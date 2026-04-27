<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Contracts;

/**
 * Payload contract for JSON files written to the frontend data directory.
 */
interface JsonOutputPayloadInterface
{
    /**
     * @return string
     */
    public function source(): string;

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array;
}