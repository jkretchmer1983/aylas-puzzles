import { createServerFn } from "@tanstack/react-start";

export type StoryResult = { ok: true; title: string; story: string; imagePrompt: string } | { ok: false; error: string };

const schema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "story", "imagePrompt"],
  properties: {
    title: { type: "string" },
    story: { type: "string" },
    imagePrompt: { type: "string" },
  },
};

export const writeStory = createServerFn({ method: "POST" })
  .inputValidator((d: { age: number; theme: string; title: string; story: string; task: string }) => ({
    age: Math.max(3, Math.min(10, Number(d.age) || 6)),
    theme: String(d.theme).slice(0, 300),
    title: String(d.title).slice(0, 100),
    story: String(d.story).slice(0, 800),
    task: String(d.task).slice(0, 300),
  }))
  .handler(async ({ data }): Promise<StoryResult> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { ok: false, error: "AI is not set up" };
    const style = data.age <= 5 ? "soft crayon picture-book, chubby cute characters, pastel colors" : data.age <= 7 ? "bright cheerful cartoon, bold outlines, playful" : "vibrant modern adventure illustration, cinematic lighting, cool stylized characters";
    const instructions = `You write short, exciting puzzle stories for a child aged ${data.age}. Rewrite the given puzzle intro as a fresh, vivid story (${data.age <= 5 ? "1-2 very simple sentences" : "2-3 sentences"}). Keep every fact, name, clue and number from the original intro exactly — never add new numbers, never hint at or state the answer, and never contradict the question. Give a fun new title (max 5 words). Write imagePrompt: a scene description for an illustration in this style: ${style}. The image must contain no text, letters or numbers, and must not show the answer.`;
    const input = `Theme: ${data.theme}\nOriginal title: ${data.title}\nOriginal intro: ${data.story}\nQuestion (unchanged, shown separately): ${data.task}`;
    try {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
        body: JSON.stringify({
          model: "openai/gpt-6-astra",
          instructions,
          input,
          stream: true,
          store: false,
          reasoning: { effort: "low", summary: "auto" },
          include: ["reasoning.encrypted_content"],
          text: { format: { type: "json_schema", name: "story", strict: true, schema } },
        }),
      });
      if (!res.ok || !res.body) {
        console.error("story error", res.status, await res.text().catch(() => ""));
        return { ok: false, error: res.status === 402 ? "Out of AI credits" : `AI unavailable (${res.status})` };
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "", text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += value;
        let i: number;
        while ((i = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, i).trim();
          buf = buf.slice(i + 1);
          if (!line.startsWith("data:")) continue;
          try {
            const ev = JSON.parse(line.slice(5)) as { type?: string; delta?: string };
            if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
            if (ev.type === "response.failed" || ev.type === "error") return { ok: false, error: "AI story failed" };
          } catch { /* partial or non-JSON line */ }
        }
      }
      const out = JSON.parse(text) as { title: string; story: string; imagePrompt: string };
      return { ok: true, ...out };
    } catch (e) {
      console.error("story exception", e);
      return { ok: false, error: "AI story failed" };
    }
  });
