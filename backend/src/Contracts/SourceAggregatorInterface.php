<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Contracts;

use MunicipioProjectAggregator\Backend\Config\BuildConfig;
use MunicipioProjectAggregator\Backend\Data\SourcePayload;
use MunicipioProjectAggregator\Backend\GitHub\SourceType;

/**
 * Aggregates a single source into a frontend-readable payload.
 */
interface SourceAggregatorInterface
{
    /**
     * Aggregate one source type.
     *
     * @param SourceType $sourceType The source to aggregate.
     * @param BuildConfig $config The build configuration.
     * @return SourcePayload
     */
    public function aggregate(SourceType $sourceType, BuildConfig $config): SourcePayload;
}