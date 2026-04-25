<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\GitHub;

/**
 * Supported GitHub sources.
 */
enum SourceType: string
{
    case Issues = 'issues';
    case PullRequests = 'pull-requests';

    /**
     * @return string
     */
    public function searchQualifier(): string
    {
        return match ($this) {
            self::Issues => 'is:issue',
            self::PullRequests => 'is:pr',
        };
    }

    /**
     * @return string
     */
    public function fragment(): string
    {
        return match ($this) {
            self::Issues => '... on Issue { title url createdAt repository { name } }',
            self::PullRequests => '... on PullRequest { title url createdAt repository { name } }',
        };
    }

    /**
     * @return string
     */
    public function label(): string
    {
        return match ($this) {
            self::Issues => 'Open Issues',
            self::PullRequests => 'Open Pull Requests',
        };
    }
}