import { useState, type FormEvent } from "react";
import { adminRequest, adminToken, ApiError } from "../lib/api";
import { signInWithGoogle } from "../lib/auth";
import { BrandMark, Icon } from "../components/Icon";
import { Link } from "../lib/router";
import type { TeamSignIn } from "./types";

export function Login({ mode, initialError, onSignedIn }: { mode: TeamSignIn; initialError: string | null; onSignedIn: () => void }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setBusy(true);
    setError(null);
    adminToken.set(token.trim());
    try {
      await adminRequest("/overview");
      onSignedIn();
    } catch (err) {
      adminToken.clear();
      setError(err instanceof ApiError && err.status === 401 ? "That token wasn't accepted. Check ADMIN_TOKEN in .env." : (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setBusy(true);
    setError(null);
    const { error: err } = await signInWithGoogle();
    if (err) {
      setError(err.message ?? "Couldn't start Google sign-in.");
      setBusy(false);
    }
  };

  const errorBanner = error && (
    <div className="banner red">
      <Icon name="alert" size={16} />
      <div>{error}</div>
    </div>
  );

  return (
    <div className="adm-login">
      <div className="adm-login-card">
        <div className="adm-login-brand">
          <BrandMark size={34} />
          <div>
            <div className="adm-login-name">Before the Vote</div>
            <div className="subtle xs">Team console</div>
          </div>
        </div>
        <h1>Team sign-in</h1>
        {mode === "google" ? (
          <>
            <p className="muted small">This area is for the Before the Vote team. Sign in with the Google account on the team list.</p>
            {errorBanner}
            <button type="button" className="btn primary block" disabled={busy} onClick={() => void google()}>
              {busy ? "Opening Google…" : "Sign in with Google"}
            </button>
            <p className="subtle xs adm-login-note">
              <Icon name="shield" size={13} />
              <span>
                Only emails listed in <code>ADMIN_EMAILS</code> can sign in.
              </span>
            </p>
          </>
        ) : (
          <form onSubmit={submit}>
            <p className="muted small">This area is for the Before the Vote team. Enter the admin token to continue.</p>
            <div className="field">
              <label htmlFor="adm-token">Admin token</label>
              <input id="adm-token" className="input" type="password" autoFocus autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="••••••••••••" />
            </div>
            {errorBanner}
            <button className="btn primary block" disabled={busy || !token.trim()}>
              {busy ? "Signing in…" : "Sign in"}
            </button>
            <p className="subtle xs adm-login-note">
              <Icon name="shield" size={13} />
              <span>
                Set <code>ADMIN_TOKEN</code> in <code>.env</code>. The local development default is <code>before-the-vote-team</code>.
              </span>
            </p>
          </form>
        )}
        <Link to="/" className="link small">
          ← Back to the public site
        </Link>
      </div>
    </div>
  );
}
