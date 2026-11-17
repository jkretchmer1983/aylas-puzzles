import { createFileRoute } from "@tanstack/react-router";

/** Storybook narration voice: one fixed model + voice so every speaker sounds the same on every device. */
const MODEL = "google/gemini-3.1-flash-tts-preview";
const VOICE = "Sulafat";
const STYLE = "Read aloud slowly, warmly and clearly, like a storybook narrator for a young child:";
export const TTS_MAX_CHARS = 700;

export const Route = createFileRoute("/api/tts")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let text = "";
        try { text = String(((await request.json()) as { text?: unknown }).text ?? "").replace(/\s+/g, " ").trim(); } catch { /* bad body */ }
        if (!text || text.length > TTS_MAX_CHARS) return new Response(JSON.stringify({ error: "Text missing or too long" }), { status: 400, headers: { "Content-Type": "application/json" } });
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) return new Response(JSON.stringify({ error: "Voice service not configured" }), { status: 500, headers: { "Content-Type": "application/json" } });
        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/audio/speech", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: MODEL,
            contents: [{ role: "user", parts: [{ text: `${STYLE} ${text}` }] }],
            generationConfig: { responseModalities: ["AUDIO"], speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: VOICE } } } },
            stream_format: "sse",
          }),
        });
        return new Response(upstream.body, {
          status: upstream.status,
          headers: { "Content-Type": upstream.headers.get("Content-Type") ?? "text/event-stream", "Cache-Control": "no-cache" },
        });
      },
    },
  },
});
