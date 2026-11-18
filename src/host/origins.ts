import { CANONICAL_HUB_ORIGIN, HOST_ROLE } from "./config";

/**
 * Exact parent (hub) origins a game iframe may talk to. Production: only the canonical hub.
 * Review previews: exact HTTPS origins listed in VITE_AYLA_DEV_PARENT_ORIGINS (comma separated) at build
 * time — a dev/review-only setting; never set it for a production game host. The master review project
 * also embeds its own routes same-origin.
 */
export function exactHttpsOrigin(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.username || url.password || url.pathname !== "/" || url.search || url.hash) return undefined;
    return url.origin === value.trim().replace(/\/$/, "") ? url.origin : undefined;
  } catch {
    return undefined;
  }
}

export function devParentOrigins(raw: string | undefined = import.meta.env.VITE_AYLA_DEV_PARENT_ORIGINS as string | undefined): string[] {
  if (!raw) return [];
  return raw.split(",").flatMap((item) => { const origin = exactHttpsOrigin(item); return origin ? [origin] : []; });
}

/**
 * Exact owner-approved integration-QA parents (no wildcards): the hub's isolated QA preview and this
 * Scene Games review preview. They may embed a game host and exchange protocol messages; they are never
 * registry destinations (registry URLs stay production-only).
 */
export const QA_PARENT_ORIGINS = [
  "https://id-preview-4--0a7ba2f9-7210-4e52-9220-51a3c422ad05.lovable.app",
  "https://id-preview-11--f6472ef2-e352-4eea-bebd-b2ca3e651718.lovable.app",
] as const;

/**
 * Private preview / dev origins where a game host may run its unregistered-Done QA shortcut: Lovable's
 * auth-walled project previews (id-preview[-N]--<project uuid>.lovable.app, <uuid>.lovableproject.com)
 * and localhost. Published *.lovable.app slugs and custom domains are never QA origins.
 */
export function isPrivateQaOrigin(origin: string): boolean {
  let url: URL;
  try { url = new URL(origin); } catch { return false; }
  if (url.origin !== origin) return false;
  if ((url.hostname === "localhost" || url.hostname === "127.0.0.1") && (url.protocol === "http:" || url.protocol === "https:")) return true;
  if (url.protocol !== "https:" || url.port) return false;
  return /^id-preview(?:-\d+)?--[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.lovable\.app$/.test(url.hostname)
    || /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.lovableproject\.com$/.test(url.hostname);
}

export function allowedParentOrigins(selfOrigin: string): string[] {
  const list = [CANONICAL_HUB_ORIGIN, ...QA_PARENT_ORIGINS, ...devParentOrigins()];
  if (HOST_ROLE === "master") list.push(selfOrigin);
  return [...new Set(list)];
}
