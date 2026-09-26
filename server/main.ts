import { serve } from "@hono/node-server";
import { createAuth, migrateAuth } from "./auth.ts";
import { config } from "./config.ts";
import { openDb } from "./db.ts";
import { createApp } from "./http/app.ts";
import { seedIfEmpty } from "./seed/seed.ts";
import { checkAppUpdates, pollAppAudio } from "./services/appBriefings.ts";
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

await migrateAuth(db);
const auth = createAuth(db);

serve({ fetch: createApp(db, { photonEnabled, auth }).fetch, port: config.port });

console.log(`News Next Door API on http://localhost:${config.port}`);
console.log(`  grok       : ${config.grok.enabled ? `on (${config.grok.model})` : "OFF — imports create blank drafts for manual entry"}`);
console.log(`  elevenlabs : ${config.elevenlabs.enabled ? "on" : "OFF — audio generation disabled"}`);
console.log(`  photon     : ${photonEnabled ? `on (line ${config.photon.lineAddress || "address not set"})` : "OFF — using the SIMULATED phone at /phone"}`);
console.log(`  public url : ${config.publicBaseUrl}`);
console.log(`  sign-in    : email/password${config.auth.googleEnabled ? " + Google" : " (set GOOGLE_CLIENT_ID/SECRET to add Google)"}`);
console.log(`  team login : ${config.auth.googleEnabled ? `Google (${config.auth.adminEmails.length} allowed email${config.auth.adminEmails.length === 1 ? "" : "s"})` : "ADMIN_TOKEN (Google sign-in not configured)"}`);
if (config.auth.googleEnabled && config.auth.adminEmails.length === 0) console.warn("  ADMIN_EMAILS is empty, so nobody can sign in to the team console");
if (recovered) console.warn(`  ${recovered} notification(s) were mid-send at shutdown → marked 'uncertain' for manual reconciliation`);

// persistent worker: due notifications, dubbing jobs, and changes to followed city applications
let busy = false;
setInterval(async () => {
  if (busy) return;
  busy = true;
  try {
    await runDueNotifications(db);
    await pollDubs(db);
    await pollAppAudio(db);
    await checkAppUpdates(db);
  } catch (e) {
    console.error("[worker]", e);
  } finally {
    busy = false;
  }
}, config.workerIntervalMs);
