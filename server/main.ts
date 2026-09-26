import { serve } from "@hono/node-server";
import { config } from "./config.ts";
import { openDb } from "./db.ts";
import { createApp } from "./http/app.ts";
import { seedIfEmpty } from "./seed/seed.ts";
import { pollDubs } from "./services/audio.ts";
import { recoverInFlight, runDueNotifications } from "./services/notifications.ts";

const db = openDb();
await seedIfEmpty(db);

const recovered = recoverInFlight(db);
let photonEnabled = false;
if (config.photon.enabled) {
  try {
    const { startPhoton } = await import("./services/photon.ts");
    const app = await startPhoton(db);
    photonEnabled = true;
    const stop = async () => {
      await app.stop().catch(() => {});
      process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
  } catch (e) {
    console.error("[photon] failed to start — falling back to the simulated phone:", (e as Error).message);
  }
}

serve({ fetch: createApp(db, { photonEnabled }).fetch, port: config.port });

console.log(`News Next Door API on http://localhost:${config.port}`);
console.log(`  grok       : ${config.grok.enabled ? `on (${config.grok.model})` : "OFF — imports create blank drafts for manual entry"}`);
console.log(`  elevenlabs : ${config.elevenlabs.enabled ? "on" : "OFF — audio generation disabled"}`);
console.log(`  photon     : ${photonEnabled ? `on (line ${config.photon.lineAddress || "address not set"})` : "OFF — using the SIMULATED phone at /phone"}`);
console.log(`  public url : ${config.publicBaseUrl}`);
if (recovered) console.warn(`  ${recovered} notification(s) were mid-send at shutdown → marked 'uncertain' for manual reconciliation`);

// persistent worker: due notifications + dubbing jobs
let busy = false;
setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    await runDueNotifications(db);
    await pollDubs(db);
  } catch (e) {
    console.error("[worker]", e);
  } finally {
    busy = false;
  }
}, config.workerIntervalMs);
