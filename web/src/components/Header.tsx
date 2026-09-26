import { useAccount } from "../lib/account";
import { LANGS, useLang, type Lang } from "../lib/i18n";
import { Link, useRouter } from "../lib/router";

export function SideNav() {
  const { t, lang, langs, setLang } = useLang();
  const { path, navigate } = useRouter();
  const { user, loading, signOut } = useAccount();
  const items = [
    { to: "/", label: t("home"), on: path === "/" || path.startsWith("/discover") || path.startsWith("/a/") || path.startsWith("/p/") },
    { to: "/about", label: t("about"), on: path === "/about" },
    { to: "/how-it-works", label: t("howItWorks"), on: path === "/how-it-works" },
    ...(user ? [{ to: "/profile", label: t("profile"), on: path === "/profile" }] : []),
  ];
  const choices = user ? LANGS.filter((l) => langs.includes(l.id)) : LANGS;
  const shown = choices.length ? choices : LANGS.filter((l) => l.id === lang);
  return (
    <aside className="side-nav">
      <Link to="/" className="side-brand">
        <img src="/favicon.svg" alt="" width="28" height="28" />
        News Next Door
      </Link>
      <nav aria-label="Main">
        {items.map((item) => (
          <Link key={item.to} to={item.to} className={item.on ? "on" : undefined} aria-current={item.on ? "page" : undefined}>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="side-foot">
        {!loading && (
          <label className="side-lang">
            <span>{t("language")}</span>
            <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
              {shown.map((l) => (
                <option key={l.id} value={l.id} lang={l.html}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        )}
        {user && (
          <button
            className="side-signout"
            onClick={() => {
              void signOut().then(() => navigate("/"));
            }}
          >
            {t("signOut")}
          </button>
        )}
      </div>
    </aside>
  );
}

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="footer">
      <div className="container inner">
        <div>{t("footer")}</div>
      </div>
    </footer>
  );
}
