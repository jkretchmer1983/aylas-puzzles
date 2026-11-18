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
  mocks.status = 'fresh';
  mocks.refresh.mockResolvedValue({});
  mocks.release.mockResolvedValue('build-1');
});
afterEach(cleanup);

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
    expect(screen.getByRole('status')).toHaveTextContent('Opening your adventure');
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