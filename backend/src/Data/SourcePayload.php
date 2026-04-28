<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

use MunicipioProjectAggregator\Backend\Contracts\JsonOutputPayloadInterface;

/**
 * Frontend payload for one source file.
 */
final class SourcePayload implements JsonOutputPayloadInterface
{
    /**
     * @param string $source Source key used for the output filename.
     * @param string $sourceScope Display label for the repository discovery scope.
     * @param array<int, string> $topics Repository topics used in the query.
     * @param string $generatedAt ISO 8601 aggregation timestamp.
     * @param array<int, RepositoryReference> $repositories Matched repositories.
     * @param array<int, array<string, string>> $authors Authors discovered across the repository history.
     * @param array<int, AggregatedItem> $items Aggregated items.
     */
    public function __construct(
        private readonly string $source,
        private readonly string $sourceScope,
        private readonly array $topics,
        private readonly string $generatedAt,
        private readonly array $repositories,
        private readonly array $authors,
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
            'topics' => $this->topics,
            'generatedAt' => $this->generatedAt,
            'count' => count($this->items),
            'repositories' => array_map(
                static fn (RepositoryReference $repository): array => $repository->toArray(),
                $this->repositories,
            ),
            'authors' => $this->authors,
            'items' => array_map(
                static fn (AggregatedItem $item): array => $item->toArray(),
                $this->items,
            ),
        ];
    }
}
