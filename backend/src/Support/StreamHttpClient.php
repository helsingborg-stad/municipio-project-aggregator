<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Support;

use MunicipioProjectAggregator\Backend\Contracts\HttpClientInterface;
use RuntimeException;

/**
 * HTTP client backed by PHP stream contexts.
 */
final class StreamHttpClient implements HttpClientInterface
{
    /**
     * @param string $url
     * @param array<string, string> $headers
     * @param array<string, mixed> $body
     * @return array<string, mixed>
     */
    public function postJson(string $url, array $headers, array $body): array
    {
        $headerLines = [];
        foreach ($headers as $name => $value) {
            $headerLines[] = sprintf('%s: %s', $name, $value);
        }

        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => implode("\r\n", $headerLines),
                'content' => json_encode($body, JSON_THROW_ON_ERROR),
                'ignore_errors' => true,
            ],
        ]);

        $response = file_get_contents($url, false, $context);
        if ($response === false) {
            throw new RuntimeException(sprintf('HTTP request failed for %s', $url));
        }

        $statusLine = $http_response_header[0] ?? '';
        if (!preg_match('/\s(\d{3})\s/', $statusLine, $matches)) {
            throw new RuntimeException(sprintf('Unable to determine HTTP response status for %s', $url));
        }

        $statusCode = (int) $matches[1];
        if ($statusCode < 200 || $statusCode >= 300) {
            throw new RuntimeException(sprintf('HTTP %d: %s', $statusCode, $response));
        }

        $decoded = json_decode($response, true, 512, JSON_THROW_ON_ERROR);
        if (!is_array($decoded)) {
            throw new RuntimeException('HTTP response did not decode to an array.');
        }

        return $decoded;
    }
}