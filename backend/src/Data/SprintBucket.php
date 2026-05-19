<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

/**
 * Frontend payload for one project planning bucket.
 */
final class SprintBucket
{
    /**
     * @param string $label Display label for the planning bucket.
     * @param string $title Human readable bucket title.
     * @param string|null $iterationId GitHub iteration identifier.
     * @param string|null $startDate ISO 8601 bucket start date.
     * @param string|null $endDate ISO 8601 bucket end date.
     * @param array<int, SprintEntry> $items Linked issues and pull requests.
     */
    public function __construct(
        private readonly string $label,
        private readonly string $title,
        private readonly ?string $iterationId,
        private readonly ?string $startDate,
        private readonly ?string $endDate,
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
            'iterationId' => $this->iterationId,
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
