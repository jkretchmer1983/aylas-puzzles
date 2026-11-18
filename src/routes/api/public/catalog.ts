import { createFileRoute } from "@tanstack/react-router";
import { CATALOG_SNAPSHOT, parsePublicCatalog, type PublicCatalog } from "@/lib/public-catalog";

let lastKnownSafe: PublicCatalog = CATALOG_SNAPSHOT;

export const Route = createFileRoute("/api/public/catalog")({
  server: {
    handlers: {
      GET: async () => {
        const feedUrl = process.env["PUBLIC_CATALOG_FEED_URL"];
        if (feedUrl) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 4000);
          try {
            const url = new URL(feedUrl);
            if (url.protocol !== "https:") throw new Error("The public catalog feed must use HTTPS");
            const response = await fetch(url, {
              signal: controller.signal,
              headers: { Accept: "application/json" },
              cache: "no-store",
            });
            if (!response.ok) throw new Error("Catalog feed unavailable");
            lastKnownSafe = parsePublicCatalog(await response.json());
            return Response.json(lastKnownSafe, {
              headers: {
                "Cache-Control": "public, max-age=60, stale-if-error=86400",
                "X-Catalog-Source": "public-feed",
              },
            });
          } catch {
            // A private dashboard response, malformed feed or network failure never reaches children.
          } finally {
            clearTimeout(timeout);
          }
        }
        return Response.json(lastKnownSafe, {
          headers: {
            "Cache-Control": "public, max-age=60, stale-if-error=86400",
            "X-Catalog-Source": "safe-snapshot",
          },
        });
      },
    },
  },
});
