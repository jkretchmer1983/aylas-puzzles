import { createFileRoute } from "@tanstack/react-router";
import { HOST_CONFIG, HOST_GAME, HOST_ROLE } from "@/host/config";
import { HOST_PROTOCOL, HOST_PROTOCOL_VERSION } from "@/host/protocol";

/**
 * Public, read-only description of what this deployment serves. The release service reads it when the
 * owner registers or updates a game host; the registry's releaseId should equal `buildId`.
 * Contains no secrets and no private URLs.
 */
export const Route = createFileRoute("/api/release")({
  server: {
    handlers: {
      GET: async () => Response.json({
        protocol: HOST_PROTOCOL,
        protocolVersion: HOST_PROTOCOL_VERSION,
        role: HOST_ROLE,
        catalogId: HOST_GAME?.catalogId ?? null,
        gameId: HOST_GAME?.gameId ?? null,
        path: HOST_GAME?.path ?? null,
        minBand: HOST_GAME?.minBand ?? null,
        maxBand: HOST_GAME?.maxBand ?? null,
        sourceVersion: HOST_CONFIG.sourceVersion ?? null,
        buildId: typeof __AYLA_BUILD_ID__ === "string" ? __AYLA_BUILD_ID__ : "dev",
        releaseId: typeof __AYLA_BUILD_ID__ === "string" ? __AYLA_BUILD_ID__ : "dev",
      }, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
          "X-Content-Type-Options": "nosniff",
        },
      }),
    },
  },
});
