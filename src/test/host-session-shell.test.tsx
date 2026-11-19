import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionShell } from '@/host/SessionShell';
import { makeMessage, readLaunchIdentity, type ChildMessageType } from '@/host/protocol';
import type { HubSession } from '@/host/session-queue';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(), refresh: vi.fn(), release: vi.fn(), save: vi.fn(),
  status: 'fresh',
  targets: [{ gameId: 'sofa', releaseId: 'registry-1', origin: 'https://sofa-host.lovable.app' }, { gameId: 'robot', releaseId: 'registry-1', origin: 'https://robot-host.lovable.app' }],
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/lib/catalog-store', () => ({
  useCatalog: () => null, useRegistry: () => null, getCurrentCatalog: () => null, getCurrentRegistry: () => null,
  refreshCatalog: () => mocks.refresh(), getManifestStatus: () => mocks.status,
}));
vi.mock('@/host/eligibility', () => ({ sessionTargets: () => mocks.targets }));
vi.mock('@/host/session-store', () => ({ readHubSession: () => null, saveHubSession: (s: HubSession) => mocks.save(s) }));
vi.mock('@/host/release-check', async (original) => ({
  ...await original<typeof import('@/host/release-check')>(), fetchHostRelease: (...args: unknown[]) => mocks.release(...args),
}));

function frames() { return Array.from(document.querySelectorAll('iframe')); }
function visible() {
  const frame = frames().find((f) => f.getAttribute('aria-hidden') !== 'true');
  if (!frame) throw new Error('Missing visible game');
  return frame;
}
function hidden() {
  const frame = frames().find((f) => f.getAttribute('aria-hidden') === 'true');
  if (!frame) throw new Error('Missing preload');
  return frame;
}
function message(frame: HTMLIFrameElement, type: ChildMessageType, overrides: MessageEventInit = {}) {
  const url = new URL(frame.src);
  const identity = readLaunchIdentity(url.search);
  if (!identity) throw new Error('Missing identity');
  act(() => window.dispatchEvent(new MessageEvent('message', {
    data: makeMessage(type, identity), origin: url.origin, source: frame.contentWindow, ...overrides,
  })));
}
function latestSession(): HubSession {
  const session = mocks.save.mock.calls.at(-1)?.[0];
  if (!session) throw new Error('Missing saved session');
  return session;
}
async function prepare(mode: 'single' | 'all' = 'single') {
  render(<SessionShell band={4} mode={mode} gameId={mode === 'single' ? 'sofa' : undefined} />);
  await waitFor(() => expect(frames()).toHaveLength(1));
  const current = visible();
  message(current, 'hello');
  message(current, 'ready');
  await waitFor(() => expect(frames()).toHaveLength(2));
  return { current, preload: hidden(), session: latestSession() };
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.targets = [{ gameId: 'sofa', releaseId: 'registry-1', origin: 'https://sofa-host.lovable.app' }, { gameId: 'robot', releaseId: 'registry-1', origin: 'https://robot-host.lovable.app' }];
  mocks.status = 'fresh';
  mocks.refresh.mockResolvedValue({});
  mocks.release.mockResolvedValue('build-1');
});
afterEach(cleanup);

describe('published child loader ownership', () => {
  it.each(['airship', 'radio', 'curiosity', 'ticket', 'take', 'seating', 'sofa', 'ordering', 'robot', 'seaside', 'trains'])('%s stays unready without a duplicate starting cover, then times out and retries', async (gameId) => {
    mocks.targets = [{ gameId, releaseId: 'registry-1', origin: `https://${gameId}-host.lovable.app` }];
    vi.useFakeTimers();
    render(<SessionShell band={4} mode="single" gameId={gameId} />);
    await act(async () => { await Promise.resolve(); });
    expect(frames()).toHaveLength(1);
    const current = visible();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    message(current, 'hello');
    message(current, 'next');
    expect(frames()).toHaveLength(1);
    expect(latestSession().reserved).toBeNull();
    try {
      await act(async () => { vi.advanceTimersByTime(20_000); });
      expect(screen.getByRole('status')).toHaveTextContent('taking a while');
      expect(screen.getByRole('button', { name: 'All games' })).toBeInTheDocument();
      act(() => screen.getByRole('button', { name: 'Try again' }).click());
      expect(visible()).not.toBe(current);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      message(visible(), 'ready');
      expect(frames()).toHaveLength(2);
    } finally { vi.useRealTimers(); }
  });

  it('money-change keeps the 20 s slow state but shows compact, non-blocking recovery over its live document', async () => {
    mocks.targets = [{ gameId: 'money-change', releaseId: 'registry-1', origin: 'https://till-host.lovable.app' }];
    vi.useFakeTimers();
    try {
      render(<SessionShell band={3} mode="single" gameId="money-change" />);
      await act(async () => { await Promise.resolve(); });
      const current = visible();
      message(current, 'hello');
      await act(async () => { vi.advanceTimersByTime(19_999); });
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      await act(async () => { vi.advanceTimersByTime(1); });
      const panel = screen.getByRole('status');
      expect(panel).toHaveTextContent(/taking a while/i);
      expect(panel.dataset.slowRecovery).toBe('compact');
      expect(panel.className).not.toMatch(/inset-0|bg-background\/90|backdrop/);
      expect(screen.queryByText('This adventure is taking a while to open.')).not.toBeInTheDocument();
      expect(screen.queryByText('Opening your adventure…')).not.toBeInTheDocument();
      expect(document.activeElement).not.toBe(screen.getByRole('button', { name: 'Try again' }));
      expect(visible()).toBe(current);
      expect(latestSession().reserved).toBeNull();
      // Same recovery handlers: Try again gives the same instance a fresh document and nonce.
      const before = new URL(current.src);
      act(() => screen.getByRole('button', { name: 'Try again' }).click());
      const again = visible();
      expect(again).not.toBe(current);
      const after = new URL(again.src);
      expect(after.searchParams.get('s')).toBeTruthy();
      expect(after.searchParams.get('s')).toBe(before.searchParams.get('s'));
      expect(readLaunchIdentity(after.search)?.nonce).not.toBe(readLaunchIdentity(before.search)?.nonce);
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      await act(async () => { vi.advanceTimersByTime(20_000); });
      expect(screen.getByRole('status').dataset.slowRecovery).toBe('compact');
      // Only real ready clears it.
      message(again, 'ready');
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
      expect(frames()).toHaveLength(2);
      expect(screen.queryByRole('button', { name: 'All games' })).not.toBeInTheDocument();
    } finally { vi.useRealTimers(); }
  });

  it('money-change compact All games uses the normal Back handler', async () => {
    mocks.targets = [{ gameId: 'money-change', releaseId: 'registry-1', origin: 'https://till-host.lovable.app' }];
    vi.useFakeTimers();
    try {
      render(<SessionShell band={3} mode="single" gameId="money-change" />);
      await act(async () => { await Promise.resolve(); });
      await act(async () => { vi.advanceTimersByTime(20_000); });
      act(() => screen.getByRole('button', { name: 'All games' }).click());
      expect(mocks.navigate).toHaveBeenCalledWith({ to: '/', search: { band: 3 } });
    } finally { vi.useRealTimers(); }
  });

  it.each(['trains', 'airship'])('%s keeps the existing full slow cover', async (gameId) => {
    mocks.targets = [{ gameId, releaseId: 'registry-1', origin: `https://${gameId}-host.lovable.app` }];
    vi.useFakeTimers();
    try {
      render(<SessionShell band={4} mode="single" gameId={gameId} />);
      await act(async () => { await Promise.resolve(); });
      await act(async () => { vi.advanceTimersByTime(20_000); });
      const cover = screen.getByRole('status');
      expect(cover).toHaveTextContent('This adventure is taking a while to open.');
      expect(cover.className).toContain('inset-0');
      expect(cover.dataset.slowRecovery).toBeUndefined();
    } finally { vi.useRealTimers(); }
  });

  it.each(['sudoku'])('%s retains normal hub startup without approved child-loader capability', async (gameId) => {
    mocks.targets = [{ gameId, releaseId: 'registry-1', origin: `https://${gameId}-host.lovable.app` }];
    render(<SessionShell band={4} mode="single" gameId={gameId} />);
    await waitFor(() => expect(frames()).toHaveLength(1));
    expect(screen.getByRole('status')).toHaveTextContent('Opening your adventure');
    expect(latestSession().reserved).toBeNull();
  });
});

describe('one-tap session handover', () => {
  it('promotes the same unready preload, activates it, and waits for real ready before reserving again', async () => {
    const { current, preload, session } = await prepare();
    const post = vi.spyOn(preload.contentWindow ?? window, 'postMessage');
    message(preload, 'hello');
    expect(post.mock.calls.at(-1)?.[0].type).toBe('prepare');
    message(current, 'next');
    message(current, 'next'); // repeated intent while verification is in flight
    await waitFor(() => expect(visible()).toBe(preload));
    expect(latestSession().current).toEqual({ ...session.reserved, releaseId: 'build-1' });
    expect(latestSession().reserved).toBeNull();
    expect(frames()).toHaveLength(1);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(post.mock.calls.at(-1)?.[0].type).toBe('activate');
    expect(new URL(preload.src).searchParams.get('band')).toBe('4');
    message(preload, 'ready');
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(frames()).toHaveLength(2);
    expect(latestSession().current?.gameId).toBe('sofa');
  });

  it('automatically promotes a new-build replacement with the reserved seed and consumes the deck once', async () => {
    const { current, preload, session } = await prepare('all');
    mocks.release.mockResolvedValue('build-2');
    message(current, 'next');
    await waitFor(() => expect(visible()).not.toBe(current));
    const replacement = visible();
    expect(replacement).not.toBe(preload);
    expect(preload.isConnected).toBe(false);
    expect(frames()).toHaveLength(1);
    const next = latestSession();
    expect(next.current?.seed).toBe(session.reserved?.seed);
    expect(next.current?.gameId).toBe(session.reserved?.gameId);
    expect(next.current?.instanceId).not.toBe(session.reserved?.instanceId);
    expect(next.current?.releaseId).toBe('build-2');
    expect(next.seen).toEqual([...session.seen, session.reserved?.gameId]);
    expect(new Set(next.seen).size).toBe(2);
    expect(next.reserved).toBeNull();
    expect(new URL(replacement.src).searchParams.get('host_phase')).toBe('active');
    const post = vi.spyOn(replacement.contentWindow ?? window, 'postMessage');
    message(replacement, 'hello');
    expect(post.mock.calls.at(-1)?.[0].type).toBe('activate');
    message(replacement, 'ready');
    await waitFor(() => expect(screen.queryByRole('status')).not.toBeInTheDocument());
    expect(frames()).toHaveLength(2);
  });

  it.each(['version', 'metadata'])('keeps the current puzzle safe on %s failure and retries the same intent', async (failure) => {
    const { current, preload, session } = await prepare();
    if (failure === 'version') mocks.release.mockRejectedValueOnce(new Error('offline'));
    else mocks.status = 'failed';
    message(current, 'next');
    await screen.findByRole('alert');
    expect(visible()).toBe(current);
    expect(latestSession()).toEqual(session);
    expect(frames()).toHaveLength(2);
    mocks.status = 'fresh';
    await act(async () => screen.getByRole('button', { name: 'Retry' }).click());
    await waitFor(() => expect(visible()).toBe(preload));
  });

  it('ignores hidden/forged Back but honours legitimate current Back without a hub workaround', async () => {
    const { current, preload } = await prepare();
    message(preload, 'back');
    message(current, 'back', { origin: 'https://wrong-host.lovable.app' });
    message(current, 'back', { source: window });
    expect(mocks.navigate).not.toHaveBeenCalled();
    message(current, 'back');
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/', search: { band: 4 } });
  });
});