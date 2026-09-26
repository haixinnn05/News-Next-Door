import { useEffect, useState } from "react";
import { AudioPlayer } from "../components/AudioPlayer";
import { Icon } from "../components/Icon";
import { NewsArticle } from "../components/NewsFeed";
import { SaveButton } from "./Proposal";
import { api } from "../lib/api";
import { useLang, type Key, type Lang } from "../lib/i18n";
import { useLoad } from "../lib/meta";
import { Link } from "../lib/router";
import { storyDate, storyFromCity } from "../lib/story";
import type { CityAudioView, CityFacts, CityTranslation } from "../lib/types";

export function CityStoryPage({ id }: { id: string }) {
  const { t, lang } = useLang();
  const res = useLoad(() => api.cityStory(id), [id]);
  const [translated, setTranslated] = useState<CityTranslation | null>(null);
  const [translating, setTranslating] = useState(false);
  const [translateError, setTranslateError] = useState<string | null>(null);
  const [audio, setAudio] = useState<CityAudioView | null>(null);
  const [listening, setListening] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    setTranslated(null);
    setTranslateError(null);
    setAudio(null);
    setAudioError(null);
    setListening(false);
  }, [id, lang]);

  useEffect(() => {
    if (audio?.status !== "pending") return;
    const iv = setInterval(() => {
      api.cityAudio(id, lang).then(setAudio).catch(() => {});
    }, 2500);
    return () => clearInterval(iv);
  }, [audio?.status, id, lang]);

  const briefing = res.data;
  if (res.loading && !briefing)
    return (
      <div className="news">
        <div className="skeleton" style={{ height: 220 }} />
      </div>
    );
  if (res.error || !briefing)
    return (
      <div className="news">
        <h1>{t("notFound")}</h1>
        <Link to="/?scope=city" className="news-back">
          {t("back")}
        </Link>
      </div>
    );

  const shown = translated && translated.lang === lang ? translated : null;
  const facts = shown?.facts ?? briefing.facts;
  const summary = shown?.summary ?? briefing.summary_en;
  const summaryParts = summary.split(/\n+/).map((part) => part.trim()).filter(Boolean);
  const when = facts.when && /^\d{4}-\d{2}-\d{2}/.test(facts.when) ? facts.when.slice(0, 10) : facts.when;
  const story = storyFromCity({
    ...briefing.article,
    headline: shown?.headline ?? briefing.article.headline,
    dek: shown?.dek ?? briefing.article.dek,
    section: shown?.section ?? briefing.article.section,
  });

  const translate = async () => {
    setTranslating(true);
    setTranslateError(null);
    try {
      setTranslated(await api.translateCity(id, lang));
    } catch (err) {
      setTranslateError((err as Error).message);
    } finally {
      setTranslating(false);
    }
  };

  const listen = async () => {
    setListening(true);
    setAudioError(null);
    try {
      setAudio(await api.requestCityAudio(id, lang));
    } catch (err) {
      setAudioError((err as Error).message);
    } finally {
      setListening(false);
    }
  };

  return (
    <NewsArticle
      story={story}
      backTo="/?scope=city"
      sourceLabel={t("readOnNyt")}
      actions={<SaveButton proposalId={id} />}
      glance={glanceOf({ ...facts, when }, t, lang)}
      body={
        <>
          <div className="news-plain city-brief">
            <p className="news-kicker">{shown ? t("showSummary") : t("englishSummary")}</p>
            {summaryParts.map((part) => (
              <p key={part.slice(0, 48)} className="news-body">
                {part}
              </p>
            ))}
            <p className="news-note">{t("citySummaryNote")}</p>
          </div>
          <div className="news-summarize">
            {lang !== "en" && !shown && (
              <button type="button" disabled={translating} onClick={() => void translate()}>
                {translating ? t("translatingStory") : t("translateStory")}
              </button>
            )}
            {shown && (
              <button type="button" onClick={() => setTranslated(null)}>
                {t("showEnglish")}
              </button>
            )}
            <button type="button" disabled={listening || audio?.status === "pending"} onClick={() => void listen()}>
              {listening || audio?.status === "pending" ? t("audioPending") : t("listenTitle")}
            </button>
          </div>
          {translateError && <p className="news-note">{translateError}</p>}
          {audioError && <p className="news-note">{audioError}</p>}
        </>
      }
    >
      {(audio || listening) && (
        <div style={{ marginTop: 28 }}>
          <div className="audio-head">
            <div>
              <h2 style={{ fontSize: 20 }}>{t("listenTitle")}</h2>
              <p className="muted" style={{ margin: 0 }}>
                {t("listenCity")}
              </p>
            </div>
          </div>
          <AudioPlayer url={audio?.status === "ready" ? audio.url : null} label={t("listenTitle")} />
          {(audio?.status === "failed" || audioError) && (
            <div className="banner info" style={{ marginTop: 12 }}>
              <Icon name="info" size={16} />
              <span>{t("audioFailed")}</span>
            </div>
          )}
        </div>
      )}
    </NewsArticle>
  );
}

function glanceOf(facts: CityFacts, t: (k: Key) => string, lang: Lang) {
  const when = facts.when && /^\d{4}-\d{2}-\d{2}$/.test(facts.when) ? storyDate(facts.when, lang) : facts.when;
  return [
    { label: t("who"), value: facts.who },
    { label: t("what"), value: facts.what },
    { label: t("location"), value: facts.where },
    { label: t("whenItHappened"), value: when },
    { label: t("source"), value: t("nytSource") },
  ];
}
