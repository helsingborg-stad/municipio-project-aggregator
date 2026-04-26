<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Tests;

use MunicipioProjectAggregator\Backend\Data\AggregatedItem;
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
            [new AggregatedItem(
                'Title',
                'https://example.com',
                'municipio',
                '2026-04-23T08:00:00+00:00',
                14,
                ['login' => 'octocat', 'avatarUrl' => 'https://example.com/avatar.png', 'url' => 'https://github.com/octocat', 'company' => '@github'],
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
        self::assertStringContainsString('"author"', $contents);
    }
}
