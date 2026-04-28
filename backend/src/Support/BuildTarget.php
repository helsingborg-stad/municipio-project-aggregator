<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Support;

/**
 * Supported build targets for scheduled data refreshes.
 */
enum BuildTarget: string
{
    case Issues = 'issues';
    case PullRequests = 'pull-requests';
    case Releases = 'releases';

    /**
     * @return array<int, self>
     */
    public static function all(): array
    {
        return [self::Issues, self::PullRequests, self::Releases];
    }
}