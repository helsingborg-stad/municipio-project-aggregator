<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

/**
 * Immutable project planning entry delivered to the frontend.
 */
final class SprintEntry
{
    /**
     * @param string $projectItemId GitHub project item node identifier.
     * @param string $contentId GitHub content node identifier.
     * @param string $title Linked issue, pull request, or draft issue title.
     * @param string $url Linked issue or pull request URL.
     * @param int $number GitHub issue or pull request number.
     * @param string $repository Repository name with owner.
     * @param string $type Entry type label.
     * @param string $state GitHub state label.
     * @param string $status Project status label.
     * @param string $statusOptionId Project status option identifier.
     * @param string|null $iterationId GitHub iteration identifier.
     * @param string|null $iterationTitle GitHub iteration title.
     * @param string $updatedAt ISO 8601 last update timestamp.
     * @param string $description Issue or pull request body text.
     * @param array<int, array<string, string>> $labels Label information.
     * @param array<int, array<string, string>> $assignees Assignee information.
     * @param array<string, string|null>|null $milestone Milestone information.
     */
    public function __construct(
        private readonly string $projectItemId,
        private readonly string $contentId,
        private readonly string $title,
        private readonly string $url,
        private readonly int $number,
        private readonly string $repository,
        private readonly string $type,
        private readonly string $state,
        private readonly string $status,
        private readonly string $statusOptionId,
        private readonly ?string $iterationId,
        private readonly ?string $iterationTitle,
        private readonly string $updatedAt,
        private readonly string $description,
        private readonly array $labels,
        private readonly array $assignees,
        private readonly ?array $milestone,
    ) {
    }

    /**
     * @return string
     */
    public function title(): string
    {
        return $this->title;
    }

    /**
     * @return string
     */
    public function repository(): string
    {
        return $this->repository;
    }

    /**
     * @return string
     */
    public function status(): string
    {
        return $this->status;
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'projectItemId' => $this->projectItemId,
            'contentId' => $this->contentId,
            'title' => $this->title,
            'url' => $this->url,
            'number' => $this->number,
            'repository' => $this->repository,
            'type' => $this->type,
            'state' => $this->state,
            'status' => $this->status,
            'statusOptionId' => $this->statusOptionId,
            'iterationId' => $this->iterationId,
            'iterationTitle' => $this->iterationTitle,
            'updatedAt' => $this->updatedAt,
            'description' => $this->description,
            'labels' => $this->labels,
            'assignees' => $this->assignees,
            'milestone' => $this->milestone,
        ];
    }
}
