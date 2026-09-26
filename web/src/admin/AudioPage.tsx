import { useEffect, useState } from "react";
import { adminJson, adminRequest } from "../lib/api";
import { fmtRelative } from "../lib/format";
import { Icon } from "../components/Icon";
import { CursorGrokModal } from "./CursorGrok";
import type { AudioItem, AudioSide, Overview } from "./types";
import { AudioPill, Empty, ErrorBanner, PageHead, SkeletonRows, Spinner, useAction, useAdmin, useInterval, useLoad } from "./ui";

const METHOD_LABEL: Record<string, string> = {
  tts: "ElevenLabs text-to-speech",
  dubbing: "ElevenLabs Dubbing",
  tts_translated: "Grok translation + ElevenLabs voice",
  tts_translated_cursor: "Grok (in Cursor) translation + ElevenLabs voice",
};

const countWords = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;

export function AudioPage() {
  const list = useLoad(() => adminRequest<AudioItem[]>("/audio"));
  const overview = useLoad(() => adminRequest<Overview>("/overview"));
  const anyPending = !!list.data?.some((a) => a.en.status === "pending" || a.zh?.status === "pending");
  useInterval(() => void list.reload(), anyPending ? 5000 : null);

  const xi = overview.data?.integrations.elevenlabs;

  return (
    <div className="adm-page">
      <PageHead
        title="Audio generation"
        subtitle="Write and approve a short English script, generate the audio, then dub it to Chinese."
        right={
          <button className="btn sm ghost" onClick={() => void list.reload()} disabled={list.loading}>
            {list.loading ? <Spinner /> : <Icon name="refresh" size={14} />} Refresh
          </button>
        }
      />

      {xi && !xi.enabled && (
        <div className="banner amber adm-mb">
          <Icon name="alert" size={16} />
          <div>
            <strong>ElevenLabs isn’t configured.</strong> Set <code>ELEVENLABS_API_KEY</code> in <code>.env</code> and restart the server to generate audio. You can still write and approve scripts.
          </div>
        </div>
      )}
      <div className="banner info adm-mb">
        <Icon name="info" size={16} />
        <div>
          Audio is cached per proposal version. When a new version is published, its script and audio start fresh and need to be regenerated.
          {xi?.enabled && (
            <span className="subtle">
              {" "}
              Voice {xi.voice} · model {xi.model} · dub target “{xi.dub_target}”.
            </span>
          )}
        </div>
      </div>

      <ErrorBanner error={list.error} onRetry={list.reload} />
      {!list.data && list.loading ? (
        <SkeletonRows n={3} />
      ) : list.data && list.data.length === 0 ? (
        <Empty icon="audio" title="No published proposals">
          Publish a proposal first; audio is generated per published version.
        </Empty>
      ) : (
        <div className="adm-audio-list">
          {list.data?.map((item) => (
            <AudioCard key={`${item.proposal.id}:${item.proposal.version}`} item={item} xiEnabled={xi?.enabled ?? true} grokEnabled={overview.data?.integrations.grok.enabled ?? true} reload={list.reload} />
          ))}
        </div>
      )}
    </div>
  );
}

function AudioCard({ item, xiEnabled, grokEnabled, reload }: { item: AudioItem; xiEnabled: boolean; grokEnabled: boolean; reload: () => Promise<void> }) {
  const { toast } = useAdmin();
  const act = useAction();
  const { proposal, en, zh } = item;
  const [script, setScript] = useState(en.script ?? "");
  const [pasting, setPasting] = useState(false);
  useEffect(() => setScript(en.script ?? ""), [en.script]);

  const locked = en.status === "ready" || en.status === "pending";
  const editable = !locked && !en.script_approved;
  const words = countWords(script);
  const inRange = words >= 60 && words <= 90;
  const dirty = script.trim() !== (en.script ?? "").trim();

  const base = `/audio/${proposal.id}`;
  const call = async (key: string, fn: () => Promise<unknown>, msg?: string) => {
    const r = await act.run(key, fn);
    if (r !== undefined && msg) toast(msg);
    await reload();
  };

  const saveScript = (approve: boolean) =>
    call(`script:${approve}`, () => adminJson("PUT", `${base}/script`, { script, approve }), approve ? "Script approved." : "Script saved.");
  const unapprove = () => call("unapprove", () => adminJson("PUT", `${base}/script`, { script: en.script ?? script, approve: false }), "Script unlocked for editing.");
  const genEn = () => call("gen-en", () => adminJson("POST", `${base}/generate-en`), "English audio ready.");
  const genZh = (method: "dubbing" | "tts_translated") =>
    call(`gen-zh:${method}`, () => adminJson("POST", `${base}/generate-zh`, { method }), method === "dubbing" ? "Dubbing started — this can take a minute or two." : "Chinese audio generated.");
  const review = (reviewed: boolean) => call("review", () => adminJson("POST", `${base}/zh-review`, { reviewed }), reviewed ? "Marked as reviewed." : "Marked as not reviewed.");
  const resetZh = () => {
    if (!confirm("Reset the Chinese audio for this version? The current file and transcript will be discarded.")) return;
    void call("reset", () => adminJson("POST", `${base}/zh-reset`), "Chinese audio reset.");
  };

  return (
    <article className="card adm-audio">
      <header className="adm-audio-head">
        <div className="grow">
          <h2>
            {proposal.title} {proposal.is_sample && <span className="chip sample">Sample</span>}
          </h2>
          <div className="subtle xs">
            Version {proposal.version} ·{" "}
            <a href={`/p/${proposal.id}`} target="_blank" rel="noreferrer" className="link">
              Public page
            </a>
          </div>
        </div>
      </header>
      <ErrorBanner error={act.error} />

      <div className="adm-audio-grid">
        {/* English */}
        <section className="adm-audio-side">
          <div className="adm-audio-side-head">
            <h3>English</h3>
            <AudioPill status={en.status} />
            {en.script_approved && en.status === "draft" && <span className="pill green">Script approved</span>}
          </div>
          <div className="field">
            <label htmlFor={`sc-${proposal.id}`} className="adm-flabel">
              <span>Script</span>
              <span className={`adm-words ${words === 0 ? "" : inRange ? "ok" : "warn"}`}>
                {words} words · target 60–90
              </span>
            </label>
            <textarea
              id={`sc-${proposal.id}`}
              className="textarea"
              rows={7}
              value={script}
              readOnly={!editable}
              onChange={(e) => setScript(e.target.value)}
              placeholder="A short, neutral, plain-language overview (60–90 words) — what is proposed, where, and the next date."
            />
          </div>
          <div className="adm-actions left">
            {editable && (
              <>
                <button className="btn sm" disabled={!!act.busy || !dirty} onClick={() => void saveScript(false)}>
                  {act.busy === "script:false" && <Spinner />} Save
                </button>
                <button className="btn sm" disabled={!!act.busy || !script.trim()} onClick={() => void saveScript(true)}>
                  {act.busy === "script:true" ? <Spinner /> : <Icon name="check" size={14} />} Approve script
                </button>
              </>
            )}
            {en.script_approved && !locked && (
              <button className="btn sm ghost" disabled={!!act.busy} onClick={() => void unapprove()}>
                Edit script
              </button>
            )}
            {en.status !== "ready" && (
              <button
                className="btn sm primary"
                disabled={!!act.busy || !en.script_approved || en.status === "pending" || !xiEnabled}
                onClick={() => void genEn()}
                title={!en.script_approved ? "Approve the script first" : !xiEnabled ? "ElevenLabs isn't configured" : undefined}
              >
                {act.busy === "gen-en" || en.status === "pending" ? <Spinner /> : <Icon name="play" size={12} />} Generate English audio
              </button>
            )}
          </div>
          {en.error && <div className="banner red adm-mt-sm">{en.error}</div>}
          {en.url && (
            <div className="adm-player">
              <audio controls preload="none" src={en.url} />
              <span className="subtle xs">
                {METHOD_LABEL[en.method ?? ""] ?? en.method} · {fmtRelative(en.updated_at)}
              </span>
            </div>
          )}
        </section>

        {/* Chinese */}
        <section className="adm-audio-side">
          <div className="adm-audio-side-head">
            <h3>Chinese (中文)</h3>
            {zh ? <AudioPill status={zh.status} /> : <span className="pill grey">Not started</span>}
            {zh?.translation_review === "reviewed" && <span className="pill green">Translation reviewed</span>}
            {zh?.translation_review === "unreviewed" && <span className="pill amber">Unreviewed translation</span>}
          </div>
          <ChineseSide
            zh={zh}
            enReady={en.status === "ready"}
            scriptApproved={en.script_approved}
            xiEnabled={xiEnabled}
            grokEnabled={grokEnabled}
            busy={act.busy}
            genZh={genZh}
            openCursor={() => setPasting(true)}
            review={review}
            resetZh={resetZh}
          />
        </section>
      </div>
      {pasting && (
        <CursorGrokModal
          title={`Chinese via Grok in Cursor: ${proposal.title}`}
          promptPath={`${base}/zh-grok-prompt`}
          pastePath={`${base}/zh-grok-paste`}
          submitLabel="Save text and generate Chinese audio"
          onClose={() => setPasting(false)}
          onDone={() => {
            toast("Chinese card text saved and audio generated.");
            setPasting(false);
            void reload();
          }}
        />
      )}
    </article>
  );
}

function ChineseSide({
  zh,
  enReady,
  scriptApproved,
  xiEnabled,
  grokEnabled,
  busy,
  genZh,
  openCursor,
  review,
  resetZh,
}: {
  zh: AudioSide | null;
  enReady: boolean;
  scriptApproved: boolean;
  xiEnabled: boolean;
  grokEnabled: boolean;
  busy: string | null;
  genZh: (m: "dubbing" | "tts_translated") => Promise<void>;
  openCursor: () => void;
  review: (r: boolean) => Promise<void>;
  resetZh: () => void;
}) {
  const status = zh?.status ?? "draft";
  const canStart = enReady && xiEnabled && status !== "pending" && status !== "ready";
  return (
    <>
      {!enReady && <p className="subtle small">Generate the English audio first — the Chinese version is dubbed from it.</p>}
      {status !== "ready" && (
        <div className="adm-actions left">
          <button className="btn sm primary" disabled={!canStart || !!busy} onClick={() => void genZh("dubbing")}>
            {busy === "gen-zh:dubbing" || status === "pending" ? <Spinner /> : <Icon name="globe" size={14} />} Dub to Chinese (ElevenLabs Dubbing)
          </button>
          {grokEnabled && (
            <button className="btn sm" disabled={!canStart || !!busy} onClick={() => void genZh("tts_translated")} title="Translate the approved English script with Grok, then read it with an ElevenLabs voice">
              {busy === "gen-zh:tts_translated" && <Spinner />} Fallback: Grok translation + ElevenLabs voice
            </button>
          )}
          <button
            className="btn sm"
            disabled={!scriptApproved || !xiEnabled || status === "pending" || !!busy}
            onClick={openCursor}
            title="Translate with Grok in Cursor chat, paste the reply, then read it with an ElevenLabs voice"
          >
            <Icon name="sparkle" size={14} /> Grok via Cursor + ElevenLabs voice
          </button>
        </div>
      )}
      {status === "pending" && (
        <p className="subtle small adm-row-ic">
          <Spinner /> Working… this page refreshes every 5 seconds.
        </p>
      )}
      {zh?.error && <div className="banner red adm-mt-sm">{zh.error}</div>}
      {zh?.method && <div className="subtle xs adm-mt-sm">Method: {METHOD_LABEL[zh.method] ?? zh.method}</div>}
      {zh?.url && (
        <div className="adm-player">
          <audio controls preload="none" src={zh.url} />
        </div>
      )}
      {zh?.script && (
        <div className="adm-transcript">
          <div className="label">Chinese transcript</div>
          <p lang="zh">{zh.script}</p>
        </div>
      )}
      {zh && zh.status !== "draft" && (
        <div className="adm-actions left adm-mt-sm">
          {zh.status === "ready" && zh.translation_review !== "not_applicable" && (
            <label className="adm-switch">
              <input type="checkbox" checked={zh.translation_review === "reviewed"} disabled={!!busy} onChange={(e) => void review(e.target.checked)} />
              <span className="track" />
              <span className="small">Mark translation reviewed</span>
            </label>
          )}
          <button className="btn sm ghost danger" disabled={!!busy} onClick={resetZh}>
            <Icon name="refresh" size={14} /> Reset Chinese
          </button>
        </div>
      )}
    </>
  );
}
