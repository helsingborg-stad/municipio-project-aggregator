<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

use MunicipioProjectAggregator\Backend\Contracts\JsonOutputPayloadInterface;

/**
 * Frontend payload describing backlog and sprint planning data.
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
     * @param array<string, mixed> $fields Project field metadata.
     * @param SprintBucket $backlog Backlog bucket.
     * @param array<int, SprintBucket> $sprints All configured sprint buckets.
     * @param SprintBucket|null $completedSprint Completed sprint bucket.
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
        private readonly array $fields,
        private readonly SprintBucket $backlog,
        private readonly array $sprints,
        private readonly ?SprintBucket $completedSprint,
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
            'count' => $this->backlog->itemCount()
                + array_sum(array_map(
                    static fn (SprintBucket $bucket): int => $bucket->itemCount(),
                    $this->sprints,
                )),
            'project' => $this->project,
            'view' => $this->view,
            'currentFilter' => $this->currentFilter,
            'fields' => $this->fields,
            'backlog' => $this->backlog->toArray(),
            'sprints' => array_map(
                static fn (SprintBucket $bucket): array => $bucket->toArray(),
                $this->sprints,
            ),
            'completedSprint' => $this->completedSprint?->toArray(),
            'currentSprint' => $this->currentSprint?->toArray(),
            'nextSprint' => $this->nextSprint?->toArray(),
        ];
    }
}
