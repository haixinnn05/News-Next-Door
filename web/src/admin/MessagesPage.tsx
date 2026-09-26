import { Fragment, useState } from "react";
import { adminJson, adminRequest } from "../lib/api";
import { fmtDateTimeShort, fmtRelative } from "../lib/format";
import { useRouter } from "../lib/router";
import { Icon } from "../components/Icon";
import { SubscribersTable } from "./SubscribersPage";
import type { DeliveryLogRow, MessageGroup, Subscriber } from "./types";
import { Empty, ErrorBanner, MessagePill, Modal, PageHead, SkeletonRows, Spinner, truncate, useAction, useAdmin, useInterval, useLoad } from "./ui";

type Tab = "outbox" | "log" | "subscribers";
const TABS: [Tab, string][] = [
  ["outbox", "Outbox"],
  ["log", "Delivery log"],
  ["subscribers", "Subscribers"],
];

export function MessagesPage() {
  const { path, search, navigate } = useRouter();
  const q = new URLSearchParams(search).get("tab");
  const tab: Tab = q === "log" || q === "subscribers" ? q : "outbox";
  const setTab = (t: Tab) => navigate(t === "outbox" ? path : `${path}?tab=${t}`, { replace: true });
  const [composing, setComposing] = useState(false);

  return (
    <div className="adm-page">
      <PageHead
        title="Message delivery"
        subtitle="Test and monitor notifications to subscribers."
        right={
          <button className="btn adm-dark" onClick={() => setComposing(true)}>
            <Icon name="plus" size={15} /> New message
          </button>
        }
      />
      <div className="tabs adm-tabs" role="tablist">
        {TABS.map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : undefined} onClick={() => setTab(t)}>
            {l}
          </button>
        ))}
      </div>
      {tab === "outbox" && <Outbox />}
      {tab === "log" && <DeliveryLog />}
      {tab === "subscribers" && <SubscribersTable />}
      {composing && <NewMessageModal onClose={() => setComposing(false)} />}
    </div>
  );
}

// ---------------------------------------------------------------- outbox
function Outbox() {
  const { toast } = useAdmin();
  const list = useLoad(() => adminRequest<MessageGroup[]>("/messages"));
  const act = useAction();
  const [open, setOpen] = useState<string | null>(null);
  useInterval(() => void list.reload(), act.busy ? null : 5000);

  const call = async (g: MessageGroup, key: string, path: string, body: object, msg: string) => {
    const r = await act.run(`${g.key}:${key}`, () => adminJson("POST", path, { ids: g.ids, ...body }));
    if (r) toast(msg);
    await list.reload();
  };
  const n = (g: MessageGroup) => `${g.recipients} message${g.recipients === 1 ? "" : "s"}`;

  const actions = (g: MessageGroup) => {
    const b = (key: string, label: string, path: string, body: object, msg: string, cls = "btn sm") => (
      <button
        key={key}
        className={cls}
        disabled={!!act.busy}
        onClick={(e) => {
          e.stopPropagation();
          if (key === "discard" || key === "cancel") {
            if (!confirm(`${label} ${n(g)}? ${key === "cancel" ? "It will not be sent." : "The draft will not be sent."}`)) return;
          }
          void call(g, key, path, body, msg);
        }}
      >
        {act.busy === `${g.key}:${key}` && <Spinner />}
        {label}
      </button>
    );
    switch (g.state) {
      case "draft":
        return [b("send", "Send", "/messages/send", {}, `Sending ${n(g)}.`, "btn sm primary"), b("discard", "Discard", "/messages/cancel", {}, "Discarded.", "btn sm ghost")];
      case "scheduled":
        return [b("cancel", "Cancel", "/messages/cancel", {}, "Cancelled.", "btn sm ghost")];
      case "uncertain":
        return [
          b("recv", "Mark received", "/messages/resolve", { received: true }, "Marked as received."),
          b("resend", "Not received — resend", "/messages/resolve", { received: false }, "Re-sending."),
        ];
      case "failed":
        return [b("retry", "Retry", "/messages/resolve", { received: false }, "Retrying.")];
      default:
        return [];
    }
  };

  const uncertain = list.data?.filter((g) => g.state === "uncertain").length ?? 0;
  const drafts = list.data?.filter((g) => g.state === "draft").length ?? 0;

  return (
    <>
      {uncertain > 0 && (
        <div className="banner amber adm-mb">
          <Icon name="alert" size={16} />
          <div>
            <strong>{uncertain} message group(s) have an uncertain delivery.</strong> The send may or may not have reached the phone. Check the recipient’s device, then mark it received or
            resend, so nobody gets a duplicate.
          </div>
        </div>
      )}
      {drafts > 0 && (
        <div className="banner info adm-mb">
          <Icon name="info" size={16} />
          <div>
            {drafts} update draft(s) are waiting for review. Expand a row to read the exact text, then Send or Discard.
          </div>
        </div>
      )}
      <ErrorBanner error={act.error} />
      <ErrorBanner error={list.error} onRetry={list.reload} />
      {!list.data && list.loading ? (
        <SkeletonRows n={5} />
      ) : list.data && list.data.length === 0 ? (
        <Empty icon="send" title="Outbox is empty">
          Reminders appear here once residents follow a proposal with upcoming dates.
        </Empty>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table hover">
            <thead>
              <tr>
                <th style={{ width: "38%" }}>Message</th>
                <th>Audience</th>
                <th>Scheduled time</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {list.data?.map((g) => {
                const isOpen = open === g.key;
                return (
                  <Fragment key={g.key}>
                    <tr className={`clickable${isOpen ? " open" : ""}`} onClick={() => setOpen(isOpen ? null : g.key)} aria-expanded={isOpen}>
                      <td>
                        <div className="adm-msg-cell">
                          <Icon name={isOpen ? "chevronDown" : "chevronRight"} size={14} className="adm-caret" />
                          <div>
                            <div className="adm-cell-title">
                              {g.label} {g.is_demo && <span className="chip demo">DEMO</span>}
                            </div>
                            <div className="subtle xs">{g.proposal_title ?? (g.kind === "test" ? "Test message" : "—")}</div>
                          </div>
                        </div>
                      </td>
                      <td className="small">
                        <span className="muted">{g.proposal_title ? truncate(g.proposal_title, 34) : "Direct"}</span>{" "}
                        <span className="subtle nowrap">
                          ({g.recipients} subscriber{g.recipients === 1 ? "" : "s"})
                        </span>
                      </td>
                      <td className="small nowrap">
                        {g.state === "draft" ? (
                          <span className="subtle">—</span>
                        ) : (
                          <span title={fmtRelative(g.due_at)}>{fmtDateTimeShort(g.due_at)}</span>
                        )}
                      </td>
                      <td>
                        <div className="adm-status-cell">
                          <MessagePill state={g.state} />
                          <div className="adm-actions">{actions(g)}</div>
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="adm-expand">
                        <td colSpan={4}>
                          <div className="adm-expand-body">
                            <div className="adm-bubble">{g.body}</div>
                            <div className="adm-expand-meta">
                              <div>
                                <span className="subtle xs">Kind</span>
                                <div className="small">{g.kind}</div>
                              </div>
                              <div>
                                <span className="subtle xs">Due</span>
                                <div className="small">
                                  {fmtDateTimeShort(g.due_at)} ({fmtRelative(g.due_at)})
                                </div>
                              </div>
                              {g.last_error && (
                                <div>
                                  <span className="subtle xs">Last error / note</span>
                                  <div className="small adm-err-text">{g.last_error}</div>
                                </div>
                              )}
                              <div>
                                <span className="subtle xs">Notification IDs</span>
                                <div className="xs adm-mono">{g.ids.join(", ")}</div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
          <p className="subtle xs adm-table-note">
            <Icon name="refresh" size={12} style={{ display: "inline", verticalAlign: "-2px" }} /> Refreshes every 5 seconds. Messages for the same reminder or update are grouped.
          </p>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- delivery log
const OUTCOME: Record<string, string> = { sent: "green", received: "blue", failed: "red" };

function DeliveryLog() {
  const log = useLoad(() => adminRequest<DeliveryLogRow[]>("/delivery-log"));
  const [open, setOpen] = useState<Set<number>>(new Set());
  useInterval(() => void log.reload(), 5000);
  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <>
      <ErrorBanner error={log.error} onRetry={log.reload} />
      {!log.data && log.loading ? (
        <SkeletonRows n={6} />
      ) : log.data && log.data.length === 0 ? (
        <Empty icon="list" title="No deliveries yet">
          Every inbound and outbound message is recorded here.
        </Empty>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Direction</th>
                <th>Transport</th>
                <th>Handle</th>
                <th style={{ width: "42%" }}>Text</th>
                <th>Outcome</th>
              </tr>
            </thead>
            <tbody>
              {log.data?.map((r) => {
                const long = r.text.length > 110 || r.text.includes("\n");
                const isOpen = open.has(r.id);
                return (
                  <tr key={r.id}>
                    <td className="small nowrap" title={fmtRelative(r.at)}>
                      {fmtDateTimeShort(r.at)}
                    </td>
                    <td className="small nowrap">
                      <span className={`adm-dir ${r.direction}`}>
                        <Icon name={r.direction === "inbound" ? "arrowLeft" : "arrowRight"} size={13} />
                        {r.direction === "inbound" ? "Inbound" : "Outbound"}
                      </span>
                    </td>
                    <td>
                      <span className={`pill ${r.transport === "photon" ? "blue" : "grey"}`}>{r.transport === "photon" ? "Photon" : "Simulator"}</span>
                    </td>
                    <td className="small adm-mono nowrap">{r.handle ?? <span className="subtle">—</span>}</td>
                    <td className="small">
                      <div className={isOpen ? "adm-prewrap" : undefined}>{isOpen || !long ? r.text : truncate(r.text.replace(/\s+/g, " "), 110)}</div>
                      {long && (
                        <button className="adm-textbtn" onClick={() => toggle(r.id)}>
                          {isOpen ? "Show less" : "Show all"}
                        </button>
                      )}
                    </td>
                    <td>
                      <span className={`pill ${OUTCOME[r.outcome] ?? "grey"}`}>{r.outcome}</span>
                      {r.detail && <div className="subtle xs adm-detail">{r.detail}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------- new message
function NewMessageModal({ onClose }: { onClose: () => void }) {
  const { toast } = useAdmin();
  const subs = useLoad(() => adminRequest<Subscriber[]>("/subscribers"));
  const act = useAction();
  const active = subs.data?.filter((s) => s.active) ?? [];
  const [subscriberId, setSubscriberId] = useState("");
  const [text, setText] = useState("");
  const chosen = subscriberId || active[0]?.id || "";

  const send = async () => {
    const r = await act.run("send", () => adminJson("POST", "/messages/test", { subscriber_id: chosen, text }));
    if (r) {
      toast("Test message queued.");
      onClose();
    }
  };

  return (
    <Modal title="Send a test message" onClose={onClose}>
      <p className="muted small" style={{ marginTop: 0 }}>
        Sends a one-off message to a subscriber who has opted in. It is prefixed with <strong>[TEST]</strong> and recorded in the delivery log.
      </p>
      <ErrorBanner error={subs.error} onRetry={subs.reload} />
      {subs.data && active.length === 0 ? (
        <div className="banner amber">
          <Icon name="info" size={16} />
          <div>No active subscribers yet. Residents opt in by texting a follow code (use the simulated phone at /phone during development).</div>
        </div>
      ) : (
        <div className="adm-form">
          <div className="field">
            <label htmlFor="nm-sub">Recipient</label>
            <select id="nm-sub" className="select" value={chosen} onChange={(e) => setSubscriberId(e.target.value)} disabled={!subs.data}>
              {!subs.data && <option>Loading…</option>}
              {active.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.handle} · {s.transport} · {s.preferred_language === "zh" ? "中文" : "English"}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="nm-text">Message</label>
            <textarea id="nm-text" className="textarea" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder="Hello from the News Next Door team — this is a delivery test." />
            <span className="subtle xs">{text.length} characters</span>
          </div>
          <ErrorBanner error={act.error} />
          <div className="adm-actions">
            <button className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={!chosen || !text.trim() || !!act.busy} onClick={() => void send()}>
              {act.busy ? <Spinner /> : <Icon name="send" size={14} />} Send test
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}
