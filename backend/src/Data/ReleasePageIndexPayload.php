<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

use MunicipioProjectAggregator\Backend\Contracts\JsonOutputPayloadInterface;

/**
 * Frontend payload describing the release log page structure.
 */
final class ReleasePageIndexPayload implements JsonOutputPayloadInterface
{
    /**
     * @param string $source Source key used for the output filename.
     * @param string $sourceScope Display label for the data source.
     * @param RepositoryReference $repository Repository the releases belong to.
     * @param string $generatedAt ISO 8601 aggregation timestamp.
     * @param int $totalCount Total number of releases.
     * @param int $pageSize Number of releases per page.
     * @param array<int, ReleasePage> $pages Available release pages.
     */
    public function __construct(
        private readonly string $source,
        private readonly string $sourceScope,
        private readonly RepositoryReference $repository,
        private readonly string $generatedAt,
        private readonly int $totalCount,
        private readonly int $pageSize,
        private readonly array $pages,
    ) {
    }

    /**
     * @return string
     */
    public function source(): string
    {
        return $this->source;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'source' => 'releases',
            'sourceScope' => $this->sourceScope,
            'generatedAt' => $this->generatedAt,
            'count' => $this->totalCount,
            'pageSize' => $this->pageSize,
            'pageCount' => count($this->pages),
            'repository' => $this->repository->toArray(),
            'pages' => array_map(
                static fn (ReleasePage $page): array => $page->toArray(),
                $this->pages,
            ),
        ];
    }
}