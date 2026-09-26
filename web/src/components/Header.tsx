import { useEffect, useRef, useState } from "react";
import { useAccount } from "../lib/account";
import { zhBoardShort, zhBorough } from "../lib/zhCivic";
import { useBoard } from "../lib/board";
import { useLang } from "../lib/i18n";
import { Link, useRouter } from "../lib/router";
import { BrandMark, Icon } from "./Icon";

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

  if (loading) return <span className="account-slot" aria-hidden="true" />;
  if (!user)
    return (
      <button className="btn sm" onClick={() => openSignIn()}>
        <Icon name="user" size={15} /> {t("signIn")}
      </button>
    );
  const initial = (user.name || user.email).trim().charAt(0).toUpperCase();
  return (
    <div className="account-menu" ref={ref}>
      <button className="avatar-btn" aria-haspopup="menu" aria-expanded={open} aria-label={user.name || user.email} onClick={() => setOpen((o) => !o)}>
        {user.image ? <img src={user.image} alt="" referrerPolicy="no-referrer" /> : <span>{initial}</span>}
      </button>
      {open && (
        <div className="account-pop" role="menu">
          <div className="account-who">
            <strong>{user.name || user.email}</strong>
            {user.name && <span className="xs subtle">{user.email}</span>}
          </div>
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

export function Header() {
  const { t, lang, setLang } = useLang();
  const { board, boards, setBoard } = useBoard();
  const { path } = useRouter();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(scrollY > 4);
    addEventListener("scroll", on, { passive: true });
    return () => removeEventListener("scroll", on);
  }, []);
  const nav = [
    { to: "/discover", label: t("discover"), on: path.startsWith("/discover") || path.startsWith("/p/") || path.startsWith("/a/") },
    { to: "/about", label: t("about"), on: path === "/about" },
    { to: "/how-it-works", label: t("howItWorks"), on: path === "/how-it-works" },
  ];
  return (
    <header className={`site-header${scrolled ? " scrolled" : ""}`}>
      <div className="container inner">
        <Link to="/" className="brand" aria-label="Before the Vote home">
          <BrandMark />
          Before the Vote
        </Link>
        <nav className="nav" aria-label="Main">
          {nav.map((n) => (
            <Link key={n.to} to={n.to} className={n.on ? "active" : undefined}>
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="header-right">
          <label className="board-select" title={t("communityBoard")}>
            <span className="sr-only">{t("communityBoard")}</span>
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
            <Icon name="chevronDown" size={14} />
          </label>
          <div className="lang-toggle" role="group" aria-label="Language">
            <button className={lang === "en" ? "on" : ""} aria-pressed={lang === "en"} onClick={() => setLang("en")}>
              EN
            </button>
            <span className="sep">|</span>
            <button className={lang === "zh" ? "on" : ""} aria-pressed={lang === "zh"} onClick={() => setLang("zh")} lang="zh-Hans">
              中文
            </button>
          </div>
          <AccountMenu />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  const { t } = useLang();
  return (
    <footer className="footer">
      <div className="container inner">
        <div>
          <strong style={{ color: "var(--ink)" }}>Before the Vote</strong> — {t("footerBlurb")}
          <br />
          {t("footerCheck")}
        </div>
        <div className="row" style={{ gap: 18 }}>
          <Link to="/about">{t("about")}</Link>
          <Link to="/how-it-works">{t("howItWorks")}</Link>
          <Link to="/admin">{t("team")}</Link>
        </div>
      </div>
    </footer>
  );
}
