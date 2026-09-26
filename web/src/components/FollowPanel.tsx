import { useEffect, useRef, useState } from "react";
import { useAccount } from "../lib/account";
import { api } from "../lib/api";
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

/** Follow via iMessage: short expiring code → resident texts it → confirmed only after the backend processed it. */
export function FollowPanel({ proposalId, title }: { proposalId: string; title: string }) {
  const { t, lang } = useLang();
  const toast = useToast();
  const { user } = useAccount();
  const [f, setF] = useState<FollowResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<"waiting" | "confirmed" | "expired" | "unknown">("waiting");
  const [now, setNow] = useState(Date.now());
  const started = useRef(false);

  const start = () => {
    setError(null);
    setStatus("waiting");
    api
      .follow(proposalId, lang)
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
        <h3 style={{ margin: "0 0 6px" }}>{t("confirmedTitle")}</h3>
        <p className="small muted" style={{ margin: 0 }}>
          “{title}”
        </p>
        <p className="small muted">{t("confirmedText")}</p>
        {simulator && (
          <Link to={`/phone?code=${f?.code ?? ""}`} className="btn sm">
            <Icon name="phone" size={15} /> {t("openSimulator")}
          </Link>
        )}
      </div>
    );

  return (
    <div>
      <div className="follow-intro">
        <div className="imsg-icon">
          <IMessageGlyph />
        </div>
        <span>{t("followIntro")}</span>
      </div>
      {error && (
        <div className="banner red" style={{ marginTop: 14 }}>
          {error}
        </div>
      )}
      {f ? (
        <>
          <div className="qr" dangerouslySetInnerHTML={{ __html: f.qr_svg }} aria-label={`QR code to text ${f.code}`} role="img" />
          <div className="code-box">
            <span aria-label="Follow code">{f.code}</span>
            <button
              onClick={() => {
                navigator.clipboard?.writeText(f.code);
                toast(t("copied"));
              }}
              aria-label="Copy code"
            >
              <Icon name="copy" size={16} />
            </button>
          </div>
          {status === "expired" ? (
            <div className="banner amber" style={{ marginTop: 12 }}>
              {t("codeExpired")}{" "}
              <button className="link" style={{ border: 0, background: "none", padding: 0 }} onClick={start}>
                {t("newCode")}
              </button>
            </div>
          ) : (
            <>
              {simulator ? (
                <Link to={`/phone?code=${f.code}`} className="btn primary block" style={{ marginTop: 12 }}>
                  <Icon name="phone" size={16} /> {t("openSimulator")}
                </Link>
              ) : (
                <a href={f.link} className="btn primary block" style={{ marginTop: 12 }}>
                  <IMessageGlyph size={17} /> {t("openImessage")}
                </a>
              )}
              <p className="small muted" style={{ margin: "10px 0 0" }}>
                {simulator ? (
                  <>{lang === "zh" ? "iMessage 线路尚未配置：此演示使用模拟手机（SIMULATED）。" : "Photon iMessage isn't configured, so this demo uses a SIMULATED phone."}</>
                ) : (
                  <>
                    {t("sendCodeTo")} <strong>{line ?? "our iMessage line"}</strong>
                  </>
                )}
              </p>
              <div className="follow-state">
                <span className="dot" />
                <span className="muted">
                  {t("waitingForMessage")} · {t("codeExpires")} {Math.ceil(remaining / 60000)} min
                </span>
              </div>
            </>
          )}
          <p className="xs subtle" style={{ marginTop: 12 }}>
            {t("youllGetConfirm")}
          </p>
          {user && (
            <p className="xs subtle" style={{ marginTop: 6 }}>
              {t("followLinked")}
            </p>
          )}
        </>
      ) : (
        !error && <div className="skeleton" style={{ height: 230, marginTop: 16 }} />
      )}
    </div>
  );
}

export function FollowModal({ proposalId, title, onClose }: { proposalId: string; title: string; onClose: () => void }) {
  const { t } = useLang();
  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, [onClose]);
  return (
    <div className="modal-back" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={t("followThis")} onClick={(e) => e.stopPropagation()}>
        <div className="m-head">
          <h3 style={{ margin: 0, fontSize: 16 }}>{t("followThis")}</h3>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div style={{ padding: "14px 22px 22px" }}>
          <FollowPanel proposalId={proposalId} title={title} />
        </div>
      </div>
    </div>
  );
}
