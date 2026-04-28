<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\GitHub;

use DateInterval;
use DateTimeImmutable;
use MunicipioProjectAggregator\Backend\Config\BuildConfig;
use MunicipioProjectAggregator\Backend\Data\SprintBucket;
use MunicipioProjectAggregator\Backend\Data\SprintEntry;
use MunicipioProjectAggregator\Backend\Data\SprintPayload;
use RuntimeException;

/**
 * Aggregates current and upcoming sprint entries from a GitHub Project v2.
 */
final class GitHubProjectSprintAggregator
{
    /**
     * @param GitHubGraphQlClient $client GitHub GraphQL client.
     */
    public function __construct(private readonly GitHubGraphQlClient $client)
    {
    }

    /**
     * @param BuildConfig $config
     * @param string $organizationLogin
     * @param int $projectNumber
     * @return SprintPayload
     */
    public function aggregate(BuildConfig $config, string $organizationLogin, int $projectNumber): SprintPayload
    {
        $afterCursor = null;
        $project = null;
        $items = [];

        do {
            $response = $this->client->runQuery(
                $config->token(),
                $this->buildQuery($organizationLogin, $projectNumber, $afterCursor),
            );

            $organization = is_array($response['organization'] ?? null) ? $response['organization'] : null;
            $projectNode = is_array($organization['projectV2'] ?? null) ? $organization['projectV2'] : null;

            if ($projectNode === null) {
                throw new RuntimeException(sprintf(
                    'GitHub Project v2 %s/%d could not be read. Ensure the token has access to the project and the read:project scope.',
                    $organizationLogin,
                    $projectNumber,
                ));
            }

            $project ??= $projectNode;

            $itemConnection = is_array($projectNode['items'] ?? null) ? $projectNode['items'] : [];
            $itemNodes = is_array($itemConnection['nodes'] ?? null) ? $itemConnection['nodes'] : [];
            $pageInfo = is_array($itemConnection['pageInfo'] ?? null) ? $itemConnection['pageInfo'] : [];

            foreach ($itemNodes as $itemNode) {
                if (is_array($itemNode)) {
                    $items[] = $itemNode;
                }
            }

            $hasNextPage = ($pageInfo['hasNextPage'] ?? false) === true;
            $afterCursor = is_string($pageInfo['endCursor'] ?? null) ? $pageInfo['endCursor'] : null;
        } while ($hasNextPage && $afterCursor !== null);

        $view = $this->extractView($project);
        $iterations = $this->extractIterations($project);
        $iterationsById = [];

        foreach ($iterations as $iteration) {
            $iterationsById[$iteration['id']] = $iteration;
        }

        $currentIterationIndex = $this->resolveCurrentIterationIndex($iterations, $config->generatedAt());
        $nextIterationIndex = $this->resolveNextIterationIndex($iterations, $config->generatedAt(), $currentIterationIndex);
        $entriesByIterationId = $this->extractEntriesByIterationId($items);

        return new SprintPayload(
            'sprints',
            $config->sourceScope(),
            $config->generatedAt()->format(DATE_ATOM),
            [
                'owner' => $organizationLogin,
                'number' => $projectNumber,
                'title' => is_string($project['title'] ?? null) ? $project['title'] : sprintf('Project %d', $projectNumber),
                'url' => is_string($project['url'] ?? null) ? $project['url'] : '',
            ],
            $view,
            is_string($view['filter'] ?? null) ? $view['filter'] : '',
            $currentIterationIndex === null ? null : $this->createSprintBucket(
                'Current Sprint',
                $iterations[$currentIterationIndex],
                $entriesByIterationId[$iterations[$currentIterationIndex]['id']] ?? [],
            ),
            $nextIterationIndex === null ? null : $this->createSprintBucket(
                'Next Sprint',
                $iterations[$nextIterationIndex],
                $entriesByIterationId[$iterations[$nextIterationIndex]['id']] ?? [],
            ),
        );
    }

    /**
     * @param string $organizationLogin
     * @param int $projectNumber
     * @param string|null $afterCursor
     * @return string
     */
    private function buildQuery(string $organizationLogin, int $projectNumber, ?string $afterCursor): string
    {
        $afterClause = $afterCursor === null ? '' : sprintf(', after: "%s"', addslashes($afterCursor));

        return <<<GRAPHQL
query {
  organization(login: "{$organizationLogin}") {
    projectV2(number: {$projectNumber}) {
      title
      number
      url
      views(first: 10) {
        nodes {
          ... on ProjectV2View {
            id
            name
            number
            layout
            filter
          }
        }
      }
      fields(first: 50) {
        nodes {
          __typename
          ... on ProjectV2IterationField {
            id
            name
            configuration {
              iterations {
                id
                title
                startDate
                duration
              }
            }
          }
        }
      }
      items(first: 100{$afterClause}) {
        pageInfo {
          hasNextPage
          endCursor
        }
        nodes {
          id
          content {
            __typename
            ... on Issue {
              title
              url
              number
              state
              repository {
                nameWithOwner
              }
            }
            ... on PullRequest {
              title
              url
              number
              state
              repository {
                nameWithOwner
              }
            }
          }
          fieldValues(first: 20) {
            nodes {
              __typename
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field {
                  ... on ProjectV2SingleSelectField {
                    name
                  }
                }
              }
              ... on ProjectV2ItemFieldIterationValue {
                title
                startDate
                duration
                iterationId
                field {
                  ... on ProjectV2IterationField {
                    name
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}
GRAPHQL;
    }

    /**
     * @param array<string, mixed> $project
     * @return array<string, string|int>|null
     */
    private function extractView(array $project): ?array
    {
        $views = is_array($project['views']['nodes'] ?? null) ? $project['views']['nodes'] : [];
        $firstView = $views[0] ?? null;

        if (!is_array($firstView)) {
            return null;
        }

        return [
            'id' => is_string($firstView['id'] ?? null) ? $firstView['id'] : '',
            'name' => is_string($firstView['name'] ?? null) ? $firstView['name'] : 'Default view',
            'number' => is_int($firstView['number'] ?? null) ? $firstView['number'] : 0,
            'layout' => is_string($firstView['layout'] ?? null) ? $firstView['layout'] : '',
            'filter' => is_string($firstView['filter'] ?? null) ? trim($firstView['filter']) : '',
        ];
    }

    /**
     * @param array<string, mixed> $project
     * @return array<int, array{id: string, title: string, startDate: string, endDate: string, duration: int}>
     */
    private function extractIterations(array $project): array
    {
        $fieldNodes = is_array($project['fields']['nodes'] ?? null) ? $project['fields']['nodes'] : [];
        $iterations = [];

        foreach ($fieldNodes as $fieldNode) {
            if (!is_array($fieldNode) || ($fieldNode['__typename'] ?? null) !== 'ProjectV2IterationField') {
                continue;
            }

            $configuredIterations = is_array($fieldNode['configuration']['iterations'] ?? null)
                ? $fieldNode['configuration']['iterations']
                : [];

            foreach ($configuredIterations as $iteration) {
                if (!is_array($iteration) || !is_string($iteration['id'] ?? null) || !is_string($iteration['startDate'] ?? null)) {
                    continue;
                }

                $iterations[] = [
                    'id' => $iteration['id'],
                    'title' => is_string($iteration['title'] ?? null) ? $iteration['title'] : 'Untitled sprint',
                    'startDate' => $iteration['startDate'],
                    'endDate' => $this->calculateEndDate(
                        $iteration['startDate'],
                        is_int($iteration['duration'] ?? null) ? $iteration['duration'] : 0,
                    ),
                    'duration' => is_int($iteration['duration'] ?? null) ? $iteration['duration'] : 0,
                ];
            }

            break;
        }

        usort(
            $iterations,
            static fn (array $left, array $right): int => strcmp($left['startDate'], $right['startDate']),
        );

        return $iterations;
    }

    /**
     * @param string $startDate
     * @param int $duration
     * @return string
     */
    private function calculateEndDate(string $startDate, int $duration): string
    {
        if ($duration <= 0) {
            return $startDate;
        }

        return (new DateTimeImmutable($startDate))
            ->add(new DateInterval(sprintf('P%dD', max($duration - 1, 0))))
            ->format('Y-m-d');
    }

    /**
     * @param array<int, array{id: string, title: string, startDate: string, endDate: string, duration: int}> $iterations
     * @param DateTimeImmutable $generatedAt
     * @return int|null
     */
    private function resolveCurrentIterationIndex(array $iterations, DateTimeImmutable $generatedAt): ?int
    {
        $currentDate = $generatedAt->format('Y-m-d');

        foreach ($iterations as $index => $iteration) {
            if ($iteration['startDate'] <= $currentDate && $iteration['endDate'] >= $currentDate) {
                return $index;
            }
        }

        return null;
    }

    /**
     * @param array<int, array{id: string, title: string, startDate: string, endDate: string, duration: int}> $iterations
     * @param DateTimeImmutable $generatedAt
     * @param int|null $currentIterationIndex
     * @return int|null
     */
    private function resolveNextIterationIndex(array $iterations, DateTimeImmutable $generatedAt, ?int $currentIterationIndex): ?int
    {
        if ($currentIterationIndex !== null) {
            $nextIndex = $currentIterationIndex + 1;
            return array_key_exists($nextIndex, $iterations) ? $nextIndex : null;
        }

        $currentDate = $generatedAt->format('Y-m-d');

        foreach ($iterations as $index => $iteration) {
            if ($iteration['startDate'] > $currentDate) {
                return $index;
            }
        }

        return null;
    }

    /**
     * @param array<int, array<string, mixed>> $itemNodes
     * @return array<string, array<int, SprintEntry>>
     */
    private function extractEntriesByIterationId(array $itemNodes): array
    {
        $entriesByIterationId = [];

        foreach ($itemNodes as $itemNode) {
            $content = is_array($itemNode['content'] ?? null) ? $itemNode['content'] : null;

            if ($content === null || !is_string($content['__typename'] ?? null)) {
                continue;
            }

            $typeName = $content['__typename'];
            if ($typeName !== 'Issue' && $typeName !== 'PullRequest') {
                continue;
            }

            $fieldValues = is_array($itemNode['fieldValues']['nodes'] ?? null) ? $itemNode['fieldValues']['nodes'] : [];
            $iterationId = $this->extractIterationId($fieldValues);

            if ($iterationId === null) {
                continue;
            }

            $entriesByIterationId[$iterationId] ??= [];
            $entriesByIterationId[$iterationId][] = new SprintEntry(
                is_string($content['title'] ?? null) ? $content['title'] : 'Untitled item',
                is_string($content['url'] ?? null) ? $content['url'] : '',
                is_int($content['number'] ?? null) ? $content['number'] : 0,
                is_array($content['repository'] ?? null) && is_string($content['repository']['nameWithOwner'] ?? null)
                    ? $content['repository']['nameWithOwner']
                    : 'unknown',
                $typeName === 'PullRequest' ? 'Pull Request' : 'Issue',
                $this->normalizeState(is_string($content['state'] ?? null) ? $content['state'] : ''),
                $this->extractStatus($fieldValues),
            );
        }

        return $entriesByIterationId;
    }

    /**
     * @param array<int, array<string, mixed>> $fieldValues
     * @return string|null
     */
    private function extractIterationId(array $fieldValues): ?string
    {
        foreach ($fieldValues as $fieldValue) {
            if (!is_array($fieldValue) || ($fieldValue['__typename'] ?? null) !== 'ProjectV2ItemFieldIterationValue') {
                continue;
            }

            return is_string($fieldValue['iterationId'] ?? null) ? $fieldValue['iterationId'] : null;
        }

        return null;
    }

    /**
     * @param array<int, array<string, mixed>> $fieldValues
     * @return string
     */
    private function extractStatus(array $fieldValues): string
    {
        $fallbackStatus = '';

        foreach ($fieldValues as $fieldValue) {
            if (!is_array($fieldValue) || ($fieldValue['__typename'] ?? null) !== 'ProjectV2ItemFieldSingleSelectValue') {
                continue;
            }

            $name = is_string($fieldValue['name'] ?? null) ? trim($fieldValue['name']) : '';
            $fieldName = is_array($fieldValue['field'] ?? null) && is_string($fieldValue['field']['name'] ?? null)
                ? trim($fieldValue['field']['name'])
                : '';

            if ($name === '') {
                continue;
            }

            if (strcasecmp($fieldName, 'Status') === 0) {
                return $name;
            }

            if ($fallbackStatus === '') {
                $fallbackStatus = $name;
            }
        }

        return $fallbackStatus;
    }

    /**
     * @param string $state
     * @return string
     */
    private function normalizeState(string $state): string
    {
        return match (strtoupper($state)) {
            'OPEN' => 'Open',
            'CLOSED' => 'Closed',
            'MERGED' => 'Merged',
            default => $state,
        };
    }

    /**
     * @param string $label
     * @param array{id: string, title: string, startDate: string, endDate: string, duration: int} $iteration
     * @param array<int, SprintEntry> $entries
     * @return SprintBucket
     */
    private function createSprintBucket(string $label, array $iteration, array $entries): SprintBucket
    {
        usort(
            $entries,
            static fn (SprintEntry $left, SprintEntry $right): int => [$left->repository(), $left->status(), $left->title()]
                <=> [$right->repository(), $right->status(), $right->title()],
        );

        return new SprintBucket(
            $label,
            $iteration['title'],
            $iteration['startDate'],
            $iteration['endDate'],
            $entries,
        );
    }
}