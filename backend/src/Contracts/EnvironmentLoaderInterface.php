<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Contracts;

/**
 * Loads environment variables from one or more local files.
 */
interface EnvironmentLoaderInterface
{
    /**
     * Load environment variables from the provided file paths.
     *
     * @param array<int, string> $filePaths Absolute file paths.
     * @return void
     */
    public function load(array $filePaths): void;
}