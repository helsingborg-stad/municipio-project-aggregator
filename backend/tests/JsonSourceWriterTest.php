<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Tests;

use MunicipioProjectAggregator\Backend\Data\AggregatedItem;
use MunicipioProjectAggregator\Backend\Data\ReleaseEntry;
use MunicipioProjectAggregator\Backend\Data\ReleasePage;
use MunicipioProjectAggregator\Backend\Data\ReleasePageIndexPayload;
use MunicipioProjectAggregator\Backend\Data\ReleasePagePayload;
use MunicipioProjectAggregator\Backend\Data\RepositoryReference;
use MunicipioProjectAggregator\Backend\Data\SprintBucket;
use MunicipioProjectAggregator\Backend\Data\SprintEntry;
use MunicipioProjectAggregator\Backend\Data\SprintPayload;
use MunicipioProjectAggregator\Backend\Data\SourcePayload;
use MunicipioProjectAggregator\Backend\Output\JsonSourceWriter;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(JsonSourceWriter::class)]
final class JsonSourceWriterTest extends TestCase
{
    private string $outputDirectory;

    protected function setUp(): void
    {
        parent::setUp();

        $this->outputDirectory = sys_get_temp_dir() . '/municipio-project-aggregator-tests-' . uniqid('', true);
    }

    protected function tearDown(): void
    {
        if (is_file($this->outputDirectory . '/issues.json')) {
            unlink($this->outputDirectory . '/issues.json');
        }

        if (is_file($this->outputDirectory . '/releases.json')) {
            unlink($this->outputDirectory . '/releases.json');
        }

        if (is_file($this->outputDirectory . '/releases/pageIndex.json')) {
            unlink($this->outputDirectory . '/releases/pageIndex.json');
        }

        if (is_file($this->outputDirectory . '/releases/page-1.json')) {
            unlink($this->outputDirectory . '/releases/page-1.json');
        }

        if (is_file($this->outputDirectory . '/sprints.json')) {
            unlink($this->outputDirectory . '/sprints.json');
        }

        if (is_dir($this->outputDirectory . '/releases')) {
            rmdir($this->outputDirectory . '/releases');
        }

        if (is_dir($this->outputDirectory)) {
            rmdir($this->outputDirectory);
        }

        parent::tearDown();
    }

    /**
     * @return void
     */
    public function testWritePersistsPrettyPrintedJson(): void
    {
        $writer = new JsonSourceWriter($this->outputDirectory);
        $payload = new SourcePayload(
            'issues',
            'GitHub',
            ['municipio-se', 'getmunicipio'],
            '2026-04-24T08:00:00+00:00',
            [],
            [[
                'login' => 'hubot',
                'avatarUrl' => 'https://example.com/hubot.png',
                'url' => 'https://github.com/hubot',
                'company' => 'Acme',
            ]],
            [new AggregatedItem(
                'Title',
                'https://example.com',
                'municipio',
                '2026-04-23T08:00:00+00:00',
                14,
                ['login' => 'octocat', 'avatarUrl' => 'https://example.com/avatar.png', 'url' => 'https://github.com/octocat'],
                [],
                null,
                'Bug',
                ['total' => 1, 'completed' => 0, 'percentCompleted' => 0],
                [],
                ['blockedBy' => 0, 'totalBlockedBy' => 0, 'blocking' => 0, 'totalBlocking' => 0, 'linked' => 0],
                [],
            )],
        );

        $filePath = $writer->write($payload);

        self::assertFileExists($filePath);
        $contents = file_get_contents($filePath);
        self::assertIsString($contents);
        self::assertStringContainsString('"source": "issues"', $contents);
        self::assertStringContainsString('"topics": [', $contents);
        self::assertStringContainsString('"count": 1', $contents);
        self::assertStringContainsString('"repositories": [', $contents);
        self::assertStringContainsString('"authors": [', $contents);
        self::assertStringContainsString('"author"', $contents);
    }

    /**
     * @return void
     */
    public function testWritePersistsReleasePayloads(): void
    {
        $writer = new JsonSourceWriter($this->outputDirectory);
        $payload = new ReleasePagePayload(
            'releases/page-1',
            'GitHub',
            new RepositoryReference(
                'municipio-se',
                'municipio-deployment',
                'Deployment helpers',
                'https://github.com/municipio-se/municipio-deployment',
            ),
            '2026-04-27T08:00:00+00:00',
            1,
            10,
            1,
            1,
            [new ReleaseEntry(
                'Release 3.2.1',
                'v3.2.1',
                '## Highlights',
                'https://github.com/municipio-se/municipio-deployment/releases/tag/v3.2.1',
                '2026-04-26T08:00:00+00:00',
                false,
                false,
            )],
        );

        $filePath = $writer->write($payload);

        self::assertFileExists($filePath);
        $contents = file_get_contents($filePath);
        self::assertIsString($contents);
        self::assertStringContainsString('"source": "releases"', $contents);
        self::assertStringContainsString('"repository": {', $contents);
        self::assertStringContainsString('"version": "v3.2.1"', $contents);
    }

    /**
     * @return void
     */
    public function testWritePersistsReleasePageIndexPayloads(): void
    {
        $writer = new JsonSourceWriter($this->outputDirectory);
        $payload = new ReleasePageIndexPayload(
            'releases/pageIndex',
            'GitHub',
            new RepositoryReference(
                'municipio-se',
                'municipio-deployment',
                'Deployment helpers',
                'https://github.com/municipio-se/municipio-deployment',
            ),
            '2026-04-27T08:00:00+00:00',
            12,
            10,
            [
                new ReleasePage(1, 'page-1.json', 10),
                new ReleasePage(2, 'page-2.json', 2),
            ],
        );

        $filePath = $writer->write($payload);

        self::assertFileExists($filePath);
        $contents = file_get_contents($filePath);
        self::assertIsString($contents);
        self::assertStringContainsString('"pageCount": 2', $contents);
        self::assertStringContainsString('"file": "page-1.json"', $contents);
    }

    /**
     * @return void
     */
    public function testWritePersistsSprintPayloads(): void
    {
        $writer = new JsonSourceWriter($this->outputDirectory);
        $payload = new SprintPayload(
            'sprints',
            'GitHub',
            '2026-04-28T08:00:00+00:00',
            [
                'owner' => 'helsingborg-stad',
                'number' => 7,
                'title' => 'Roadmap',
                'url' => 'https://github.com/orgs/helsingborg-stad/projects/7',
            ],
            [
                'id' => 'PVTV_1',
                'name' => 'Board',
                'number' => 1,
                'layout' => 'BOARD_LAYOUT',
                'filter' => 'status:Todo',
            ],
            'status:Todo',
            new SprintBucket(
                'Current Sprint',
                'Sprint 14',
                '2026-04-28',
                '2026-05-11',
                [new SprintEntry(
                    'Implement sprint tab',
                    'https://github.com/helsingborg-stad/municipio-project-aggregator/issues/1',
                    1,
                    'helsingborg-stad/municipio-project-aggregator',
                    'Issue',
                    'Open',
                    'In progress',
                )],
            ),
            null,
        );

        $filePath = $writer->write($payload);

        self::assertFileExists($filePath);
        $contents = file_get_contents($filePath);
        self::assertIsString($contents);
        self::assertStringContainsString('"source": "sprints"', $contents);
        self::assertStringContainsString('"currentFilter": "status:Todo"', $contents);
        self::assertStringContainsString('"Current Sprint"', $contents);
    }
}
