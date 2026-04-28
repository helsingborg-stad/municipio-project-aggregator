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
            self::Issues => '... on Issue { title url createdAt number repository { name nameWithOwner owner { login } description url } author { login avatarUrl url ... on User { company } } assignees(first: 20) { nodes { login avatarUrl url } } milestone { title url dueOn } issueType { name } subIssuesSummary { total completed percentCompleted } subIssues(first: 100) { nodes { url } } issueDependenciesSummary { blockedBy totalBlockedBy blocking totalBlocking } timelineItems(first: 100, itemTypes: [CONNECTED_EVENT, CROSS_REFERENCED_EVENT, DISCONNECTED_EVENT]) { nodes { __typename ... on ConnectedEvent { subject { ... on Issue { title url repository { nameWithOwner } } ... on PullRequest { title url repository { nameWithOwner } } } } ... on CrossReferencedEvent { source { ... on Issue { title url repository { nameWithOwner } } ... on PullRequest { title url repository { nameWithOwner } } } } ... on DisconnectedEvent { subject { ... on Issue { title url repository { nameWithOwner } } ... on PullRequest { title url repository { nameWithOwner } } } } } } }',
            self::PullRequests => '... on PullRequest { title url createdAt number repository { name nameWithOwner owner { login } description url } author { login avatarUrl url ... on User { company } } assignees(first: 20) { nodes { login avatarUrl url } } milestone { title url dueOn } timelineItems(first: 100, itemTypes: [CONNECTED_EVENT, CROSS_REFERENCED_EVENT, DISCONNECTED_EVENT]) { nodes { __typename ... on ConnectedEvent { subject { ... on Issue { title url repository { nameWithOwner } } ... on PullRequest { title url repository { nameWithOwner } } } } ... on CrossReferencedEvent { source { ... on Issue { title url repository { nameWithOwner } } ... on PullRequest { title url repository { nameWithOwner } } } } ... on DisconnectedEvent { subject { ... on Issue { title url repository { nameWithOwner } } ... on PullRequest { title url repository { nameWithOwner } } } } } } }',
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