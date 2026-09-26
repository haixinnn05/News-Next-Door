import { useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import { HeroSkyline } from "../components/Illustration";
import { LiveApplications } from "../components/LiveApplications";
import { ProposalCardView } from "../components/ProposalCard";
import { api } from "../lib/api";
import { useBoard } from "../lib/board";
import { useLang } from "../lib/i18n";
import { useLoad } from "../lib/meta";
import { Link, useRouter } from "../lib/router";
import { zhBoardName, zhBoardShort, zhBorough, zhNeighborhoods } from "../lib/zhCivic";

export function SearchBar({ initial = "", compact = false, onSearch }: { initial?: string; compact?: boolean; onSearch: (q: string) => void }) {
  const { t } = useLang();
  const [q, setQ] = useState(initial);
  const submit = (e: FormEvent) => {
    e.preventDefault();
    onSearch(q.trim());
  };
  return (
    <form className={`search${compact ? " compact" : ""}`} onSubmit={submit} role="search">
      <Icon name="search" size={17} />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} />
      {!compact && (
        <button className="go" type="submit" aria-label={t("search")}>
          <Icon name="search" size={17} stroke={2.2} />
        </button>
      )}
    </form>
  );
}

export function Home() {
  const { t, lang } = useLang();
  const { board } = useBoard();
  const { navigate } = useRouter();
  const recent = useLoad(() => api.search(), []);
  const reviewed = board.id === "queens-cb2" ? (recent.data?.results ?? []).filter((p) => !p.is_sample) : [];
  return (
    <>
      <section className="container">
        <div className="hero">
          <div className="hero-copy">
            <h1>{lang === "zh" ? t("heroTitle") : <>Understand local proposals before you can take action.</>}</h1>
            <p className="lede">{t("heroLede")}</p>
            <SearchBar onSearch={(q) => navigate(`/discover${q ? `?q=${encodeURIComponent(q)}` : ""}`)} />
            <div className="coverage-note">
              <Icon name="pin" size={14} />
              {lang === "zh" ? `${zhBoardName(board, lang)}：${zhNeighborhoods(board.neighborhoods, lang).join("、")}` : `${board.name}: ${board.neighborhoods.join(", ")}.`}
            </div>
          </div>
          <div className="hero-art">
            <HeroSkyline />
            <div className="hero-note" aria-hidden="true">
              {zhBorough(board.borough, lang)}
              <br />
              {lang === "zh" ? "第" : "Community"}
              <br />
              {lang === "zh" ? `${board.number}社区委员会` : `Board ${board.number}`}
              <svg viewBox="0 0 60 44" fill="none" stroke="#2a2a28" strokeWidth="2" strokeLinecap="round">
                <path d="M50 4 C 40 20, 28 30, 8 38" />
                <path d="M8 38 l10 -1 M8 38 l4 -9" />
              </svg>
            </div>
          </div>
        </div>
      </section>

      <section className="container">
        <LiveApplications boardId={board.id} boardName={zhBoardShort(board, lang)} />
        {reviewed.length > 0 && (
          <>
            <div className="section-head">
              <h2>{lang === "zh" ? "已核对的简报" : "Reviewed briefing"}</h2>
              <Link to="/discover" className="row small" style={{ gap: 6, color: "var(--ink-2)" }}>
                {t("viewAll")} <Icon name="arrowRight" size={14} />
              </Link>
            </div>
            <div className="grid-3">
              {reviewed.map((p) => (
                <ProposalCardView key={p.id} p={p} />
              ))}
            </div>
          </>
        )}

        <div className="explain-strip">
          <div className="item">
            <div className="ic">
              <Icon name="doc" />
            </div>
            <h3>{lang === "zh" ? "来自官方文件" : "Straight from official documents"}</h3>
            <p>{lang === "zh" ? "每项事实都链接到原始文件的具体页面。来源中未列出的信息会明确标注。" : "Every fact links to the page it came from. If the source doesn't say, we say “Not listed in source.”"}</p>
          </div>
          <div className="item">
            <div className="ic">
              <Icon name="audio" />
            </div>
            <h3>{lang === "zh" ? "用您的语言收听" : "Listen in your language"}</h3>
            <p>{lang === "zh" ? "每个提案都有一分钟左右的英文简报和中文配音。" : "A one-minute English briefing for each proposal, with a Chinese dub. Translations are clearly labelled."}</p>
          </div>
          <div className="item">
            <div className="ic">
              <Icon name="bell" />
            </div>
            <h3>{lang === "zh" ? "通过 iMessage 获取提醒" : "Reminders by iMessage"}</h3>
            <p>{lang === "zh" ? "关注提案，在会议前 24 小时收到提醒。回复 STOP 随时退订。" : "Follow a proposal and get a text 24 hours before its meeting. Reply STOP anytime."}</p>
          </div>
        </div>
      </section>
    </>
  );
}
