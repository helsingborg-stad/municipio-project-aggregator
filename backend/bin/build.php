#!/usr/bin/env php
<?php

declare(strict_types=1);

use MunicipioProjectAggregator\Backend\Config\BuildConfig;
use MunicipioProjectAggregator\Backend\GitHub\GitHubReleaseAggregator;
use MunicipioProjectAggregator\Backend\GitHub\GitHubRestClient;
use MunicipioProjectAggregator\Backend\GitHub\GitHubSourceAggregator;
use MunicipioProjectAggregator\Backend\GitHub\SourceType;
use MunicipioProjectAggregator\Backend\Output\JsonSourceWriter;
use MunicipioProjectAggregator\Backend\Support\LocalEnvironmentLoader;
use MunicipioProjectAggregator\Backend\Support\StreamHttpClient;

require dirname(__DIR__, 2) . '/vendor/autoload.php';

$projectRoot = dirname(__DIR__, 2);

$environmentLoader = new LocalEnvironmentLoader();
$environmentLoader->load([
    $projectRoot . '/.env',
    $projectRoot . '/.env.local',
]);

$token = getenv('GITHUB_TOKEN');
if ($token === false || $token === '') {
    fwrite(STDERR, "Error: GITHUB_TOKEN environment variable is not set. Add it to your shell or to .env.local in the project root.\n");
    exit(1);
}

$itemLookbackDays = resolveItemLookbackDays();

$config = new BuildConfig(
    sourceScope: 'GitHub',
    topics: ['municipio-se', 'getmunicipio'],
    token: $token,
    outputDirectory: $projectRoot . '/public/data',
    generatedAt: new \DateTimeImmutable(),
    itemLookbackDays: $itemLookbackDays,
);

$aggregator = new GitHubSourceAggregator(
    new GitHubRestClient(new StreamHttpClient()),
);

$releaseAggregator = new GitHubReleaseAggregator(
    new GitHubRestClient(new StreamHttpClient()),
);

$writer = new JsonSourceWriter($config->outputDirectory());

foreach ([SourceType::Issues, SourceType::PullRequests] as $sourceType) {
    fwrite(STDOUT, sprintf("Fetching %s...\n", strtolower($sourceType->label())));
    $payload = $aggregator->aggregate($sourceType, $config);
    $filePath = $writer->write($payload);
    fwrite(STDOUT, sprintf("  Wrote %s\n", $filePath));
}

fwrite(STDOUT, "Fetching releases...\n");
$releasePayload = $releaseAggregator->aggregate($config, 'municipio-se', 'municipio-deployment');
$releaseFilePath = $writer->write($releasePayload);
fwrite(STDOUT, sprintf("  Wrote %s\n", $releaseFilePath));

/**
 * @return int
 */
function resolveItemLookbackDays(): int
{
    $configuredValue = getenv('ITEM_LOOKBACK_DAYS');

    if ($configuredValue === false || $configuredValue === '') {
        return 365;
    }

    $lookbackDays = filter_var($configuredValue, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

    if (!is_int($lookbackDays)) {
        fwrite(STDERR, "Error: ITEM_LOOKBACK_DAYS must be a positive integer.\n");
        exit(1);
    }

    return $lookbackDays;
}
