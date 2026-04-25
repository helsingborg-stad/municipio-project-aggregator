<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\GitHub;

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

        foreach ($this->client->listRepositoriesByTopics($config->organization(), $config->topics(), $config->token()) as $repository) {
            foreach ($this->client->listOpenItems($sourceType, $config->organization(), $repository, $config->token()) as $itemData) {
                if (empty($itemData['title']) || empty($itemData['html_url'])) {
                    continue;
                }

                $item = AggregatedItem::fromRestItem($repository, $itemData);
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
            $config->organization(),
            $config->topics(),
            $config->generatedAt()->format(DATE_ATOM),
            $items,
        );
    }
}