import { useLang } from "../lib/i18n";
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
      <div className="side-lang" role="group" aria-label={t("language")}>
        <button className={lang === "en" ? "on" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")}>
          English
        </button>
        <button className={lang === "zh" ? "on" : ""} aria-pressed={lang === "zh"} onClick={() => setLang("zh")} lang="zh-Hans">
          中文
        </button>
      </div>
    </aside>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container inner">
        <div>News Next Door. News from Queens. Check the city website on each story.</div>
      </div>
    </footer>
  );
}
