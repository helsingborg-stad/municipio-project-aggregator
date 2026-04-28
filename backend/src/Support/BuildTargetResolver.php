<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Support;

use RuntimeException;

/**
 * Resolves requested build targets from environment configuration.
 */
final class BuildTargetResolver
{
    /**
     * @param string|false $configuredTargets
     * @return array<int, BuildTarget>
     */
    public function resolve(string|false $configuredTargets): array
    {
        if ($configuredTargets === false || trim($configuredTargets) === '') {
            return BuildTarget::all();
        }

        $resolvedTargets = [];

        foreach (explode(',', $configuredTargets) as $configuredTarget) {
            $normalizedTarget = trim($configuredTarget);

            if ($normalizedTarget === '') {
                continue;
            }

            $target = BuildTarget::tryFrom($normalizedTarget);

            if ($target === null) {
                throw new RuntimeException(sprintf(
                    'Unsupported BUILD_TARGETS value "%s". Supported values are: %s.',
                    $normalizedTarget,
                    implode(', ', array_map(static fn (BuildTarget $item): string => $item->value, BuildTarget::all())),
                ));
            }

            $resolvedTargets[$target->value] = $target;
        }

        if ($resolvedTargets === []) {
            return BuildTarget::all();
        }

        return array_values($resolvedTargets);
    }
}