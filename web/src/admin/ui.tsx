import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError } from "../lib/api";
import { Icon } from "../components/Icon";
import type { DraftStatus, MessageState, AudioStatus } from "./types";

// ---------------------------------------------------------------- context (auth + toast)
export interface AdminCtx {
  /** Called when any admin request returns 401: clears the token and shows the sign-in card. */
  unauthorized: () => void;
  toast: (msg: string) => void;
}
export const AdminContext = createContext<AdminCtx>({ unauthorized: () => {}, toast: () => {} });
export const useAdmin = () => useContext(AdminContext);

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

// ---------------------------------------------------------------- data hooks
export interface Loaded<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => Promise<void>;
  setData: (d: T) => void;
}

/** Fetch on mount (and when deps change); `reload()` refetches without clearing current data. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[] = []): Loaded<T> {
  const { unauthorized } = useAdmin();
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const my = ++seq.current;
    setLoading(true);
    try {
      const d = await fnRef.current();
      if (my !== seq.current) return;
      setData(d);
      setError(null);
    } catch (e) {
      if (my !== seq.current) return;
      if (e instanceof ApiError && e.status === 401) unauthorized();
      else setError(errMsg(e));
    } finally {
      if (my === seq.current) setLoading(false);
    }
  }, [unauthorized]);

  useEffect(() => {
    setData(undefined);
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload, setData };
}

/** Wrap a mutation: tracks a busy key, surfaces errors, handles 401. */
export function useAction() {
  const { unauthorized } = useAdmin();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useCallback(
    async <R,>(key: string, fn: () => Promise<R>): Promise<R | undefined> => {
      setBusy(key);
      setError(null);
      try {
        return await fn();
      } catch (e) {
        if (e instanceof ApiError && e.status === 401) unauthorized();
        else setError(errMsg(e));
        return undefined;
      } finally {
        setBusy(null);
      }
    },
    [unauthorized],
  );
  return { busy, error, setError, run };
}

export function useInterval(fn: () => void, ms: number | null) {
  const ref = useRef(fn);
  ref.current = fn;
  useEffect(() => {
    if (ms == null) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible") ref.current();
    }, ms);
    return () => clearInterval(t);
  }, [ms]);
}

// ---------------------------------------------------------------- UI bits
export function PageHead({ title, subtitle, right }: { title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <div className="adm-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {right && <div className="adm-head-right">{right}</div>}
    </div>
  );
}

export function ErrorBanner({ error, onRetry }: { error: string | null | undefined; onRetry?: () => void }) {
  if (!error) return null;
  return (
    <div className="banner red adm-mb">
      <Icon name="alert" size={16} />
      <div className="grow">{error}</div>
      {onRetry && (
        <button className="btn sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}

export function Spinner({ size = 14 }: { size?: number }) {
  return <span className="adm-spin" style={{ width: size, height: size }} aria-label="Loading" />;
}

export function SkeletonRows({ n = 3 }: { n?: number }) {
  return (
    <div className="adm-skel">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="skeleton" style={{ height: 44 }} />
      ))}
    </div>
  );
}

export function Empty({ icon = "inbox", title, children }: { icon?: "inbox" | "doc" | "users" | "audio" | "list" | "send"; title: string; children?: ReactNode }) {
  return (
    <div className="adm-empty">
      <Icon name={icon} size={22} />
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}

const DRAFT_PILL: Record<DraftStatus, [string, string]> = {
  needs_review: ["amber", "Needs Review"],
  published: ["green", "Published"],
  failed: ["red", "Failed"],
  discarded: ["grey", "Discarded"],
  extracting: ["blue", "Extracting"],
};
export function DraftPill({ status }: { status: DraftStatus }) {
  const [c, l] = DRAFT_PILL[status] ?? ["grey", status];
  return <span className={`pill ${c}`}>{l}</span>;
}

const MSG_PILL: Record<MessageState, [string, string]> = {
  scheduled: ["blue", "Scheduled"],
  draft: ["grey", "Draft"],
  sent: ["green", "Sent"],
  failed: ["red", "Failed"],
  cancelled: ["grey", "Cancelled"],
  uncertain: ["amber", "Uncertain"],
  sending: ["blue", "Sending"],
};
export function MessagePill({ state }: { state: MessageState }) {
  const [c, l] = MSG_PILL[state] ?? ["grey", state];
  return <span className={`pill ${c}`}>{l}</span>;
}

const AUDIO_PILL: Record<AudioStatus, [string, string]> = {
  draft: ["grey", "Draft"],
  pending: ["blue", "Generating"],
  ready: ["green", "Ready"],
  failed: ["red", "Failed"],
};
export function AudioPill({ status }: { status: AudioStatus }) {
  const [c, l] = AUDIO_PILL[status] ?? ["grey", status];
  return (
    <span className={`pill ${c}`}>
      {status === "pending" && <Spinner size={11} />}
      {l}
    </span>
  );
}

export function Modal({ title, onClose, children, width = 480 }: { title: string; onClose: () => void; children: ReactNode; width?: number }) {
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal adm-modal" style={{ width: `min(${width}px, 100%)` }} role="dialog" aria-modal="true" aria-label={title}>
        <div className="m-head">
          <h2 className="adm-modal-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="adm-modal-body">{children}</div>
      </div>
    </div>
  );
}

export const shortId = (id: string) => (id.length > 10 ? `${id.slice(0, 10)}…` : id);
export const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
