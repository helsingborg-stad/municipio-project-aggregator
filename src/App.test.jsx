import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import App from './App';
import {
  getMockDashboardData,
  getMockReleasePagePayload,
} from '@/lib/mock-data';

const mockDashboardData = getMockDashboardData();
const issuesPayload = mockDashboardData.payloads.issues;
const pullRequestsPayload = mockDashboardData.payloads['pull-requests'];
const planningPayload = mockDashboardData.planningPayload;
const releasePageIndexPayload = mockDashboardData.releasePageIndex;
const releasePageOnePayload = mockDashboardData.releasePagePayload;
const releasePageTwoPayload = getMockReleasePagePayload(2);

describe('App', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  function jsonResponse(payload) {
    return {
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: async () => payload,
    };
  }

  function mockDashboardFetch() {
    vi.stubGlobal('fetch', vi.fn(async (input) => {
      const url = String(input);

      if (url.includes('/api/auth/session')) {
        return jsonResponse({ authenticated: false, available: true });
      }

      if (url.includes('issues.json')) {
        return jsonResponse(issuesPayload);
      }

      if (url.includes('pull-requests.json')) {
        return jsonResponse(pullRequestsPayload);
      }

      if (url.includes('sprints.json')) {
        return jsonResponse(planningPayload);
      }

      if (url.includes('releases/pageIndex.json')) {
        return jsonResponse(releasePageIndexPayload);
      }

      if (url.includes('releases/page-2.json')) {
        return jsonResponse(releasePageTwoPayload);
      }

      return jsonResponse(releasePageOnePayload);
    }));
  }

  it('renders backlog, sprint, repository, and author views from GitHub payloads', async () => {
    mockDashboardFetch();

    render(<App />);

    await screen.findByRole('tab', { name: 'Backlog' });

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Backlog' }));
    expect(await screen.findByRole('heading', { name: 'Backlog manager' })).toBeInTheDocument();
    expect(screen.getByText('Unplanned GitHub issues')).toBeInTheDocument();
    expect(screen.getByText('Issue alpha foundation')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Sprints' }));
    expect(await screen.findByRole('heading', { name: 'Sprint board' })).toBeInTheDocument();
    expect(screen.getByText('Sprint 14')).toBeInTheDocument();
    expect(screen.getAllByText('Issue alpha child').length).toBeGreaterThan(0);
    expect(screen.queryByText('Deliver drag and drop for the active sprint so issues can be moved without leaving the planning surface.')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'List view' })).toHaveClass('bg-cyan-300/15');
    expect(screen.getAllByText('Sprint 16').length).toBeGreaterThan(0);

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Repositories' }));
    expect(await screen.findByRole('heading', { name: 'Compatible plugins' })).toBeInTheDocument();
    expect(screen.getByText('plugin-alpha')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Authors' }));
    expect(await screen.findByText('monalisa')).toBeInTheDocument();
  });

  it('keeps the quick add UI read-only for public users', async () => {
    mockDashboardFetch();

    render(<App />);

    fireEvent.mouseDown(await screen.findByRole('tab', { name: 'Backlog' }));

    expect(await screen.findByText('Public users can browse the workspace. Sign in with GitHub to create or move work.')).toBeInTheDocument();
    expect(screen.getByLabelText('Description')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Create GitHub issue' })).toBeDisabled();
    expect(await screen.findByRole('button', { name: 'Sign in with GitHub to edit' })).toBeInTheDocument();
  });

  it('loads demo data from the mock query parameter without network requests', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    window.history.replaceState({}, '', '/?mock=1&tab=backlog');

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Backlog manager' })).toBeInTheDocument();
    expect(screen.getByText('Mock demo')).toBeInTheDocument();
    expect(screen.getByText('Issue alpha foundation')).toBeInTheDocument();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('supports local mock sprint list updates for status moves and subtask assignment', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    window.history.replaceState({}, '', '/?mock=1&tab=sprints');

    render(<App />);

    expect(await screen.findByText('Mock demo mode')).toBeInTheDocument();

    fireEvent.dragStart(screen.getByLabelText('Drag Review release data caching'));
    fireEvent.drop(screen.getByLabelText('Drop in status In progress for Sprint 14'));

    await waitFor(() => {
      expect(screen.getByText('Mock sprint list updated for Review release data caching.')).toBeInTheDocument();
    });

    fireEvent.dragStart(screen.getByLabelText('Drag Issue alpha child'));
    fireEvent.drop(screen.getByLabelText('Drop Issue alpha child under Review release data caching as subtask'));

    await waitFor(() => {
      expect(screen.getByText('Mock subtask linked under Review release data caching.')).toBeInTheDocument();
      expect(screen.getByText('Subtask of Review release data caching')).toBeInTheDocument();
    });

    fireEvent.dragStart(screen.getByLabelText('Drag Issue alpha child'));
    fireEvent.drop(screen.getByLabelText('Drop in status In progress for Sprint 14'));

    await waitFor(() => {
      expect(screen.getByText('Mock subtask Issue alpha child was broken out as a top-level task.')).toBeInTheDocument();
      expect(screen.queryByText('Subtask of Review release data caching')).not.toBeInTheDocument();
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('filters the shared backlog and sprint planning workspace with the global search input', async () => {
    mockDashboardFetch();

    render(<App />);

    await screen.findByRole('tab', { name: 'Backlog' });

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search all tabs' }), { target: { value: 'release' } });
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Backlog' }));
    expect(await screen.findByText('No unplanned issues match the current filters.')).toBeInTheDocument();

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Sprints' }));
    expect((await screen.findAllByText('Release beta sync')).length).toBeGreaterThan(0);
    expect(screen.queryByText('Issue alpha child')).not.toBeInTheDocument();
  });

  it('renders the release log tab and paginates page-backed release files', async () => {
    mockDashboardFetch();

    render(<App />);

    await screen.findByRole('tab', { name: 'Release log' });

    fireEvent.mouseDown(screen.getByRole('tab', { name: 'Release log' }));

    expect(await screen.findByRole('heading', { name: 'Release log' })).toBeInTheDocument();
    expect(screen.getByText('Release 3.2.1')).toBeInTheDocument();
    expect(screen.getByText('Highlights')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next release page' }));

    await waitFor(() => {
      expect(screen.getByText('Release 3.0.1')).toBeInTheDocument();
    });
  });

  it('restores the selected main tab from the URL and maps contributors to authors', async () => {
    mockDashboardFetch();
    window.history.replaceState({}, '', '/?tab=contributors');

    render(<App />);

    expect(await screen.findByText('monalisa')).toBeInTheDocument();
    expect(window.location.search).toBe('?tab=authors');
  });
});
