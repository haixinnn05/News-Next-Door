import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { adminRequest, adminToken, api, ApiError } from "../lib/api";
import { authClient } from "../lib/auth";
import { Link, match, useRouter } from "../lib/router";
import { AudioPage } from "./AudioPage";
import { ImportPage } from "./ImportPage";
import { Layout } from "./Layout";
import { Login } from "./Login";
import { MessagesPage } from "./MessagesPage";
import { ReviewListPage } from "./ReviewListPage";
import { ReviewPage } from "./ReviewPage";
import { SettingsPage } from "./SettingsPage";
import { SubscribersPage } from "./SubscribersPage";
import type { Me, TeamMember, TeamSignIn } from "./types";
import { AdminContext, Empty, PageHead } from "./ui";

/** Better Auth redirects back to /admin?error=<code> when Google sign-in fails. */
function takeSignInError(): string | null {
  const params = new URLSearchParams(location.search);
  const code = params.get("error");
  if (!code) return null;
  params.delete("error");
  params.delete("error_description");
  const rest = params.toString();
  history.replaceState(history.state, "", `${location.pathname}${rest ? `?${rest}` : ""}`);
  return code === "not_on_team" ? "That Google account isn't on the team list. Ask a teammate to add your email to ADMIN_EMAILS." : "Google sign-in didn't go through. Please try again.";
}

/** Team-only console. Rendered full-screen by the main App for any path under /admin. */
export function AdminApp() {
  const { path } = useRouter();
  const [mode, setMode] = useState<TeamSignIn | null>(null);
  const [status, setStatus] = useState<"checking" | "in" | "out">("checking");
  const [member, setMember] = useState<TeamMember | null>(null);
  const [signInError, setSignInError] = useState<string | null>(takeSignInError);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const checkSession = useCallback(async () => {
    try {
      const me = await adminRequest<Me>("/me");
      setMember(me.member);
      setStatus("in");
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) setSignInError(e.message);
      setStatus("out");
    }
  }, []);

  useEffect(() => {
    api
      .meta()
      .then((m) => setMode(m.team_sign_in))
      .catch(() => setMode("token"));
    void checkSession();
  }, [checkSession]);

  const unauthorized = useCallback(() => {
    adminToken.clear();
    setMember(null);
    setStatus("out");
  }, []);
  const signOut = useCallback(async () => {
    if (mode === "google") await authClient.signOut().catch(() => {});
    unauthorized();
  }, [mode, unauthorized]);
  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 3200);
  }, []);
  const ctx = useMemo(() => ({ unauthorized, toast }), [unauthorized, toast]);

  useEffect(() => {
    const prev = document.title;
    document.title = "Team console · Before the Vote";
    return () => {
      document.title = prev;
    };
  }, []);

  let page: ReactNode;
  let reviewId: Record<string, string> | null;
  const p = path.replace(/\/+$/, "") || "/admin";
  if (p === "/admin" || p === "/admin/import") page = <ImportPage />;
  else if (p === "/admin/review") page = <ReviewListPage />;
  else if ((reviewId = match("/admin/review/:id", p))) page = <ReviewPage key={reviewId.id} id={reviewId.id} />;
  else if (p === "/admin/audio") page = <AudioPage />;
  else if (p === "/admin/messages") page = <MessagesPage />;
  else if (p === "/admin/subscribers") page = <SubscribersPage />;
  else if (p === "/admin/settings") page = <SettingsPage />;
  else
    page = (
      <>
        <PageHead title="Page not found" />
        <Empty icon="doc" title="There's nothing at this address.">
          <Link to="/admin/import" className="link">
            Go to Import Documents
          </Link>
        </Empty>
      </>
    );

  let body: ReactNode = null;
  if (status === "in")
    body = (
      <Layout member={member} onSignOut={() => void signOut()}>
        {page}
      </Layout>
    );
  else if (status === "out" && mode)
    body = (
      <Login
        mode={mode}
        initialError={signInError}
        onSignedIn={() => {
          setSignInError(null);
          void checkSession();
        }}
      />
    );

  return (
    <AdminContext.Provider value={ctx}>
      {body}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </AdminContext.Provider>
  );
}

export default AdminApp;
