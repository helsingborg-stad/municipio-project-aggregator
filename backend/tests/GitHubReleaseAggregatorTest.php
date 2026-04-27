<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Tests;

use DateTimeImmutable;
use MunicipioProjectAggregator\Backend\Config\BuildConfig;
use MunicipioProjectAggregator\Backend\Contracts\HttpClientInterface;
use MunicipioProjectAggregator\Backend\GitHub\GitHubReleaseAggregator;
use MunicipioProjectAggregator\Backend\GitHub\GitHubRestClient;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(GitHubReleaseAggregator::class)]
final class GitHubReleaseAggregatorTest extends TestCase
{
    /**
     * @return void
     */
    public function testAggregateCollectsReleaseMetadataAndMarkdownBody(): void
    {
        $aggregator = new GitHubReleaseAggregator(
            new GitHubRestClient($this->createHttpClient()),
        );

        $payload = $aggregator->aggregate(
            new BuildConfig(
                'GitHub',
                ['municipio-se', 'getmunicipio'],
                'token',
                '/tmp',
                new DateTimeImmutable('2026-04-27T10:00:00+00:00'),
                365,
            ),
            'municipio-se',
            'municipio-deployment',
        );

        $data = $payload->toArray();

        self::assertSame('releases', $data['source']);
        self::assertSame('municipio-se/municipio-deployment', $data['repository']['fullName']);
        self::assertSame(2, $data['count']);
        self::assertSame('v3.2.1', $data['items'][0]['version']);
        self::assertSame('Release 3.2.1', $data['items'][0]['title']);
        self::assertStringContainsString('## Highlights', $data['items'][0]['body']);
        self::assertTrue($data['items'][1]['isPrerelease']);
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
                if (str_contains($url, '/repos/municipio-se/municipio-deployment/releases')) {
                    return [
                        [
                            'name' => 'Release 3.2.1',
                            'tag_name' => 'v3.2.1',
                            'body' => "## Highlights\n\n- Added rollout support",
                            'html_url' => 'https://github.com/municipio-se/municipio-deployment/releases/tag/v3.2.1',
                            'published_at' => '2026-04-26T08:00:00Z',
                            'prerelease' => false,
                            'draft' => false,
                        ],
                        [
                            'name' => 'Release 3.2.0-rc1',
                            'tag_name' => 'v3.2.0-rc1',
                            'body' => 'Release candidate',
                            'html_url' => 'https://github.com/municipio-se/municipio-deployment/releases/tag/v3.2.0-rc1',
                            'published_at' => '2026-04-20T08:00:00Z',
                            'prerelease' => true,
                            'draft' => false,
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