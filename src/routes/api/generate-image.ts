import { createFileRoute } from "@tanstack/react-router";
import { generateImage } from "@/lib/image-gateway.server";

export const Route = createFileRoute("/api/generate-image")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as { prompt?: string; stream?: boolean };
        const prompt = String(body.prompt ?? "").slice(0, 1500);
        if (!prompt) return new Response("Missing prompt", { status: 400 });
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        const upstream = await generateImage(apiKey, prompt, body.stream !== false);
        return new Response(upstream.body, {
          status: upstream.status,
          headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "application/json", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
