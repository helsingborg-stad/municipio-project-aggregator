/**
 * Starts the GitHub OAuth flow.
 *
 * @returns {void}
 */
export function startGitHubLogin() {
  const returnTo = typeof window !== 'undefined' ? window.location.href : '/';
  window.location.assign(`/api/auth/start?returnTo=${encodeURIComponent(returnTo)}`);
}

/**
 * Ends the current GitHub OAuth session.
 *
 * @returns {void}
 */
export function logoutGitHub() {
  const returnTo = typeof window !== 'undefined' ? window.location.href : '/';
  window.location.assign(`/api/auth/logout?returnTo=${encodeURIComponent(returnTo)}`);
}

/**
 * Loads the current GitHub session state.
 *
 * @returns {Promise<Record<string, any>>}
 */
export async function fetchGitHubSession() {
  const response = await fetch('/api/auth/session', {
    credentials: 'same-origin',
  });

  if (!response.ok) {
    throw new Error('Unable to load the GitHub session.');
  }

  return response.json();
}

/**
 * Executes a GitHub GraphQL request through the serverless proxy.
 *
 * @param {string} query
 * @param {Record<string, unknown>} [variables]
 * @returns {Promise<Record<string, any>>}
 */
export async function runGitHubGraphql(query, variables = {}) {
  const response = await fetch('/api/github/graphql', {
    method: 'POST',
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, variables }),
  });

  const payload = await response.json();

  if (!response.ok || payload.errors?.length) {
    const message = payload.errors?.[0]?.message || payload.error || 'GitHub request failed.';
    throw new Error(message);
  }

  return payload;
}

/**
 * Loads planning options for a repository.
 *
 * @param {string} repositoryNameWithOwner
 * @returns {Promise<{repository: Record<string, any> | null, labels: Array<Record<string, any>>, assignees: Array<Record<string, any>>}>}
 */
export async function fetchRepositoryPlanningOptions(repositoryNameWithOwner) {
  const [owner, name] = repositoryNameWithOwner.split('/');
  const payload = await runGitHubGraphql(
    `query RepositoryPlanningOptions($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        id
        nameWithOwner
        labels(first: 25, orderBy: { field: NAME, direction: ASC }) {
          nodes {
            id
            name
            color
            description
          }
        }
        assignableUsers(first: 25) {
          nodes {
            id
            login
            avatarUrl
            url
          }
        }
      }
    }`,
    { owner, name },
  );

  return {
    repository: payload.data?.repository || null,
    labels: payload.data?.repository?.labels?.nodes || [],
    assignees: payload.data?.repository?.assignableUsers?.nodes || [],
  };
}

/**
 * Creates a GitHub issue.
 *
 * @param {{repositoryId: string, title: string, body?: string, assigneeIds?: string[], labelIds?: string[]}} input
 * @returns {Promise<Record<string, any>>}
 */
export async function createGitHubIssue(input) {
  const payload = await runGitHubGraphql(
    `mutation CreateIssue($input: CreateIssueInput!) {
        createIssue(input: $input) {
          issue {
            id
            title
            body
            url
            number
            state
          repository {
            nameWithOwner
          }
          labels(first: 20) {
            nodes {
              id
              name
              color
              description
            }
          }
          assignees(first: 20) {
            nodes {
              id
              login
              avatarUrl
              url
            }
          }
        }
      }
    }`,
    {
        input: {
          repositoryId: input.repositoryId,
          title: input.title,
          body: input.body || '',
          assigneeIds: input.assigneeIds || [],
          labelIds: input.labelIds || [],
        },
    },
  );

  return payload.data?.createIssue?.issue || null;
}

/**
 * Adds an item to the configured GitHub Project v2.
 *
 * @param {{projectId: string, contentId: string}} input
 * @returns {Promise<string>}
 */
export async function addItemToProject(input) {
  const payload = await runGitHubGraphql(
    `mutation AddProjectItem($input: AddProjectV2ItemByIdInput!) {
      addProjectV2ItemById(input: $input) {
        item {
          id
        }
      }
    }`,
    { input },
  );

  return payload.data?.addProjectV2ItemById?.item?.id || '';
}

/**
 * Updates a single-select project field value.
 *
 * @param {{projectId: string, itemId: string, fieldId: string, optionId: string}} input
 * @returns {Promise<void>}
 */
export async function updateProjectSingleSelectField(input) {
  await runGitHubGraphql(
    `mutation UpdateProjectSingleSelect($input: UpdateProjectV2ItemFieldValueInput!) {
      updateProjectV2ItemFieldValue(input: $input) {
        projectV2Item {
          id
        }
      }
    }`,
    {
      input: {
        projectId: input.projectId,
        itemId: input.itemId,
        fieldId: input.fieldId,
        value: {
          singleSelectOptionId: input.optionId,
        },
      },
    },
  );
}

/**
 * Updates an iteration project field value.
 *
 * @param {{projectId: string, itemId: string, fieldId: string, iterationId: string}} input
 * @returns {Promise<void>}
 */
export async function updateProjectIterationField(input) {
  await runGitHubGraphql(
    `mutation UpdateProjectIteration($input: UpdateProjectV2ItemFieldValueInput!) {
      updateProjectV2ItemFieldValue(input: $input) {
        projectV2Item {
          id
        }
      }
    }`,
    {
      input: {
        projectId: input.projectId,
        itemId: input.itemId,
        fieldId: input.fieldId,
        value: {
          iterationId: input.iterationId,
        },
      },
    },
  );
}

/**
 * Clears a project field value.
 *
 * @param {{projectId: string, itemId: string, fieldId: string}} input
 * @returns {Promise<void>}
 */
export async function clearProjectFieldValue(input) {
  await runGitHubGraphql(
    `mutation ClearProjectField($input: ClearProjectV2ItemFieldValueInput!) {
      clearProjectV2ItemFieldValue(input: $input) {
        projectV2Item {
          id
        }
      }
    }`,
    { input },
  );
}

/**
 * Updates project item ordering.
 *
 * @param {{projectId: string, itemId: string, afterId?: string | null}} input
 * @returns {Promise<void>}
 */
export async function updateProjectItemPosition(input) {
  await runGitHubGraphql(
    `mutation UpdateProjectItemPosition($input: UpdateProjectV2ItemPositionInput!) {
      updateProjectV2ItemPosition(input: $input) {
        items {
          id
        }
      }
    }`,
    {
      input: {
        projectId: input.projectId,
        itemId: input.itemId,
        afterId: input.afterId || null,
      },
    },
  );
}

/**
 * Creates a GitHub-native sub-issue relationship.
 *
 * @param {{parentIssueId: string, childIssueId: string}} input
 * @returns {Promise<void>}
 */
export async function addGitHubSubIssue(input) {
  await runGitHubGraphql(
    `mutation AddSubIssue($input: AddSubIssueInput!) {
      addSubIssue(input: $input) {
        issue {
          id
        }
        subIssue {
          id
        }
      }
    }`,
    {
      input: {
        issueId: input.parentIssueId,
        subIssueId: input.childIssueId,
      },
    },
  );
}

/**
 * Removes a GitHub-native sub-issue relationship.
 *
 * @param {{parentIssueId: string, childIssueId: string}} input
 * @returns {Promise<void>}
 */
export async function removeGitHubSubIssue(input) {
  await runGitHubGraphql(
    `mutation RemoveSubIssue($input: RemoveSubIssueInput!) {
      removeSubIssue(input: $input) {
        issue {
          id
        }
        subIssue {
          id
        }
      }
    }`,
    {
      input: {
        issueId: input.parentIssueId,
        subIssueId: input.childIssueId,
      },
    },
  );
}
