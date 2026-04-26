<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Tests;

use DateTimeImmutable;
use MunicipioProjectAggregator\Backend\Config\BuildConfig;
use MunicipioProjectAggregator\Backend\Contracts\HttpClientInterface;
use MunicipioProjectAggregator\Backend\GitHub\GitHubRestClient;
use MunicipioProjectAggregator\Backend\GitHub\GitHubSourceAggregator;
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
        self::assertSame('@github', $data['items'][0]['author']['company']);
        self::assertSame('hubot', $data['items'][0]['assignees'][0]['login']);
        self::assertSame('Q2', $data['items'][0]['milestone']['title']);
        self::assertSame('Feature', $data['items'][0]['type']);
        self::assertSame(3, $data['items'][0]['subIssues']['total']);
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

                if (str_contains($url, '/repos/municipio-se/municipio-site/pulls')) {
                    return [];
                }

                if (str_contains($url, '/users/octocat')) {
                    return [
                        'company' => '@github',
                    ];
                }

                if (str_contains($url, '/users/monalisa')) {
                    return [
                        'company' => 'Mona Lisa Studio',
                    ];
                }

                if (str_contains($url, '/users/oldtimer')) {
                    return [
                        'company' => '',
                    ];
                }

                if (str_contains($url, '/repos/helsingborg-stad/styleguide/pulls')) {
                    return [
                        [
                            'title' => 'GetMunicipio only PR',
                            'html_url' => 'https://github.com/helsingborg-stad/styleguide/pull/2',
                            'number' => 2,
                            'created_at' => '2026-04-25T09:00:00Z',
                        ],
                        [
                            'title' => 'Shared PR',
                            'html_url' => 'https://github.com/helsingborg-stad/styleguide/pull/1',
                            'number' => 1,
                            'created_at' => '2026-04-24T09:00:00Z',
                        ],
                    ];
                }

                if (str_contains($url, '/repos/helsingborg-stad/styleguide-blocks/pulls')) {
                    return [[
                        'title' => 'Obsolete PR',
                        'html_url' => 'https://github.com/helsingborg-stad/styleguide-blocks/pull/3',
                        'number' => 3,
                        'created_at' => '2025-04-24T09:00:00Z',
                    ]];
                }

                if (str_contains($url, '/repos/helsingborg-stad/styleguide/issues/2/timeline')) {
                    return [[
                        'event' => 'cross-referenced',
                        'source' => [
                            'issue' => [
                                'title' => 'Roadmap card',
                                'html_url' => 'https://github.com/helsingborg-stad/roadmap/issues/9',
                                'repository' => [
                                    'full_name' => 'helsingborg-stad/roadmap',
                                ],
                            ],
                        ],
                    ]];
                }

                if (str_contains($url, '/repos/helsingborg-stad/styleguide/issues/1/timeline')) {
                    return [];
                }

                if (str_contains($url, '/repos/helsingborg-stad/styleguide-blocks/issues/3/timeline')) {
                    return [];
                }

                if (str_contains($url, '/repos/helsingborg-stad/styleguide/issues/2')) {
                    return [
                        'title' => 'GetMunicipio only PR',
                        'html_url' => 'https://github.com/helsingborg-stad/styleguide/pull/2',
                        'number' => 2,
                        'created_at' => '2026-04-25T09:00:00Z',
                        'user' => [
                            'login' => 'octocat',
                            'avatar_url' => 'https://avatars.example.com/octocat.png',
                            'html_url' => 'https://github.com/octocat',
                        ],
                        'assignees' => [[
                            'login' => 'hubot',
                            'avatar_url' => 'https://avatars.example.com/hubot.png',
                            'html_url' => 'https://github.com/hubot',
                        ]],
                        'milestone' => [
                            'title' => 'Q2',
                            'html_url' => 'https://github.com/helsingborg-stad/styleguide/milestone/1',
                            'due_on' => '2026-06-01T00:00:00Z',
                        ],
                        'type' => 'Feature',
                        'sub_issues_summary' => [
                            'total' => 3,
                            'completed' => 1,
                            'percent_completed' => 33,
                        ],
                        'issue_dependencies_summary' => [
                            'blocked_by' => 1,
                            'total_blocked_by' => 2,
                            'blocking' => 0,
                            'total_blocking' => 1,
                        ],
                    ];
                }

                if (str_contains($url, '/repos/helsingborg-stad/styleguide/issues/1')) {
                    return [
                        'title' => 'Shared PR',
                        'html_url' => 'https://github.com/helsingborg-stad/styleguide/pull/1',
                        'number' => 1,
                        'created_at' => '2026-04-24T09:00:00Z',
                        'user' => [
                            'login' => 'monalisa',
                            'avatar_url' => 'https://avatars.example.com/monalisa.png',
                            'html_url' => 'https://github.com/monalisa',
                        ],
                        'assignees' => [],
                        'milestone' => null,
                        'type' => null,
                        'sub_issues_summary' => [
                            'total' => 0,
                            'completed' => 0,
                            'percent_completed' => 0,
                        ],
                        'issue_dependencies_summary' => [
                            'blocked_by' => 0,
                            'total_blocked_by' => 0,
                            'blocking' => 0,
                            'total_blocking' => 0,
                        ],
                    ];
                }

                if (str_contains($url, '/repos/helsingborg-stad/styleguide-blocks/issues/3')) {
                    return [
                        'title' => 'Obsolete PR',
                        'html_url' => 'https://github.com/helsingborg-stad/styleguide-blocks/pull/3',
                        'number' => 3,
                        'created_at' => '2025-04-24T09:00:00Z',
                        'user' => [
                            'login' => 'oldtimer',
                            'avatar_url' => 'https://avatars.example.com/oldtimer.png',
                            'html_url' => 'https://github.com/oldtimer',
                        ],
                        'assignees' => [],
                        'milestone' => null,
                        'type' => null,
                        'sub_issues_summary' => [
                            'total' => 0,
                            'completed' => 0,
                            'percent_completed' => 0,
                        ],
                        'issue_dependencies_summary' => [
                            'blocked_by' => 0,
                            'total_blocked_by' => 0,
                            'blocking' => 0,
                            'total_blocking' => 0,
                        ],
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
                return [];
            }
        };
    }
}
