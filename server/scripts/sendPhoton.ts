/**
 * Hour-one check: can our Photon line send the first message? The sender shown on the phone is the
 * line address to put in PHOTON_LINE_ADDRESS. Only text a teammate who agreed to it.
 * `npm run smoke:photon-send -- +19295550123`
 */
import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { config } from "../config.ts";

const to = process.argv[2];
if (!config.photon.enabled) {
  console.error("Set SPECTRUM_PROJECT_ID and SPECTRUM_PROJECT_SECRET in .env first.");
  process.exit(2);
}
if (!to || !/^(\+\d{10,15}|[^@\s]+@[^@\s]+)$/.test(to)) {
  console.error("Usage: npm run smoke:photon-send -- +19295550123   (E.164 phone or iMessage email)");
  process.exit(2);
}
const app = await Spectrum({ projectId: config.photon.projectId, projectSecret: config.photon.projectSecret, providers: [imessage.config()] });
try {
  const space = await imessage(app).space.create([to]);
  const sent = await space.send("Before the Vote: Photon outbound test (you can ignore this).");
  console.log(`sent to ${to} in space ${space.id}, provider id: ${sent?.id ?? "(none)"}`);
} catch (e) {
  console.error("send failed:", (e as Error).message);
  process.exitCode = 1;
} finally {
  await app.stop().catch(() => {});
}
