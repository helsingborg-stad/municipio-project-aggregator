<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Tests;

use MunicipioProjectAggregator\Backend\Support\BuildTarget;
use MunicipioProjectAggregator\Backend\Support\BuildTargetResolver;
use PHPUnit\Framework\Attributes\CoversClass;
use PHPUnit\Framework\TestCase;
use RuntimeException;

#[CoversClass(BuildTargetResolver::class)]
final class BuildTargetResolverTest extends TestCase
{
    /**
     * @return void
     */
    public function testResolveReturnsAllTargetsWhenConfigurationIsMissing(): void
    {
        $resolver = new BuildTargetResolver();

        $targets = $resolver->resolve(false);

        self::assertSame(BuildTarget::all(), $targets);
    }

    /**
     * @return void
     */
    public function testResolveParsesDistinctConfiguredTargets(): void
    {
        $resolver = new BuildTargetResolver();

        $targets = $resolver->resolve('issues, pull-requests,issues');

        self::assertSame([BuildTarget::Issues, BuildTarget::PullRequests], $targets);
    }

    /**
     * @return void
     */
    public function testResolveThrowsForUnsupportedTarget(): void
    {
        $resolver = new BuildTargetResolver();

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Unsupported BUILD_TARGETS value');

        $resolver->resolve('deploy');
    }
}