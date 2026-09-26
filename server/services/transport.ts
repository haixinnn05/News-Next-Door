import { config } from "../config.ts";
import { run, type Db } from "../db.ts";
import { nowIso } from "../lib/util.ts";

export interface Recipient {
  handle: string;
  space_id: string | null;
  transport: string; // photon | simulator
}

export interface Transport {
  name: "photon" | "simulator";
  send(to: Recipient, text: string): Promise<{ providerMessageId: string | null }>;
  /** A tappable poll (iMessage via Photon). Transports without polls leave this out and get the text fallback. */
  sendPoll?(to: Recipient, title: string, options: string[]): Promise<{ providerMessageId: string | null }>;
}

/** Simulated phone: outbound messages are stored and shown on /phone. Clearly labelled SIMULATED. */
export function simulatorTransport(db: Db): Transport {
  return {
    name: "simulator",
    async send(to, text) {
      const r = run(db, "INSERT INTO sim_messages (handle, direction, text, at) VALUES (?,?,?,?)", to.handle, "to_phone", text, nowIso());
      return { providerMessageId: `sim-${r.lastInsertRowid}` };
    },
  };
}

let photon: Transport | undefined;
export function setPhotonTransport(t: Transport) {
  photon = t;
}

export function transportFor(db: Db, to: Recipient): Transport {
  if (to.transport === "photon") {
    if (!photon) throw new Error(config.photon.enabled ? "Photon is still connecting" : "Photon is not configured");
    return photon;
  }
  return simulatorTransport(db);
}
