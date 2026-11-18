// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Immutable per-build release ID, reported by /api/release so the release service can register exactly
// the version a game host is serving.
const BUILD_ID = `${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 8)}`;

export default defineConfig({
  vite: { define: { __AYLA_BUILD_ID__: JSON.stringify(BUILD_ID) } },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
