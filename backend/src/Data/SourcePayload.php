<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

/**
 * Frontend payload for one source file.
 */
final class SourcePayload
{
    /**
     * @param string $source Source key used for the output filename.
     * @param string $organization GitHub organization name.
     * @param string $label Label used in the query.
     * @param string $generatedAt ISO 8601 aggregation timestamp.
     * @param array<int, AggregatedItem> $items Aggregated items.
     */
    public function __construct(
        private readonly string $source,
        private readonly string $organization,
        private readonly string $label,
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
            'organization' => $this->organization,
            'label' => $this->label,
            'generatedAt' => $this->generatedAt,
            'count' => count($this->items),
            'items' => array_map(
                static fn (AggregatedItem $item): array => $item->toArray(),
                $this->items,
            ),
        ];
    }
}