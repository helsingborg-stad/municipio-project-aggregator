#!/usr/bin/env php
<?php

declare(strict_types=1);

use MunicipioProjectAggregator\Backend\Config\BuildConfig;
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

$config = new BuildConfig(
    organization: 'helsingborg-stad',
    topics: ['municipio', 'getmunicipio'],
    token: $token,
    outputDirectory: $projectRoot . '/public/data',
    generatedAt: new \DateTimeImmutable(),
);

$aggregator = new GitHubSourceAggregator(
    new GitHubRestClient(new StreamHttpClient()),
);

$writer = new JsonSourceWriter($config->outputDirectory());

foreach ([SourceType::Issues, SourceType::PullRequests] as $sourceType) {
    fwrite(STDOUT, sprintf("Fetching %s...\n", strtolower($sourceType->label())));
    $payload = $aggregator->aggregate($sourceType, $config);
    $filePath = $writer->write($payload);
    fwrite(STDOUT, sprintf("  Wrote %s\n", $filePath));
}