import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useLang } from "../lib/i18n";
import type { AppAudioView } from "../lib/types";
import { AudioPlayer } from "./AudioPlayer";
import { Icon } from "./Icon";

/**
 * Audio for a live city application, in the visitor's site language only: English visitors hear the
 * American English voice, Chinese visitors hear the native Mandarin voice, and every other language
 * sees "not available yet" (no player, no ElevenLabs credit spent). Audio is created the first time
 * anyone asks and then reused. English reads the city's record (or Grok's checked Simple English);
 * Chinese reads the page's Chinese description (or Grok's checked Chinese).
 */
export function AppListen({ id }: { id: string }) {
  const { t, lang: uiLang } = useLang();
  const lang: "en" | "zh" | null = uiLang === "en" || uiLang === "zh" ? uiLang : null;
  const [view, setView] = useState<AppAudioView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const asked = useRef(new Set<string>());

  useEffect(() => {
    setView(null);
    asked.current.clear();
    if (lang) api.appAudio(id).then(setView).catch((e: Error) => setError(e.message));
  }, [id, lang]);

  // Ask for this language once per page view when it doesn't exist yet (or failed before).
  const unavailable = !lang || (lang === "zh" && view?.zh_available === false);
  useEffect(() => {
    if (!lang || unavailable || !view?.available) return;
    const cur = view[lang];
    if (cur && cur.status !== "failed") return;
    if (asked.current.has(lang)) return;
    asked.current.add(lang);
    api.requestAppAudio(id, lang).then(setView).catch((e: Error) => setError(e.message));
  }, [id, lang, view, unavailable]);

  const pending = !!lang && view?.[lang]?.status === "pending";
  useEffect(() => {
    if (!pending) return;
    const iv = setInterval(() => api.appAudio(id).then(setView).catch(() => {}), 2500);
    return () => clearInterval(iv);
  }, [id, pending]);

  if (unavailable)
    return (
      <div style={{ marginTop: 28 }}>
        <h2 style={{ fontSize: 20, margin: "0 0 6px" }}>{t("listenTitle")}</h2>
        <p className="muted" style={{ margin: 0 }}>
          {t("audioEnZhOnly")}
        </p>
      </div>
    );

  const cur = view?.[lang] ?? null;
  const version = view?.version ?? null;
  let note: string | null = null;
  if (error || (view && !view.available)) note = t("audioFailed");
  else if (!cur || cur.status === "pending") note = t("audioPending");
  else if (cur.status === "failed") note = t("audioFailed");

  return (
    <div style={{ marginTop: 28 }}>
      <div className="audio-head">
        <div>
          <h2 style={{ fontSize: 20 }}>{t("listenTitle")}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {version
              ? lang === "zh"
                ? "用简单的语言说明这项申请，并朗读出来。"
                : "This application in plain language, read aloud."
              : lang === "zh"
                ? "朗读本页的中文说明。"
                : "NYC Planning's own record, read aloud."}
          </p>
        </div>
      </div>
      <AudioPlayer url={cur?.status === "ready" ? cur.url : null} label={lang === "en" ? "English briefing" : "Chinese briefing"} />
      {note && (
        <div className="banner info" style={{ marginTop: 12 }}>
          <Icon name="info" size={16} />
          <span>{note}</span>
        </div>
      )}
      {version && (
        <div className="transcripts" style={{ marginTop: 14 }}>
          <div className="transcript">
            <h3>{lang === "zh" ? "简明中文" : "In plain language"}</h3>
            <p className={lang === "zh" ? "zh" : undefined} lang={lang === "zh" ? "zh-Hans" : "en"}>
              {lang === "zh" ? version.zh : version.simple_en}
            </p>
            <div className="gen-note">
              <Icon name="info" size={15} />
              {lang === "zh"
                ? "由 Grok 撰写，所有数字、地址和日期已与市政府记录核对；由 ElevenLabs 朗读。请以官方记录为准。"
                : "Written by Grok and checked so every number, address and date matches the city's record. Read by ElevenLabs. The official record is the final word."}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
