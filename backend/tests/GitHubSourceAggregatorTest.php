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
        $httpClient = new class () implements HttpClientInterface {
            /**
             * @param string $url
             * @param array<string, string> $headers
             * @return array<mixed>
             */
            public function getJson(string $url, array $headers): array
            {
                if (str_contains($url, '/search/repositories')) {
                    if (str_contains($url, 'topic:municipio')) {
                        return [
                            'items' => [
                                ['name' => 'styleguide'],
                            ],
                        ];
                    }

                    if (str_contains($url, 'topic:getmunicipio')) {
                        return [
                            'items' => [
                                ['name' => 'styleguide'],
                                ['name' => 'styleguide-blocks'],
                            ],
                        ];
                    }
                }

                if (str_contains($url, '/repos/helsingborg-stad/styleguide/pulls')) {
                    return [
                        [
                            'title' => 'GetMunicipio only PR',
                            'html_url' => 'https://github.com/helsingborg-stad/styleguide/pull/2',
                            'created_at' => '2026-04-25T09:00:00Z',
                        ],
                        [
                            'title' => 'Shared PR',
                            'html_url' => 'https://github.com/helsingborg-stad/styleguide/pull/1',
                            'created_at' => '2026-04-24T09:00:00Z',
                        ],
                    ];
                }

                if (str_contains($url, '/repos/helsingborg-stad/styleguide-blocks/pulls')) {
                    return [];
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

        $aggregator = new GitHubSourceAggregator(
            new GitHubRestClient($httpClient),
        );

        $payload = $aggregator->aggregate(
            SourceType::PullRequests,
            new BuildConfig(
                'helsingborg-stad',
                ['municipio', 'getmunicipio'],
                'token',
                '/tmp',
                new DateTimeImmutable('2026-04-25T10:00:00+00:00'),
            ),
        );

        $data = $payload->toArray();

        self::assertSame(['municipio', 'getmunicipio'], $data['topics']);
        self::assertSame(2, $data['count']);
        self::assertSame('GetMunicipio only PR', $data['items'][0]['title']);
        self::assertSame('Shared PR', $data['items'][1]['title']);
    }
}