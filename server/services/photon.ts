import { Spectrum, type Message, type Space } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import { config } from "../config.ts";
import type { Db } from "../db.ts";
import { respondToInbound } from "./assistant.ts";
import { runDueNotifications } from "./notifications.ts";
import { handleInbound } from "./subscriptions.ts";
import { setPhotonTransport, type Transport } from "./transport.ts";

/**
 * Photon Spectrum (hosted iMessage). Receives follow codes / STOP, and sends confirmations,
 * reminders and updates. spectrum-ts is pinned to 12.10.1 in package.json.
 */
export type SpectrumApp = Awaited<ReturnType<typeof Spectrum>>;

export async function startPhoton(db: Db): Promise<SpectrumApp> {
  const app = await Spectrum({
    projectId: config.photon.projectId,
    projectSecret: config.photon.projectSecret,
    providers: [imessage.config()],
    options: { flattenGroups: true, logLevel: config.logLevel as never },
  });
  const spaces = new Map<string, Space>();
  const transport: Transport = {
    name: "photon",
    async send(to, text) {
      let space = to.space_id ? spaces.get(to.space_id) : undefined;
      if (!space && to.space_id) space = await imessage(app).space.get(to.space_id).catch(() => undefined);
      if (!space) space = await imessage(app).space.create([to.handle]);
      const sent = await space.send(text);
      return { providerMessageId: sent?.id ?? null };
    },
  };
  setPhotonTransport(transport);

  (async () => {
    console.log("[photon] listening for iMessage…");
    for await (const [space, message] of app.messages) {
      try {
        const ev = toText(space, message);
        if (!ev) continue;
        spaces.set(space.id, space);
        const r = handleInbound(db, { providerEventId: message.id, handle: ev.sender, spaceId: space.id, text: ev.text, transport: "photon" });
        console.log(`[photon] inbound ${message.id} → ${r.action}`);
        await runDueNotifications(db); // reply immediately rather than waiting for the next tick
        if (r.action === "question" || r.action === "list") {
          // answer in the background (a model call can take seconds) so other texts aren't held up
          void answerWithTyping(db, space, r, ev.text, message.id);
        }
      } catch (err) {
        console.error("[photon] handler error", err);
      }
    }
  })().catch((e) => console.error("[photon] stream ended", e));
  return app;
}

/** Show the typing bubble while the assistant works, then send its reply. */
async function answerWithTyping(db: Db, space: Space, r: { action: string; subscriberId?: string }, text: string, key: string): Promise<void> {
  const typing = space as unknown as { startTyping?: () => Promise<void>; stopTyping?: () => Promise<void> };
  await typing.startTyping?.().catch(() => {});
  try {
    await respondToInbound(db, r, text, key);
  } catch (err) {
    console.error("[photon] assistant error", err);
  } finally {
    await typing.stopTyping?.().catch(() => {});
  }
  await runDueNotifications(db);
}

function toText(space: Space, message: Message): { sender: string; text: string } | undefined {
  if (message.direction !== "inbound") return undefined;
  if ((space as unknown as { type?: string }).type === "group") return undefined; // DMs only
  const sender = message.sender?.id;
  if (!sender) return undefined;
  const c = message.content;
  if (c.type === "text") return { sender, text: c.text };
  if (c.type === "group") {
    const t = c.items.map((i) => (i.content.type === "text" ? i.content.text : "")).join(" ").trim();
    return t ? { sender, text: t } : undefined;
  }
  return undefined;
}
