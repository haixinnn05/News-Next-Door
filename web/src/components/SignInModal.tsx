import { useEffect, useState, type FormEvent } from "react";
import { LangChecks } from "./LangChecks";
import { PENDING_LANGS, PENDING_ZONE, useAccount } from "../lib/account";
import { authClient, residentGoogleSignIn } from "../lib/auth";
import { useBoard } from "../lib/board";
import { useLang, type Lang } from "../lib/i18n";
import { useMeta } from "../lib/meta";
import { zhBoardShort, zhBorough } from "../lib/zhCivic";
import { Icon } from "./Icon";

function GoogleGlyph() {
  return (
    <svg width="17" height="17" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

function ZoneSelect({ id, value, onChange }: { id: string; value: string; onChange: (id: string) => void }) {
  const { t, lang } = useLang();
  const { boards } = useBoard();
  return (
    <div className="field">
      <label htmlFor={id}>{t("chooseZone")}</label>
      <select id={id} className="input" required value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t("chooseZone")}</option>
        {["Queens", "Brooklyn", "Manhattan"].map((borough) => (
          <optgroup key={borough} label={zhBorough(borough, lang)}>
            {boards
              .filter((b) => b.borough === borough)
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {zhBoardShort(b, lang)}
                </option>
              ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}

function ZoneStep() {
  const { t } = useLang();
  const { zoneId, saveZone, closeZone, signOut } = useAccount();
  const [zone, setZone] = useState(zoneId ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canClose = !!zoneId;

  useEffect(() => {
    if (!canClose) return;
    const on = (e: KeyboardEvent) => e.key === "Escape" && closeZone();
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, [canClose, closeZone]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!zone) return;
    setBusy(true);
    setError(null);
    try {
      await saveZone(zone);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("signInFailed"));
      setBusy(false);
    }
  };

  return (
    <div className="modal-back" onClick={() => canClose && closeZone()}>
      <div className="modal auth-modal" role="dialog" aria-modal="true" aria-label={t("chooseZone")} onClick={(e) => e.stopPropagation()}>
        <div className="m-head">
          <h3>{t("chooseZone")}</h3>
          {canClose && (
            <button className="auth-close" onClick={closeZone} aria-label="Close">
              <Icon name="x" size={20} />
            </button>
          )}
        </div>
        <div className="signin-body">
          <p>{t("chooseZoneWhy")}</p>
          {error && (
            <div className="banner red">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}
          <form className="signin-form" onSubmit={submit}>
            <ZoneSelect id="si-zone-pick" value={zone} onChange={setZone} />
            <button className="news-cta block" disabled={busy || !zone}>
              {t("chooseZone")}
            </button>
          </form>
          {!canClose && (
            <p className="signin-switch">
              <button type="button" onClick={() => void signOut()}>
                {t("signOut")}
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export function SignInModal() {
  const { t, lang } = useLang();
  const meta = useMeta();
  const { signInError, closeSignIn, saveZone, saveLangs, zoneOpen, user, signInOpen, signInMode } = useAccount();
  const [mode, setMode] = useState<"signin" | "create">(signInMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [zone, setZone] = useState("");
  const [picked, setPicked] = useState<Lang[]>([lang]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(signInError === "oauth" ? t("signInFailed") : signInError);

  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && closeSignIn();
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, [closeSignIn]);

  if (zoneOpen && user && !signInOpen) return <ZoneStep />;

  const google = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await residentGoogleSignIn();
    if (err) {
      setError(err.message ?? t("signInFailed"));
      setBusy(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    if (mode === "create") {
      if (!zone) {
        setError(t("chooseZone"));
        setBusy(false);
        return;
      }
      await saveZone(zone);
      await saveLangs(picked);
    }
    const { error: err } =
      mode === "create"
        ? await authClient.signUp.email({ name: name.trim() || email.split("@")[0], email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      sessionStorage.removeItem(PENDING_ZONE);
      sessionStorage.removeItem(PENDING_LANGS);
      setError(err.message ?? t("signInFailed"));
      return;
    }
    closeSignIn();
  };

  const creating = mode === "create";
  return (
    <div className="modal-back" onClick={closeSignIn}>
      <div className="modal auth-modal" role="dialog" aria-modal="true" aria-label={creating ? t("createTitle") : t("signInTitle")} onClick={(e) => e.stopPropagation()}>
        <div className="m-head">
          <h3>{creating ? t("createTitle") : t("signIn")}</h3>
          <button className="auth-close" onClick={closeSignIn} aria-label="Close">
            <Icon name="x" size={20} />
          </button>
        </div>
        <div className="signin-body">
          <p>{creating ? t("signInWhy") : t("signInForNews")}</p>
          {error && (
            <div className="banner red">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}
          {meta?.account_sign_in.google && (
            <>
              <button type="button" className="auth-google" disabled={busy} onClick={() => void google()}>
                <GoogleGlyph /> {t("continueGoogle")}
              </button>
              <div className="signin-or">
                <span>{t("orEmail")}</span>
              </div>
            </>
          )}
          <form className="signin-form" onSubmit={submit}>
            {creating && (
              <div className="field">
                <label htmlFor="si-name">{t("name")}</label>
                <input id="si-name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
            )}
            <div className="field">
              <label htmlFor="si-email">{t("email")}</label>
              <input id="si-email" className="input" type="email" required autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="si-password">{t("password")}</label>
              <input
                id="si-password"
                className="input"
                type="password"
                required
                minLength={8}
                autoComplete={creating ? "new-password" : "current-password"}
                placeholder={creating ? t("passwordHint") : undefined}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {creating && <ZoneSelect id="si-zone" value={zone} onChange={setZone} />}
            {creating && (
              <div className="field">
                <span className="label">{t("yourLanguages")}</span>
                <LangChecks value={picked} onChange={setPicked} />
              </div>
            )}
            <button className="news-cta block" disabled={busy}>
              {creating ? t("createAccount") : t("signIn")}
            </button>
          </form>
          <p className="signin-switch">
            {creating ? t("haveAccount") : t("noAccount")}{" "}
            <button
              type="button"
              onClick={() => {
                setMode(creating ? "signin" : "create");
                setError(null);
              }}
            >
              {creating ? t("signIn") : t("createAccount")}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
