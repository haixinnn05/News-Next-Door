import { useEffect, useRef, useState, type FormEvent } from "react";
import { Icon } from "../components/Icon";
import { api } from "../lib/api";
import { useLang } from "../lib/i18n";
import { useMeta } from "../lib/meta";
import { useQuery } from "../lib/router";

const HANDLE_KEY = "btv-sim-handle";

function linkify(text: string) {
  return text.split(/(https?:\/\/\S+)/g).map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target="_blank" rel="noreferrer">
        {part}
      </a>
    ) : (
      part
    ),
  );
}

/** SIMULATED phone for demos without Photon credentials. Messages go through the same backend handler. */
export function Phone() {
  const { lang } = useLang();
  const meta = useMeta();
  const q = useQuery();
  const [handle, setHandle] = useState(() => localStorage.getItem(HANDLE_KEY) ?? "+1 (555) 010-2026");
  const [text, setText] = useState(q.get("code") ?? "");
  const [thread, setThread] = useState<{ id: number; direction: string; text: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem(HANDLE_KEY, handle);
    let alive = true;
    const load = () => api.simThread(handle).then((t) => alive && setThread(t)).catch(() => {});
    load();
    const iv = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [handle]);
  useEffect(() => end.current?.scrollIntoView({ behavior: "smooth" }), [thread.length]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try {
      await api.simSend(handle, text.trim());
      setText("");
      setThread(await api.simThread(handle));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="container page">
      <div className="phone-page">
        <div className="prose">
          <span className="chip demo">SIMULATED</span>
          <h1>{lang === "zh" ? "模拟手机" : "Simulated phone"}</h1>
          <p>
            {lang === "zh"
              ? "当未配置 Photon iMessage 凭据时，此页面模拟居民的手机。消息经过与真实 iMessage 相同的后台处理：关注代码、确认、提醒和 STOP。"
              : "When Photon iMessage credentials aren't configured, this page stands in for a resident's phone. Messages go through exactly the same backend handler as real iMessage: follow codes, confirmations, reminders, and STOP."}
          </p>
          {meta?.messaging.mode === "photon" && (
            <div className="banner green">
              <Icon name="check" size={16} />
              {lang === "zh" ? "Photon 已连接——请用真实手机发送代码。" : "Photon is connected — text the code from a real phone instead."}
            </div>
          )}
          <div className="field" style={{ maxWidth: 320, marginTop: 20 }}>
            <label htmlFor="sim-handle">{lang === "zh" ? "模拟号码" : "Simulated number"}</label>
            <input id="sim-handle" className="input" value={handle} onChange={(e) => setHandle(e.target.value)} />
          </div>
          <h2>{lang === "zh" ? "试试看" : "Try it"}</h2>
          <ol>
            <li>{lang === "zh" ? "在提案页面点击“关注”，获取代码（如 QCB2-1234）。" : "Tap Follow on a proposal to get a code (like QCB2-1234)."}</li>
            <li>{lang === "zh" ? "在此发送代码，确认信息会出现在对话中。" : "Send the code here. The confirmation appears in the thread and the proposal page updates to “Following”."}</li>
            <li>{lang === "zh" ? "发送 STOP 以取消订阅并取消所有排队的提醒。" : "Send STOP to unsubscribe and cancel every queued reminder."}</li>
          </ol>
        </div>
        <div className="phone" aria-label="Simulated iMessage conversation">
          <div className="screen">
            <div className="bar">
              <div className="avatar">BV</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>Before the Vote</div>
              <div style={{ fontSize: 10.5, color: "#8e8e93" }}>iMessage · SIMULATED</div>
            </div>
            <div className="msgs">
              {thread.length === 0 && <div style={{ textAlign: "center", color: "#8e8e93", fontSize: 12, marginTop: 30 }}>{lang === "zh" ? "暂无消息" : "No messages yet"}</div>}
              {thread.map((m) => (
                <div key={m.id} className={`bubble ${m.direction === "from_phone" ? "me" : "them"}`}>
                  {linkify(m.text)}
                </div>
              ))}
              <div ref={end} />
            </div>
            <form className="compose" onSubmit={send}>
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder="iMessage" aria-label="Message" />
              <button type="submit" disabled={busy || !text.trim()} aria-label="Send">
                <Icon name="arrowRight" size={16} stroke={2.4} style={{ transform: "rotate(-90deg)" }} />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
