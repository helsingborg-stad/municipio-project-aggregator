<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Config;

use DateTimeImmutable;

/**
 * Immutable runtime configuration for one aggregation run.
 */
final class BuildConfig
{
    /**
     * @param string $organization GitHub organization name.
     * @param string $label Label used to filter issues and pull requests.
     * @param string $token GitHub access token.
     * @param string $outputDirectory Directory where JSON files are written.
     * @param DateTimeImmutable $generatedAt Timestamp for the aggregation run.
     */
    public function __construct(
        private readonly string $organization,
        private readonly string $label,
        private readonly string $token,
        private readonly string $outputDirectory,
        private readonly DateTimeImmutable $generatedAt,
    ) {
    }

    /**
     * @return string
     */
    public function organization(): string
    {
        return $this->organization;
    }

    /**
     * @return string
     */
    public function label(): string
    {
        return $this->label;
    }

    /**
     * @return string
     */
    public function token(): string
    {
        return $this->token;
    }

    /**
     * @return string
     */
    public function outputDirectory(): string
    {
        return $this->outputDirectory;
    }

    /**
     * @return DateTimeImmutable
     */
    public function generatedAt(): DateTimeImmutable
    {
        return $this->generatedAt;
    }
}