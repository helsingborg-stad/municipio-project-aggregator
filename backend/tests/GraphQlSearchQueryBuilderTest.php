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

        $query = $builder->build(SourceType::Issues, 'helsingborg-stad', 'styleguide', null);

        self::assertStringContainsString('repo:helsingborg-stad/styleguide is:issue is:open sort:created-desc', $query);
        self::assertStringContainsString('... on Issue', $query);
        self::assertStringContainsString('subIssuesSummary', $query);
        self::assertStringNotContainsString('after:', $query);
    }

    /**
     * @return void
     */
    public function testBuildCreatesPullRequestQueryWithCursor(): void
    {
        $builder = new GraphQlSearchQueryBuilder();

        $query = $builder->build(SourceType::PullRequests, 'helsingborg-stad', 'styleguide', 'cursor-123');

        self::assertStringContainsString('repo:helsingborg-stad/styleguide is:pr is:open sort:created-desc', $query);
        self::assertStringContainsString('after: "cursor-123"', $query);
        self::assertStringContainsString('... on PullRequest', $query);
    }
}