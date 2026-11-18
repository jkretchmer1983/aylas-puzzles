import { z } from "zod";
import { BANDS } from "@/gen/bands";
import snapshotJson from "@/lib/catalog-snapshot.json";
import { CATALOG_THUMBNAILS } from "@/lib/catalog-thumbnails";
import { installedAdapterForBand, type InstalledGameAdapter } from "@/lib/game-adapters";

/** Catalog release status. Only `available` can ever unlock an installed adapter. */
export const CATALOG_RELEASES = ["available", "coming-soon", "withdrawn"] as const;
export type CatalogRelease = (typeof CATALOG_RELEASES)[number];

const BUNDLED_THUMBNAIL = /^v[12]-[a-z0-9-]+\.jpg$/;
const LOVABLE_ASSET_PATH = /^\/__l5e\/assets-v1\/[0-9a-f-]{36}\/[A-Za-z0-9._-]+\.(?:jpe?g|png|webp|avif)$/;
const IMAGE_PATH = /\.(?:jpe?g|png|webp|avif)$/i;
/**
 * The one explicitly configured PUBLIC image location of the release service: content-addressed
 * thumbnails at /thumbnails/<catalogId>/<sha256>.<png|jpg|webp>. Every other chatgpt.site, dashboard,
 * editor or preview URL stays rejected.
 */
export const PUBLIC_RELEASE_IMAGE_ORIGIN = "https://aylas-game-releases.coatedscarf3.chatgpt.site";
const PUBLIC_RELEASE_IMAGE_PATH = /^\/thumbnails\/v[12]-[a-z0-9-]{1,60}\/[0-9a-f]{64}\.(?:png|jpe?g|webp)$/;
/** Dashboards, editors and preview builds are private; their URLs never reach children. */
const PRIVATE_HOSTS = [
  /(^|\.)id-preview[^.]*\.lovable\.app$/i,
  /^id-preview/i,
  /-dev\.lovable\.app$/i,
  /(^|\.)lovable\.dev$/i,
  /(^|\.)lovableproject\.com$/i,
  /(^|\.)chatgpt\.(?:site|com)$/i,
  /^localhost$/i,
  /^\d{1,3}(?:\.\d{1,3}){3}$/,
  /^\[.*\]$/,
  /\.(?:local|internal|localhost)$/i,
];

/** True for dashboards, editors, previews, local and raw-IP hosts that must never reach children. */
export function isPrivateHostname(hostname: string): boolean {
  return PRIVATE_HOSTS.some((pattern) => pattern.test(hostname));
}

/**
 * A thumbnail is either a bundled filename (resolved through the imported asset map),
 * a same-origin Lovable asset path, or a plain public HTTPS image URL. Anything else —
 * javascript:, data:, private previews, credentials, ports, query strings or non-image
 * destinations such as game launch links — is rejected and fails the whole feed.
 */
export function isSafeThumbnailReference(value: string): boolean {
  if (value.length > 300 || /[\s\\]/.test(value)) return false;
  if (BUNDLED_THUMBNAIL.test(value)) return true;
  if (value.startsWith("/")) return LOVABLE_ASSET_PATH.test(value);
  let url: URL;
  try { url = new URL(value); } catch { return false; }
  if (url.protocol !== "https:") return false;
  if (url.username || url.password || url.port || url.search || url.hash) return false;
  if (url.origin === PUBLIC_RELEASE_IMAGE_ORIGIN) return PUBLIC_RELEASE_IMAGE_PATH.test(url.pathname) && value === url.href;
  if (PRIVATE_HOSTS.some((pattern) => pattern.test(url.hostname))) return false;
  return IMAGE_PATH.test(url.pathname);
}

const catalogRecordSchema = z.object({
  // Dashboard-safe slug: letters, numbers and hyphens only (no paths, dots or URLs).
  id: z.string().min(1).max(100).regex(/^[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*$/),
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(220),
  // The dashboard allows 1–99; recordSupportsBand intersects with the app's bands.
  minAge: z.number().int().min(1).max(99),
  maxAge: z.number().int().min(1).max(99),
  thumbnail: z.string().refine(isSafeThumbnailReference, { message: "Unsafe thumbnail reference" }).nullable(),
  hidden: z.boolean(),
  release: z.enum(CATALOG_RELEASES),
  // Dashboard workflow note (e.g. "Done"). Informational only: it never makes a game playable.
  nextAction: z.string().trim().min(1).max(60).optional(),
}).strict().refine((record) => record.maxAge >= record.minAge, {
  message: "The maximum age must not be below the minimum age",
});

const publicCatalogSchema = z.object({
  version: z.literal(2),
  revision: z.string().min(1).max(80),
  // An intentionally empty catalog is valid and must stay empty.
  records: z.array(catalogRecordSchema).max(100),
}).strict();

export type PublicCatalogRecord = z.infer<typeof catalogRecordSchema>;
export type PublicCatalog = z.infer<typeof publicCatalogSchema>;
export type PublicBand = (typeof BANDS)[number];

export const PUBLIC_BANDS = BANDS.filter((band) => band.id >= 1);

export function parsePublicCatalog(input: unknown): PublicCatalog {
  const catalog = publicCatalogSchema.parse(input);
  const ids = catalog.records.map((record) => record.id);
  if (new Set(ids).size !== ids.length) throw new Error("Catalog IDs must be unique");
  return catalog;
}

/** Bundled, public-safe last-known-good snapshot. */
export const CATALOG_SNAPSHOT: PublicCatalog = parsePublicCatalog(snapshotJson);

export function bandById(id: number): PublicBand {
  return PUBLIC_BANDS.find((band) => band.id === id) ?? PUBLIC_BANDS[2]!;
}

/** Overlap is not enough: the complete selected range must fit the dashboard range. */
export function recordSupportsBand(record: Pick<PublicCatalogRecord, "minAge" | "maxAge">, band: PublicBand) {
  return record.minAge <= band.min && record.maxAge >= band.max;
}

/** Resolves the record's own thumbnail reference; an unknown bundled filename resolves to "". */
export function resolveThumbnail(reference: string | null): string {
  if (!reference || !isSafeThumbnailReference(reference)) return "";
  if (BUNDLED_THUMBNAIL.test(reference)) return CATALOG_THUMBNAILS[reference] ?? "";
  return reference;
}

export type CatalogGame = PublicCatalogRecord & {
  thumbnailUrl: string;
  adapter: InstalledGameAdapter | undefined;
};

/** Default (master build): catalog release "available" + an installed same-origin adapter. */
export type AdapterResolver = (record: PublicCatalogRecord, bandId: number) => InstalledGameAdapter | undefined;
const installedResolver: AdapterResolver = (record, bandId) => record.release === "available" ? installedAdapterForBand(record.id, bandId) : undefined;

export function gamesForBand(catalog: PublicCatalog, bandId: number, resolveAdapter: AdapterResolver = installedResolver): CatalogGame[] {
  const band = bandById(bandId);
  return catalog.records
    .filter((record) => !record.hidden && recordSupportsBand(record, band))
    .map((record) => ({
      ...record,
      thumbnailUrl: resolveThumbnail(record.thumbnail),
      // Playable needs BOTH catalog release and a tested same-origin adapter.
      adapter: resolveAdapter(record, band.id),
    }))
    .filter((record) => record.thumbnailUrl.length > 0)
    .sort((a, b) => Number(Boolean(b.adapter)) - Number(Boolean(a.adapter)));
}

export function playableGamesForBand(catalog: PublicCatalog, bandId: number, resolveAdapter: AdapterResolver = installedResolver) {
  return gamesForBand(catalog, bandId, resolveAdapter).filter((game) => game.adapter !== undefined);
}

/** Template IDs /play, Next and Play All may launch for this band under the current catalog. */
export function playableTemplateIds(catalog: PublicCatalog, bandId: number): string[] {
  return playableGamesForBand(catalog, bandId).flatMap((game) => game.adapter ? [game.adapter.templateId] : []);
}
