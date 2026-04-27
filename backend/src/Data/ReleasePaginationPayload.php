<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

/**
 * Aggregated release pagination payload collection.
 */
final class ReleasePaginationPayload
{
    /**
     * @param ReleasePageIndexPayload $pageIndexPayload
     * @param array<int, ReleasePagePayload> $pagePayloads
     */
    public function __construct(
        private readonly ReleasePageIndexPayload $pageIndexPayload,
        private readonly array $pagePayloads,
    ) {
    }

    /**
     * @return ReleasePageIndexPayload
     */
    public function pageIndexPayload(): ReleasePageIndexPayload
    {
        return $this->pageIndexPayload;
    }

    /**
     * @return array<int, ReleasePagePayload>
     */
    public function pagePayloads(): array
    {
        return $this->pagePayloads;
    }
}