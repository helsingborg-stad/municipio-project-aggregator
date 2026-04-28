<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Tests;

use DateTimeImmutable;
use MunicipioProjectAggregator\Backend\Config\BuildConfig;
use MunicipioProjectAggregator\Backend\Contracts\HttpClientInterface;
use MunicipioProjectAggregator\Backend\GitHub\GitHubGraphQlClient;
use MunicipioProjectAggregator\Backend\GitHub\GitHubProjectSprintAggregator;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use RuntimeException;

#[CoversClass(GitHubProjectSprintAggregator::class)]
final class GitHubProjectSprintAggregatorTest extends TestCase
{
    /**
     * @return void
     */
    public function testAggregateCollectsCurrentAndNextSprintEntries(): void
    {
        $aggregator = new GitHubProjectSprintAggregator(
            new GitHubGraphQlClient($this->createHttpClient()),
        );

        $payload = $aggregator->aggregate(
            new BuildConfig(
                'GitHub',
                ['municipio-se', 'getmunicipio'],
                'token',
                '/tmp',
                new DateTimeImmutable('2026-04-28T10:00:00+00:00'),
                365,
            ),
            'helsingborg-stad',
            7,
        );

        $data = $payload->toArray();

        self::assertSame('sprints', $data['source']);
        self::assertSame('status:Todo', $data['currentFilter']);
        self::assertSame('Roadmap', $data['project']['title']);
        self::assertSame('Board', $data['view']['name']);
        self::assertSame('Sprint 14', $data['currentSprint']['title']);
        self::assertSame('2026-05-11', $data['currentSprint']['endDate']);
        self::assertSame('Sprint 15', $data['nextSprint']['title']);
        self::assertSame(4, $data['count']);
        self::assertSame('Implement sprint tab', $data['currentSprint']['items'][0]['title']);
        self::assertSame('In progress', $data['currentSprint']['items'][0]['status']);
        self::assertSame('Draft Issue', $data['nextSprint']['items'][0]['type']);
        self::assertSame('Prepare sprint planning', $data['nextSprint']['items'][0]['title']);
        self::assertSame('Draft', $data['nextSprint']['items'][0]['state']);
        self::assertSame('Pull Request', $data['nextSprint']['items'][1]['type']);
        self::assertSame('Merged', $data['nextSprint']['items'][1]['state']);
    }

    /**
     * @return void
     */
    public function testAggregateThrowsWhenProjectIsNotAccessible(): void
    {
        $aggregator = new GitHubProjectSprintAggregator(
            new GitHubGraphQlClient(new class () implements HttpClientInterface {
                /**
                 * @param string $url
                 * @param array<string, string> $headers
                 * @return array<mixed>
                 */
                public function getJson(string $url, array $headers): array
                {
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
                            'organization' => [
                                'projectV2' => null,
                            ],
                        ],
                    ];
                }
            }),
        );

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('could not be read');

        $aggregator->aggregate(
            new BuildConfig(
                'GitHub',
                ['municipio-se', 'getmunicipio'],
                'token',
                '/tmp',
                new DateTimeImmutable('2026-04-28T10:00:00+00:00'),
                365,
            ),
            'helsingborg-stad',
            7,
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
                        'organization' => [
                            'projectV2' => [
                                'title' => 'Roadmap',
                                'number' => 7,
                                'url' => 'https://github.com/orgs/helsingborg-stad/projects/7',
                                'views' => [
                                    'nodes' => [[
                                        'id' => 'PVTV_1',
                                        'name' => 'Board',
                                        'number' => 1,
                                        'layout' => 'BOARD_LAYOUT',
                                        'filter' => 'status:Todo',
                                    ]],
                                ],
                                'fields' => [
                                    'nodes' => [[
                                        '__typename' => 'ProjectV2IterationField',
                                        'id' => 'PVTIF_1',
                                        'name' => 'Iteration',
                                        'configuration' => [
                                            'iterations' => [
                                                [
                                                    'id' => 'iteration-current',
                                                    'title' => 'Sprint 14',
                                                    'startDate' => '2026-04-28',
                                                    'duration' => 14,
                                                ],
                                                [
                                                    'id' => 'iteration-next',
                                                    'title' => 'Sprint 15',
                                                    'startDate' => '2026-05-12',
                                                    'duration' => 14,
                                                ],
                                            ],
                                        ],
                                    ]],
                                ],
                                'items' => [
                                    'pageInfo' => [
                                        'hasNextPage' => false,
                                        'endCursor' => null,
                                    ],
                                    'nodes' => [
                                        [
                                            'id' => 'item-1',
                                            'content' => [
                                                '__typename' => 'Issue',
                                                'title' => 'Implement sprint tab',
                                                'url' => 'https://github.com/helsingborg-stad/municipio-project-aggregator/issues/1',
                                                'number' => 1,
                                                'state' => 'OPEN',
                                                'repository' => [
                                                    'nameWithOwner' => 'helsingborg-stad/municipio-project-aggregator',
                                                ],
                                            ],
                                            'fieldValues' => [
                                                'nodes' => [
                                                    [
                                                        '__typename' => 'ProjectV2ItemFieldIterationValue',
                                                        'title' => 'Sprint 14',
                                                        'startDate' => '2026-04-28',
                                                        'duration' => 14,
                                                        'iterationId' => 'iteration-current',
                                                        'field' => ['name' => 'Iteration'],
                                                    ],
                                                    [
                                                        '__typename' => 'ProjectV2ItemFieldSingleSelectValue',
                                                        'name' => 'In progress',
                                                        'field' => ['name' => 'Status'],
                                                    ],
                                                ],
                                            ],
                                        ],
                                        [
                                            'id' => 'item-2',
                                            'content' => [
                                                '__typename' => 'Issue',
                                                'title' => 'Track project filter',
                                                'url' => 'https://github.com/helsingborg-stad/municipio-project-aggregator/issues/2',
                                                'number' => 2,
                                                'state' => 'OPEN',
                                                'repository' => [
                                                    'nameWithOwner' => 'helsingborg-stad/municipio-project-aggregator',
                                                ],
                                            ],
                                            'fieldValues' => [
                                                'nodes' => [
                                                    [
                                                        '__typename' => 'ProjectV2ItemFieldIterationValue',
                                                        'title' => 'Sprint 15',
                                                        'startDate' => '2026-05-12',
                                                        'duration' => 14,
                                                        'iterationId' => 'iteration-next',
                                                        'field' => ['name' => 'Iteration'],
                                                    ],
                                                    [
                                                        '__typename' => 'ProjectV2ItemFieldSingleSelectValue',
                                                        'name' => 'Todo',
                                                        'field' => ['name' => 'Status'],
                                                    ],
                                                ],
                                            ],
                                        ],
                                        [
                                            'id' => 'item-3',
                                            'content' => [
                                                '__typename' => 'PullRequest',
                                                'title' => 'Ship sprint view',
                                                'url' => 'https://github.com/helsingborg-stad/municipio-project-aggregator/pull/3',
                                                'number' => 3,
                                                'state' => 'MERGED',
                                                'repository' => [
                                                    'nameWithOwner' => 'helsingborg-stad/municipio-project-aggregator',
                                                ],
                                            ],
                                            'fieldValues' => [
                                                'nodes' => [
                                                    [
                                                        '__typename' => 'ProjectV2ItemFieldIterationValue',
                                                        'title' => 'Sprint 15',
                                                        'startDate' => '2026-05-12',
                                                        'duration' => 14,
                                                        'iterationId' => 'iteration-next',
                                                        'field' => ['name' => 'Iteration'],
                                                    ],
                                                    [
                                                        '__typename' => 'ProjectV2ItemFieldSingleSelectValue',
                                                        'name' => 'Done',
                                                        'field' => ['name' => 'Status'],
                                                    ],
                                                ],
                                            ],
                                        ],
                                        [
                                            'id' => 'item-4',
                                            'content' => [
                                                '__typename' => 'DraftIssue',
                                                'title' => 'Prepare sprint planning',
                                            ],
                                            'fieldValues' => [
                                                'nodes' => [
                                                    [
                                                        '__typename' => 'ProjectV2ItemFieldIterationValue',
                                                        'title' => 'Sprint 15',
                                                        'startDate' => '2026-05-12',
                                                        'duration' => 14,
                                                        'iterationId' => 'iteration-next',
                                                        'field' => ['name' => 'Iteration'],
                                                    ],
                                                    [
                                                        '__typename' => 'ProjectV2ItemFieldSingleSelectValue',
                                                        'name' => 'Todo',
                                                        'field' => ['name' => 'Status'],
                                                    ],
                                                ],
                                            ],
                                        ],
                                    ],
                                ],
                            ],
                        ],
                    ],
                ];
            }
        };
    }
}