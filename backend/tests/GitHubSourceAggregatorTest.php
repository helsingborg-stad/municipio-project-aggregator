<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Tests;

use DateTimeImmutable;
use MunicipioProjectAggregator\Backend\Config\BuildConfig;
use MunicipioProjectAggregator\Backend\Contracts\HttpClientInterface;
use MunicipioProjectAggregator\Backend\GitHub\GitHubGraphQlClient;
use MunicipioProjectAggregator\Backend\GitHub\GitHubRestClient;
use MunicipioProjectAggregator\Backend\GitHub\GitHubSourceAggregator;
use MunicipioProjectAggregator\Backend\GitHub\GraphQlSearchQueryBuilder;
use MunicipioProjectAggregator\Backend\GitHub\SourceType;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(GitHubSourceAggregator::class)]
final class GitHubSourceAggregatorTest extends TestCase
{
    /**
     * @return void
     */
    public function testAggregateCollectsItemsFromRepositoriesWithTrackedTopics(): void
    {
        $aggregator = new GitHubSourceAggregator(
            new GitHubRestClient($this->createHttpClient()),
            new GitHubGraphQlClient($this->createHttpClient()),
            new GraphQlSearchQueryBuilder(),
        );

        $payload = $aggregator->aggregate(
            SourceType::PullRequests,
            new BuildConfig(
                'GitHub',
                ['municipio-se', 'getmunicipio'],
                'token',
                '/tmp',
                new DateTimeImmutable('2026-04-25T10:00:00+00:00'),
                365,
            ),
        );

        $data = $payload->toArray();

        self::assertSame(['municipio-se', 'getmunicipio'], $data['topics']);
        self::assertSame(2, $data['count']);
        self::assertCount(3, $data['repositories']);
        self::assertSame('municipio-se/municipio-site', $data['repositories'][0]['fullName']);
        self::assertSame('Municipio site plugin', $data['repositories'][0]['description']);
        self::assertSame('https://github.com/municipio-se/municipio-site', $data['repositories'][0]['url']);
        self::assertSame('GetMunicipio only PR', $data['items'][0]['title']);
        self::assertSame('Shared PR', $data['items'][1]['title']);
        self::assertSame('helsingborg-stad/styleguide', $data['items'][0]['repository']);
        self::assertSame('octocat', $data['items'][0]['author']['login']);
        self::assertSame('GitHub', $data['items'][0]['author']['company']);
        self::assertSame('hubot', $data['items'][0]['assignees'][0]['login']);
        self::assertSame('Q2', $data['items'][0]['milestone']['title']);
        self::assertSame('Feature', $data['items'][0]['type']);
        self::assertSame(3, $data['items'][0]['subIssues']['total']);
        self::assertSame(['https://github.com/helsingborg-stad/styleguide/issues/8'], $data['items'][0]['subIssueUrls']);
        self::assertSame(1, $data['items'][0]['relationshipSummary']['blockedBy']);
        self::assertSame(1, $data['items'][0]['relationshipSummary']['linked']);
        self::assertSame('Roadmap card', $data['items'][0]['relationships'][0]['title']);
    }

    /**
     * @return void
     */
    public function testAggregateExcludesItemsOlderThanConfiguredLookbackWindow(): void
    {
        $aggregator = new GitHubSourceAggregator(
            new GitHubRestClient($this->createHttpClient()),
            new GitHubGraphQlClient($this->createHttpClient()),
            new GraphQlSearchQueryBuilder(),
        );

        $payload = $aggregator->aggregate(
            SourceType::PullRequests,
            new BuildConfig(
                'GitHub',
                ['municipio-se', 'getmunicipio'],
                'token',
                '/tmp',
                new DateTimeImmutable('2026-04-25T10:00:00+00:00'),
                365,
            ),
        );

        $data = $payload->toArray();

        self::assertSame(2, $data['count']);
        self::assertSame(
            ['GetMunicipio only PR', 'Shared PR'],
            array_column($data['items'], 'title'),
        );
    }

    /**
     * @return void
     */
    public function testAggregateAllowsConfiguringALongerLookbackWindow(): void
    {
        $aggregator = new GitHubSourceAggregator(
            new GitHubRestClient($this->createHttpClient()),
            new GitHubGraphQlClient($this->createHttpClient()),
            new GraphQlSearchQueryBuilder(),
        );

        $payload = $aggregator->aggregate(
            SourceType::PullRequests,
            new BuildConfig(
                'GitHub',
                ['municipio-se', 'getmunicipio'],
                'token',
                '/tmp',
                new DateTimeImmutable('2026-04-25T10:00:00+00:00'),
                800,
            ),
        );

        $data = $payload->toArray();

        self::assertSame(3, $data['count']);
        self::assertSame(
            ['GetMunicipio only PR', 'Shared PR', 'Obsolete PR'],
            array_column($data['items'], 'title'),
        );
    }

    /**
     * @return void
     */
    public function testAggregateContinuesWhenAuthorProfileIsMissing(): void
    {
        $aggregator = new GitHubSourceAggregator(
            new GitHubRestClient($this->createHttpClientWithMissingAuthorProfile()),
            new GitHubGraphQlClient($this->createHttpClientWithMissingAuthorProfile()),
            new GraphQlSearchQueryBuilder(),
        );

        $payload = $aggregator->aggregate(
            SourceType::PullRequests,
            new BuildConfig(
                'GitHub',
                ['getmunicipio'],
                'token',
                '/tmp',
                new DateTimeImmutable('2026-04-25T10:00:00+00:00'),
                365,
            ),
        );

        $data = $payload->toArray();

        self::assertSame(1, $data['count']);
        self::assertSame('ghost-user', $data['items'][0]['author']['login']);
        self::assertSame('', $data['items'][0]['author']['company']);
    }

    /**
     * @return HttpClientInterface
     */
    private function createHttpClient(): HttpClientInterface
    {
        return new class () implements HttpClientInterface {
            /**
             * @param string $url
             * @param array<string, string> $headers
             * @return array<mixed>
             */
            public function getJson(string $url, array $headers): array
            {
                if (str_contains($url, '/search/repositories')) {
                    if (str_contains($url, 'topic:municipio-se')) {
                        return [
                            'items' => [
                                [
                                    'name' => 'municipio-site',
                                    'owner' => ['login' => 'municipio-se'],
                                    'description' => 'Municipio site plugin',
                                    'html_url' => 'https://github.com/municipio-se/municipio-site',
                                ],
                            ],
                        ];
                    }

                    if (str_contains($url, 'topic:getmunicipio')) {
                        return [
                            'items' => [
                                [
                                    'name' => 'styleguide',
                                    'owner' => ['login' => 'helsingborg-stad'],
                                    'description' => 'Shared Municipio components',
                                    'html_url' => 'https://github.com/helsingborg-stad/styleguide',
                                ],
                                [
                                    'name' => 'styleguide-blocks',
                                    'owner' => ['login' => 'helsingborg-stad'],
                                    'description' => 'Block collection',
                                    'html_url' => 'https://github.com/helsingborg-stad/styleguide-blocks',
                                ],
                            ],
                        ];
                    }
                }

                return [];
            }

            /**
             * @param string $url
             * @param array<string, string> $headers
             * @param array<string, mixed> $body
             * @return array<string, mixed>
             */
            public function postJson(string $url, array $headers, array $body): array
            {
                $query = (string) ($body['query'] ?? '');

                if (str_contains($query, 'repo:municipio-se/municipio-site')) {
                    return [
                        'data' => [
                            'search' => [
                                'pageInfo' => ['hasNextPage' => false, 'endCursor' => null],
                                'nodes' => [],
                            ],
                        ],
                    ];
                }

                if (str_contains($query, 'repo:helsingborg-stad/styleguide ') && !str_contains($query, 'after:')) {
                    return [
                        'data' => [
                            'search' => [
                                'pageInfo' => ['hasNextPage' => false, 'endCursor' => null],
                                'nodes' => [
                                    $this->createPullRequestNode(
                                        title: 'GetMunicipio only PR',
                                        url: 'https://github.com/helsingborg-stad/styleguide/pull/2',
                                        number: 2,
                                        createdAt: '2026-04-25T09:00:00Z',
                                        authorLogin: 'octocat',
                                        authorCompany: 'GitHub',
                                        milestoneTitle: 'Q2',
                                        typeName: 'Feature',
                                        subIssueTotal: 3,
                                        subIssueUrl: 'https://github.com/helsingborg-stad/styleguide/issues/8',
                                        blockedBy: 1,
                                        linkedTitle: 'Roadmap card',
                                    ),
                                    $this->createPullRequestNode(
                                        title: 'Shared PR',
                                        url: 'https://github.com/helsingborg-stad/styleguide/pull/1',
                                        number: 1,
                                        createdAt: '2026-04-24T09:00:00Z',
                                        authorLogin: 'monalisa',
                                        authorCompany: 'Octo Arts',
                                    ),
                                ],
                            ],
                        ],
                    ];
                }

                if (str_contains($query, 'repo:helsingborg-stad/styleguide-blocks') && !str_contains($query, 'after:')) {
                    return [
                        'data' => [
                            'search' => [
                                'pageInfo' => ['hasNextPage' => false, 'endCursor' => null],
                                'nodes' => [
                                    $this->createPullRequestNode(
                                        title: 'Obsolete PR',
                                        url: 'https://github.com/helsingborg-stad/styleguide-blocks/pull/3',
                                        number: 3,
                                        createdAt: '2025-04-24T09:00:00Z',
                                        authorLogin: 'oldtimer',
                                        authorCompany: 'Legacy Systems',
                                    ),
                                ],
                            ],
                        ],
                    ];
                }

                return ['data' => ['search' => ['pageInfo' => ['hasNextPage' => false, 'endCursor' => null], 'nodes' => []]]];
            }

            /**
             * @param string $title
             * @param string $url
             * @param int $number
             * @param string $createdAt
             * @param string $authorLogin
             * @param string $authorCompany
             * @param string|null $milestoneTitle
             * @param string|null $typeName
             * @param int $subIssueTotal
             * @param string|null $subIssueUrl
             * @param int $blockedBy
             * @param string|null $linkedTitle
             * @return array<string, mixed>
             */
            private function createPullRequestNode(
                string $title,
                string $url,
                int $number,
                string $createdAt,
                string $authorLogin,
                string $authorCompany,
                ?string $milestoneTitle = null,
                ?string $typeName = null,
                int $subIssueTotal = 0,
                ?string $subIssueUrl = null,
                int $blockedBy = 0,
                ?string $linkedTitle = null,
            ): array {
                return [
                    'title' => $title,
                    'url' => $url,
                    'number' => $number,
                    'createdAt' => $createdAt,
                    'repository' => [
                        'name' => 'styleguide',
                        'nameWithOwner' => str_contains($url, 'styleguide-blocks') ? 'helsingborg-stad/styleguide-blocks' : 'helsingborg-stad/styleguide',
                        'owner' => ['login' => 'helsingborg-stad'],
                        'description' => str_contains($url, 'styleguide-blocks') ? 'Block collection' : 'Shared Municipio components',
                        'url' => str_contains($url, 'styleguide-blocks') ? 'https://github.com/helsingborg-stad/styleguide-blocks' : 'https://github.com/helsingborg-stad/styleguide',
                    ],
                    'author' => [
                        'login' => $authorLogin,
                        'avatarUrl' => sprintf('https://avatars.example.com/%s.png', $authorLogin),
                        'url' => sprintf('https://github.com/%s', $authorLogin),
                        'company' => $authorCompany,
                    ],
                    'assignees' => [
                        'nodes' => $title === 'GetMunicipio only PR' ? [[
                            'login' => 'hubot',
                            'avatarUrl' => 'https://avatars.example.com/hubot.png',
                            'url' => 'https://github.com/hubot',
                        ]] : [],
                    ],
                    'milestone' => $milestoneTitle === null ? null : [
                        'title' => $milestoneTitle,
                        'url' => 'https://github.com/helsingborg-stad/styleguide/milestone/1',
                        'dueOn' => '2026-06-01T00:00:00Z',
                    ],
                    'issueType' => $typeName === null ? null : ['name' => $typeName],
                    'subIssuesSummary' => [
                        'total' => $subIssueTotal,
                        'completed' => $subIssueTotal > 0 ? 1 : 0,
                        'percentCompleted' => $subIssueTotal > 0 ? 33 : 0,
                    ],
                    'subIssues' => [
                        'nodes' => $subIssueUrl === null ? [] : [['url' => $subIssueUrl]],
                    ],
                    'issueDependenciesSummary' => [
                        'blockedBy' => $blockedBy,
                        'totalBlockedBy' => $blockedBy > 0 ? 2 : 0,
                        'blocking' => 0,
                        'totalBlocking' => $blockedBy > 0 ? 1 : 0,
                    ],
                    'timelineItems' => [
                        'nodes' => $linkedTitle === null ? [] : [[
                            '__typename' => 'CrossReferencedEvent',
                            'source' => [
                                'title' => $linkedTitle,
                                'url' => 'https://github.com/helsingborg-stad/roadmap/issues/9',
                                'repository' => [
                                    'nameWithOwner' => 'helsingborg-stad/roadmap',
                                ],
                            ],
                        ]],
                    ],
                ];
            }
        };
    }

    /**
     * @return HttpClientInterface
     */
    private function createHttpClientWithMissingAuthorProfile(): HttpClientInterface
    {
        return new class () implements HttpClientInterface {
            /**
             * @param string $url
             * @param array<string, string> $headers
             * @return array<mixed>
             */
            public function getJson(string $url, array $headers): array
            {
                if (str_contains($url, '/search/repositories') && str_contains($url, 'topic:getmunicipio')) {
                    return [
                        'items' => [[
                            'name' => 'styleguide',
                            'owner' => ['login' => 'helsingborg-stad'],
                            'description' => 'Shared Municipio components',
                            'html_url' => 'https://github.com/helsingborg-stad/styleguide',
                        ]],
                    ];
                }

                return [];
            }

            /**
             * @param string $url
             * @param array<string, string> $headers
             * @param array<string, mixed> $body
             * @return array<string, mixed>
             */
            public function postJson(string $url, array $headers, array $body): array
            {
                return [
                    'data' => [
                        'search' => [
                            'pageInfo' => ['hasNextPage' => false, 'endCursor' => null],
                            'nodes' => [[
                                'title' => 'PR from missing profile',
                                'url' => 'https://github.com/helsingborg-stad/styleguide/pull/7',
                                'number' => 7,
                                'createdAt' => '2026-04-25T09:00:00Z',
                                'repository' => [
                                    'name' => 'styleguide',
                                    'nameWithOwner' => 'helsingborg-stad/styleguide',
                                    'owner' => ['login' => 'helsingborg-stad'],
                                    'description' => 'Shared Municipio components',
                                    'url' => 'https://github.com/helsingborg-stad/styleguide',
                                ],
                                'author' => [
                                    'login' => 'ghost-user',
                                    'avatarUrl' => 'https://avatars.example.com/ghost-user.png',
                                    'url' => 'https://github.com/ghost-user',
                                ],
                                'assignees' => ['nodes' => []],
                                'milestone' => null,
                                'issueType' => null,
                                'subIssuesSummary' => ['total' => 0, 'completed' => 0, 'percentCompleted' => 0],
                                'subIssues' => ['nodes' => []],
                                'issueDependenciesSummary' => ['blockedBy' => 0, 'totalBlockedBy' => 0, 'blocking' => 0, 'totalBlocking' => 0],
                                'timelineItems' => ['nodes' => []],
                            ]],
                        ],
                    ],
                ];
            }
        };
    }
}
