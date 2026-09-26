/**
 * Hour-one check: prove a real iMessage send/receive loop on one consenting phone.
 * Text anything to the Photon line; this script prints it and replies once.  `npm run smoke:photon`
 */
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { config } from "../config.ts";

if (!config.photon.enabled) {
  console.error("Set SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET in .env first.");
  process.exit(2);
}
const app = await Spectrum({ projectId: config.photon.projectId, projectSecret: config.photon.projectSecret, providers: [imessage.config()] });
console.log(`Connected. Text the Photon line${config.photon.lineAddress ? ` (${config.photon.lineAddress})` : ""} from a teammate's phone…`);
for await (const [space, message] of app.messages) {
  if (message.direction !== "inbound") continue;
  const text = message.content.type === "text" ? message.content.text : `<${message.content.type}>`;
  console.log(`inbound from ${message.sender?.id} in ${space.id}: ${text}`);
  const sent = await space.send("Before the Vote: Photon loop OK ✅ (test message)");
  console.log("reply sent, provider id:", sent?.id);
}
