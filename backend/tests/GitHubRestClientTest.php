<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Tests;

use MunicipioProjectAggregator\Backend\Contracts\HttpClientInterface;
use MunicipioProjectAggregator\Backend\GitHub\GitHubRestClient;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(GitHubRestClient::class)]
final class GitHubRestClientTest extends TestCase
{
    /**
     * @return void
     */
    public function testListRepositoriesByTopicsCachesRequestsForTheSameTopicSet(): void
    {
        $httpClient = new class () implements HttpClientInterface {
            public int $repositorySearchRequestCount = 0;

            /**
             * @param string $url
             * @param array<string, string> $headers
             * @return array<mixed>
             */
            public function getJson(string $url, array $headers): array
            {
                if (str_contains($url, '/search/repositories')) {
                    $this->repositorySearchRequestCount++;

                    if (str_contains($url, 'topic:getmunicipio')) {
                        return [
                            'items' => [[
                                'name' => 'styleguide',
                                'owner' => ['login' => 'helsingborg-stad'],
                                'description' => 'Shared Municipio components',
                                'html_url' => 'https://github.com/helsingborg-stad/styleguide',
                            ]],
                        ];
                    }

                    return [
                        'items' => [[
                            'name' => 'municipio-site',
                            'owner' => ['login' => 'municipio-se'],
                            'description' => 'Municipio site plugin',
                            'html_url' => 'https://github.com/municipio-se/municipio-site',
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
                return [];
            }
        };

        $client = new GitHubRestClient($httpClient);

        $firstResult = $client->listRepositoriesByTopics(['municipio-se', 'getmunicipio'], 'token');
        $secondResult = $client->listRepositoriesByTopics(['getmunicipio', 'municipio-se'], 'token');

        self::assertCount(2, $firstResult);
        self::assertCount(2, $secondResult);
        self::assertSame(2, $httpClient->repositorySearchRequestCount);
    }

    /**
     * @return void
     */
    public function testListContributorsCollectsDistinctContributorsAcrossPages(): void
    {
        $httpClient = new class () implements HttpClientInterface {
            /**
             * @param string $url
             * @param array<string, string> $headers
             * @return array<mixed>
             */
            public function getJson(string $url, array $headers): array
            {
                if (!str_contains($url, '/contributors')) {
                    return [];
                }

                if (preg_match('/[?&]page=1(?:&|$)/', $url) === 1) {
                    return array_map(
                        static fn (int $index): array => [
                            'login' => sprintf('contributor-%d', $index),
                            'avatar_url' => sprintf('https://avatars.example.com/%d.png', $index),
                            'html_url' => sprintf('https://github.com/contributor-%d', $index),
                        ],
                        range(1, 100),
                    );
                }

                return [
                    [
                        'login' => 'contributor-100',
                        'avatar_url' => 'https://avatars.example.com/100.png',
                        'html_url' => 'https://github.com/contributor-100',
                    ],
                    [
                        'login' => 'contributor-101',
                        'avatar_url' => 'https://avatars.example.com/101.png',
                        'html_url' => 'https://github.com/contributor-101',
                    ],
                ];
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

        $client = new GitHubRestClient($httpClient);

        $contributors = $client->listContributors(
            new \MunicipioProjectAggregator\Backend\Data\RepositoryReference(
                'helsingborg-stad',
                'styleguide',
                'Shared Municipio components',
                'https://github.com/helsingborg-stad/styleguide',
            ),
            'token',
        );

        self::assertCount(101, $contributors);
        self::assertSame('contributor-1', $contributors[0]['login']);
        self::assertSame('contributor-101', $contributors[100]['login']);
    }
}