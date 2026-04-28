<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

/**
 * Immutable sprint entry delivered to the frontend.
 */
final class SprintEntry
{
    /**
     * @param string $title Linked issue or pull request title.
     * @param string $url Linked issue or pull request URL.
     * @param int $number GitHub issue or pull request number.
     * @param string $repository Repository name with owner.
     * @param string $type Entry type label.
     * @param string $state GitHub state label.
     * @param string $status Project status label.
     */
    public function __construct(
        private readonly string $title,
        private readonly string $url,
        private readonly int $number,
        private readonly string $repository,
        private readonly string $type,
        private readonly string $state,
        private readonly string $status,
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
     * @return array<string, string|int>
     */
    public function toArray(): array
    {
        return [
            'title' => $this->title,
            'url' => $this->url,
            'number' => $this->number,
            'repository' => $this->repository,
            'type' => $this->type,
            'state' => $this->state,
            'status' => $this->status,
        ];
    }
}