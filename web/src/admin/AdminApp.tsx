import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { adminToken } from "../lib/api";
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
import { AdminContext, Empty, PageHead } from "./ui";

/** Team-only console. Rendered full-screen by the main App for any path under /admin. */
export function AdminApp() {
  const { path } = useRouter();
  const [authed, setAuthed] = useState(() => !!adminToken.get());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const unauthorized = useCallback(() => {
    adminToken.clear();
    setAuthed(false);
  }, []);
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

  return (
    <AdminContext.Provider value={ctx}>
      {authed ? <Layout onSignOut={unauthorized}>{page}</Layout> : <Login onSignedIn={() => setAuthed(true)} />}
      {toastMsg && (
        <div className="toast" role="status">
          {toastMsg}
        </div>
      )}
    </AdminContext.Provider>
  );
}

export default AdminApp;
