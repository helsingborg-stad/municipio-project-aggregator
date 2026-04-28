<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

use MunicipioProjectAggregator\Backend\Contracts\JsonOutputPayloadInterface;

/**
 * Frontend payload describing current and upcoming sprint work.
 */
final class SprintPayload implements JsonOutputPayloadInterface
{
    /**
     * @param string $source Source key used for the output filename.
     * @param string $sourceScope Display label for the data source.
     * @param string $generatedAt ISO 8601 aggregation timestamp.
     * @param array<string, string|int> $project GitHub project metadata.
     * @param array<string, string|int>|null $view Active project view metadata.
     * @param string $currentFilter Current project filter text.
     * @param SprintBucket|null $currentSprint Current sprint bucket.
     * @param SprintBucket|null $nextSprint Next sprint bucket.
     */
    public function __construct(
        private readonly string $source,
        private readonly string $sourceScope,
        private readonly string $generatedAt,
        private readonly array $project,
        private readonly ?array $view,
        private readonly string $currentFilter,
        private readonly ?SprintBucket $currentSprint,
        private readonly ?SprintBucket $nextSprint,
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
            'count' => ($this->currentSprint?->itemCount() ?? 0) + ($this->nextSprint?->itemCount() ?? 0),
            'project' => $this->project,
            'view' => $this->view,
            'currentFilter' => $this->currentFilter,
            'currentSprint' => $this->currentSprint?->toArray(),
            'nextSprint' => $this->nextSprint?->toArray(),
        ];
    }
}