import { useEffect, useState, type ReactNode } from "react";
import { AudioPlayer } from "../components/AudioPlayer";
import { FollowModal, FollowPanel } from "../components/FollowPanel";
import { Icon, type IconName } from "../components/Icon";
import { ProposalArt } from "../components/Illustration";
import { CategoryChip } from "../components/ProposalCard";
import { useToast } from "../components/Toast";
import { useAccount } from "../lib/account";
import { api } from "../lib/api";
import { eventTypeLabel, fmtDate, fmtEventWhen, fmtTime, stageLabel, summaryOf, titleOf } from "../lib/format";
import { useLang } from "../lib/i18n";
import { useLoad } from "../lib/meta";
import { Link, useRouter } from "../lib/router";
import type { Evidence, ProposalDetail, PublicEvent } from "../lib/types";

type Tab = "overview" | "audio" | "source" | "participate" | "timeline";
const TABS: { key: Tab; label: "overview" | "audio" | "source" | "participate" | "timeline" }[] = [
  { key: "overview", label: "overview" },
  { key: "audio", label: "audio" },
  { key: "source", label: "source" },
  { key: "participate", label: "participate" },
  { key: "timeline", label: "timeline" },
];

const FIELD_LABEL: Record<string, [string, string]> = {
  title: ["Title", "标题"],
  location: ["Location", "位置"],
  stage: ["Stage", "阶段"],
  summary: ["Summary", "摘要"],
  purpose: ["Stated purpose", "申报目的"],
  proposed_by: ["Proposed by", "提案方"],
  participation: ["How to participate", "参与方式"],
};

export function SaveButton({ proposalId }: { proposalId: string }) {
  const { t } = useLang();
  const toast = useToast();
  const { user, savedIds, setSaved, openSignIn } = useAccount();
  const [busy, setBusy] = useState(false);
  const saved = savedIds.has(proposalId);
  const onClick = async () => {
    if (!user) return openSignIn();
    setBusy(true);
    try {
      await setSaved(proposalId, !saved);
      toast(saved ? t("removedToast") : t("savedToast"));
    } catch (e) {
      toast((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <button className={`btn sm${saved ? " saved" : ""}`} aria-pressed={saved} disabled={busy} onClick={() => void onClick()}>
      <Icon name={saved ? "check" : "bookmark"} size={15} /> {saved ? t("saved") : t("save")}
    </button>
  );
}

export function ProposalPage({ id, tab }: { id: string; tab?: string }) {
  const { t, lang } = useLang();
  const { navigate } = useRouter();
  const toast = useToast();
  const res = useLoad(() => api.proposal(id), [id]);
  const [following, setFollowing] = useState(false);
  const active: Tab = (TABS.find((x) => x.key === tab)?.key ?? "overview") as Tab;
  const p = res.data;

  // keep polling while audio is being produced so the page updates by itself
  useEffect(() => {
    if (!p) return;
    const pending = p.audio.en?.status === "pending" || p.audio.zh?.status === "pending";
    if (!pending) return;
    const iv = setTimeout(res.reload, 6000);
    return () => clearTimeout(iv);
  }, [p, res]);

  if (res.loading && !p)
    return (
      <div className="container page">
        <div className="skeleton" style={{ height: 40, width: 320 }} />
        <div className="skeleton" style={{ height: 420, marginTop: 24 }} />
      </div>
    );
  if (res.error || !p)
    return (
      <div className="container page">
        <div className="state-box">
          <h3>{lang === "zh" ? "找不到此提案" : "Proposal not found"}</h3>
          <p>{res.error}</p>
          <Link to="/discover" className="btn sm">
            {t("backToResults")}
          </Link>
        </div>
      </div>
    );

  const share = async () => {
    const url = location.origin + `/p/${p.id}`;
    if (navigator.share) navigator.share({ title: p.title, url }).catch(() => {});
    else {
      await navigator.clipboard?.writeText(url);
      toast(lang === "zh" ? "链接已复制" : "Link copied");
    }
  };

  return (
    <div className="container page" style={{ paddingTop: 20 }}>
      <div className="row between">
        <Link to="/discover" className="back-link">
          <Icon name="arrowLeft" size={16} /> {t("backToResults")}
        </Link>
        <div className="row" style={{ gap: 10 }}>
          <button className="btn sm" onClick={share}>
            <Icon name="share" size={15} /> {t("share")}
          </button>
          <SaveButton proposalId={p.id} />
          <button className="btn primary sm" onClick={() => setFollowing(true)}>
            <Icon name="bell" size={15} /> {t("follow")}
          </button>
        </div>
      </div>

      {p.is_sample && (
        <div className="banner amber" style={{ marginTop: 16 }}>
          <Icon name="alert" size={16} />
          <span>{t("sampleBanner")}</span>
        </div>
      )}

      <div className="p-head">
        <div>
          <CategoryChip category={p.category} />
          <h1>{titleOf(p, lang)}</h1>
          <div className="addr">{p.address?.full ?? p.location_text ?? t("notListed")}</div>
        </div>
      </div>

      <nav className="tabs" aria-label="Proposal sections">
        {TABS.map((x) => (
          <Link key={x.key} to={`/p/${p.id}${x.key === "overview" ? "" : `/${x.key}`}`} className={active === x.key ? "on" : undefined} aria-current={active === x.key ? "page" : undefined}>
            {t(x.label)}
          </Link>
        ))}
      </nav>

      {active === "overview" && <Overview p={p} goSource={() => navigate(`/p/${p.id}/source`)} />}
      {active === "audio" && <AudioTab p={p} />}
      {active === "source" && <SourceTab p={p} />}
      {active === "participate" && <ParticipateTab p={p} />}
      {active === "timeline" && <TimelineTab p={p} />}

      {following && <FollowModal proposalId={p.id} title={p.title} onClose={() => setFollowing(false)} />}
    </div>
  );
}

function useEvidence(p: ProposalDetail) {
  return (field: string) => p.evidence.filter((e) => e.field === field);
}

function Cite({ ev, onClick }: { ev: Evidence[]; onClick: () => void }) {
  const { lang } = useLang();
  if (!ev.length) return null;
  return (
    <button className="evidence-btn" onClick={onClick} title={ev.map((e) => `p.${e.page}: “${e.excerpt}”`).join("\n")}>
      <Icon name="doc" size={11} />
      {lang === "zh" ? `第 ${ev[0].page} 页` : `p.${ev[0].page}`}
    </button>
  );
}

function GlanceRow({ icon, label, children, unknown }: { icon: IconName; label: string; children: ReactNode; unknown?: boolean }) {
  return (
    <div className="g-row">
      <Icon name={icon} size={18} />
      <div>
        <dt>{label}</dt>
        <dd className={unknown ? "unknown" : undefined}>{children}</dd>
      </div>
    </div>
  );
}

function nextMeeting(p: ProposalDetail): PublicEvent | undefined {
  return p.events.find((e) => e.timing === "upcoming");
}

function Overview({ p, goSource }: { p: ProposalDetail; goSource: () => void }) {
  const { t, lang } = useLang();
  const ev = useEvidence(p);
  const next = nextMeeting(p);
  const nextWhen = next ? fmtEventWhen(next, lang) : null;
  return (
    <div className="overview">
      <div>
        <div className="figure">
          <ProposalArt category={p.category} seed={p.id} title={lang === "zh" ? "插图（非现场照片）" : "Illustration (not a photo of the site)"} />
        </div>
        <p className="xs subtle" style={{ margin: "6px 2px 0" }}>
          {lang === "zh" ? "插图，非现场照片。" : "Illustration — not a photo of the site."}
        </p>
        <h2>{t("whatIsProposed")}</h2>
        <p>
          {summaryOf(p, lang)} <Cite ev={ev("summary")} onClick={goSource} />
        </p>
        {lang === "zh" && p.summary_zh && <p className="xs subtle">{t("translationNote")}</p>}
        <h2 style={{ fontSize: 16 }}>{t("statedPurpose")}</h2>
        <p>
          {p.purpose ? (
            <>
              {p.purpose} <Cite ev={ev("purpose")} onClick={goSource} />
            </>
          ) : (
            <span className="not-listed">{t("notListed")}</span>
          )}
        </p>
        <p className="xs subtle" style={{ marginTop: 18 }}>
          {t("lastChecked")}: {fmtDate(p.last_checked_at.slice(0, 10), lang)} · {lang === "zh" ? "版本" : "Version"} {p.version} ·{" "}
          <button className="link xs" style={{ border: 0, background: "none", padding: 0 }} onClick={goSource}>
            {t("officialDocs")} ({p.documents.length})
          </button>
        </p>
      </div>
      <aside className="panel glance">
        <h3>{t("atAGlance")}</h3>
        <dl>
          <GlanceRow icon="flag" label={t("stage")} unknown={!p.stage}>
            {p.stage ?? t("notListed")} <Cite ev={ev("stage")} onClick={goSource} />
          </GlanceRow>
          <GlanceRow icon="calendar" label={next?.type === "public_hearing" ? t("hearingDate") : t("nextDate")} unknown={!next}>
            {next ? (
              <>
                {nextWhen ?? t("tbd")}
                {next.type !== "public_hearing" && <div className="xs subtle" style={{ fontWeight: 500 }}>{eventTypeLabel(next.type, lang)}</div>}
                {next.is_demo && <span className="chip demo" style={{ height: 18, fontSize: 10, marginTop: 4 }}>{t("demo")}</span>}
              </>
            ) : (
              t("nextNotAnnounced")
            )}
          </GlanceRow>
          <GlanceRow icon="pin" label={t("location")} unknown={!p.location_text}>
            {p.location_text ?? t("notListed")} <Cite ev={ev("location")} onClick={goSource} />
          </GlanceRow>
          <GlanceRow icon="folder" label={t("category")}>
            {t(p.category)}
          </GlanceRow>
          <GlanceRow icon="building" label={t("address")} unknown={!p.address}>
            {p.address?.full ?? (lang === "zh" ? "未收录到地址索引" : "Not in our address index")}
          </GlanceRow>
          <GlanceRow icon="user" label={t("proposedBy")} unknown={!p.proposed_by}>
            {p.proposed_by ?? t("notListed")} <Cite ev={ev("proposed_by")} onClick={goSource} />
          </GlanceRow>
        </dl>
      </aside>
    </div>
  );
}

function AudioTab({ p }: { p: ProposalDetail }) {
  const { t, lang: uiLang } = useLang();
  const [lang, setLang] = useState<"en" | "zh">(uiLang === "zh" && p.audio.zh?.status === "ready" ? "zh" : "en");
  const [showRefs, setShowRefs] = useState(false);
  const en = p.audio.en;
  const zh = p.audio.zh;
  const cur = lang === "en" ? en : zh;
  const refs = p.evidence.filter((e) => ["summary", "purpose", "stage", "location", "participation"].includes(e.field) || e.field.startsWith("event:"));

  let note: string | null = null;
  if (!cur || cur.status === "draft") note = lang === "zh" && en?.status === "ready" ? t("zhPending") : t("audioNone");
  else if (cur.status === "pending") note = lang === "zh" ? t("zhPending") : t("audioPending");
  else if (cur.status === "failed") note = t("audioFailed");

  const enTranscript = en?.transcript;
  return (
    <div>
      <div className="audio-head">
        <div>
          <h2>{t("listenTitle")}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {t("listenSub")}
          </p>
        </div>
        <div className="segmented" role="tablist" aria-label="Audio language">
          <button role="tab" aria-selected={lang === "en"} className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>
            English
          </button>
          <button role="tab" aria-selected={lang === "zh"} className={lang === "zh" ? "on" : ""} onClick={() => setLang("zh")} lang="zh-Hans">
            中文
          </button>
        </div>
      </div>
      <AudioPlayer url={cur?.status === "ready" ? cur.url : null} label={lang === "en" ? "English briefing" : "Chinese briefing"} />
      {note && (
        <div className="banner info" style={{ marginTop: 12 }}>
          <Icon name="info" size={16} />
          <span>{note}</span>
        </div>
      )}
      <div className="transcripts">
        <div className="transcript">
          <h3>{t("enTranscript")}</h3>
          <p>{enTranscript ?? p.summary}</p>
          {!enTranscript && (
            <p className="xs subtle" style={{ marginTop: 8 }}>
              {uiLang === "zh" ? "（语音文稿尚未审核，显示为摘要。）" : "(Briefing script not yet approved — showing the reviewed summary.)"}
            </p>
          )}
          {refs.length > 0 && (
            <>
              <button className="refs-toggle" onClick={() => setShowRefs((s) => !s)} aria-expanded={showRefs}>
                <span className="row" style={{ gap: 8 }}>
                  <Icon name="doc" size={16} /> {showRefs ? t("hideRefs") : t("showRefs")} ({refs.length})
                </span>
                <Icon name="chevronDown" size={16} style={{ transform: showRefs ? "rotate(180deg)" : undefined, transition: "transform .15s" }} />
              </button>
              {showRefs && <RefList p={p} refs={refs} />}
            </>
          )}
        </div>
        <div className="transcript" lang="zh-Hans">
          <h3>{t("zhTranscript")}</h3>
          {zh?.status === "ready" && zh.transcript ? (
            <p className="zh">{zh.transcript}</p>
          ) : p.summary_zh ? (
            <p className="zh">{p.summary_zh}</p>
          ) : (
            <p className="muted">{uiLang === "zh" ? "中文翻译尚未生成。" : "Chinese translation not generated yet."}</p>
          )}
          <div className="gen-note">
            <Icon name="info" size={15} />
            {zh?.translation_review === "reviewed" ? t("reviewedTranslation") : t("generatedTranslation")}
            {zh?.status === "ready" && zh.method && (
              <span className="subtle xs">· {zh.method === "dubbing" ? "ElevenLabs Dubbing" : zh.method === "tts_translated_cursor" ? "Grok (in Cursor) translation + ElevenLabs voice" : "Grok translation + ElevenLabs voice"}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function RefList({ p, refs }: { p: ProposalDetail; refs: Evidence[] }) {
  const { lang } = useLang();
  const docs = new Map(p.documents.map((d) => [d.id, d]));
  return (
    <div className="refs">
      {refs.map((r, i) => {
        const d = docs.get(r.document_id);
        return (
          <div key={i} className="ref">
            <q>{r.excerpt}</q>
            <div className="meta">
              {fieldLabel(r.field, p, lang)} ·{" "}
              {d && (
                <a className="link" href={`${d.file_url}${d.mime_type === "application/pdf" ? `#page=${r.page}` : ""}`} target="_blank" rel="noreferrer">
                  {d.title} — {d.mime_type === "application/pdf" ? (lang === "zh" ? `第 ${r.page} 页` : `page ${r.page}`) : lang === "zh" ? `第 ${r.page} 节` : `section ${r.page}`}
                </a>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function fieldLabel(field: string, p: ProposalDetail, lang: "en" | "zh"): string {
  if (field.startsWith("event:")) {
    const e = p.events.find((x) => x.key === field.slice(6));
    return e ? e.title : lang === "zh" ? "事件" : "Event";
  }
  return (FIELD_LABEL[field] ?? [field, field])[lang === "zh" ? 1 : 0];
}

function SourceTab({ p }: { p: ProposalDetail }) {
  const { t, lang } = useLang();
  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={{ fontSize: 20, margin: "0 0 12px" }}>{t("officialDocs")}</h2>
      <div className="source-list">
        {p.documents.map((d) => (
          <div key={d.id} className="source-item">
            <div className="ic">{d.mime_type === "application/pdf" ? "PDF" : "HTML"}</div>
            <div>
              <div style={{ fontWeight: 600 }}>
                {d.title} {d.is_sample && <span className="chip sample" style={{ height: 18, fontSize: 10.5 }}>{t("sample")}</span>}
              </div>
              <div className="small subtle">
                {d.publication_date ? `${lang === "zh" ? "发布" : "Published"} ${fmtDate(d.publication_date, lang)}` : lang === "zh" ? "发布日期未列出" : "Publication date not listed"} · {lang === "zh" ? "获取于" : "Retrieved"}{" "}
                {fmtDate(d.retrieved_at.slice(0, 10), lang)} · {d.page_count} {d.mime_type === "application/pdf" ? (lang === "zh" ? "页" : "pages") : lang === "zh" ? "节" : "sections"}
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <a className="btn sm" href={d.file_url} target="_blank" rel="noreferrer">
                <Icon name="doc" size={14} /> {t("openOriginal")}
              </a>
              <a className="btn sm ghost" href={d.official_url} target="_blank" rel="noreferrer">
                {t("viewOnSite")} <Icon name="external" size={13} />
              </a>
            </div>
          </div>
        ))}
      </div>
      <h2 style={{ fontSize: 18, margin: "32px 0 4px" }}>{t("evidenceTitle")}</h2>
      <p className="small muted" style={{ margin: 0 }}>
        {lang === "zh" ? "每条摘录都已与原始文件文本自动核对。" : "Each excerpt was checked automatically against the document text before publishing."}
      </p>
      <RefList p={p} refs={p.evidence} />
    </div>
  );
}

function ParticipateTab({ p }: { p: ProposalDetail }) {
  const { t, lang } = useLang();
  const next = nextMeeting(p);
  const meeting = next && ["public_hearing", "community_discussion", "committee_meeting", "board_meeting"].includes(next.type) ? next : undefined;
  const officialDoc = p.documents[0];
  return (
    <div className="participate">
      <div>
        <h2>{t("howToParticipate")}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {t("participateSub")}
        </p>
        <ol className="steps">
          <li>
            <span className="n">1</span>
            <div>
              <h3>{meeting ? `${lang === "zh" ? "参加" : "Attend the"} ${eventTypeLabel(meeting.type, lang).toLowerCase()}` : t("nextNotAnnounced")}</h3>
              <div className="meta">
                {meeting ? (
                  <>
                    <div>
                      <Icon name="calendar" size={16} />
                      <span>
                        {meeting.date ? fmtDate(meeting.date, lang) : t("tbd")}
                        {meeting.starts_at && ` · ${fmtTime(meeting.starts_at, lang)}`}
                        {meeting.is_demo && <span className="chip demo" style={{ height: 18, fontSize: 10, marginLeft: 8 }}>{t("demo")}</span>}
                      </span>
                    </div>
                    <div>
                      <Icon name="pin" size={16} />
                      <span>{meeting.location ?? t("notListed")}</span>
                    </div>
                    {meeting.meeting_url && (
                      <div>
                        <Icon name="globe" size={16} />
                        <a className="link" href={meeting.meeting_url} target="_blank" rel="noreferrer">
                          {lang === "zh" ? "线上会议链接" : "Online meeting link"}
                        </a>
                      </div>
                    )}
                  </>
                ) : (
                  <div>
                    <Icon name="info" size={16} />
                    <span>
                      {lang === "zh" ? "官方文件中没有列出即将举行的会议。关注此提案，会议公布后我们会通知您。" : "The source documents don't list an upcoming meeting. Follow this proposal and we'll text you if one is announced."}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </li>
          <li>
            <span className="n">2</span>
            <div>
              <h3>{t("submitComment")}</h3>
              <div className="meta">
                <div>
                  <Icon name="doc" size={16} />
                  <span>
                    {p.participation ?? meeting?.instructions ?? <span className="not-listed">{t("notListed")}</span>}
                    {officialDoc && (
                      <>
                        <br />
                        <a className="link small" href={officialDoc.file_url} target="_blank" rel="noreferrer">
                          {lang === "zh" ? "详见官方文件。" : "More details in the official document."}
                        </a>
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </li>
          <li>
            <span className="n">3</span>
            <div>
              <h3>{t("stayUpdated")}</h3>
              <div className="meta">
                <div>
                  <Icon name="bell" size={16} />
                  <span>{t("stayUpdatedText")}</span>
                </div>
              </div>
            </div>
          </li>
        </ol>
      </div>
      <aside className="panel follow-panel">
        <h3>{t("followThis")}</h3>
        <FollowPanel proposalId={p.id} title={p.title} />
      </aside>
    </div>
  );
}

function TimelineTab({ p }: { p: ProposalDetail }) {
  const { t, lang } = useLang();
  const next = nextMeeting(p);
  const docs = new Map(p.documents.map((d) => [d.id, d]));
  const evFor = (key: string) => p.evidence.find((e) => e.field === `event:${key}`);
  return (
    <div style={{ maxWidth: 820 }}>
      <h2 style={{ fontSize: 22, margin: "0 0 4px", letterSpacing: "-0.02em" }}>{t("timeline")}</h2>
      <p className="muted" style={{ margin: 0 }}>
        {t("keyDates")}
      </p>
      {p.events.length === 0 ? (
        <div className="state-box" style={{ marginTop: 20 }}>
          <h3>{lang === "zh" ? "没有列出日期" : "No dates listed"}</h3>
          <p style={{ margin: 0 }}>{t("nextNotAnnounced")}</p>
        </div>
      ) : (
        <ol className="timeline">
          {p.events.map((e) => {
            const cls = e.cancelled ? "cancelled" : e.id === next?.id ? "current" : e.timing === "past" ? "past" : "future";
            const src = evFor(e.key);
            const d = src ? docs.get(src.document_id) : undefined;
            return (
              <li key={e.id} className={cls}>
                <div className="when">
                  {e.date ? fmtDate(e.date, lang) : <span className="tbd">{t("tbd")}</span>}
                  {e.starts_at && (
                    <>
                      <br />
                      {fmtTime(e.starts_at, lang)}
                    </>
                  )}
                </div>
                <span className="dot" />
                <div className="what">
                  <h4>
                    {e.title}{" "}
                    {e.is_demo && <span className="chip demo" style={{ height: 18, fontSize: 10, verticalAlign: 2 }}>{t("demo")}</span>}
                    {e.cancelled && <span className="pill red" style={{ height: 18, fontSize: 10.5, marginLeft: 6 }}>{t("cancelled")}</span>}
                  </h4>
                  <p>
                    {[e.description, e.location].filter(Boolean).join(" · ") || eventTypeLabel(e.type, lang)}
                    {d && (
                      <>
                        {" "}
                        <a className="link xs" href={`${d.file_url}${d.mime_type === "application/pdf" ? `#page=${src!.page}` : ""}`} target="_blank" rel="noreferrer">
                          {lang === "zh" ? "查看文件" : "View document"} ↗
                        </a>
                      </>
                    )}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <p className="xs subtle" style={{ marginTop: 16 }}>
        {lang === "zh" ? "所有时间均为纽约时间。当前阶段：" : "All times are New York time. Current stage: "}
        {p.stage ?? stageLabel(p.stage_kind, lang)}
      </p>
    </div>
  );
}
