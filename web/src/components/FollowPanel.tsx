import { useEffect, useRef, useState } from "react";
import { useAccount } from "../lib/account";
import { api } from "../lib/api";
import { markFollowed } from "../lib/followed";
import { useLang } from "../lib/i18n";
import { Link } from "../lib/router";
import type { FollowResponse } from "../lib/types";
import { Icon, IMessageGlyph } from "./Icon";
import { useToast } from "./Toast";

function formatLine(addr: string | null): string | null {
  if (!addr) return null;
  const d = addr.replace(/[^\d]/g, "");
  if (/^1?\d{10}$/.test(d)) {
    const n = d.slice(-10);
    return `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}`;
  }
  return addr;
}

/**
 * Follow via iMessage: short expiring code → resident texts it → confirmed only after the backend processed it.
 * `requestFollow` swaps in another code source (live city applications); the default follows a proposal.
 */
export function FollowPanel({ proposalId, title, requestFollow }: { proposalId: string; title: string; requestFollow?: (lang: string) => Promise<FollowResponse> }) {
  const { t, lang } = useLang();
  const toast = useToast();
  const { user } = useAccount();
  const [f, setF] = useState<FollowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"waiting" | "confirmed" | "stopped" | "expired" | "unknown">("waiting");
  const [now, setNow] = useState(Date.now());
  const started = useRef(false);

  const start = () => {
    setError(null);
    setStatus("waiting");
    (requestFollow ? requestFollow(lang) : api.follow(proposalId, lang))
      .then(setF)
      .catch((e: Error) => setError(e.message));
  };
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (status === "confirmed" && f) markFollowed(proposalId, f.code);
  }, [status, proposalId, f]);

  useEffect(() => {
    if (!f || status !== "waiting") return;
    const iv = setInterval(async () => {
      setNow(Date.now());
      try {
        const s = await api.followStatus(f.code);
        setStatus(s.status);
      } catch {
        /* retry next tick */
      }
    }, 2000);
    return () => clearInterval(iv);
  }, [f, status]);

  const remaining = f ? Math.max(0, Date.parse(f.expires_at) - now) : 0;
  const line = formatLine(f?.line_address ?? null);
  const simulator = f?.mode === "simulator";

  if (status === "confirmed")
    return (
      <div className="follow-done">
        <div className="check">
          <Icon name="check" size={26} stroke={2.4} />
        </div>
        <h3>{t("confirmedTitle")}</h3>
        <p>“{title}”</p>
        <p>{t("confirmedText")}</p>
        {simulator && (
          <Link to={`/phone?code=${f?.code ?? ""}`} className="news-cta">
            <Icon name="phone" size={16} /> {t("openSimulator")}
          </Link>
        )}
      </div>
    );

  return (
    <div className="follow-card">
      <div className="follow-intro">
        <div className="imsg-icon">
          <IMessageGlyph />
        </div>
        <p>{t("followIntro")}</p>
      </div>
      {error && (
        <div className="banner red">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}
      {f ? (
        <>
          <div className="qr" dangerouslySetInnerHTML={{ __html: f.qr_svg }} aria-label={`QR code to text ${f.code}`} role="img" />
          <div className="code-box">
            <span aria-label="Follow code">{f.code}</span>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(f.code);
                toast(t("copied"));
              }}
              aria-label="Copy code"
            >
              <Icon name="copy" size={18} />
            </button>
          </div>
          {status === "expired" ? (
            <div className="banner red">
              <span>
                {t("codeExpired")}{" "}
                <button type="button" className="follow-link" onClick={start}>
                  {t("newCode")}
                </button>
              </span>
            </div>
          ) : (
            <>
              {simulator ? (
                <Link to={`/phone?code=${f.code}`} className="news-cta">
                  <Icon name="phone" size={16} /> {t("openSimulator")}
                </Link>
              ) : (
                <a href={f.link} className="news-cta">
                  <IMessageGlyph size={17} /> {t("openImessage")}
                </a>
              )}
              {!simulator && (
                <p className="follow-note">
                  {t("sendCodeTo")} <strong>{line ?? "our iMessage line"}</strong>
                </p>
              )}
              <div className="follow-state">
                <span className="dot" />
                <span>
                  {t("waitingForMessage")} · {t("codeExpires")} {Math.ceil(remaining / 60000)} min
                </span>
              </div>
            </>
          )}
          <p className="follow-note">{t("youllGetConfirm")}</p>
          {user && <p className="follow-note">{t("followLinked")}</p>}
        </>
      ) : (
        !error && <div className="skeleton" style={{ height: 230 }} />
      )}
    </div>
  );
}

export function FollowModal({
  proposalId,
  title,
  onClose,
  requestFollow,
}: {
  proposalId: string;
  title: string;
  onClose: () => void;
  requestFollow?: (lang: string) => Promise<FollowResponse>;
}) {
  const { t } = useLang();
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal auth-modal" role="dialog" aria-modal="true" aria-label={t("followThis")} onClick={(e) => e.stopPropagation()}>
        <div className="m-head">
          <h3>{t("followThis")}</h3>
          <button className="auth-close" onClick={onClose} aria-label={t("close")}>
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="signin-body">
          <FollowPanel proposalId={proposalId} title={title} requestFollow={requestFollow} />
        </div>
      </div>
    </div>
  );
}
