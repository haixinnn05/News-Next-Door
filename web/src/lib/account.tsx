import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import { authClient } from "./auth";
import { parseLangs, useLang, type Lang } from "./i18n";

export interface Account {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

interface AccountCtx {
  user: Account | null;
  /** True until the first session check finishes. */
  loading: boolean;
  savedIds: Set<string>;
  setSaved: (proposalId: string, saved: boolean) => Promise<void>;
  zoneId: string | null;
  zoneReady: boolean;
  zoneOpen: boolean;
  openZone: () => void;
  closeZone: () => void;
  saveZone: (boardId: string) => Promise<void>;
  saveLangs: (langs: Lang[]) => Promise<void>;
  updateName: (name: string) => Promise<void>;
  signInOpen: boolean;
  signInMode: "signin" | "create";
  signInError: string | null;
  openSignIn: (error?: string | null, mode?: "signin" | "create") => void;
  closeSignIn: () => void;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AccountCtx | null>(null);

/** Better Auth redirects failed Google sign-ins back to the page with ?error=<code>. */
function takeOAuthError(): boolean {
  if (location.pathname.startsWith("/admin")) return false;
  const params = new URLSearchParams(location.search);
  if (!params.has("error")) return false;
  params.delete("error");
  params.delete("error_description");
  const rest = params.toString();
  history.replaceState(history.state, "", `${location.pathname}${rest ? `?${rest}` : ""}`);
  return true;
}

export const PENDING_ZONE = "btv-pending-zone";
export const PENDING_LANGS = "btv-pending-langs";

export function AccountProvider({ children }: { children: ReactNode }) {
  const { lang, setLangs } = useLang();
  const { data: session, isPending } = authClient.useSession();
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const user = useMemo<Account | null>(
    () => (session ? { id: session.user.id, name: nameOverride ?? session.user.name, email: session.user.email, image: session.user.image ?? null } : null),
    [session, nameOverride],
  );
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [zoneId, setZoneId] = useState<string | null>(null);
  const [zoneReady, setZoneReady] = useState(false);
  const [zoneOpen, setZoneOpen] = useState(false);
  const [signInOpen, setSignInOpen] = useState(false);
  const [signInMode, setSignInMode] = useState<"signin" | "create">("signin");
  const [signInError, setSignInError] = useState<string | null>(null);

  useEffect(() => {
    if (takeOAuthError()) {
      setSignInError("oauth");
      setSignInOpen(true);
    }
  }, []);

  useEffect(() => {
    if (!user) {
      setSavedIds(new Set());
      setNameOverride(null);
      return;
    }
    api
      .myProposals()
      .then((m) => setSavedIds(new Set([...m.saved.map((p) => p.id), ...m.applications.map((a) => a.id)])))
      .catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) {
      setZoneId(null);
      setZoneReady(false);
      setZoneOpen(false);
      return;
    }
    let cancel = false;
    (async () => {
      try {
        const pending = sessionStorage.getItem(PENDING_ZONE);
        if (pending) {
          const saved = await api.setZone(pending);
          sessionStorage.removeItem(PENDING_ZONE);
          if (!cancel) setZoneId(saved.board_id);
        } else {
          const zone = await api.zone();
          if (!cancel) setZoneId(zone.board_id);
        }
      } catch {
        if (!cancel) setZoneId(null);
      } finally {
        if (!cancel) setZoneReady(true);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    (async () => {
      try {
        const pending = sessionStorage.getItem(PENDING_LANGS);
        if (pending) {
          const saved = await api.setLangs(JSON.parse(pending));
          sessionStorage.removeItem(PENDING_LANGS);
          if (!cancel) setLangs(parseLangs(saved.langs, [lang]));
        } else {
          const stored = await api.langs();
          if (!cancel && stored.langs?.length) setLangs(parseLangs(stored.langs, [lang]));
        }
      } catch {
        /* keep local languages */
      }
    })();
    return () => {
      cancel = true;
    };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user && zoneReady && !zoneId) setZoneOpen(true);
  }, [user, zoneReady, zoneId]);

  const saveZone = useCallback(async (boardId: string) => {
    if (!user) {
      sessionStorage.setItem(PENDING_ZONE, boardId);
      return;
    }
    const saved = await api.setZone(boardId);
    setZoneId(saved.board_id);
    setZoneOpen(false);
  }, [user]);

  const saveLangs = useCallback(async (next: Lang[]) => {
    const clean = parseLangs(next, [lang]);
    if (!user) {
      sessionStorage.setItem(PENDING_LANGS, JSON.stringify(clean));
      setLangs(clean);
      return;
    }
    const saved = await api.setLangs(clean);
    setLangs(parseLangs(saved.langs, clean));
  }, [user, lang, setLangs]);

  const updateName = useCallback(async (name: string) => {
    const saved = await api.setProfile(name);
    setNameOverride(saved.name);
    await authClient.updateUser({ name: saved.name }).catch(() => {});
  }, []);

  const setSaved = useCallback(async (proposalId: string, saved: boolean) => {
    await api.setSaved(proposalId, saved);
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (saved) next.add(proposalId);
      else next.delete(proposalId);
      return next;
    });
  }, []);

  const value = useMemo<AccountCtx>(
    () => ({
      user,
      loading: isPending,
      savedIds,
      setSaved,
      zoneId,
      zoneReady,
      zoneOpen,
      openZone: () => setZoneOpen(true),
      closeZone: () => {
        if (zoneId) setZoneOpen(false);
      },
      saveZone,
      saveLangs,
      updateName,
      signInOpen,
      signInMode,
      signInError,
      openSignIn: (error = null, mode = "signin") => {
        setSignInError(error);
        setSignInMode(mode);
        setSignInOpen(true);
      },
      closeSignIn: () => {
        setSignInOpen(false);
        setSignInError(null);
      },
      signOut: async () => {
        await authClient.signOut();
      },
    }),
    [user, isPending, savedIds, setSaved, zoneId, zoneReady, zoneOpen, saveZone, saveLangs, updateName, signInOpen, signInMode, signInError],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount(): AccountCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAccount must be used inside AccountProvider");
  return ctx;
}
