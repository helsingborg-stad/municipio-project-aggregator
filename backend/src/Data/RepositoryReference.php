<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

/**
 * Immutable GitHub repository reference.
 */
final class RepositoryReference
{
    /**
     * @param string $owner Repository owner.
     * @param string $name Repository name.
     */
    public function __construct(
        private readonly string $owner,
        private readonly string $name,
    ) {
    }

    /**
     * @return string
     */
    public function owner(): string
    {
        return $this->owner;
    }

    /**
     * @return string
     */
    public function name(): string
    {
        return $this->name;
    }

    /**
     * @return string
     */
    public function fullName(): string
    {
        return sprintf('%s/%s', $this->owner, $this->name);
    }
}