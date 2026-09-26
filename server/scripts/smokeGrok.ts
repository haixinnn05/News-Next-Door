/** Hour-one check: can our key reach Grok with a JSON-schema response? `npm run smoke:grok` */
import { config } from "../config.ts";
import { grokJson } from "../services/grok.ts";

if (!config.grok.enabled) {
  console.error("Set XAI_API_KEY in .env first.");
  process.exit(2);
}
const { data, model } = await grokJson<{ ok: boolean; echo: string }>({
  system: "Reply with the requested JSON only.",
  user: 'Return ok=true and echo="Before the Vote".',
  schemaName: "smoke",
  schema: { type: "object", additionalProperties: false, properties: { ok: { type: "boolean" }, echo: { type: "string" } }, required: ["ok", "echo"] },
});
console.log(`Grok OK (${model}):`, data);
