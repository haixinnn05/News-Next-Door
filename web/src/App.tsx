import { lazy, Suspense } from "react";
import { Footer, SideNav } from "./components/Header";
import { SignInModal } from "./components/SignInModal";
import { ToastProvider } from "./components/Toast";
import { AccountProvider, useAccount } from "./lib/account";
import { BoardProvider } from "./lib/board";
import { LangProvider } from "./lib/i18n";
import { MetaProvider } from "./lib/meta";
import { match, RouterProvider, useRouter } from "./lib/router";
import { ApplicationPage } from "./pages/Application";
import { CityStoryPage } from "./pages/CityStory";
import { Discover } from "./pages/Discover";
import { HowItWorks } from "./pages/Info";
import { MyProposals } from "./pages/MyProposals";
import { Phone } from "./pages/Phone";
import { Profile } from "./pages/Profile";
import { ProposalPage } from "./pages/Proposal";

const AdminApp = lazy(() => import("./admin/AdminApp").then((m) => ({ default: m.AdminApp })));

function Routes() {
  const { path } = useRouter();
  const { signInOpen, zoneOpen } = useAccount();
  if (path.startsWith("/admin"))
    return (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    );
  let page;
  const p = match("/p/:id/:tab?", path);
  const application = match("/a/:id", path);
  const cityStory = match("/c/:id", path);
  if (path === "/" || path === "/discover") page = <Discover />;
  else if (application) page = <ApplicationPage key={application.id} id={application.id} />;
  else if (cityStory) page = <CityStoryPage key={cityStory.id} id={cityStory.id} />;
  else if (p) page = <ProposalPage key={p.id} id={p.id} tab={p.tab} />;
  else if (path === "/phone") page = <Phone />;
  else if (path === "/how-it-works") page = <HowItWorks />;
  else if (path === "/me") page = <MyProposals />;
  else if (path === "/profile") page = <Profile />;
  else
    page = (
      <div className="container page">
        <div className="state-box">
          <h3>Page not found</h3>
        </div>
      </div>
    );
  return (
    <div className="public app-shell">
      <SideNav />
      <div className="app-main">
        <main>{page}</main>
        <Footer />
      </div>
      {(signInOpen || zoneOpen) && <SignInModal />}
    </div>
  );
}

export function App() {
  return (
    <RouterProvider>
      <LangProvider>
        <BoardProvider>
          <MetaProvider>
            <ToastProvider>
              <AccountProvider>
                <Routes />
              </AccountProvider>
            </ToastProvider>
          </MetaProvider>
        </BoardProvider>
      </LangProvider>
    </RouterProvider>
  );
}
