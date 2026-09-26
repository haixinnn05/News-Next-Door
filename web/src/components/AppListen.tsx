import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useLang } from "../lib/i18n";
import type { AppAudioView } from "../lib/types";
import { AudioPlayer } from "./AudioPlayer";
import { Icon } from "./Icon";

/**
 * Audio for a live city application, in the visitor's site language, created the first time anyone asks
 * and then reused. Audio exists only in English and Chinese (to save ElevenLabs credit): Chinese visitors
 * hear Chinese, everyone else hears English. With a checked Grok version, residents hear Simple English
 * and Chinese; without one, English reads NYC Planning's record and Chinese is an ElevenLabs dub of it.
 */
export function AppListen({ id }: { id: string }) {
  const { t, lang: uiLang } = useLang();
  const lang: "en" | "zh" = uiLang === "zh" ? "zh" : "en";
  const [view, setView] = useState<AppAudioView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const asked = useRef(new Set<string>());

  useEffect(() => {
    setView(null);
    asked.current.clear();
    api.appAudio(id).then(setView).catch((e: Error) => setError(e.message));
  }, [id]);

  // Ask for the selected language once per page view when it doesn't exist yet (or failed before).
  useEffect(() => {
    if (!view?.available) return;
    const cur = view[lang];
    if (cur && cur.status !== "failed") return;
    if (asked.current.has(lang)) return;
    asked.current.add(lang);
    api.requestAppAudio(id, lang).then(setView).catch((e: Error) => setError(e.message));
  }, [id, lang, view]);

  const pending = view?.en?.status === "pending" || view?.zh?.status === "pending";
  useEffect(() => {
    if (!pending) return;
    const iv = setInterval(() => api.appAudio(id).then(setView).catch(() => {}), 2500);
    return () => clearInterval(iv);
  }, [id, pending]);

  const cur = view?.[lang] ?? null;
  const version = view?.version ?? null;
  let note: string | null = null;
  if (error) note = t("audioFailed");
  else if (view && !view.available) note = t("audioFailed");
  else if (!cur || cur.status === "pending")
    note =
      lang === "zh" && !version
        ? uiLang === "zh"
          ? "正在用 ElevenLabs 生成中文配音，大约需要 1–2 分钟。"
          : "ElevenLabs is dubbing this into Chinese. It takes about 1–2 minutes."
        : t("audioPending");
  else if (cur.status === "failed") note = t("audioFailed");

  return (
    <div style={{ marginTop: 28 }}>
      <div className="audio-head">
        <div>
          <h2 style={{ fontSize: 20 }}>{t("listenTitle")}</h2>
          <p className="muted" style={{ margin: 0 }}>
            {version
              ? uiLang === "zh"
                ? "用简单的语言说明这项申请，并朗读出来。"
                : "This application in plain language, read aloud."
              : uiLang === "zh"
                ? "朗读纽约市规划局的官方记录。"
                : "NYC Planning's own record, read aloud."}
          </p>
        </div>
      </div>
      <AudioPlayer url={cur?.status === "ready" ? cur.url : null} label={lang === "en" ? "English briefing" : "Chinese briefing"} />
      {uiLang !== "en" && uiLang !== "zh" && <p className="xs subtle" style={{ margin: "8px 2px 0" }}>{t("audioEnZhOnly")}</p>}
      {note && (
        <div className="banner info" style={{ marginTop: 12 }}>
          <Icon name="info" size={16} />
          <span>{note}</span>
        </div>
      )}
      {version && (
        <div className="transcripts" style={{ marginTop: 14 }}>
          <div className="transcript">
            <h3>{lang === "zh" ? "简明中文" : uiLang === "zh" ? "简明英文" : "In plain language"}</h3>
            <p className={lang === "zh" ? "zh" : undefined} lang={lang === "zh" ? "zh-Hans" : "en"}>
              {lang === "zh" ? version.zh : version.simple_en}
            </p>
            <div className="gen-note">
              <Icon name="info" size={15} />
              {uiLang === "zh"
                ? "由 Grok 撰写，所有数字、地址和日期已与市政府记录核对；由 ElevenLabs 朗读。请以官方记录为准。"
                : "Written by Grok and checked so every number, address and date matches the city's record. Read by ElevenLabs. The official record is the final word."}
            </div>
          </div>
        </div>
      )}
      {!version && lang === "zh" && cur?.status === "ready" && (
        <div className="transcripts" style={{ marginTop: 14 }}>
          <div className="transcript">
            <h3>{t("zhTranscript")}</h3>
            {cur.transcript && <p className="zh">{cur.transcript}</p>}
            <div className="gen-note">
              <Icon name="info" size={15} />
              {t("generatedTranslation")} <span className="subtle xs">· ElevenLabs Dubbing</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
