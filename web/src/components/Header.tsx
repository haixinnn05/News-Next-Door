import { useEffect, useRef, useState } from "react";
import { useAccount } from "../lib/account";
import { useBoard } from "../lib/board";
import { LANGS, useLang, type Lang } from "../lib/i18n";
import { Link, useRouter } from "../lib/router";
import { zhBoardShort, zhBorough } from "../lib/zhCivic";
import { Icon } from "./Icon";

function AccountMenu() {
  const { t } = useLang();
  const { navigate } = useRouter();
  const { user, loading, openSignIn, signOut } = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    addEventListener("mousedown", on);
    return () => removeEventListener("mousedown", on);
  }, [open]);

  if (loading) return null;
  if (!user)
    return (
      <button className="side-signin" onClick={() => openSignIn()}>
        {t("signIn")}
      </button>
    );
  return (
    <div className="account-menu" ref={ref}>
      <button className="side-signin" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {user.name || user.email}
      </button>
      {open && (
        <div className="account-pop" role="menu">
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              navigate("/me");
            }}
          >
            <Icon name="bookmark" size={15} /> {t("myProposals")}
          </button>
          <button
            role="menuitem"
            onClick={() => {
              setOpen(false);
              void signOut();
            }}
          >
            <Icon name="logout" size={15} /> {t("signOut")}
          </button>
        </div>
      )}
    </div>
  );
}

export function SideNav() {
  const { t, lang, setLang } = useLang();
  const { board, boards, setBoard } = useBoard();
  const { path } = useRouter();
  const items = [
    { to: "/", label: t("home"), on: path === "/" || path.startsWith("/discover") || path.startsWith("/a/") || path.startsWith("/p/") },
    { to: "/about", label: t("about"), on: path === "/about" },
    { to: "/how-it-works", label: t("howItWorks"), on: path === "/how-it-works" },
  ];
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
      <label className="side-board">
        <span>{t("communityBoard")}</span>
        <select value={board.id} aria-label={t("communityBoard")} onChange={(e) => setBoard(e.target.value)}>
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
      </label>
      <div className="side-account">
        <AccountMenu />
      </div>
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
