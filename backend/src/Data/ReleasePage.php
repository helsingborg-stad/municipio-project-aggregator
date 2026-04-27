<?php

declare(strict_types=1);

namespace MunicipioProjectAggregator\Backend\Data;

/**
 * Release page metadata exposed by the page index.
 */
final class ReleasePage
{
    /**
     * @param int $pageNumber 1-based page number.
     * @param string $file Relative JSON filename for the page.
     * @param int $itemCount Number of releases in the page.
     */
    public function __construct(
        private readonly int $pageNumber,
        private readonly string $file,
        private readonly int $itemCount,
    ) {
    }

    /**
     * @return array<string, int|string>
     */
    public function toArray(): array
    {
        return [
            'pageNumber' => $this->pageNumber,
            'file' => $this->file,
            'itemCount' => $this->itemCount,
        ];
    }
}