import { useEffect, useState } from "react";
import { useBoard } from "../lib/board";
import { useLang } from "../lib/i18n";
import { Link, useRouter } from "../lib/router";
import { BrandMark, Icon } from "./Icon";

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
    { to: "/discover", label: t("discover"), on: path.startsWith("/discover") || path.startsWith("/p/") },
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
          <label className="board-select" title="Covered community board">
            <span className="sr-only">Community board</span>
            <select value={board.id} aria-label="Community board" onChange={(e) => setBoard(e.target.value)}>
              {["Queens", "Brooklyn", "Manhattan"].map((borough) => (
                <optgroup key={borough} label={borough}>
                  {boards
                    .filter((b) => b.borough === borough)
                    .map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.shortName}
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
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="footer">
      <div className="container inner">
        <div>
          <strong style={{ color: "var(--ink)" }}>Before the Vote</strong> — an independent civic prototype. Not affiliated with a community board or the City of New York.
          <br />
          Always check the official document linked on each proposal. Chinese text and audio are generated translations unless marked reviewed.
        </div>
        <div className="row" style={{ gap: 18 }}>
          <Link to="/about">About</Link>
          <Link to="/how-it-works">How it works</Link>
          <Link to="/admin">Team</Link>
        </div>
      </div>
    </footer>
  );
}
