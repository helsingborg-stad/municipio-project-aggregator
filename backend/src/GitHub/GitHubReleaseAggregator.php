<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\GitHub;

use MunicipioProjectAggregator\Backend\Config\BuildConfig;
use MunicipioProjectAggregator\Backend\Data\ReleaseEntry;
use MunicipioProjectAggregator\Backend\Data\ReleasePage;
use MunicipioProjectAggregator\Backend\Data\ReleasePageIndexPayload;
use MunicipioProjectAggregator\Backend\Data\ReleasePagePayload;
use MunicipioProjectAggregator\Backend\Data\ReleasePaginationPayload;
use MunicipioProjectAggregator\Backend\Data\RepositoryReference;

/**
 * Aggregates GitHub releases for a fixed repository.
 */
final class GitHubReleaseAggregator
{
    private const PAGE_SIZE = 10;

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
     * @return ReleasePaginationPayload
     */
    public function aggregate(BuildConfig $config, string $owner, string $repositoryName): ReleasePaginationPayload
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

        $pageChunks = array_chunk($items, self::PAGE_SIZE);
        $pageCount = count($pageChunks);
        $pageMetadata = [];
        $pagePayloads = [];

        foreach ($pageChunks as $pageIndex => $pageItems) {
            $pageNumber = $pageIndex + 1;
            $pageFile = sprintf('page-%d.json', $pageNumber);
            $pageMetadata[] = new ReleasePage($pageNumber, $pageFile, count($pageItems));
            $pagePayloads[] = new ReleasePagePayload(
                sprintf('releases/%s', pathinfo($pageFile, PATHINFO_FILENAME)),
                $config->sourceScope(),
                $repository,
                $config->generatedAt()->format(DATE_ATOM),
                count($items),
                self::PAGE_SIZE,
                $pageNumber,
                $pageCount,
                $pageItems,
            );
        }

        return new ReleasePaginationPayload(
            new ReleasePageIndexPayload(
                'releases/pageIndex',
                $config->sourceScope(),
                $repository,
                $config->generatedAt()->format(DATE_ATOM),
                count($items),
                self::PAGE_SIZE,
                $pageMetadata,
            ),
            $pagePayloads,
        );
    }
}