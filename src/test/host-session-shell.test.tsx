import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SessionShell } from '@/host/SessionShell';
import { makeMessage, readLaunchIdentity, type ChildMessageType } from '@/host/protocol';
import type { HubSession } from '@/host/session-queue';

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(), refresh: vi.fn(), release: vi.fn(), save: vi.fn(), saveIntent: vi.fn(),
  status: 'fresh', saved: null as HubSession | null, intent: null as null | { band: number; gameId: string; step: 'next' | 'previous' },
  targets: [{ gameId: 'sofa', releaseId: 'registry-1', origin: 'https://sofa-host.lovable.app' }, { gameId: 'robot', releaseId: 'registry-1', origin: 'https://robot-host.lovable.app' }],
}));
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => mocks.navigate }));
vi.mock('@/lib/catalog-store', () => ({
  useCatalog: () => null, useRegistry: () => null, getCurrentCatalog: () => null, getCurrentRegistry: () => null,
  refreshCatalog: () => mocks.refresh(), getManifestStatus: () => mocks.status,
}));
vi.mock('@/host/eligibility', () => ({ sessionTargets: () => mocks.targets }));
vi.mock('@/host/session-store', () => ({
  readHubSession: () => mocks.saved, saveHubSession: (s: HubSession) => mocks.save(s),
  saveStepIntent: (i: unknown) => mocks.saveIntent(i),
  consumeStepIntent: () => { const i = mocks.intent; mocks.intent = null; return i; },
}));
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
  mocks.saved = null;
  mocks.intent = null;
  mocks.refresh.mockResolvedValue({});
  mocks.release.mockResolvedValue('build-1');
});
afterEach(cleanup);

describe('published child loader ownership', () => {
  it.each(['airship', 'radio', 'curiosity', 'ticket', 'take', 'seating', 'sofa', 'ordering', 'robot', 'seaside', 'trains', 'water'])('%s stays unready without a duplicate starting cover, then times out and retries', async (gameId) => {
    const other = gameId === 'sofa' ? 'robot' : 'sofa';
    mocks.targets = [{ gameId, releaseId: 'registry-1', origin: `https://${gameId}-host.lovable.app` }, { gameId: other, releaseId: 'registry-1', origin: `https://${other}-host.lovable.app` }];
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
    // Single mode reserves a DIFFERENT game type (top Next), so a second eligible game is present.
    mocks.targets = [{ gameId: 'money-change', releaseId: 'registry-1', origin: 'https://till-host.lovable.app' }, { gameId: 'sofa', releaseId: 'registry-1', origin: 'https://sofa-host.lovable.app' }];
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
    expect(latestSession().current?.gameId).toBe('robot');
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
describe('top Next / Previous change puzzle type', () => {
  function locate(frame: HTMLIFrameElement, href: string) {
    const url = new URL(frame.src);
    const identity = readLaunchIdentity(url.search)!;
    act(() => window.dispatchEvent(new MessageEvent('message', { data: makeMessage('location', identity, { href }), origin: url.origin, source: frame.contentWindow })));
  }

  it('Next from a single-game launch opens a different game; Previous restores the first game and its work', async () => {
    const { current, preload, session } = await prepare('single');
    expect(session.reserved?.gameId).toBe('robot');
    locate(current, '/sofa?band=4&seed=77&lvl=3');
    message(current, 'next');
    await waitFor(() => expect(visible()).toBe(preload));
    expect(latestSession().history.at(-1)).toMatchObject({ gameId: 'sofa', href: '/sofa?band=4&seed=77&lvl=2' });
    message(preload, 'hello');
    message(preload, 'ready');
    await waitFor(() => expect(frames()).toHaveLength(2));
    expect(latestSession().reserved?.gameId).toBe('sofa');
    message(preload, 'previous');
    await waitFor(() => expect(latestSession().current?.gameId).toBe('sofa'));
    expect(latestSession().current?.instanceId).toBe(session.current?.instanceId);
    expect(latestSession().current?.seed).toBe(session.current?.seed);
    expect(latestSession().forward.at(-1)?.gameId).toBe('robot');
    // The restored document resumes the saved location (level normalized) and the same-game reservation is dropped.
    const restored = visible();
    expect(new URL(restored.src).pathname).toBe('/sofa');
    expect(new URL(restored.src).searchParams.get('seed')).toBe('77');
    expect(new URL(restored.src).searchParams.get('lvl')).toBe('2');
    expect(latestSession().reserved).toBeNull();
    expect(frames().length).toBeLessThanOrEqual(2);
  });

  it('Play all Previous with no history opens the previous eligible type, skipping a withdrawn game', async () => {
    mocks.targets = [
      { gameId: 'sofa', releaseId: 'registry-1', origin: 'https://sofa-host.lovable.app' },
      { gameId: 'robot', releaseId: 'registry-1', origin: 'https://robot-host.lovable.app' },
      { gameId: 'ticket', releaseId: 'registry-1', origin: 'https://ticket-host.lovable.app' },
    ];
    const { current, session } = await prepare('all');
    const others = mocks.targets.filter((t) => t.gameId !== session.current?.gameId);
    mocks.targets = others; // the current game's age/visibility changed: it is no longer eligible
    message(current, 'previous');
    await waitFor(() => expect(latestSession().current?.gameId).not.toBe(session.current?.gameId));
    expect(others.map((t) => t.gameId)).toContain(latestSession().current?.gameId);
    expect(frames().length).toBeLessThanOrEqual(2);
  });

  it('with only one eligible game, Next and Previous keep the same puzzle and say so', async () => {
    mocks.targets = [{ gameId: 'sofa', releaseId: 'registry-1', origin: 'https://sofa-host.lovable.app' }];
    render(<SessionShell band={4} mode="single" gameId="sofa" />);
    await waitFor(() => expect(frames()).toHaveLength(1));
    const current = visible();
    message(current, 'hello');
    message(current, 'ready');
    const before = latestSession();
    message(current, 'next');
    expect(await screen.findByText(/only adventure ready/)).toBeInTheDocument();
    message(current, 'previous');
    expect(visible()).toBe(current);
    expect(latestSession().current).toEqual(before.current);
    expect(frames()).toHaveLength(1);
  });

  it('a failed check on Previous keeps the current game safe and Retry repeats Previous', async () => {
    const { current } = await prepare('single');
    mocks.status = 'failed';
    message(current, 'previous');
    await screen.findByRole('alert');
    expect(visible()).toBe(current);
    mocks.status = 'fresh';
    await act(async () => screen.getByRole('button', { name: 'Retry' }).click());
    await waitFor(() => expect(latestSession().current?.gameId).toBe('robot'));
  });

  it('a standalone arrow step is recorded, the address is cleaned, and it is consumed once relative to that game', async () => {
    mocks.intent = { band: 4, gameId: 'sofa', step: 'next' };
    render(<SessionShell band={4} mode="all" step={{ gameId: 'sofa', step: 'next' }} />);
    expect(mocks.saveIntent).toHaveBeenCalledWith({ band: 4, gameId: 'sofa', step: 'next' });
    expect(mocks.navigate).toHaveBeenCalledWith({ to: '/session', search: { band: 4, mode: 'all' }, replace: true });
    await waitFor(() => expect(frames()).toHaveLength(1));
    expect(latestSession().current?.gameId).toBe('robot');
    expect(latestSession().mode).toBe('all');
    expect(latestSession().history.at(-1)?.gameId).toBe('sofa');
    expect(mocks.intent).toBeNull();
  });

  it('a standalone arrow with only that game eligible offers to go back instead of reshuffling it', async () => {
    mocks.targets = [{ gameId: 'sofa', releaseId: 'registry-1', origin: 'https://sofa-host.lovable.app' }];
    mocks.intent = { band: 4, gameId: 'sofa', step: 'previous' };
    render(<SessionShell band={4} mode="all" />);
    expect(await screen.findByText(/only adventure ready/)).toBeInTheDocument();
    expect(frames()).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'All games' })).toBeInTheDocument();
  });
});

describe('Previous and forward restores verify the target release first', () => {
  function locate(frame: HTMLIFrameElement, href: string) {
    const url = new URL(frame.src);
    const identity = readLaunchIdentity(url.search)!;
    act(() => window.dispatchEvent(new MessageEvent('message', { data: makeMessage('location', identity, { href }), origin: url.origin, source: frame.contentWindow })));
  }
  async function onRobotWithSofaHistory() {
    const { current, preload, session } = await prepare('single');
    locate(current, '/sofa?band=4&seed=77&lvl=2');
    message(current, 'next');
    await waitFor(() => expect(visible()).toBe(preload));
    message(preload, 'hello');
    message(preload, 'ready');
    await waitFor(() => expect(frames()).toHaveLength(2)); // fresh reservation captured its version already
    return { sofaFrame: current, robotFrame: preload, sofa: session.current! };
  }

  it.each([['unreachable', new Error('offline')], ['mismatched', new Error('This adventure returned a mismatched release.')]])('a %s version on Previous keeps the current puzzle; Retry restores the same work in a fresh latest document', async (_label, failure) => {
    const { sofaFrame, robotFrame, sofa } = await onRobotWithSofaHistory();
    const before = latestSession();
    mocks.release.mockClear();
    mocks.release.mockRejectedValueOnce(failure);
    message(robotFrame, 'previous');
    await screen.findByRole('alert');
    expect(mocks.release).toHaveBeenCalledWith('https://sofa-host.lovable.app', 'sofa');
    expect(visible()).toBe(robotFrame);
    expect(latestSession()).toEqual(before);
    mocks.release.mockResolvedValue('build-2');
    await act(async () => screen.getByRole('button', { name: 'Retry' }).click());
    await waitFor(() => expect(latestSession().current?.gameId).toBe('sofa'));
    const restored = latestSession().current!;
    expect(restored).toMatchObject({ instanceId: sofa.instanceId, seed: sofa.seed, href: '/sofa?band=4&seed=77&lvl=2', releaseId: 'build-2' });
    const doc = visible();
    expect(doc).not.toBe(sofaFrame);
    expect(sofaFrame.isConnected).toBe(false);
    expect(new URL(doc.src).searchParams.get('seed')).toBe('77');
    expect(new URL(doc.src).searchParams.get('host_nonce')).not.toBe(new URL(sofaFrame.src).searchParams.get('host_nonce'));
    expect(frames().length).toBeLessThanOrEqual(2);
  });

  it('a failed version on forward restore keeps the current puzzle; Retry returns forward with the same work', async () => {
    const { robotFrame } = await onRobotWithSofaHistory();
    const robot = latestSession().current!;
    message(robotFrame, 'previous');
    await waitFor(() => expect(latestSession().current?.gameId).toBe('sofa'));
    const sofaDoc = visible();
    message(sofaDoc, 'hello');
    message(sofaDoc, 'ready');
    await waitFor(() => expect(frames()).toHaveLength(2));
    const before = latestSession();
    mocks.release.mockClear();
    mocks.release.mockRejectedValueOnce(new Error('offline'));
    message(sofaDoc, 'next');
    await screen.findByRole('alert');
    expect(mocks.release).toHaveBeenCalledWith('https://robot-host.lovable.app', 'robot');
    expect(visible()).toBe(sofaDoc);
    expect(latestSession()).toEqual(before);
    mocks.release.mockResolvedValue('build-3');
    await act(async () => screen.getByRole('button', { name: 'Retry' }).click());
    await waitFor(() => expect(latestSession().current?.gameId).toBe('robot'));
    expect(latestSession().current).toMatchObject({ instanceId: robot.instanceId, seed: robot.seed, releaseId: 'build-3' });
    expect(visible()).not.toBe(robotFrame);
    expect(robotFrame.isConnected).toBe(false);
    expect(latestSession().forward).toEqual([]);
  });
});

describe('Train /adventures level locations through the real shell', () => {
  it('stores a Train level location (legacy 3 → 2) and Previous resumes it on the fixed path after version check', async () => {
    mocks.targets = [{ gameId: 'trains', releaseId: 'registry-1', origin: 'https://trains-host.lovable.app' }, { gameId: 'sofa', releaseId: 'registry-1', origin: 'https://sofa-host.lovable.app' }];
    render(<SessionShell band={4} mode="single" gameId="trains" />);
    await waitFor(() => expect(frames()).toHaveLength(1));
    const train = visible();
    message(train, 'hello');
    message(train, 'ready');
    await waitFor(() => expect(frames()).toHaveLength(2));
    const identity = readLaunchIdentity(new URL(train.src).search)!;
    for (const [reported, kept] of [['2', '2'], ['3', '2']]) {
      const href = `/adventures?game=trains&band=4&age=7&seed=42&deal=3&level=${reported}`;
      act(() => window.dispatchEvent(new MessageEvent('message', { data: makeMessage('location', identity, { href }), origin: 'https://trains-host.lovable.app', source: train.contentWindow })));
      expect(latestSession().current?.href).toBe(href.replace(`level=${reported}`, `level=${kept}`));
    }
    const saved = latestSession().current!;
    const sofa = hidden();
    message(train, 'next');
    await waitFor(() => expect(visible()).toBe(sofa));
    message(sofa, 'hello');
    message(sofa, 'ready');
    await waitFor(() => expect(frames()).toHaveLength(2));
    mocks.release.mockClear();
    mocks.release.mockResolvedValue('train-build-2');
    message(sofa, 'previous');
    await waitFor(() => expect(latestSession().current?.gameId).toBe('trains'));
    expect(mocks.release).toHaveBeenCalledWith('https://trains-host.lovable.app', 'trains');
    expect(latestSession().current).toMatchObject({ instanceId: saved.instanceId, href: saved.href, releaseId: 'train-build-2' });
    const resumed = new URL(visible().src);
    expect(visible()).not.toBe(train);
    expect(resumed.origin + resumed.pathname).toBe('https://trains-host.lovable.app/adventures');
    expect(Object.fromEntries(['game', 'age', 'seed', 'deal', 'level', 'host_game'].map((k) => [k, resumed.searchParams.get(k)]))).toEqual({ game: 'trains', age: '7', seed: '42', deal: '3', level: '2', host_game: 'trains' });
  });
});

describe('Train bridge 886b444 legacy location through the real shell', () => {
  it('captures the real legacy payload in history and resumes exact seed/deal/level on Previous', async () => {
    mocks.targets = [{ gameId: 'trains', releaseId: 'registry-1', origin: 'https://trains-host.lovable.app' }, { gameId: 'sofa', releaseId: 'registry-1', origin: 'https://sofa-host.lovable.app' }];
    render(<SessionShell band={4} mode="single" gameId="trains" />);
    await waitFor(() => expect(frames()).toHaveLength(1));
    const train = visible();
    message(train, 'hello');
    message(train, 'ready');
    await waitFor(() => expect(frames()).toHaveLength(2));
    const identity = readLaunchIdentity(new URL(train.src).search)!;
    const payload = { protocol: 'ayla-host', v: 1, type: 'location', session: identity.session, nonce: identity.nonce, gameId: 'trains', location: '/adventures?band=4&seed=8675309&deal=4&from=commons&level=3' };
    // Wrong source or origin is ignored even with the right payload.
    act(() => window.dispatchEvent(new MessageEvent('message', { data: payload, origin: 'https://evil.lovable.app', source: train.contentWindow })));
    act(() => window.dispatchEvent(new MessageEvent('message', { data: payload, origin: 'https://trains-host.lovable.app', source: window })));
    expect(latestSession().current?.href).toBeUndefined();
    act(() => window.dispatchEvent(new MessageEvent('message', { data: payload, origin: 'https://trains-host.lovable.app', source: train.contentWindow })));
    const expected = '/adventures?game=trains&band=4&seed=8675309&deal=4&from=commons&level=2';
    expect(latestSession().current?.href).toBe(expected);
    const sofa = hidden();
    message(train, 'next');
    await waitFor(() => expect(visible()).toBe(sofa));
    expect(latestSession().history.at(-1)?.href).toBe(expected);
    message(sofa, 'hello');
    message(sofa, 'ready');
    await waitFor(() => expect(frames()).toHaveLength(2));
    message(sofa, 'previous');
    await waitFor(() => expect(latestSession().current?.gameId).toBe('trains'));
    const resumed = new URL(visible().src);
    expect(resumed.origin + resumed.pathname).toBe('https://trains-host.lovable.app/adventures');
    expect(Object.fromEntries(['game', 'band', 'seed', 'deal', 'level', 'host_game'].map((k) => [k, resumed.searchParams.get(k)]))).toEqual({ game: 'trains', band: '4', seed: '8675309', deal: '4', level: '2', host_game: 'trains' });
  });
});
describe('water directional type navigation (next with direction ±1 uses the shared type navigation)', () => {
  const water = { gameId: 'water', releaseId: 'registry-1', origin: 'https://water-host.lovable.app' };
  const sofa = { gameId: 'sofa', releaseId: 'registry-1', origin: 'https://sofa-host.lovable.app' };
  const trains = { gameId: 'trains', releaseId: 'registry-1', origin: 'https://trains-host.lovable.app' };
  function send(frame: HTMLIFrameElement, type: ChildMessageType, extra: Record<string, unknown> = {}) {
    const url = new URL(frame.src);
    const identity = readLaunchIdentity(url.search);
    if (!identity) throw new Error('Missing identity');
    act(() => window.dispatchEvent(new MessageEvent('message', { data: { ...makeMessage(type, identity), ...extra }, origin: url.origin, source: frame.contentWindow })));
  }
  async function startWater() {
    render(<SessionShell band={4} mode="single" gameId="water" />);
    await waitFor(() => expect(frames()).toHaveLength(1));
    const current = visible();
    send(current, 'hello');
    send(current, 'location', { href: '/adventures?game=water&band=4&age=7&seed=31&deal=2&level=2&from=commons' });
    send(current, 'ready');
    await waitFor(() => expect(frames()).toHaveLength(2));
    return current;
  }

  it('Next (+1) moves to a different eligible TYPE and keeps the exact water instance for Previous', async () => {
    mocks.targets = [sofa, water, trains];
    const current = await startWater();
    const arriving = latestSession().reserved!;
    expect(arriving.gameId).not.toBe('water');
    send(current, 'next', { direction: 1 });
    await waitFor(() => expect(latestSession().current?.gameId).toBe(arriving.gameId));
    const s = latestSession();
    const target = mocks.targets.find((t) => t.gameId === arriving.gameId)!;
    expect(new URL(visible().src).origin).toBe(target.origin);
    expect(s.history.at(-1)?.href).toBe('/adventures?game=water&band=4&age=7&seed=31&deal=2&level=2&from=commons');
    expect(s.mode).toBe('single');
    expect(current.isConnected).toBe(false);
    expect(frames().length).toBeLessThanOrEqual(2);
  });

  it('Previous (-1) wraps to the previous eligible type', async () => {
    mocks.targets = [water, trains, sofa];
    const current = await startWater();
    send(current, 'next', { direction: -1 });
    await waitFor(() => expect(latestSession().current?.gameId).toBe('sofa'));
  });

  it('returns to the exact seated instance of the arriving type and drops a duplicate preload', async () => {
    mocks.targets = [sofa, water];
    const random = vi.spyOn(Math, 'random').mockReturnValue(0);
    try {
      render(<SessionShell band={4} mode="all" />);
      await waitFor(() => expect(frames()).toHaveLength(1));
      const first = visible();
      expect(new URL(first.src).origin).toBe(sofa.origin);
      send(first, 'hello');
      send(first, 'location', { href: '/sofa?band=4&seed=777&from=commons' });
      send(first, 'ready');
      await waitFor(() => expect(frames()).toHaveLength(2));
      send(first, 'next');
      await waitFor(() => expect(latestSession().current?.gameId).toBe('water'));
      const w = visible();
      send(w, 'hello');
      send(w, 'ready');
      await waitFor(() => expect(latestSession().reserved?.gameId).toBe('sofa'));
      send(w, 'next', { direction: -1 });
      await waitFor(() => expect(latestSession().current?.gameId).toBe('sofa'));
      const back = new URL(visible().src);
      expect(back.pathname).toBe('/sofa');
      expect(back.searchParams.get('seed')).toBe('777');
      expect(readLaunchIdentity(back.search)?.nonce).not.toBe(readLaunchIdentity(new URL(first.src).search)?.nonce);
      expect(latestSession().reserved).toBeNull();
      expect(latestSession().forward.at(-1)?.gameId).toBe('water');
      expect(frames()).toHaveLength(1);
    } finally { random.mockRestore(); }
  });

  it('drops malformed directions from water and ignores direction from other games', async () => {
    mocks.targets = [sofa, water, trains];
    const current = await startWater();
    for (const direction of [0, 2, '1', null, -2]) send(current, 'next', { direction });
    await act(async () => { await Promise.resolve(); });
    expect(visible()).toBe(current);
    expect(latestSession().current?.gameId).toBe('water');
    cleanup();
    mocks.targets = [sofa, robotTarget()];
    const { current: s, preload } = await prepare();
    send(s, 'next', { direction: 1 });
    // Ignored direction: an ordinary top Next, i.e. the prepared different type.
    await waitFor(() => expect(visible()).toBe(preload));
    expect(latestSession().current?.gameId).toBe('robot');
  });

  it('with no other eligible type: Previous and Next keep the same puzzle and say so', async () => {
    mocks.targets = [water];
    render(<SessionShell band={4} mode="single" gameId="water" />);
    await waitFor(() => expect(frames()).toHaveLength(1));
    const current = visible();
    send(current, 'hello');
    send(current, 'ready');
    const before = latestSession();
    send(current, 'next', { direction: -1 });
    expect(await screen.findByText(/only adventure ready/)).toBeInTheDocument();
    send(current, 'next', { direction: 1 });
    await act(async () => { await Promise.resolve(); });
    expect(visible()).toBe(current);
    expect(latestSession().current).toEqual(before.current);
    expect(frames()).toHaveLength(1);
  });
});

function robotTarget() { return { gameId: 'robot', releaseId: 'registry-1', origin: 'https://robot-host.lovable.app' }; }
