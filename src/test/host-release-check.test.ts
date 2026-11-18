import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchHostRelease, refreshReservedInstance } from '@/host/release-check';
import { promoteNext, reserveNext, startSession } from '@/host/session-queue';

const payload = (buildId = 'build-1') => ({ protocol: 'ayla-host', protocolVersion: 1, catalogId: 'v2-robot', gameId: 'robot', buildId, releaseId: buildId });
afterEach(() => vi.unstubAllGlobals());

describe('public host freshness', () => {
  it('reads the current public build with CORS and no-store rather than registry version', async () => {
    const fetcher = vi.fn().mockResolvedValue(Response.json(payload('build-2')));
    vi.stubGlobal('fetch', fetcher);
    expect(await fetchHostRelease('https://robot-host.lovable.app', 'robot')).toBe('build-2');
    expect(fetcher).toHaveBeenCalledWith(new URL('https://robot-host.lovable.app/api/release'), expect.objectContaining({ mode: 'cors', cache: 'no-store', credentials: 'omit' }));
  });
  it('same version reuses the reserved document identity', () => {
    const instance = { instanceId: 'old', gameId: 'robot', seed: 42, releaseId: 'build-1' };
    const fresh = vi.fn(() => 'new');
    expect(refreshReservedInstance(instance, 'build-1', fresh)).toBe(instance);
    expect(fresh).not.toHaveBeenCalled();
  });
  it('republishing invalidates only the reserved document, preserving game, seed and deck until promotion', () => {
    const eligible = [{ gameId: 'robot', releaseId: 'registry-old' }, { gameId: 'sofa', releaseId: 'r-sofa' }];
    const started = startSession(4, 'all', eligible, undefined, () => 0);
    if (!started) throw new Error('Expected a session');
    const reserved = reserveNext(started, eligible, () => 0);
    if (!reserved.reserved) throw new Error('Expected a reservation');
    const changed = refreshReservedInstance(reserved.reserved, 'host-new', () => 'fresh-document');
    const prepared = { ...reserved, reserved: changed };
    expect(prepared.current).toBe(started.current);
    expect(prepared.seen).toEqual(started.seen);
    expect(changed.seed).toBe(reserved.reserved.seed);
    expect(changed.gameId).toBe(reserved.reserved.gameId);
    expect(changed.instanceId).not.toBe(reserved.reserved.instanceId);
    expect(reserveNext(prepared, eligible)).toBe(prepared);
    const promoted = promoteNext(prepared, eligible);
    expect(promoted?.current).toBe(changed);
    expect(promoted?.seen).toEqual(['robot', 'sofa']);
  });
  it('rejects wrong identities, inconsistent aliases and HTTP failures', async () => {
    for (const value of [{ ...payload(), catalogId: 'v1-riddle' }, { ...payload(), gameId: 'sofa' }, { ...payload(), releaseId: 'other' }]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json(value)));
      await expect(fetchHostRelease('https://robot-host.lovable.app', 'robot')).rejects.toThrow();
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 503 })));
    await expect(fetchHostRelease('https://robot-host.lovable.app', 'robot')).rejects.toThrow();
  });
  it('aborts an unreachable host within the bounded timeout', async () => {
    vi.stubGlobal('fetch', vi.fn((_url, options: RequestInit) => new Promise((_resolve, reject) => options.signal?.addEventListener('abort', () => reject(new Error('aborted'))))));
    await expect(fetchHostRelease('https://robot-host.lovable.app', 'robot', 5)).rejects.toThrow('aborted');
  });
});