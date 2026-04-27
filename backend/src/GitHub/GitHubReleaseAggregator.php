<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\GitHub;

use MunicipioProjectAggregator\Backend\Config\BuildConfig;
use MunicipioProjectAggregator\Backend\Data\ReleaseEntry;
use MunicipioProjectAggregator\Backend\Data\ReleasePayload;
use MunicipioProjectAggregator\Backend\Data\RepositoryReference;

/**
 * Aggregates GitHub releases for a fixed repository.
 */
final class GitHubReleaseAggregator
{
    /**
     * @param GitHubRestClient $client GitHub REST client.
     */
    public function __construct(
        private readonly GitHubRestClient $client,
    ) {
    }

    /**
     * @param BuildConfig $config
     * @param string $owner
     * @param string $repositoryName
     * @return ReleasePayload
     */
    public function aggregate(BuildConfig $config, string $owner, string $repositoryName): ReleasePayload
    {
        $repository = new RepositoryReference(
            $owner,
            $repositoryName,
            '',
            sprintf('https://github.com/%s/%s', rawurlencode($owner), rawurlencode($repositoryName)),
        );

        $items = array_map(
            static fn (array $release): ReleaseEntry => ReleaseEntry::fromRestRelease($release),
            $this->client->listReleases($repository, $config->token()),
        );

        usort(
            $items,
            static fn (ReleaseEntry $left, ReleaseEntry $right): int => strcmp($right->publishedAt(), $left->publishedAt()),
        );

        return new ReleasePayload(
            'releases',
            $config->sourceScope(),
            $repository,
            $config->generatedAt()->format(DATE_ATOM),
            $items,
        );
    }
}