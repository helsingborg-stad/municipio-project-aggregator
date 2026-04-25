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
     * @param string $organization GitHub organization name.
        * @param string $label Label to search for.
     * @param string|null $afterCursor GraphQL pagination cursor.
     * @return string
     */
    public function build(SourceType $sourceType, string $organization, string $label, ?string $afterCursor): string
    {
        $queryString = sprintf(
            'org:%s label:%s %s is:open',
            $organization,
            $label,
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