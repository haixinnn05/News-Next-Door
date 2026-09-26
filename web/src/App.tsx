import { lazy, Suspense } from "react";
import { Footer, Header } from "./components/Header";
import { ToastProvider } from "./components/Toast";
import { BoardProvider } from "./lib/board";
import { LangProvider } from "./lib/i18n";
import { MetaProvider } from "./lib/meta";
import { match, RouterProvider, useRouter } from "./lib/router";
import { Discover } from "./pages/Discover";
import { Home } from "./pages/Home";
import { About, HowItWorks } from "./pages/Info";
import { Phone } from "./pages/Phone";
import { ProposalPage } from "./pages/Proposal";

const AdminApp = lazy(() => import("./admin/AdminApp").then((m) => ({ default: m.AdminApp })));

function Routes() {
  const { path } = useRouter();
  if (path.startsWith("/admin"))
    return (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    );
  let page;
  const p = match("/p/:id/:tab?", path);
  if (path === "/") page = <Home />;
  else if (path === "/discover") page = <Discover />;
  else if (p) page = <ProposalPage key={p.id} id={p.id} tab={p.tab} />;
  else if (path === "/phone") page = <Phone />;
  else if (path === "/about") page = <About />;
  else if (path === "/how-it-works") page = <HowItWorks />;
  else
    page = (
      <div className="container page">
        <div className="state-box">
          <h3>Page not found</h3>
        </div>
      </div>
    );
  return (
    <>
      <Header />
      <main>{page}</main>
      <Footer />
    </>
  );
}

export function App() {
  return (
    <RouterProvider>
      <LangProvider>
        <BoardProvider>
        <MetaProvider>
          <ToastProvider>
            <Routes />
          </ToastProvider>
        </MetaProvider>
        </BoardProvider>
      </LangProvider>
    </RouterProvider>
  );
}
