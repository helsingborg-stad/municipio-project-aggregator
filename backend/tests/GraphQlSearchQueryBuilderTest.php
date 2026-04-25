<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Tests;

use MunicipioProjectAggregator\Backend\GitHub\GraphQlSearchQueryBuilder;
use MunicipioProjectAggregator\Backend\GitHub\SourceType;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(GraphQlSearchQueryBuilder::class)]
final class GraphQlSearchQueryBuilderTest extends TestCase
{
    /**
     * @return void
     */
    public function testBuildCreatesIssueQueryWithoutCursor(): void
    {
        $builder = new GraphQlSearchQueryBuilder();

        $query = $builder->build(SourceType::Issues, 'helsingborg-stad', 'municipio', null);

        self::assertStringContainsString('org:helsingborg-stad label:municipio is:issue is:open', $query);
        self::assertStringContainsString('... on Issue', $query);
        self::assertStringNotContainsString('after:', $query);
    }

    /**
     * @return void
     */
    public function testBuildCreatesPullRequestQueryWithCursor(): void
    {
        $builder = new GraphQlSearchQueryBuilder();

        $query = $builder->build(SourceType::PullRequests, 'helsingborg-stad', 'municipio', 'cursor-123');

        self::assertStringContainsString('org:helsingborg-stad label:municipio is:pr is:open', $query);
        self::assertStringContainsString('after: "cursor-123"', $query);
        self::assertStringContainsString('... on PullRequest', $query);
    }
}