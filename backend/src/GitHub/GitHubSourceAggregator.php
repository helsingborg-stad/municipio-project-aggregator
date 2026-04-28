<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\GitHub;

use DateTimeImmutable;
use Exception;
use MunicipioProjectAggregator\Backend\Config\BuildConfig;
use MunicipioProjectAggregator\Backend\Contracts\SourceAggregatorInterface;
use MunicipioProjectAggregator\Backend\Data\AggregatedItem;
use MunicipioProjectAggregator\Backend\Data\SourcePayload;

/**
 * Aggregates paginated GitHub search results for one source type.
 */
final class GitHubSourceAggregator implements SourceAggregatorInterface
{
    /**
     * @param GitHubRestClient $client GitHub REST client.
     */
    public function __construct(
        private readonly GitHubRestClient $restClient,
        private readonly GitHubGraphQlClient $graphQlClient,
        private readonly GraphQlSearchQueryBuilder $queryBuilder,
    ) {
    }

    /**
     * @param SourceType $sourceType
     * @param BuildConfig $config
     * @return SourcePayload
     */
    public function aggregate(SourceType $sourceType, BuildConfig $config): SourcePayload
    {
        $itemsByUrl = [];
        $repositories = $this->restClient->listRepositoriesByTopics($config->topics(), $config->token());
        $oldestIncludedCreatedAt = $config->oldestIncludedCreatedAt();

        foreach ($repositories as $repository) {
            foreach ($this->listGraphQlItems($sourceType, $repository->owner(), $repository->name(), $config->token(), $oldestIncludedCreatedAt) as $itemNode) {
                $item = AggregatedItem::fromNode($itemNode);
                $itemData = $item->toArray();

                if ($itemData['url'] === '') {
                    continue;
                }

                $itemsByUrl[$itemData['url']] = $item;
            }
        }

        $items = array_values($itemsByUrl);

        usort(
            $items,
            static fn (AggregatedItem $left, AggregatedItem $right): int => strcmp($right->createdAt(), $left->createdAt()),
        );

        return new SourcePayload(
            $sourceType->value,
            $config->sourceScope(),
            $config->topics(),
            $config->generatedAt()->format(DATE_ATOM),
            $repositories,
            $items,
        );
    }

    /**
     * @param array<string, mixed> $itemData
     * @param DateTimeImmutable $oldestIncludedCreatedAt
     * @return bool
     */
    private function wasCreatedWithinWindow(array $itemData, DateTimeImmutable $oldestIncludedCreatedAt): bool
    {
        $createdAt = $itemData['created_at'] ?? null;

        if (!is_string($createdAt) || $createdAt === '') {
            return false;
        }

        try {
            return new DateTimeImmutable($createdAt) >= $oldestIncludedCreatedAt;
        } catch (Exception) {
            return false;
        }
    }

    /**
     * @param SourceType $sourceType
     * @param string $owner
     * @param string $repositoryName
     * @param string $token
     * @param DateTimeImmutable $oldestIncludedCreatedAt
     * @return array<int, array<string, mixed>>
     */
    private function listGraphQlItems(
        SourceType $sourceType,
        string $owner,
        string $repositoryName,
        string $token,
        DateTimeImmutable $oldestIncludedCreatedAt,
    ): array {
        $items = [];
        $afterCursor = null;

        do {
            $response = $this->graphQlClient->runQuery(
                $token,
                $this->queryBuilder->build($sourceType, $owner, $repositoryName, $afterCursor),
            );

            $search = is_array($response['search'] ?? null) ? $response['search'] : [];
            $nodes = is_array($search['nodes'] ?? null) ? $search['nodes'] : [];
            $pageInfo = is_array($search['pageInfo'] ?? null) ? $search['pageInfo'] : [];
            $reachedLookbackBoundary = false;

            foreach ($nodes as $node) {
                if (!is_array($node) || empty($node['title']) || empty($node['url']) || empty($node['number'])) {
                    continue;
                }

                if (!$this->wasCreatedWithinWindow(['created_at' => $node['createdAt'] ?? null], $oldestIncludedCreatedAt)) {
                    $reachedLookbackBoundary = true;
                    break;
                }

                $items[] = $node;
            }

            if ($reachedLookbackBoundary) {
                break;
            }

            $hasNextPage = ($pageInfo['hasNextPage'] ?? false) === true;
            $afterCursor = is_string($pageInfo['endCursor'] ?? null) ? $pageInfo['endCursor'] : null;
        } while ($hasNextPage && $afterCursor !== null);

        return $items;
    }
}
