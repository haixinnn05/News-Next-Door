import { useEffect, useState } from "react";

/** Proposals and applications this browser confirmed a text follow for, so the Follow button stays "Following". */
const KEY = "btv-followed";
const EVENT = "btv-followed-change";

function read(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[]);
  } catch {
    return new Set();
  }
}

export function markFollowed(id: string) {
  const ids = read();
  if (ids.has(id)) return;
  ids.add(id);
  localStorage.setItem(KEY, JSON.stringify([...ids]));
  dispatchEvent(new Event(EVENT));
}

export function useFollowed(id: string): boolean {
  const [followed, setFollowed] = useState(() => read().has(id));
  useEffect(() => {
    const sync = () => setFollowed(read().has(id));
    sync();
    addEventListener(EVENT, sync);
    addEventListener("storage", sync);
    return () => {
      removeEventListener(EVENT, sync);
      removeEventListener("storage", sync);
    };
  }, [id]);
  return followed;
}
