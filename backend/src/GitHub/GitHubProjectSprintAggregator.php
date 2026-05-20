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
 * Aggregates GitHub Project v2 planning data for backlog and sprint views.
 */
final class GitHubProjectSprintAggregator
{
    private const EMPTY_ITERATION = [
        'id' => null,
        'title' => null,
    ];

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
        $fieldMetadata = $this->extractFieldMetadata($project, $config->generatedAt());
        $iterations = $fieldMetadata['iteration']['iterations'] ?? [];
        $currentIterationIndex = $this->resolveCurrentIterationIndex($iterations, $config->generatedAt());
        $nextIterationIndex = $this->resolveNextIterationIndex($iterations, $config->generatedAt(), $currentIterationIndex);
        $completedIterationIndex = $this->resolveCompletedIterationIndex($iterations, $config->generatedAt(), $currentIterationIndex);
        $entries = $this->extractEntries($items);
        $sprintBuckets = $this->createSprintBuckets(
            $iterations,
            $entries,
            $currentIterationIndex,
            $nextIterationIndex,
            $completedIterationIndex,
        );

        return new SprintPayload(
            'sprints',
            $config->sourceScope(),
            $config->generatedAt()->format(DATE_ATOM),
            [
                'id' => is_string($project['id'] ?? null) ? $project['id'] : '',
                'owner' => $organizationLogin,
                'number' => $projectNumber,
                'title' => is_string($project['title'] ?? null) ? $project['title'] : sprintf('Project %d', $projectNumber),
                'url' => is_string($project['url'] ?? null) ? $project['url'] : '',
            ],
            $view,
            is_string($view['filter'] ?? null) ? $view['filter'] : '',
            $fieldMetadata,
            $this->createBacklogBucket($entries),
            $sprintBuckets,
            $completedIterationIndex === null ? null : $sprintBuckets[$completedIterationIndex],
            $currentIterationIndex === null ? null : $sprintBuckets[$currentIterationIndex],
            $nextIterationIndex === null ? null : $sprintBuckets[$nextIterationIndex],
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
      id
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
          ... on ProjectV2SingleSelectField {
            id
            name
            options {
              id
              name
              color
              description
            }
          }
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
          updatedAt
          content {
            __typename
            ... on DraftIssue {
              id
              title
            }
            ... on Issue {
              id
              title
              body
              url
              number
              state
              updatedAt
              repository {
                nameWithOwner
              }
              assignees(first: 20) {
                nodes {
                  login
                  avatarUrl
                  url
                }
              }
              labels(first: 20) {
                nodes {
                  id
                  name
                  color
                  description
                }
              }
              milestone {
                title
                url
                dueOn
              }
            }
            ... on PullRequest {
              id
              title
              body
              url
              number
              state
              updatedAt
              repository {
                nameWithOwner
              }
              assignees(first: 20) {
                nodes {
                  login
                  avatarUrl
                  url
                }
              }
              labels(first: 20) {
                nodes {
                  id
                  name
                  color
                  description
                }
              }
              milestone {
                title
                url
                dueOn
              }
            }
          }
          fieldValues(first: 20) {
            nodes {
              __typename
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                optionId
                field {
                  ... on ProjectV2SingleSelectField {
                    id
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
                    id
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
     * @param DateTimeImmutable $generatedAt
     * @return array<string, mixed>
     */
    private function extractFieldMetadata(array $project, DateTimeImmutable $generatedAt): array
    {
        $fieldNodes = is_array($project['fields']['nodes'] ?? null) ? $project['fields']['nodes'] : [];
        $statusField = [
            'id' => '',
            'name' => 'Status',
            'options' => [],
        ];
        $iterationField = [
            'id' => '',
            'name' => 'Iteration',
            'iterations' => [],
            'currentIterationId' => null,
            'nextIterationId' => null,
            'completedIterationId' => null,
        ];

        foreach ($fieldNodes as $fieldNode) {
            if (!is_array($fieldNode) || !is_string($fieldNode['__typename'] ?? null)) {
                continue;
            }

            if ($fieldNode['__typename'] === 'ProjectV2SingleSelectField') {
                $fieldName = is_string($fieldNode['name'] ?? null) ? trim($fieldNode['name']) : '';
                if (strcasecmp($fieldName, 'Status') !== 0) {
                    continue;
                }

                $statusField = [
                    'id' => is_string($fieldNode['id'] ?? null) ? $fieldNode['id'] : '',
                    'name' => $fieldName !== '' ? $fieldName : 'Status',
                    'options' => $this->extractStatusOptions($fieldNode['options'] ?? []),
                ];

                continue;
            }

            if ($fieldNode['__typename'] !== 'ProjectV2IterationField') {
                continue;
            }

            $iterations = $this->extractIterations($fieldNode['configuration']['iterations'] ?? []);
            $currentIterationIndex = $this->resolveCurrentIterationIndex($iterations, $generatedAt);
            $nextIterationIndex = $this->resolveNextIterationIndex($iterations, $generatedAt, $currentIterationIndex);
            $completedIterationIndex = $this->resolveCompletedIterationIndex($iterations, $generatedAt, $currentIterationIndex);

            $iterationField = [
                'id' => is_string($fieldNode['id'] ?? null) ? $fieldNode['id'] : '',
                'name' => is_string($fieldNode['name'] ?? null) && trim($fieldNode['name']) !== '' ? trim($fieldNode['name']) : 'Iteration',
                'iterations' => $iterations,
                'currentIterationId' => $currentIterationIndex === null ? null : $iterations[$currentIterationIndex]['id'],
                'nextIterationId' => $nextIterationIndex === null ? null : $iterations[$nextIterationIndex]['id'],
                'completedIterationId' => $completedIterationIndex === null ? null : $iterations[$completedIterationIndex]['id'],
            ];
        }

        return [
            'status' => $statusField,
            'iteration' => $iterationField,
        ];
    }

    /**
     * @param mixed $options
     * @return array<int, array<string, string>>
     */
    private function extractStatusOptions(mixed $options): array
    {
        if (!is_array($options)) {
            return [];
        }

        $result = [];

        foreach ($options as $option) {
            if (!is_array($option) || !is_string($option['id'] ?? null) || !is_string($option['name'] ?? null)) {
                continue;
            }

            $result[] = [
                'id' => $option['id'],
                'name' => $option['name'],
                'color' => is_string($option['color'] ?? null) ? $option['color'] : '',
                'description' => is_string($option['description'] ?? null) ? $option['description'] : '',
            ];
        }

        return $result;
    }

    /**
     * @param mixed $configuredIterations
     * @return array<int, array{id: string, title: string, startDate: string, endDate: string, duration: int}>
     */
    private function extractIterations(mixed $configuredIterations): array
    {
        if (!is_array($configuredIterations)) {
            return [];
        }

        $iterations = [];

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
     * @param array<int, array{id: string, title: string, startDate: string, endDate: string, duration: int}> $iterations
     * @param DateTimeImmutable $generatedAt
     * @param int|null $currentIterationIndex
     * @return int|null
     */
    private function resolveCompletedIterationIndex(array $iterations, DateTimeImmutable $generatedAt, ?int $currentIterationIndex): ?int
    {
        if ($currentIterationIndex !== null) {
            $completedIndex = $currentIterationIndex - 1;
            return $completedIndex >= 0 ? $completedIndex : null;
        }

        $currentDate = $generatedAt->format('Y-m-d');
        $lastPastIndex = null;

        foreach ($iterations as $index => $iteration) {
            if ($iteration['endDate'] < $currentDate) {
                $lastPastIndex = $index;
            }
        }

        return $lastPastIndex;
    }

    /**
     * @param array<int, array<string, mixed>> $itemNodes
     * @return array<int, SprintEntry>
     */
    private function extractEntries(array $itemNodes): array
    {
        $entries = [];

        foreach ($itemNodes as $itemNode) {
            $content = is_array($itemNode['content'] ?? null) ? $itemNode['content'] : null;

            if ($content === null || !is_string($content['__typename'] ?? null)) {
                continue;
            }

            $typeName = $content['__typename'];
            if ($typeName !== 'Issue' && $typeName !== 'PullRequest' && $typeName !== 'DraftIssue') {
                continue;
            }

            $fieldValues = is_array($itemNode['fieldValues']['nodes'] ?? null) ? $itemNode['fieldValues']['nodes'] : [];
            $iteration = $this->extractIteration($fieldValues);
            $status = $this->extractStatus($fieldValues);

            $entries[] = $this->createSprintEntry(
                is_string($itemNode['id'] ?? null) ? $itemNode['id'] : '',
                is_string($itemNode['updatedAt'] ?? null) ? $itemNode['updatedAt'] : '',
                $content,
                $iteration,
                $status,
            );
        }

        return $entries;
    }

    /**
     * @param array<int, SprintEntry> $entries
     * @param string $iterationId
     * @return array<int, SprintEntry>
     */
    private function filterEntriesByIterationId(array $entries, string $iterationId): array
    {
        return array_values(array_filter(
            $entries,
            static fn (SprintEntry $entry): bool => ($entry->toArray()['iterationId'] ?? null) === $iterationId,
        ));
    }

    /**
     * @param array<int, SprintEntry> $entries
     * @return SprintBucket
     */
    private function createBacklogBucket(array $entries): SprintBucket
    {
        $backlogEntries = array_values(array_filter(
            $entries,
            static fn (SprintEntry $entry): bool => ($entry->toArray()['iterationId'] ?? null) === null,
        ));

        usort(
            $backlogEntries,
            static fn (SprintEntry $left, SprintEntry $right): int => [$left->status(), $left->repository(), $left->title()]
                <=> [$right->status(), $right->repository(), $right->title()],
        );

        return new SprintBucket(
            'Backlog',
            'Backlog',
            null,
            null,
            null,
            $backlogEntries,
        );
    }

    /**
     * @param string $label
     * @param array{id: string, title: string, startDate: string, endDate: string, duration: int} $iteration
     * @param array<int, SprintEntry> $entries
     * @return SprintBucket
     */
    private function createIterationBucket(string $label, array $iteration, array $entries): SprintBucket
    {
        usort(
            $entries,
            static fn (SprintEntry $left, SprintEntry $right): int => [$left->repository(), $left->status(), $left->title()]
                <=> [$right->repository(), $right->status(), $right->title()],
        );

        return new SprintBucket(
            $label,
            $iteration['title'],
            $iteration['id'],
            $iteration['startDate'],
            $iteration['endDate'],
            $entries,
        );
    }

    /**
     * @param array<int, array{id: string, title: string, startDate: string, endDate: string, duration: int}> $iterations
     * @param array<int, SprintEntry> $entries
     * @param int|null $currentIterationIndex
     * @param int|null $nextIterationIndex
     * @param int|null $completedIterationIndex
     * @return array<int, SprintBucket>
     */
    private function createSprintBuckets(
        array $iterations,
        array $entries,
        ?int $currentIterationIndex,
        ?int $nextIterationIndex,
        ?int $completedIterationIndex,
    ): array {
        $buckets = [];

        foreach ($iterations as $index => $iteration) {
            $label = 'Sprint';

            if ($completedIterationIndex !== null && $index === $completedIterationIndex) {
                $label = 'Completed Sprint';
            } elseif ($currentIterationIndex !== null && $index === $currentIterationIndex) {
                $label = 'Current Sprint';
            } elseif ($nextIterationIndex !== null && $index === $nextIterationIndex) {
                $label = 'Next Sprint';
            }

            $buckets[] = $this->createIterationBucket(
                $label,
                $iteration,
                $this->filterEntriesByIterationId($entries, $iteration['id']),
            );
        }

        return $buckets;
    }

    /**
     * @param array<int, array<string, mixed>> $fieldValues
     * @return array{id: string|null, title: string|null}
     */
    private function extractIteration(array $fieldValues): array
    {
        foreach ($fieldValues as $fieldValue) {
            if (!is_array($fieldValue) || ($fieldValue['__typename'] ?? null) !== 'ProjectV2ItemFieldIterationValue') {
                continue;
            }

            return [
                'id' => is_string($fieldValue['iterationId'] ?? null) ? $fieldValue['iterationId'] : null,
                'title' => is_string($fieldValue['title'] ?? null) ? $fieldValue['title'] : null,
            ];
        }

        return self::EMPTY_ITERATION;
    }

    /**
     * @param array<int, array<string, mixed>> $fieldValues
     * @return array{name: string, optionId: string}
     */
    private function extractStatus(array $fieldValues): array
    {
        $fallbackStatus = '';
        $fallbackOptionId = '';

        foreach ($fieldValues as $fieldValue) {
            if (!is_array($fieldValue) || ($fieldValue['__typename'] ?? null) !== 'ProjectV2ItemFieldSingleSelectValue') {
                continue;
            }

            $name = is_string($fieldValue['name'] ?? null) ? trim($fieldValue['name']) : '';
            $optionId = is_string($fieldValue['optionId'] ?? null) ? $fieldValue['optionId'] : '';
            $fieldName = is_array($fieldValue['field'] ?? null) && is_string($fieldValue['field']['name'] ?? null)
                ? trim($fieldValue['field']['name'])
                : '';

            if ($name === '') {
                continue;
            }

            if (strcasecmp($fieldName, 'Status') === 0) {
                return [
                    'name' => $name,
                    'optionId' => $optionId,
                ];
            }

            if ($fallbackStatus === '') {
                $fallbackStatus = $name;
                $fallbackOptionId = $optionId;
            }
        }

        return [
            'name' => $fallbackStatus,
            'optionId' => $fallbackOptionId,
        ];
    }

    /**
     * @param string $projectItemId
     * @param string $projectItemUpdatedAt
     * @param array<string, mixed> $content
     * @param array{id: string|null, title: string|null} $iteration
     * @param array{name: string, optionId: string} $status
     * @return SprintEntry
     */
    private function createSprintEntry(
        string $projectItemId,
        string $projectItemUpdatedAt,
        array $content,
        array $iteration,
        array $status,
    ): SprintEntry {
        $typeName = is_string($content['__typename'] ?? null) ? $content['__typename'] : 'DraftIssue';

        if ($typeName === 'DraftIssue') {
            return new SprintEntry(
                $projectItemId,
                is_string($content['id'] ?? null) ? $content['id'] : '',
                is_string($content['title'] ?? null) ? $content['title'] : 'Untitled draft issue',
                '',
                0,
                '',
                'Draft Issue',
                'DRAFT',
                $status['name'],
                $status['optionId'],
                $iteration['id'],
                $iteration['title'],
                $projectItemUpdatedAt,
                '',
                [],
                [],
                null,
            );
        }

        return new SprintEntry(
            $projectItemId,
            is_string($content['id'] ?? null) ? $content['id'] : '',
            is_string($content['title'] ?? null) ? $content['title'] : 'Untitled item',
            is_string($content['url'] ?? null) ? $content['url'] : '',
            is_int($content['number'] ?? null) ? $content['number'] : 0,
            is_array($content['repository'] ?? null) && is_string($content['repository']['nameWithOwner'] ?? null)
                ? $content['repository']['nameWithOwner']
                : 'unknown',
            $typeName === 'PullRequest' ? 'Pull Request' : 'Issue',
            $this->normalizeState($content['state'] ?? null),
            $status['name'],
            $status['optionId'],
            $iteration['id'],
            $iteration['title'],
            is_string($content['updatedAt'] ?? null) && $content['updatedAt'] !== '' ? $content['updatedAt'] : $projectItemUpdatedAt,
            is_string($content['body'] ?? null) ? trim($content['body']) : '',
            $this->extractLabels($content['labels']['nodes'] ?? []),
            $this->extractUsers($content['assignees']['nodes'] ?? []),
            $this->extractMilestone($content['milestone'] ?? null),
        );
    }

    /**
     * @param mixed $users
     * @return array<int, array<string, string>>
     */
    private function extractUsers(mixed $users): array
    {
        if (!is_array($users)) {
            return [];
        }

        $result = [];

        foreach ($users as $user) {
            if (!is_array($user) || !is_string($user['login'] ?? null)) {
                continue;
            }

            $result[] = [
                'login' => $user['login'],
                'avatarUrl' => is_string($user['avatarUrl'] ?? null) ? $user['avatarUrl'] : '',
                'url' => is_string($user['url'] ?? null) ? $user['url'] : '',
            ];
        }

        return $result;
    }

    /**
     * @param mixed $labels
     * @return array<int, array<string, string>>
     */
    private function extractLabels(mixed $labels): array
    {
        if (!is_array($labels)) {
            return [];
        }

        $result = [];

        foreach ($labels as $label) {
            if (!is_array($label) || !is_string($label['name'] ?? null)) {
                continue;
            }

            $result[] = [
                'id' => is_string($label['id'] ?? null) ? $label['id'] : '',
                'name' => $label['name'],
                'color' => is_string($label['color'] ?? null) ? $label['color'] : '',
                'description' => is_string($label['description'] ?? null) ? $label['description'] : '',
            ];
        }

        return $result;
    }

    /**
     * @param mixed $milestone
     * @return array<string, string|null>|null
     */
    private function extractMilestone(mixed $milestone): ?array
    {
        if (!is_array($milestone) || !is_string($milestone['title'] ?? null)) {
            return null;
        }

        return [
            'title' => $milestone['title'],
            'url' => is_string($milestone['url'] ?? null) ? $milestone['url'] : null,
            'dueOn' => is_string($milestone['dueOn'] ?? null) ? $milestone['dueOn'] : null,
        ];
    }

    /**
     * Normalizes string state values to uppercase and returns an empty string for unknown values.
     *
     * @param mixed $state
     * @return string
     */
    private function normalizeState(mixed $state): string
    {
        return is_string($state) ? strtoupper($state) : '';
    }
}
