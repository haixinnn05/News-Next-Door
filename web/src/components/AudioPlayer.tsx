import { useEffect, useMemo, useRef, useState } from "react";
import { fmtDuration } from "../lib/format";
import { Icon } from "./Icon";

const BARS = 72;

/** Compute a real waveform from the audio file (falls back to a neutral shape while loading). */
function useWaveform(url: string | null) {
  const [peaks, setPeaks] = useState<number[] | null>(null);
  useEffect(() => {
    setPeaks(null);
    if (!url) return;
    let alive = true;
    (async () => {
      try {
        const buf = await (await fetch(url)).arrayBuffer();
        const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new Ctx();
        const audio = await ctx.decodeAudioData(buf);
        const data = audio.getChannelData(0);
        const step = Math.floor(data.length / BARS);
        const out: number[] = [];
        for (let i = 0; i < BARS; i++) {
          let sum = 0;
          for (let j = 0; j < step; j += 16) sum += Math.abs(data[i * step + j] ?? 0);
          out.push(sum / (step / 16));
        }
        const max = Math.max(...out, 0.0001);
        if (alive) setPeaks(out.map((v) => 0.12 + 0.88 * (v / max)));
        ctx.close();
      } catch {
        /* keep placeholder */
      }
    })();
    return () => {
      alive = false;
    };
  }, [url]);
  return peaks;
}

export function AudioPlayer({ url, label, disabled }: { url: string | null; label: string; disabled?: boolean }) {
  const ref = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [dur, setDur] = useState(0);
  const [rate, setRate] = useState(1);
  const [muted, setMuted] = useState(false);
  const peaks = useWaveform(url);
  const placeholder = useMemo(() => Array.from({ length: BARS }, (_, i) => 0.25 + 0.55 * Math.abs(Math.sin(i * 0.7) * Math.cos(i * 0.23))), []);
  const bars = peaks ?? placeholder;

  useEffect(() => {
    setPlaying(false);
    setTime(0);
    setDur(0);
  }, [url]);
  useEffect(() => {
    if (ref.current) ref.current.playbackRate = rate;
  }, [rate]);

  const toggle = () => {
    const a = ref.current;
    if (!a || !url) return;
    if (a.paused) a.play().catch(() => {});
    else a.pause();
  };
  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = ref.current;
    if (!a || !dur) return;
    const r = e.currentTarget.getBoundingClientRect();
    a.currentTime = ((e.clientX - r.left) / r.width) * dur;
  };
  const progress = dur ? time / dur : 0;
  const off = disabled || !url;

  return (
    <div className="player" aria-label={label}>
      {url && (
        <audio
          ref={ref}
          src={url}
          preload="metadata"
          muted={muted}
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onEnded={() => setPlaying(false)}
          onTimeUpdate={(e) => setTime(e.currentTarget.currentTime)}
          onLoadedMetadata={(e) => setDur(e.currentTarget.duration)}
          onDurationChange={(e) => setDur(e.currentTarget.duration)}
        />
      )}
      <button className="play" onClick={toggle} disabled={off} aria-label={playing ? "Pause" : `Play ${label}`}>
        <Icon name={playing ? "pause" : "play"} size={20} />
      </button>
      <div
        className="wave"
        onClick={seek}
        role="slider"
        tabIndex={off ? -1 : 0}
        aria-label="Seek"
        aria-valuemin={0}
        aria-valuemax={Math.round(dur)}
        aria-valuenow={Math.round(time)}
        onKeyDown={(e) => {
          const a = ref.current;
          if (!a) return;
          if (e.key === "ArrowRight") a.currentTime = Math.min(dur, a.currentTime + 5);
          if (e.key === "ArrowLeft") a.currentTime = Math.max(0, a.currentTime - 5);
        }}
        style={{ opacity: off ? 0.45 : 1 }}
      >
        {bars.map((h, i) => (
          <span key={i} className={i / bars.length < progress ? "done" : ""} style={{ height: `${Math.round(h * 100)}%` }} />
        ))}
      </div>
      <div className="time">
        {fmtDuration(time)} / {fmtDuration(dur)}
      </div>
      <button className="speed" onClick={() => setRate((r) => (r === 1 ? 1.25 : r === 1.25 ? 1.5 : r === 1.5 ? 0.75 : 1))} disabled={off} aria-label="Playback speed">
        {rate}x
      </button>
      <button className="icon-btn vol" onClick={() => setMuted((m) => !m)} disabled={off} aria-label={muted ? "Unmute" : "Mute"} style={{ border: 0, background: "transparent" }}>
        <Icon name={muted ? "mute" : "volume"} size={19} />
      </button>
    </div>
  );
}
