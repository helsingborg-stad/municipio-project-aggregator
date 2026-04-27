<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

/**
 * Immutable GitHub release entry delivered to the frontend.
 */
final class ReleaseEntry
{
    /**
     * @param string $title Release title.
     * @param string $version Release tag or display version.
     * @param string $body Markdown release notes.
     * @param string $url GitHub release URL.
     * @param string $publishedAt ISO 8601 publication timestamp.
     * @param bool $isPrerelease Whether the release is marked as a pre-release.
     * @param bool $isDraft Whether the release is still a draft.
     */
    public function __construct(
        private readonly string $title,
        private readonly string $version,
        private readonly string $body,
        private readonly string $url,
        private readonly string $publishedAt,
        private readonly bool $isPrerelease,
        private readonly bool $isDraft,
    ) {
    }

    /**
     * @param array<string, mixed> $release
     * @return self
     */
    public static function fromRestRelease(array $release): self
    {
        $title = is_string($release['name'] ?? null) && trim($release['name']) !== ''
            ? trim($release['name'])
            : (string) ($release['tag_name'] ?? 'Untitled release');

        return new self(
            $title,
            (string) ($release['tag_name'] ?? ''),
            is_string($release['body'] ?? null) ? $release['body'] : '',
            (string) ($release['html_url'] ?? ''),
            (string) (($release['published_at'] ?? $release['created_at']) ?? ''),
            (bool) ($release['prerelease'] ?? false),
            (bool) ($release['draft'] ?? false),
        );
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(): array
    {
        return [
            'title' => $this->title,
            'version' => $this->version,
            'body' => $this->body,
            'url' => $this->url,
            'publishedAt' => $this->publishedAt,
            'isPrerelease' => $this->isPrerelease,
            'isDraft' => $this->isDraft,
        ];
    }

    /**
     * @return string
     */
    public function publishedAt(): string
    {
        return $this->publishedAt;
    }
}