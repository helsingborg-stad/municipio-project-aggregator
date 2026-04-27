<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Output;

use MunicipioProjectAggregator\Backend\Contracts\JsonOutputPayloadInterface;
use RuntimeException;

/**
 * Persists aggregated source payloads as JSON files.
 */
final class JsonSourceWriter
{
    /**
     * @param string $outputDirectory Directory where JSON files are written.
     */
    public function __construct(private readonly string $outputDirectory)
    {
    }

    /**
    * @param JsonOutputPayloadInterface $payload Payload to persist.
     * @return string Written file path.
     */
    public function write(JsonOutputPayloadInterface $payload): string
    {
        if (!is_dir($this->outputDirectory) && !mkdir($this->outputDirectory, 0777, true) && !is_dir($this->outputDirectory)) {
            throw new RuntimeException(sprintf('Unable to create output directory: %s', $this->outputDirectory));
        }

        $filePath = sprintf('%s/%s.json', rtrim($this->outputDirectory, '/'), $payload->source());
        $fileDirectory = dirname($filePath);

        if (!is_dir($fileDirectory) && !mkdir($fileDirectory, 0777, true) && !is_dir($fileDirectory)) {
            throw new RuntimeException(sprintf('Unable to create output directory: %s', $fileDirectory));
        }

        $encodedPayload = json_encode($payload->toArray(), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);

        $result = file_put_contents($filePath, $encodedPayload . PHP_EOL);
        if ($result === false) {
            throw new RuntimeException(sprintf('Unable to write JSON payload to %s', $filePath));
        }

        return $filePath;
    }
}