<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Contracts;

/**
 * Sends JSON HTTP requests.
 */
interface HttpClientInterface
{
    /**
     * Perform a JSON GET request.
     *
     * @param string $url The target URL.
     * @param array<string, string> $headers Request headers.
     * @return array<mixed>
     */
    public function getJson(string $url, array $headers): array;

    /**
     * Perform a JSON POST request.
     *
     * @param string $url The target URL.
     * @param array<string, string> $headers Request headers.
     * @param array<string, mixed> $body Request body.
     * @return array<string, mixed>
     */
    public function postJson(string $url, array $headers, array $body): array;
}