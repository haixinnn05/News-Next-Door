import { useEffect, useState } from "react";
import { api } from "./api";

/**
 * Proposals and applications this browser confirmed a text follow for, keyed by id → the follow code,
 * so the Follow button stays "Following" and flips back once the server reports the follow stopped (STOP).
 */
const KEY = "btv-followed";
const EVENT = "btv-followed-change";

function read(): Record<string, string | null> {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown;
    // the first version stored a plain list of ids, without codes
    if (Array.isArray(raw)) return Object.fromEntries(raw.map((id: string) => [id, null]));
    return raw && typeof raw === "object" ? (raw as Record<string, string | null>) : {};
  } catch {
    return {};
  }
}

function write(ids: Record<string, string | null>) {
  localStorage.setItem(KEY, JSON.stringify(ids));
  dispatchEvent(new Event(EVENT));
}

export function markFollowed(id: string, code: string) {
  const ids = read();
  if (ids[id] === code) return;
  write({ ...ids, [id]: code });
}

function forget(id: string) {
  const { [id]: _, ...rest } = read();
  write(rest);
}

export function useFollowed(id: string): boolean {
  const [followed, setFollowed] = useState(() => id in read());
  useEffect(() => {
    const sync = () => setFollowed(id in read());
    // ask the server whether the follow is still active, e.g. after the resident texted STOP
    const check = async () => {
      const code = read()[id];
      if (!code) return;
      try {
        const { status } = await api.followStatus(code);
        if (status === "stopped" || status === "unknown") forget(id);
      } catch {
        /* offline: keep what we have */
      }
    };
    sync();
    void check();
    const onVisible = () => document.visibilityState === "visible" && void check();
    addEventListener(EVENT, sync);
    addEventListener("storage", sync);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      removeEventListener(EVENT, sync);
      removeEventListener("storage", sync);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [id]);
  return followed;
}
