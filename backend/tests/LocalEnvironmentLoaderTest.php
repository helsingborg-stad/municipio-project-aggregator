<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Tests;

use MunicipioProjectAggregator\Backend\Support\LocalEnvironmentLoader;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;

#[CoversClass(LocalEnvironmentLoader::class)]
final class LocalEnvironmentLoaderTest extends TestCase
{
    private string $envFilePath;

    protected function setUp(): void
    {
        parent::setUp();

        $this->envFilePath = sys_get_temp_dir() . '/municipio-project-aggregator-env-' . uniqid('', true) . '.env';
        file_put_contents($this->envFilePath, "# comment\nTEST_AGGREGATOR_KEY=loaded-value\nQUOTED_KEY=\"quoted\"\n");
        putenv('TEST_AGGREGATOR_KEY');
        unset($_ENV['TEST_AGGREGATOR_KEY'], $_SERVER['TEST_AGGREGATOR_KEY']);
        putenv('QUOTED_KEY');
        unset($_ENV['QUOTED_KEY'], $_SERVER['QUOTED_KEY']);
    }

    protected function tearDown(): void
    {
        if (is_file($this->envFilePath)) {
            unlink($this->envFilePath);
        }

        putenv('TEST_AGGREGATOR_KEY');
        unset($_ENV['TEST_AGGREGATOR_KEY'], $_SERVER['TEST_AGGREGATOR_KEY']);
        putenv('QUOTED_KEY');
        unset($_ENV['QUOTED_KEY'], $_SERVER['QUOTED_KEY']);

        parent::tearDown();
    }

    /**
     * @return void
     */
    public function testLoadReadsEnvFileValues(): void
    {
        $loader = new LocalEnvironmentLoader();

        $loader->load([$this->envFilePath]);

        self::assertSame('loaded-value', getenv('TEST_AGGREGATOR_KEY'));
        self::assertSame('quoted', getenv('QUOTED_KEY'));
    }
}