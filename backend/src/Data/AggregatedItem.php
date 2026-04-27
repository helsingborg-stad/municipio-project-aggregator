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
     * @param int $number GitHub issue or pull request number.
     * @param array<string, string>|null $author Author information.
     * @param array<int, array<string, string>> $assignees Assignee information.
     * @param array<string, string|null>|null $milestone Milestone information.
     * @param string|null $type GitHub issue type.
     * @param array<string, int> $subIssues Sub-issue summary.
     * @param array<int, string> $subIssueUrls Tracked sub-issue URLs.
     * @param array<string, int> $relationshipSummary Relationship summary counts.
     * @param array<int, array<string, string>> $relationships Relationship links.
     */
    public function __construct(
        private readonly string $title,
        private readonly string $url,
        private readonly string $repository,
        private readonly string $createdAt,
        private readonly int $number,
        private readonly ?array $author,
        private readonly array $assignees,
        private readonly ?array $milestone,
        private readonly ?string $type,
        private readonly array $subIssues,
        private readonly array $subIssueUrls,
        private readonly array $relationshipSummary,
        private readonly array $relationships,
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
            (int) ($node['number'] ?? 0),
            null,
            [],
            null,
            null,
            self::defaultSubIssues(),
            [],
            self::defaultRelationshipSummary(),
            [],
        );
    }

    /**
     * Create an item from a GitHub REST issue or pull request payload.
     *
     * @param string $repository Repository name.
     * @param array<string, mixed> $item GitHub REST item.
     * @param array<string, mixed> $detail GitHub REST issue detail.
     * @param array<string, mixed> $authorProfile GitHub REST user payload.
     * @param array<int, array<string, mixed>> $timelineEvents GitHub REST issue timeline events.
     * @param array<int, array<string, mixed>> $subIssues GitHub REST sub-issue payloads.
     * @return self
     */
    public static function fromRestItem(
        string $repository,
        array $item,
        array $detail,
        array $authorProfile,
        array $timelineEvents,
        array $subIssues,
    ): self
    {
        $relationships = self::extractRelationships($timelineEvents);

        return new self(
            (string) ($item['title'] ?? ''),
            (string) ($item['html_url'] ?? ''),
            $repository,
            (string) ($item['created_at'] ?? ''),
            (int) ($item['number'] ?? 0),
            self::extractUser($detail['user'] ?? null, $authorProfile),
            self::extractUsers($detail['assignees'] ?? []),
            self::extractMilestone($detail['milestone'] ?? null),
            self::extractType($detail['type'] ?? null),
            self::extractSubIssues($detail['sub_issues_summary'] ?? null),
            self::extractSubIssueUrls($subIssues),
            self::extractRelationshipSummary($detail['issue_dependencies_summary'] ?? null, $relationships),
            $relationships,
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
            'number' => $this->number,
            'author' => $this->author,
            'assignees' => $this->assignees,
            'milestone' => $this->milestone,
            'type' => $this->type,
            'subIssues' => $this->subIssues,
            'subIssueUrls' => $this->subIssueUrls,
            'relationshipSummary' => $this->relationshipSummary,
            'relationships' => $this->relationships,
        ];
    }

    /**
     * @return string
     */
    public function createdAt(): string
    {
        return $this->createdAt;
    }

    /**
     * @param mixed $user
     * @param array<string, mixed> $profile
     * @return array<string, string>|null
     */
    private static function extractUser(mixed $user, array $profile = []): ?array
    {
        if (!is_array($user) || !is_string($user['login'] ?? null)) {
            return null;
        }

        return [
            'login' => $user['login'],
            'avatarUrl' => is_string($user['avatar_url'] ?? null) ? $user['avatar_url'] : '',
            'url' => is_string($user['html_url'] ?? null) ? $user['html_url'] : '',
            'company' => is_string($profile['company'] ?? null) ? trim($profile['company']) : '',
        ];
    }

    /**
     * @param mixed $users
     * @return array<int, array<string, string>>
     */
    private static function extractUsers(mixed $users): array
    {
        if (!is_array($users)) {
            return [];
        }

        $result = [];

        foreach ($users as $user) {
            $normalizedUser = self::extractUser($user);

            if ($normalizedUser !== null) {
                $result[] = $normalizedUser;
            }
        }

        return $result;
    }

    /**
     * @param mixed $milestone
     * @return array<string, string|null>|null
     */
    private static function extractMilestone(mixed $milestone): ?array
    {
        if (!is_array($milestone) || !is_string($milestone['title'] ?? null)) {
            return null;
        }

        return [
            'title' => $milestone['title'],
            'url' => is_string($milestone['html_url'] ?? null) ? $milestone['html_url'] : null,
            'dueOn' => is_string($milestone['due_on'] ?? null) ? $milestone['due_on'] : null,
        ];
    }

    /**
     * @param mixed $type
     * @return string|null
     */
    private static function extractType(mixed $type): ?string
    {
        if (is_string($type) && $type !== '') {
            return $type;
        }

        if (is_array($type) && is_string($type['name'] ?? null) && $type['name'] !== '') {
            return $type['name'];
        }

        return null;
    }

    /**
     * @param mixed $summary
     * @return array<string, int>
     */
    private static function extractSubIssues(mixed $summary): array
    {
        if (!is_array($summary)) {
            return self::defaultSubIssues();
        }

        return [
            'total' => (int) ($summary['total'] ?? 0),
            'completed' => (int) ($summary['completed'] ?? 0),
            'percentCompleted' => (int) ($summary['percent_completed'] ?? 0),
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $subIssues
     * @return array<int, string>
     */
    private static function extractSubIssueUrls(array $subIssues): array
    {
        $result = [];

        foreach ($subIssues as $subIssue) {
            if (!is_array($subIssue) || !is_string($subIssue['html_url'] ?? null) || $subIssue['html_url'] === '') {
                continue;
            }

            $result[] = $subIssue['html_url'];
        }

        return array_values(array_unique($result));
    }

    /**
     * @param mixed $summary
     * @param array<int, array<string, string>> $relationships
     * @return array<string, int>
     */
    private static function extractRelationshipSummary(mixed $summary, array $relationships): array
    {
        if (!is_array($summary)) {
            $result = self::defaultRelationshipSummary();
            $result['linked'] = count($relationships);
            return $result;
        }

        return [
            'blockedBy' => (int) ($summary['blocked_by'] ?? 0),
            'totalBlockedBy' => (int) ($summary['total_blocked_by'] ?? 0),
            'blocking' => (int) ($summary['blocking'] ?? 0),
            'totalBlocking' => (int) ($summary['total_blocking'] ?? 0),
            'linked' => count($relationships),
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $timelineEvents
     * @return array<int, array<string, string>>
     */
    private static function extractRelationships(array $timelineEvents): array
    {
        $relationshipsByUrl = [];

        foreach ($timelineEvents as $event) {
            if (!is_array($event)) {
                continue;
            }

            $eventName = is_string($event['event'] ?? null) ? $event['event'] : '';
            if (!in_array($eventName, ['connected', 'cross-referenced', 'disconnected'], true)) {
                continue;
            }

            $sourceIssue = is_array($event['source']['issue'] ?? null) ? $event['source']['issue'] : null;
            if ($sourceIssue === null || !is_string($sourceIssue['html_url'] ?? null)) {
                continue;
            }

            $relationshipsByUrl[$sourceIssue['html_url']] = [
                'event' => $eventName,
                'title' => is_string($sourceIssue['title'] ?? null) ? $sourceIssue['title'] : 'Related item',
                'url' => $sourceIssue['html_url'],
                'repository' => is_array($sourceIssue['repository'] ?? null) && is_string($sourceIssue['repository']['full_name'] ?? null)
                    ? $sourceIssue['repository']['full_name']
                    : 'unknown',
            ];
        }

        return array_values($relationshipsByUrl);
    }

    /**
     * @return array<string, int>
     */
    private static function defaultSubIssues(): array
    {
        return [
            'total' => 0,
            'completed' => 0,
            'percentCompleted' => 0,
        ];
    }

    /**
     * @return array<string, int>
     */
    private static function defaultRelationshipSummary(): array
    {
        return [
            'blockedBy' => 0,
            'totalBlockedBy' => 0,
            'blocking' => 0,
            'totalBlocking' => 0,
            'linked' => 0,
        ];
    }
}
