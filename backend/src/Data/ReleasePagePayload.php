<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

use MunicipioProjectAggregator\Backend\Contracts\JsonOutputPayloadInterface;

/**
 * Frontend payload for one paginated release log page.
 */
final class ReleasePagePayload implements JsonOutputPayloadInterface
{
    /**
     * @param string $source Source key used for the output filename.
     * @param string $sourceScope Display label for the data source.
     * @param RepositoryReference $repository Repository the releases belong to.
     * @param string $generatedAt ISO 8601 aggregation timestamp.
     * @param int $totalCount Total number of releases across all pages.
     * @param int $pageSize Number of releases per page.
     * @param int $pageNumber Current page number.
     * @param int $pageCount Total page count.
     * @param array<int, ReleaseEntry> $items Release entries for this page.
     */
    public function __construct(
        private readonly string $source,
        private readonly string $sourceScope,
        private readonly RepositoryReference $repository,
        private readonly string $generatedAt,
        private readonly int $totalCount,
        private readonly int $pageSize,
        private readonly int $pageNumber,
        private readonly int $pageCount,
        private readonly array $items,
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
            'pageNumber' => $this->pageNumber,
            'pageCount' => $this->pageCount,
            'repository' => $this->repository->toArray(),
            'items' => array_map(
                static fn (ReleaseEntry $item): array => $item->toArray(),
                $this->items,
            ),
        ];
    }
}