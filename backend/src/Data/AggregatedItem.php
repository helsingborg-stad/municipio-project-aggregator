<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

/**
 * Immutable item delivered to the frontend.
 */
final class AggregatedItem
{
    /**
     * @param string $title Item title.
     * @param string $url Item URL.
     * @param string $repository Repository name.
     * @param string $createdAt ISO 8601 creation timestamp.
     */
    public function __construct(
        private readonly string $title,
        private readonly string $url,
        private readonly string $repository,
        private readonly string $createdAt,
    ) {
    }

    /**
     * Create an item from a GitHub GraphQL search node.
     *
     * @param array<string, mixed> $node GitHub GraphQL node.
     * @return self
     */
    public static function fromNode(array $node): self
    {
        return new self(
            (string) ($node['title'] ?? ''),
            (string) ($node['url'] ?? ''),
            (string) (($node['repository']['name'] ?? 'unknown')),
            (string) ($node['createdAt'] ?? ''),
        );
    }

    /**
     * Create an item from a GitHub REST issue or pull request payload.
     *
     * @param string $repository Repository name.
     * @param array<string, mixed> $item GitHub REST item.
     * @return self
     */
    public static function fromRestItem(string $repository, array $item): self
    {
        return new self(
            (string) ($item['title'] ?? ''),
            (string) ($item['html_url'] ?? ''),
            $repository,
            (string) ($item['created_at'] ?? ''),
        );
    }

    /**
     * @return array<string, string>
     */
    public function toArray(): array
    {
        return [
            'title' => $this->title,
            'url' => $this->url,
            'repository' => $this->repository,
            'createdAt' => $this->createdAt,
        ];
    }

    /**
     * @return string
     */
    public function createdAt(): string
    {
        return $this->createdAt;
    }
}