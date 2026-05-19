#!/usr/bin/env php
<?php

declare(strict_types=1);

use MunicipioProjectAggregator\Backend\Config\BuildConfig;
use MunicipioProjectAggregator\Backend\GitHub\GitHubReleaseAggregator;
use MunicipioProjectAggregator\Backend\GitHub\GitHubGraphQlClient;
use MunicipioProjectAggregator\Backend\GitHub\GitHubProjectSprintAggregator;
use MunicipioProjectAggregator\Backend\GitHub\GitHubRestClient;
use MunicipioProjectAggregator\Backend\GitHub\GitHubSourceAggregator;
use MunicipioProjectAggregator\Backend\GitHub\GraphQlSearchQueryBuilder;
use MunicipioProjectAggregator\Backend\GitHub\SourceType;
use MunicipioProjectAggregator\Backend\Output\JsonSourceWriter;
use MunicipioProjectAggregator\Backend\Support\BuildTarget;
use MunicipioProjectAggregator\Backend\Support\BuildTargetResolver;
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
$buildTargets = resolveBuildTargets();
$trackedTopics = resolveTrackedTopics();
$projectOwner = resolveProjectOwner();
$projectNumber = resolveProjectNumber();
$releaseRepository = resolveReleaseRepository();

$config = new BuildConfig(
    sourceScope: 'GitHub',
    topics: $trackedTopics,
    token: $token,
    outputDirectory: $projectRoot . '/public/data',
    generatedAt: new \DateTimeImmutable(),
    itemLookbackDays: $itemLookbackDays,
);

$aggregator = new GitHubSourceAggregator(
    new GitHubRestClient(new StreamHttpClient()),
    new GitHubGraphQlClient(new StreamHttpClient()),
    new GraphQlSearchQueryBuilder(),
);

$releaseAggregator = new GitHubReleaseAggregator(
    new GitHubRestClient(new StreamHttpClient()),
);

$sprintAggregator = new GitHubProjectSprintAggregator(
    new GitHubGraphQlClient(new StreamHttpClient()),
);

$writer = new JsonSourceWriter($config->outputDirectory());

foreach ($buildTargets as $buildTarget) {
    if ($buildTarget === BuildTarget::Issues) {
        writeSourcePayload($aggregator, SourceType::Issues, $config, $writer);
        continue;
    }

    if ($buildTarget === BuildTarget::PullRequests) {
        writeSourcePayload($aggregator, SourceType::PullRequests, $config, $writer);
        continue;
    }

    if ($buildTarget === BuildTarget::Sprints) {
        writeSprintPayload($sprintAggregator, $config, $writer, $projectOwner, $projectNumber);
        continue;
    }

    writeReleasePayloads($releaseAggregator, $config, $writer, $releaseRepository['owner'], $releaseRepository['name']);
}

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

/**
 * @return array<int, string>
 */
function resolveTrackedTopics(): array
{
    $configuredValue = getenv('GITHUB_TOPICS');

    if ($configuredValue === false || trim($configuredValue) === '') {
        return ['municipio-se', 'getmunicipio'];
    }

    $topics = array_values(array_filter(array_map(
        static fn (string $topic): string => trim($topic),
        explode(',', $configuredValue),
    )));

    if ($topics === []) {
        fwrite(STDERR, "Error: GITHUB_TOPICS must contain at least one topic.\n");
        exit(1);
    }

    return $topics;
}

/**
 * @return string
 */
function resolveProjectOwner(): string
{
    $configuredValue = getenv('GITHUB_PROJECT_OWNER');

    if ($configuredValue === false || trim($configuredValue) === '') {
        return 'helsingborg-stad';
    }

    return trim($configuredValue);
}

/**
 * @return int
 */
function resolveProjectNumber(): int
{
    $configuredValue = getenv('GITHUB_PROJECT_NUMBER');

    if ($configuredValue === false || $configuredValue === '') {
        return 7;
    }

    $projectNumber = filter_var($configuredValue, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);

    if (!is_int($projectNumber)) {
        fwrite(STDERR, "Error: GITHUB_PROJECT_NUMBER must be a positive integer.\n");
        exit(1);
    }

    return $projectNumber;
}

/**
 * @return array{owner: string, name: string}
 */
function resolveReleaseRepository(): array
{
    $configuredValue = getenv('GITHUB_RELEASE_REPOSITORY');

    if ($configuredValue === false || trim($configuredValue) === '') {
        return [
            'owner' => 'municipio-se',
            'name' => 'municipio-deployment',
        ];
    }

    [$owner, $name] = array_pad(explode('/', trim($configuredValue), 2), 2, '');

    if ($owner === '' || $name === '') {
        fwrite(STDERR, "Error: GITHUB_RELEASE_REPOSITORY must use the owner/name format.\n");
        exit(1);
    }

    return [
        'owner' => $owner,
        'name' => $name,
    ];
}

/**
 * @return array<int, BuildTarget>
 */
function resolveBuildTargets(): array
{
    try {
        return (new BuildTargetResolver())->resolve(getenv('BUILD_TARGETS'));
    } catch (RuntimeException $exception) {
        fwrite(STDERR, sprintf("Error: %s\n", $exception->getMessage()));
        exit(1);
    }
}

/**
 * @param GitHubSourceAggregator $aggregator
 * @param SourceType $sourceType
 * @param BuildConfig $config
 * @param JsonSourceWriter $writer
 * @return void
 */
function writeSourcePayload(
    GitHubSourceAggregator $aggregator,
    SourceType $sourceType,
    BuildConfig $config,
    JsonSourceWriter $writer,
): void {
    fwrite(STDOUT, sprintf("Fetching %s...\n", strtolower($sourceType->label())));
    $payload = $aggregator->aggregate($sourceType, $config);
    $filePath = $writer->write($payload);
    fwrite(STDOUT, sprintf("  Wrote %s\n", $filePath));
}

/**
 * @param GitHubReleaseAggregator $releaseAggregator
 * @param BuildConfig $config
 * @param JsonSourceWriter $writer
 * @return void
 */
function writeReleasePayloads(
    GitHubReleaseAggregator $releaseAggregator,
    BuildConfig $config,
    JsonSourceWriter $writer,
    string $owner,
    string $repository,
): void {
    fwrite(STDOUT, "Fetching releases...\n");
    $releasePayload = $releaseAggregator->aggregate($config, $owner, $repository);
    $releaseIndexFilePath = $writer->write($releasePayload->pageIndexPayload());
    fwrite(STDOUT, sprintf("  Wrote %s\n", $releaseIndexFilePath));

    foreach ($releasePayload->pagePayloads() as $pagePayload) {
        $releasePageFilePath = $writer->write($pagePayload);
        fwrite(STDOUT, sprintf("  Wrote %s\n", $releasePageFilePath));
    }
}

/**
 * @param GitHubProjectSprintAggregator $sprintAggregator
 * @param BuildConfig $config
 * @param JsonSourceWriter $writer
 * @return void
 */
function writeSprintPayload(
    GitHubProjectSprintAggregator $sprintAggregator,
    BuildConfig $config,
    JsonSourceWriter $writer,
    string $projectOwner,
    int $projectNumber,
): void {
    fwrite(STDOUT, "Fetching sprints...\n");
    $payload = $sprintAggregator->aggregate($config, $projectOwner, $projectNumber);
    $filePath = $writer->write($payload);
    fwrite(STDOUT, sprintf("  Wrote %s\n", $filePath));
}
