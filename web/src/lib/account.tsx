import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "./api";
import { authClient } from "./auth";

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
  signInOpen: boolean;
  signInError: string | null;
  openSignIn: (error?: string | null) => void;
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

export function AccountProvider({ children }: { children: ReactNode }) {
  const { data: session, isPending } = authClient.useSession();
  const user = useMemo<Account | null>(
    () => (session ? { id: session.user.id, name: session.user.name, email: session.user.email, image: session.user.image ?? null } : null),
    [session],
  );
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [signInOpen, setSignInOpen] = useState(false);
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
      return;
    }
    api
      .myProposals()
      .then((m) => setSavedIds(new Set(m.saved.map((p) => p.id))))
      .catch(() => {});
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

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
      signInOpen,
      signInError,
      openSignIn: (error = null) => {
        setSignInError(error);
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
    [user, isPending, savedIds, setSaved, signInOpen, signInError],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccount(): AccountCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAccount must be used inside AccountProvider");
  return ctx;
}
