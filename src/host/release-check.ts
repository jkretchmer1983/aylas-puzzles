import { publicGameById } from './public-games';
import { HOST_PROTOCOL, HOST_PROTOCOL_VERSION } from './protocol';
import type { SessionInstance } from './session-queue';

/** Read the actual public deployment, not the registry's activation-time version. */
export async function fetchHostRelease(origin: string, gameId: string, timeoutMs = 3000): Promise<string> {
  const game = publicGameById(gameId);
  if (!game) throw new Error('Unknown adventure.');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(new URL('/api/release', origin), {
      mode: 'cors', cache: 'no-store', credentials: 'omit', signal: controller.signal,
    });
    if (!response.ok) throw new Error('Could not check this adventure’s latest version.');
    const value: unknown = await response.json();
    if (!value || typeof value !== 'object') throw new Error('Invalid adventure release.');
    const release = value as Record<string, unknown>;
    const build = release.buildId ?? release.releaseId;
    if (release.protocol !== HOST_PROTOCOL || release.protocolVersion !== HOST_PROTOCOL_VERSION ||
      release.catalogId !== game.catalogId || release.gameId !== gameId ||
      typeof build !== 'string' || !build.length || build.length > 120 ||
      (release.releaseId !== undefined && release.releaseId !== build)) {
      throw new Error('This adventure returned a mismatched release.');
    }
    return build;
  } finally { clearTimeout(timer); }
}

/** Refresh a reserved document only: never draw another seed or consume the deck. */
export function refreshReservedInstance(instance: SessionInstance, releaseId: string, freshId: () => string): SessionInstance {
  if (instance.releaseId === releaseId) return instance;
  const { href: _oldDocumentLocation, ...samePuzzle } = instance;
  return { ...samePuzzle, releaseId, instanceId: freshId() };
}