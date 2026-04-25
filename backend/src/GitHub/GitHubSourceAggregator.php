<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\GitHub;

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
     * @param GraphQlSearchQueryBuilder $queryBuilder GraphQL query builder.
     * @param GitHubGraphQlClient $client GitHub GraphQL client.
     */
    public function __construct(
        private readonly GraphQlSearchQueryBuilder $queryBuilder,
        private readonly GitHubGraphQlClient $client,
    ) {
    }

    /**
     * @param SourceType $sourceType
     * @param BuildConfig $config
     * @return SourcePayload
     */
    public function aggregate(SourceType $sourceType, BuildConfig $config): SourcePayload
    {
        $items = [];
        $cursor = null;
        $hasNextPage = true;

        while ($hasNextPage) {
            $query = $this->queryBuilder->build(
                $sourceType,
                $config->organization(),
                $config->label(),
                $cursor,
            );

            $data = $this->client->runQuery($config->token(), $query);
            $search = is_array($data['search'] ?? null) ? $data['search'] : [];
            $nodes = is_array($search['nodes'] ?? null) ? $search['nodes'] : [];

            foreach ($nodes as $node) {
                if (!is_array($node) || empty($node['title'])) {
                    continue;
                }

                $items[] = AggregatedItem::fromNode($node);
            }

            $pageInfo = is_array($search['pageInfo'] ?? null) ? $search['pageInfo'] : [];
            $hasNextPage = (bool) ($pageInfo['hasNextPage'] ?? false);
            $cursor = is_string($pageInfo['endCursor'] ?? null) ? $pageInfo['endCursor'] : null;
        }

        usort(
            $items,
            static fn (AggregatedItem $left, AggregatedItem $right): int => strcmp($right->createdAt(), $left->createdAt()),
        );

        return new SourcePayload(
            $sourceType->value,
            $config->organization(),
            $config->label(),
            $config->generatedAt()->format(DATE_ATOM),
            $items,
        );
    }
}