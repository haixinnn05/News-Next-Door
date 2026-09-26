import { LANGS, useLang, type Lang } from "../lib/i18n";
import { Link, useRouter } from "../lib/router";

export function SideNav() {
  const { t, lang, setLang } = useLang();
  const { path } = useRouter();
  const home = path === "/" || path.startsWith("/discover") || path.startsWith("/a/") || path.startsWith("/p/");
  return (
    <aside className="side-nav">
      <Link to="/" className="side-brand">
        <img src="/favicon.svg" alt="" width="28" height="28" />
        News Next Door
      </Link>
      <nav aria-label="Main">
        <Link to="/" className={home ? "on" : undefined} aria-current={home ? "page" : undefined}>
          {t("home")}
        </Link>
      </nav>
      <label className="side-lang">
        <span>{t("language")}</span>
        <select value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
          {LANGS.map((l) => (
            <option key={l.id} value={l.id} lang={l.html}>
              {l.label}
            </option>
          ))}
        </select>
      </label>
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
