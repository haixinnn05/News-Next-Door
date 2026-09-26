import { useEffect, useState, type FormEvent } from "react";
import { useAccount } from "../lib/account";
import { authClient, residentGoogleSignIn } from "../lib/auth";
import { useLang } from "../lib/i18n";
import { useMeta } from "../lib/meta";
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

export function SignInModal() {
  const { t } = useLang();
  const meta = useMeta();
  const { signInError, closeSignIn } = useAccount();
  const [mode, setMode] = useState<"signin" | "create">("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(signInError === "oauth" ? t("signInFailed") : signInError);

  useEffect(() => {
    const on = (e: KeyboardEvent) => e.key === "Escape" && closeSignIn();
    addEventListener("keydown", on);
    return () => removeEventListener("keydown", on);
  }, [closeSignIn]);

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
    const { error: err } =
      mode === "create"
        ? await authClient.signUp.email({ name: name.trim() || email.split("@")[0], email: email.trim(), password })
        : await authClient.signIn.email({ email: email.trim(), password });
    setBusy(false);
    if (err) {
      setError(err.message ?? t("signInFailed"));
      return;
    }
    closeSignIn();
  };

  const creating = mode === "create";
  return (
    <div className="modal-back" onClick={closeSignIn}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={creating ? t("createTitle") : t("signInTitle")} onClick={(e) => e.stopPropagation()}>
        <div className="m-head">
          <h3 style={{ margin: 0, fontSize: 16 }}>{creating ? t("createTitle") : t("signInTitle")}</h3>
          <button className="btn ghost sm" onClick={closeSignIn} aria-label="Close">
            <Icon name="x" size={16} />
          </button>
        </div>
        <div className="signin-body">
          <p className="small muted">{t("signInWhy")}</p>
          {error && (
            <div className="banner red">
              <Icon name="alert" size={16} />
              <span>{error}</span>
            </div>
          )}
          {meta?.account_sign_in.google && (
            <>
              <button type="button" className="btn block" disabled={busy} onClick={() => void google()}>
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
            <button className="btn primary block" disabled={busy}>
              {creating ? t("createAccount") : t("signIn")}
            </button>
          </form>
          <p className="small muted signin-switch">
            {creating ? t("haveAccount") : t("noAccount")}{" "}
            <button
              type="button"
              className="link"
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
