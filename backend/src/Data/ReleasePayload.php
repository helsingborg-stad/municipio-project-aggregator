<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

use MunicipioProjectAggregator\Backend\Contracts\JsonOutputPayloadInterface;

/**
 * Frontend payload for the release log.
 */
final class ReleasePayload implements JsonOutputPayloadInterface
{
    /**
     * @param string $source Source key used for the output filename.
     * @param string $sourceScope Display label for the data source.
     * @param RepositoryReference $repository Repository the releases belong to.
     * @param string $generatedAt ISO 8601 aggregation timestamp.
     * @param array<int, ReleaseEntry> $items Release entries.
     */
    public function __construct(
        private readonly string $source,
        private readonly string $sourceScope,
        private readonly RepositoryReference $repository,
        private readonly string $generatedAt,
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
            'source' => $this->source,
            'sourceScope' => $this->sourceScope,
            'generatedAt' => $this->generatedAt,
            'count' => count($this->items),
            'repository' => $this->repository->toArray(),
            'items' => array_map(
                static fn (ReleaseEntry $item): array => $item->toArray(),
                $this->items,
            ),
        ];
    }
}