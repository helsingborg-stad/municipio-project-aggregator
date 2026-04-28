<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\GitHub;

use DateTimeImmutable;
use Exception;
use MunicipioProjectAggregator\Backend\Config\BuildConfig;
use MunicipioProjectAggregator\Backend\Contracts\SourceAggregatorInterface;
use MunicipioProjectAggregator\Backend\Data\AggregatedItem;
use MunicipioProjectAggregator\Backend\Data\SourcePayload;

/**
 * Aggregates paginated GitHub search results for one source type.
 */
final class GitHubSourceAggregator implements SourceAggregatorInterface
{
    /**
     * @param GitHubRestClient $client GitHub REST client.
     */
    public function __construct(
        private readonly GitHubRestClient $restClient,
        private readonly GitHubGraphQlClient $graphQlClient,
        private readonly GraphQlSearchQueryBuilder $queryBuilder,
    ) {
    }

    /**
     * @param SourceType $sourceType
     * @param BuildConfig $config
     * @return SourcePayload
     */
    public function aggregate(SourceType $sourceType, BuildConfig $config): SourcePayload
    {
        $itemsByUrl = [];
        $authorsByLogin = [];
        $repositories = $this->restClient->listRepositoriesByTopics($config->topics(), $config->token());
        $oldestIncludedCreatedAt = $config->oldestIncludedCreatedAt();

        foreach ($repositories as $repository) {
            foreach ($this->restClient->listContributors($repository, $config->token()) as $contributor) {
                $this->rememberAuthor($authorsByLogin, $contributor);
            }

            $searchResult = $this->listGraphQlItemsAndAuthors(
                $sourceType,
                $repository->owner(),
                $repository->name(),
                $config->token(),
                $oldestIncludedCreatedAt,
            );

            foreach ($searchResult['authors'] as $author) {
                $this->rememberAuthor($authorsByLogin, $author);
            }

            foreach ($searchResult['items'] as $itemNode) {
                $item = AggregatedItem::fromNode($itemNode);
                $itemData = $item->toArray();

                if ($itemData['url'] === '') {
                    continue;
                }

                $itemsByUrl[$itemData['url']] = $item;
            }
        }

        $items = array_values($itemsByUrl);
        $authors = array_values($authorsByLogin);

        usort(
            $items,
            static fn (AggregatedItem $left, AggregatedItem $right): int => strcmp($right->createdAt(), $left->createdAt()),
        );

        usort(
            $authors,
            static fn (array $left, array $right): int => strcmp($left['login'] ?? '', $right['login'] ?? ''),
        );

        return new SourcePayload(
            $sourceType->value,
            $config->sourceScope(),
            $config->topics(),
            $config->generatedAt()->format(DATE_ATOM),
            $repositories,
            $authors,
            $items,
        );
    }

    /**
     * @param array<string, mixed> $itemData
     * @param DateTimeImmutable $oldestIncludedCreatedAt
     * @return bool
     */
    private function wasCreatedWithinWindow(array $itemData, DateTimeImmutable $oldestIncludedCreatedAt): bool
    {
        $createdAt = $itemData['created_at'] ?? null;

        if (!is_string($createdAt) || $createdAt === '') {
            return false;
        }

        try {
            return new DateTimeImmutable($createdAt) >= $oldestIncludedCreatedAt;
        } catch (Exception) {
            return false;
        }
    }

    /**
     * @param SourceType $sourceType
     * @param string $owner
     * @param string $repositoryName
     * @param string $token
     * @param DateTimeImmutable $oldestIncludedCreatedAt
     * @return array{items: array<int, array<string, mixed>>, authors: array<int, array<string, string>>}
     */
    private function listGraphQlItemsAndAuthors(
        SourceType $sourceType,
        string $owner,
        string $repositoryName,
        string $token,
        DateTimeImmutable $oldestIncludedCreatedAt,
    ): array {
        $items = [];
        $authorsByLogin = [];
        $afterCursor = null;

        do {
            $response = $this->graphQlClient->runQuery(
                $token,
                $this->queryBuilder->build($sourceType, $owner, $repositoryName, $afterCursor),
            );

            $search = is_array($response['search'] ?? null) ? $response['search'] : [];
            $nodes = is_array($search['nodes'] ?? null) ? $search['nodes'] : [];
            $pageInfo = is_array($search['pageInfo'] ?? null) ? $search['pageInfo'] : [];

            foreach ($nodes as $node) {
                if (!is_array($node)) {
                    continue;
                }

                $this->rememberAuthor($authorsByLogin, $this->extractGraphQlAuthor($node['author'] ?? null));

                if (!is_array($node) || empty($node['title']) || empty($node['url']) || empty($node['number'])) {
                    continue;
                }

                if (!$this->wasCreatedWithinWindow(['created_at' => $node['createdAt'] ?? null], $oldestIncludedCreatedAt)) {
                    continue;
                }

                $items[] = $node;
            }

            $hasNextPage = ($pageInfo['hasNextPage'] ?? false) === true;
            $afterCursor = is_string($pageInfo['endCursor'] ?? null) ? $pageInfo['endCursor'] : null;
        } while ($hasNextPage && $afterCursor !== null);

        return [
            'items' => $items,
            'authors' => array_values($authorsByLogin),
        ];
    }

    /**
     * @param mixed $author
     * @return array<string, string>|null
     */
    private function extractGraphQlAuthor(mixed $author): ?array
    {
        if (!is_array($author) || !is_string($author['login'] ?? null) || $author['login'] === '') {
            return null;
        }

        $company = is_string($author['company'] ?? null) ? trim($author['company']) : '';

        return [
            'login' => $author['login'],
            'avatarUrl' => is_string($author['avatarUrl'] ?? null) ? $author['avatarUrl'] : '',
            'url' => is_string($author['url'] ?? null) ? $author['url'] : '',
            'company' => $company,
        ];
    }

    /**
     * @param array<string, array<string, string>> $authorsByLogin
     * @param array<string, string>|null $author
     * @return void
     */
    private function rememberAuthor(array &$authorsByLogin, ?array $author): void
    {
        if ($author === null) {
            return;
        }

        $login = $author['login'] ?? '';

        if ($login === '') {
            return;
        }

        $currentAuthor = $authorsByLogin[$login] ?? null;

        $authorsByLogin[$login] = [
            'login' => $login,
            'avatarUrl' => $author['avatarUrl'] !== '' ? $author['avatarUrl'] : ($currentAuthor['avatarUrl'] ?? ''),
            'url' => $author['url'] !== '' ? $author['url'] : ($currentAuthor['url'] ?? ''),
            'company' => $author['company'] !== '' ? $author['company'] : ($currentAuthor['company'] ?? ''),
        ];
    }
}
