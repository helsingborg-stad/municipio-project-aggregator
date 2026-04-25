<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\GitHub;

use MunicipioProjectAggregator\Backend\Contracts\HttpClientInterface;
use RuntimeException;

/**
 * Minimal GitHub GraphQL client.
 */
final class GitHubGraphQlClient
{
    private const API_URL = 'https://api.github.com/graphql';
    private const USER_AGENT = 'municipio-project-aggregator/2.0';

    /**
     * @param HttpClientInterface $httpClient HTTP client implementation.
     */
    public function __construct(private readonly HttpClientInterface $httpClient)
    {
    }

    /**
     * Execute a GraphQL query.
     *
     * @param string $token GitHub token.
     * @param string $query GraphQL query string.
     * @return array<string, mixed>
     */
    public function runQuery(string $token, string $query): array
    {
        $response = $this->httpClient->postJson(
            self::API_URL,
            [
                'Authorization' => sprintf('Bearer %s', $token),
                'Content-Type' => 'application/json',
                'User-Agent' => self::USER_AGENT,
            ],
            ['query' => $query],
        );

        if (isset($response['errors'])) {
            throw new RuntimeException(sprintf('GraphQL errors: %s', json_encode($response['errors'], JSON_THROW_ON_ERROR)));
        }

        $data = $response['data'] ?? null;
        if (!is_array($data)) {
            throw new RuntimeException('GitHub GraphQL response did not contain a valid data payload.');
        }

        return $data;
    }
}