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
    public function testAggregateCollectsBacklogCurrentCompletedAndNextSprintEntries(): void
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
        self::assertSame('PVT_kwDOA', $data['project']['id']);
        self::assertSame('Roadmap', $data['project']['title']);
        self::assertSame('Board', $data['view']['name']);
        self::assertSame('PVTSSF_status', $data['fields']['status']['id']);
        self::assertSame('PVTIF_1', $data['fields']['iteration']['id']);
        self::assertSame('iteration-current', $data['fields']['iteration']['currentIterationId']);
        self::assertSame('iteration-next', $data['fields']['iteration']['nextIterationId']);
        self::assertSame('iteration-previous', $data['fields']['iteration']['completedIterationId']);
        self::assertSame('Backlog', $data['backlog']['label']);
        self::assertSame('Unplanned work', $data['backlog']['items'][0]['title']);
        self::assertSame('estimate:5', $data['backlog']['items'][0]['labels'][0]['name']);
        self::assertSame('Completed Sprint', $data['completedSprint']['label']);
        self::assertSame('Sprint 13', $data['completedSprint']['title']);
        self::assertSame('Sprint 14', $data['currentSprint']['title']);
        self::assertSame('2026-05-11', $data['currentSprint']['endDate']);
        self::assertSame('Sprint 15', $data['nextSprint']['title']);
        self::assertSame(5, $data['count']);
        self::assertSame('Implement sprint tab', $data['currentSprint']['items'][0]['title']);
        self::assertSame('In progress', $data['currentSprint']['items'][0]['status']);
        self::assertSame('PVTSSO_in-progress', $data['currentSprint']['items'][0]['statusOptionId']);
        self::assertSame('Draft Issue', $data['nextSprint']['items'][0]['type']);
        self::assertSame('Prepare sprint planning', $data['nextSprint']['items'][0]['title']);
        self::assertSame('DRAFT', $data['nextSprint']['items'][0]['state']);
        self::assertSame('Pull Request', $data['nextSprint']['items'][1]['type']);
        self::assertSame('MERGED', $data['nextSprint']['items'][1]['state']);
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
                                'id' => 'PVT_kwDOA',
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
                                    'nodes' => [
                                        [
                                            '__typename' => 'ProjectV2SingleSelectField',
                                            'id' => 'PVTSSF_status',
                                            'name' => 'Status',
                                            'options' => [
                                                [
                                                    'id' => 'PVTSSO_backlog',
                                                    'name' => 'Backlog',
                                                    'color' => 'ORANGE',
                                                    'description' => 'Queued work',
                                                ],
                                                [
                                                    'id' => 'PVTSSO_in-progress',
                                                    'name' => 'In progress',
                                                    'color' => 'BLUE',
                                                    'description' => 'Active work',
                                                ],
                                                [
                                                    'id' => 'PVTSSO_done',
                                                    'name' => 'Done',
                                                    'color' => 'GREEN',
                                                    'description' => 'Completed work',
                                                ],
                                            ],
                                        ],
                                        [
                                            '__typename' => 'ProjectV2IterationField',
                                            'id' => 'PVTIF_1',
                                            'name' => 'Iteration',
                                            'configuration' => [
                                                'iterations' => [
                                                    [
                                                        'id' => 'iteration-previous',
                                                        'title' => 'Sprint 13',
                                                        'startDate' => '2026-04-14',
                                                        'duration' => 14,
                                                    ],
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
                                        ],
                                    ],
                                ],
                                'items' => [
                                    'pageInfo' => [
                                        'hasNextPage' => false,
                                        'endCursor' => null,
                                    ],
                                    'nodes' => [
                                        [
                                            'id' => 'item-backlog',
                                            'updatedAt' => '2026-04-27T10:00:00Z',
                                            'content' => [
                                                '__typename' => 'Issue',
                                                'id' => 'I_backlog',
                                                'title' => 'Unplanned work',
                                                'url' => 'https://github.com/helsingborg-stad/municipio-project-aggregator/issues/10',
                                                'number' => 10,
                                                'state' => 'OPEN',
                                                'updatedAt' => '2026-04-27T10:00:00Z',
                                                'repository' => [
                                                    'nameWithOwner' => 'helsingborg-stad/municipio-project-aggregator',
                                                ],
                                                'assignees' => [
                                                    'nodes' => [],
                                                ],
                                                'labels' => [
                                                    'nodes' => [[
                                                        'id' => 'label-estimate-5',
                                                        'name' => 'estimate:5',
                                                        'color' => '7c3aed',
                                                        'description' => 'Five points',
                                                    ]],
                                                ],
                                                'milestone' => null,
                                            ],
                                            'fieldValues' => [
                                                'nodes' => [[
                                                    '__typename' => 'ProjectV2ItemFieldSingleSelectValue',
                                                    'name' => 'Backlog',
                                                    'optionId' => 'PVTSSO_backlog',
                                                    'field' => ['id' => 'PVTSSF_status', 'name' => 'Status'],
                                                ]],
                                            ],
                                        ],
                                        [
                                            'id' => 'item-completed',
                                            'updatedAt' => '2026-04-26T10:00:00Z',
                                            'content' => [
                                                '__typename' => 'Issue',
                                                'id' => 'I_completed',
                                                'title' => 'Wrap up sprint review',
                                                'url' => 'https://github.com/helsingborg-stad/municipio-project-aggregator/issues/9',
                                                'number' => 9,
                                                'state' => 'CLOSED',
                                                'updatedAt' => '2026-04-26T10:00:00Z',
                                                'repository' => [
                                                    'nameWithOwner' => 'helsingborg-stad/municipio-project-aggregator',
                                                ],
                                                'assignees' => [
                                                    'nodes' => [],
                                                ],
                                                'labels' => [
                                                    'nodes' => [],
                                                ],
                                                'milestone' => null,
                                            ],
                                            'fieldValues' => [
                                                'nodes' => [
                                                    [
                                                        '__typename' => 'ProjectV2ItemFieldIterationValue',
                                                        'title' => 'Sprint 13',
                                                        'startDate' => '2026-04-14',
                                                        'duration' => 14,
                                                        'iterationId' => 'iteration-previous',
                                                        'field' => ['id' => 'PVTIF_1', 'name' => 'Iteration'],
                                                    ],
                                                    [
                                                        '__typename' => 'ProjectV2ItemFieldSingleSelectValue',
                                                        'name' => 'Done',
                                                        'optionId' => 'PVTSSO_done',
                                                        'field' => ['id' => 'PVTSSF_status', 'name' => 'Status'],
                                                    ],
                                                ],
                                            ],
                                        ],
                                        [
                                            'id' => 'item-1',
                                            'updatedAt' => '2026-04-28T10:00:00Z',
                                            'content' => [
                                                '__typename' => 'Issue',
                                                'id' => 'I_current',
                                                'title' => 'Implement sprint tab',
                                                'url' => 'https://github.com/helsingborg-stad/municipio-project-aggregator/issues/1',
                                                'number' => 1,
                                                'state' => 'OPEN',
                                                'updatedAt' => '2026-04-28T10:00:00Z',
                                                'repository' => [
                                                    'nameWithOwner' => 'helsingborg-stad/municipio-project-aggregator',
                                                ],
                                                'assignees' => [
                                                    'nodes' => [[
                                                        'login' => 'octocat',
                                                        'avatarUrl' => 'https://avatars.example.com/octocat.png',
                                                        'url' => 'https://github.com/octocat',
                                                    ]],
                                                ],
                                                'labels' => [
                                                    'nodes' => [],
                                                ],
                                                'milestone' => [
                                                    'title' => 'Sprint 14',
                                                    'url' => 'https://github.com/helsingborg-stad/municipio-project-aggregator/milestone/1',
                                                    'dueOn' => '2026-05-11T00:00:00Z',
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
                                                        'field' => ['id' => 'PVTIF_1', 'name' => 'Iteration'],
                                                    ],
                                                    [
                                                        '__typename' => 'ProjectV2ItemFieldSingleSelectValue',
                                                        'name' => 'In progress',
                                                        'optionId' => 'PVTSSO_in-progress',
                                                        'field' => ['id' => 'PVTSSF_status', 'name' => 'Status'],
                                                    ],
                                                ],
                                            ],
                                        ],
                                        [
                                            'id' => 'item-3',
                                            'updatedAt' => '2026-05-12T10:00:00Z',
                                            'content' => [
                                                '__typename' => 'PullRequest',
                                                'id' => 'PR_next',
                                                'title' => 'Ship sprint view',
                                                'url' => 'https://github.com/helsingborg-stad/municipio-project-aggregator/pull/3',
                                                'number' => 3,
                                                'state' => 'MERGED',
                                                'updatedAt' => '2026-05-12T10:00:00Z',
                                                'repository' => [
                                                    'nameWithOwner' => 'helsingborg-stad/municipio-project-aggregator',
                                                ],
                                                'assignees' => [
                                                    'nodes' => [],
                                                ],
                                                'labels' => [
                                                    'nodes' => [],
                                                ],
                                                'milestone' => null,
                                            ],
                                            'fieldValues' => [
                                                'nodes' => [
                                                    [
                                                        '__typename' => 'ProjectV2ItemFieldIterationValue',
                                                        'title' => 'Sprint 15',
                                                        'startDate' => '2026-05-12',
                                                        'duration' => 14,
                                                        'iterationId' => 'iteration-next',
                                                        'field' => ['id' => 'PVTIF_1', 'name' => 'Iteration'],
                                                    ],
                                                    [
                                                        '__typename' => 'ProjectV2ItemFieldSingleSelectValue',
                                                        'name' => 'Done',
                                                        'optionId' => 'PVTSSO_done',
                                                        'field' => ['id' => 'PVTSSF_status', 'name' => 'Status'],
                                                    ],
                                                ],
                                            ],
                                        ],
                                        [
                                            'id' => 'item-4',
                                            'updatedAt' => '2026-05-12T09:00:00Z',
                                            'content' => [
                                                '__typename' => 'DraftIssue',
                                                'id' => 'DI_next',
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
                                                        'field' => ['id' => 'PVTIF_1', 'name' => 'Iteration'],
                                                    ],
                                                    [
                                                        '__typename' => 'ProjectV2ItemFieldSingleSelectValue',
                                                        'name' => 'Todo',
                                                        'optionId' => 'PVTSSO_backlog',
                                                        'field' => ['id' => 'PVTSSF_status', 'name' => 'Status'],
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
