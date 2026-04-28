<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\GitHub;

/**
 * Builds GitHub GraphQL search queries.
 */
final class GraphQlSearchQueryBuilder
{
    private const PAGE_SIZE = 100;

    /**
     * Build a paginated GraphQL search query.
     *
     * @param SourceType $sourceType Source type to query.
     * @param string $owner GitHub repository owner.
     * @param string $repositoryName GitHub repository name.
     * @param string|null $afterCursor GraphQL pagination cursor.
     * @return string
     */
    public function build(SourceType $sourceType, string $owner, string $repositoryName, ?string $afterCursor): string
    {
        $queryString = sprintf(
            'repo:%s/%s %s is:open sort:created-desc',
            $owner,
            $repositoryName,
            $sourceType->searchQualifier(),
        );

        $afterClause = $afterCursor !== null
            ? sprintf(', after: "%s"', addslashes($afterCursor))
            : '';

        return sprintf(
            '{ search(query: "%s", type: ISSUE, first: %d%s) { pageInfo { hasNextPage endCursor } nodes { %s } } }',
            addslashes($queryString),
            self::PAGE_SIZE,
            $afterClause,
            $sourceType->fragment(),
        );
    }
}