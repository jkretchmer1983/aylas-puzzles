import { defineTool } from "@lovable.dev/mcp-js";
import { allTypes } from "../puzzles";

export default defineTool({
  name: "list_puzzle_types",
  title: "List puzzle types",
  description: "List every puzzle type with the ages it suits.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: () => {
    const types = allTypes();
    return { content: [{ type: "text", text: types.map((t) => `${t.id}: ${t.name} (ages ${t.minAge}-${t.maxAge})`).join("\n") }], structuredContent: { types } };
  },
});
