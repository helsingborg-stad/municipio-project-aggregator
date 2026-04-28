<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

/**
 * Frontend payload for one sprint window.
 */
final class SprintBucket
{
    /**
     * @param string $label Display label for the sprint bucket.
     * @param string $title Iteration title.
     * @param string $startDate ISO 8601 sprint start date.
     * @param string $endDate ISO 8601 sprint end date.
     * @param array<int, SprintEntry> $items Linked issues and pull requests.
     */
    public function __construct(
        private readonly string $label,
        private readonly string $title,
        private readonly string $startDate,
        private readonly string $endDate,
        private readonly array $items,
    ) {
    }

    /**
     * @return int
     */
    public function itemCount(): int
    {
        return count($this->items);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'label' => $this->label,
            'title' => $this->title,
            'startDate' => $this->startDate,
            'endDate' => $this->endDate,
            'itemCount' => $this->itemCount(),
            'items' => array_map(
                static fn (SprintEntry $item): array => $item->toArray(),
                $this->items,
            ),
        ];
    }
}