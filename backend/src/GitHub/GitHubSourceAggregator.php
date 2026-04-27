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
        private readonly GitHubRestClient $client,
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
        $repositories = $this->client->listRepositoriesByTopics($config->topics(), $config->token());
        $oldestIncludedCreatedAt = $config->oldestIncludedCreatedAt();

        foreach ($repositories as $repository) {
            foreach ($this->client->listOpenItems($sourceType, $repository, $config->token()) as $itemData) {
                if (empty($itemData['title']) || empty($itemData['html_url']) || empty($itemData['number'])) {
                    continue;
                }

                if (!$this->wasCreatedWithinWindow($itemData, $oldestIncludedCreatedAt)) {
                    continue;
                }

                $issueNumber = (int) $itemData['number'];
                $issueDetails = $this->client->getIssueDetails($repository, $issueNumber, $config->token());
                $authorProfile = $this->client->getUserProfile(
                    is_array($issueDetails['user'] ?? null) && is_string($issueDetails['user']['login'] ?? null)
                        ? $issueDetails['user']['login']
                        : '',
                    $config->token(),
                );
                $timelineEvents = $this->client->listTimelineEvents($repository, $issueNumber, $config->token());
                $subIssues = $this->client->listSubIssues($repository, $issueNumber, $config->token());
                $item = AggregatedItem::fromRestItem(
                    $repository->fullName(),
                    $itemData,
                    $issueDetails,
                    $authorProfile,
                    $timelineEvents,
                    $subIssues,
                );
                $itemsByUrl[$itemData['html_url']] = $item;
            }
        }

        $items = array_values($itemsByUrl);

        usort(
            $items,
            static fn (AggregatedItem $left, AggregatedItem $right): int => strcmp($right->createdAt(), $left->createdAt()),
        );

        return new SourcePayload(
            $sourceType->value,
            $config->sourceScope(),
            $config->topics(),
            $config->generatedAt()->format(DATE_ATOM),
            $repositories,
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
}
