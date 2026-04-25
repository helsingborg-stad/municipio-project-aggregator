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
     * @param string $sourceScope Display label for the repository discovery scope.
     * @param array<int, string> $topics Repository topics used to select repositories.
     * @param string $token GitHub access token.
     * @param string $outputDirectory Directory where JSON files are written.
     * @param DateTimeImmutable $generatedAt Timestamp for the aggregation run.
     */
    public function __construct(
        private readonly string $sourceScope,
        private readonly array $topics,
        private readonly string $token,
        private readonly string $outputDirectory,
        private readonly DateTimeImmutable $generatedAt,
    ) {
    }

    /**
     * @return string
     */
    public function sourceScope(): string
    {
        return $this->sourceScope;
    }

    /**
     * @return array<int, string>
     */
    public function topics(): array
    {
        return $this->topics;
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