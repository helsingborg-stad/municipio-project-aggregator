<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\GitHub;

use MunicipioProjectAggregator\Backend\Contracts\HttpClientInterface;
use MunicipioProjectAggregator\Backend\Data\RepositoryReference;
use RuntimeException;

/**
 * GitHub REST client used for repository topic and open item discovery.
 */
final class GitHubRestClient
{
    private const API_URL = 'https://api.github.com';
    private const USER_AGENT = 'municipio-project-aggregator/2.0';
    private const PAGE_SIZE = 100;

    private bool $shouldUseAuthentication = true;

    /**
     * @param HttpClientInterface $httpClient HTTP client implementation.
     */
    public function __construct(private readonly HttpClientInterface $httpClient)
    {
    }

    /**
     * @param array<int, string> $topics
     * @param string $token
     * @return array<int, RepositoryReference>
     */
    public function listRepositoriesByTopics(array $topics, string $token): array
    {
        $repositoriesByName = [];

        foreach ($topics as $topic) {
            $page = 1;

            do {
                $response = $this->getJson(
                    sprintf(
                        '%s/search/repositories?q=topic:%s+archived:false&per_page=%d&page=%d',
                        self::API_URL,
                        rawurlencode($topic),
                        self::PAGE_SIZE,
                        $page,
                    ),
                    $token,
                );

                $items = $response['items'] ?? [];
                if (!is_array($items)) {
                    $items = [];
                }

                foreach ($items as $repository) {
                    if (!is_array($repository)) {
                        continue;
                    }

                    $owner = is_array($repository['owner'] ?? null) ? ($repository['owner']['login'] ?? null) : null;
                    $name = $repository['name'] ?? null;

                    if (is_string($owner) && $owner !== '' && is_string($name) && $name !== '') {
                        $repositoriesByName[sprintf('%s/%s', $owner, $name)] = new RepositoryReference(
                            $owner,
                            $name,
                            is_string($repository['description'] ?? null) ? $repository['description'] : '',
                            is_string($repository['html_url'] ?? null) ? $repository['html_url'] : '',
                        );
                    }
                }

                $page++;
            } while (count($items) === self::PAGE_SIZE);
        }

        return array_values($repositoriesByName);
    }

    /**
     * @param SourceType $sourceType
     * @param RepositoryReference $repository
     * @param string $token
     * @return array<int, array<string, mixed>>
     */
    public function listOpenItems(SourceType $sourceType, RepositoryReference $repository, string $token): array
    {
        $items = [];
        $page = 1;

        do {
            $endpoint = $sourceType === SourceType::PullRequests ? 'pulls' : 'issues';
            $response = $this->getJson(
                sprintf(
                    '%s/repos/%s/%s/%s?state=open&per_page=%d&page=%d',
                    self::API_URL,
                    rawurlencode($repository->owner()),
                    rawurlencode($repository->name()),
                    $endpoint,
                    self::PAGE_SIZE,
                    $page,
                ),
                $token,
            );

            foreach ($response as $item) {
                if (!is_array($item)) {
                    continue;
                }

                if ($sourceType === SourceType::Issues && array_key_exists('pull_request', $item)) {
                    continue;
                }

                $items[] = $item;
            }

            $page++;
        } while (count($response) === self::PAGE_SIZE);

        return $items;
    }

    /**
     * @param RepositoryReference $repository
     * @param int $issueNumber
     * @param string $token
     * @return array<string, mixed>
     */
    public function getIssueDetails(RepositoryReference $repository, int $issueNumber, string $token): array
    {
        $response = $this->getJson(
            sprintf(
                '%s/repos/%s/%s/issues/%d',
                self::API_URL,
                rawurlencode($repository->owner()),
                rawurlencode($repository->name()),
                $issueNumber,
            ),
            $token,
        );

        /** @var array<string, mixed> $response */
        return $response;
    }

    /**
     * @param RepositoryReference $repository
     * @param int $issueNumber
     * @param string $token
     * @return array<int, array<string, mixed>>
     */
    public function listTimelineEvents(RepositoryReference $repository, int $issueNumber, string $token): array
    {
        $response = $this->getJson(
            sprintf(
                '%s/repos/%s/%s/issues/%d/timeline?per_page=100',
                self::API_URL,
                rawurlencode($repository->owner()),
                rawurlencode($repository->name()),
                $issueNumber,
            ),
            $token,
        );

        if (!is_array($response)) {
            return [];
        }

        return array_values(array_filter($response, static fn (mixed $event): bool => is_array($event)));
    }

    /**
     * @param RepositoryReference $repository
     * @param int $issueNumber
     * @param string $token
     * @return array<int, array<string, mixed>>
     */
    public function listSubIssues(RepositoryReference $repository, int $issueNumber, string $token): array
    {
        $subIssues = [];
        $page = 1;

        do {
            try {
                $response = $this->getJson(
                    sprintf(
                        '%s/repos/%s/%s/issues/%d/sub_issues?per_page=%d&page=%d',
                        self::API_URL,
                        rawurlencode($repository->owner()),
                        rawurlencode($repository->name()),
                        $issueNumber,
                        self::PAGE_SIZE,
                        $page,
                    ),
                    $token,
                );
            } catch (RuntimeException $exception) {
                if (!$this->shouldIgnoreMissingSubIssues($exception)) {
                    throw $exception;
                }

                return [];
            }

            if (!is_array($response)) {
                return $subIssues;
            }

            foreach ($response as $subIssue) {
                if (is_array($subIssue)) {
                    $subIssues[] = $subIssue;
                }
            }

            $page++;
        } while (count($response) === self::PAGE_SIZE);

        return $subIssues;
    }

    /**
     * @param RuntimeException $exception
     * @return bool
     */
    private function shouldIgnoreMissingSubIssues(RuntimeException $exception): bool
    {
        return str_contains($exception->getMessage(), 'HTTP 404')
            || str_contains($exception->getMessage(), 'HTTP 410');
    }

    /**
     * @param string $url
     * @param string $token
     * @return array<mixed>
     */
    private function getJson(string $url, string $token): array
    {
        if (!$this->shouldUseAuthentication || $token === '') {
            return $this->httpClient->getJson($url, $this->headers(null));
        }

        $authenticatedHeaders = $this->headers($token);

        try {
            return $this->httpClient->getJson($url, $authenticatedHeaders);
        } catch (RuntimeException $exception) {
            if (!$this->shouldRetryWithoutAuthentication($exception)) {
                throw $exception;
            }

            $this->shouldUseAuthentication = false;
        }

        return $this->httpClient->getJson($url, $this->headers(null));
    }

    /**
     * @param RuntimeException $exception
     * @return bool
     */
    private function shouldRetryWithoutAuthentication(RuntimeException $exception): bool
    {
        return str_contains($exception->getMessage(), 'HTTP 403')
            || str_contains($exception->getMessage(), 'HTTP 422');
    }

    /**
     * @param string|null $token
     * @return array<string, string>
     */
    private function headers(?string $token): array
    {
        $headers = [
            'Accept' => 'application/vnd.github+json',
            'User-Agent' => self::USER_AGENT,
        ];

        if ($token !== null && $token !== '') {
            $headers['Authorization'] = sprintf('Bearer %s', $token);
        }

        return $headers;
    }
}
