<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Support;

use MunicipioProjectAggregator\Backend\Contracts\EnvironmentLoaderInterface;

/**
 * Loads .env-style files for local development.
 */
final class LocalEnvironmentLoader implements EnvironmentLoaderInterface
{
    /**
     * @param array<int, string> $filePaths
     * @return void
     */
    public function load(array $filePaths): void
    {
        foreach ($filePaths as $filePath) {
            if (!is_file($filePath)) {
                continue;
            }

            $lines = file($filePath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if ($lines === false) {
                continue;
            }

            foreach ($lines as $line) {
                $trimmedLine = trim($line);
                if ($trimmedLine === '' || str_starts_with($trimmedLine, '#')) {
                    continue;
                }

                $separatorPosition = strpos($trimmedLine, '=');
                if ($separatorPosition === false) {
                    continue;
                }

                $key = trim(substr($trimmedLine, 0, $separatorPosition));
                $value = trim(substr($trimmedLine, $separatorPosition + 1));
                if ($key === '' || getenv($key) !== false) {
                    continue;
                }

                if (
                    (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                    (str_starts_with($value, "'") && str_ends_with($value, "'"))
                ) {
                    $value = substr($value, 1, -1);
                }

                putenv(sprintf('%s=%s', $key, $value));
                $_ENV[$key] = $value;
                $_SERVER[$key] = $value;
            }
        }
    }
}