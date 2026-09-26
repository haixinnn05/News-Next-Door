import { useState } from "react";
import { adminJson, adminRequest, api } from "../lib/api";
import { Icon } from "../components/Icon";
import { CursorGrokModal } from "./CursorGrok";
import type { AdminApplications, AppVersion } from "./types";
import { Empty, ErrorBanner, PageHead, SkeletonRows, Spinner, useAction, useAdmin, useLoad } from "./ui";

const VERSION_PILL: Record<AppVersion["status"], [string, string]> = {
  none: ["grey", "City wording"],
  pending: ["blue", "Grok writing"],
  ready: ["green", "Checked"],
  flagged: ["amber", "Flagged"],
  failed: ["red", "Failed"],
};

/**
 * Grok rewrites each live city application as Simple English and Chinese; ElevenLabs reads it.
 * A version is only used when every number, address and date matches the city's record.
 */
export function PlainLanguagePage() {
  const { toast } = useAdmin();
  const boards = useLoad(() => api.boards());
  const [boardId, setBoardId] = useState<string | null>(null);
  const board = boardId ?? boards.data?.default_id ?? null;
  const list = useLoad(() => (board ? adminRequest<AdminApplications>(`/applications?board=${encodeURIComponent(board)}`) : Promise.resolve(null)), [board]);
  const act = useAction();
  const [pasteFor, setPasteFor] = useState<{ id: string; name: string } | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const generate = async (id: string) => {
    const v = await act.run(`gen:${id}`, () => adminJson<AppVersion>("POST", `/applications/${encodeURIComponent(id)}/version-generate`));
    if (v) toast(v.status === "ready" ? "Grok's version passed the checks." : "Grok's version was flagged. Residents keep hearing the city's wording.");
    void list.reload();
  };
  const remove = async (id: string) => {
    if (!confirm("Stop using this version? Residents will hear the city's own wording again.")) return;
    await act.run(`rm:${id}`, () => adminJson("DELETE", `/applications/${encodeURIComponent(id)}/version`));
    void list.reload();
  };

  return (
    <div className="adm-page">
      <PageHead
        title="Plain language"
        subtitle="Grok rewrites each live city application as Simple English and Chinese, and ElevenLabs reads it aloud. A version goes live only if every number, address and date matches the city's record."
        right={
          boards.data && (
            <select className="select" style={{ width: 200 }} value={board ?? ""} onChange={(e) => setBoardId(e.target.value)} aria-label="Community board">
              {boards.data.boards.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          )
        }
      />
      {list.data && !list.data.grok_api && (
        <div className="banner amber adm-mb">
          <Icon name="info" size={16} />
          <div>
            <strong>The Grok API isn't available</strong> (no xAI credit), so use <strong>Grok via Cursor</strong>: copy the prompt into Cursor chat with a Grok model, then paste the reply. Once
            the API works, versions are written automatically the first time someone opens an application.
          </div>
        </div>
      )}
      <ErrorBanner error={list.error ?? act.error} onRetry={list.error ? list.reload : undefined} />
      {!list.data && list.loading ? (
        <SkeletonRows n={5} />
      ) : list.data && list.data.applications.length === 0 ? (
        <Empty icon="list" title="No live applications">
          The city lists no active applications for this board right now.
        </Empty>
      ) : (
        list.data && (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Application</th>
                  <th>Version</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.data.applications.map((a) => {
                  const v = a.version;
                  const [color, label] = VERSION_PILL[v.status];
                  const shown = open === a.id;
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="adm-cell-title">{a.name}</div>
                        <div className="subtle xs">
                          {a.id} · {a.public_status} · {a.location}
                        </div>
                        {shown && (v.simple_en || v.issues.length > 0 || v.error) && (
                          <div className="adm-mt-sm small" style={{ maxWidth: 640 }}>
                            {v.issues.map((i) => (
                              <div key={i} className="banner amber adm-mb-sm">
                                {i}
                              </div>
                            ))}
                            {v.error && <div className="banner red adm-mb-sm">{v.error}</div>}
                            {v.simple_en && (
                              <p>
                                <strong>Simple English</strong>
                                <br />
                                {v.simple_en}
                              </p>
                            )}
                            {v.zh && (
                              <p lang="zh">
                                <strong>中文</strong>
                                <br />
                                {v.zh}
                              </p>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="nowrap">
                        <span className={`pill ${color}`}>{label}</span>
                        {v.source && <div className="subtle xs">{v.source === "grok_cursor" ? "Grok in Cursor" : v.model ?? "Grok API"}</div>}
                      </td>
                      <td className="right">
                        <div className="adm-actions">
                          {(v.simple_en || v.issues.length > 0 || v.error) && (
                            <button className="btn sm ghost" onClick={() => setOpen(shown ? null : a.id)}>
                              {shown ? "Hide" : "Show"}
                            </button>
                          )}
                          <button className="btn sm" onClick={() => setPasteFor(a)} disabled={!!act.busy}>
                            <Icon name="sparkle" size={14} /> Grok via Cursor
                          </button>
                          {list.data!.grok_api && (
                            <button className="btn sm" onClick={() => void generate(a.id)} disabled={!!act.busy}>
                              {act.busy === `gen:${a.id}` ? <Spinner /> : <Icon name="refresh" size={14} />} Grok API
                            </button>
                          )}
                          {v.status !== "none" && v.status !== "pending" && (
                            <button className="btn sm ghost danger" onClick={() => void remove(a.id)} disabled={!!act.busy}>
                              Use city wording
                            </button>
                          )}
                          <a className="btn sm ghost" href={`/a/${encodeURIComponent(a.id)}`} target="_blank" rel="noreferrer">
                            <Icon name="external" size={14} /> Page
                          </a>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      )}
      {pasteFor && (
        <CursorGrokModal
          title={`Grok via Cursor: ${pasteFor.name}`}
          promptPath={`/applications/${encodeURIComponent(pasteFor.id)}/version-prompt`}
          pastePath={`/applications/${encodeURIComponent(pasteFor.id)}/version-paste`}
          submitLabel="Check and save"
          askModel
          onClose={() => setPasteFor(null)}
          onDone={(r) => {
            const v = r as AppVersion;
            toast(v.status === "ready" ? "Checked and saved. ElevenLabs is recording the English audio now; Chinese is recorded the first time a Chinese-language visitor opens the page." : "Saved, but flagged: something doesn't match the city's record. Residents keep hearing the city's wording.");
            setPasteFor(null);
            setOpen(pasteFor.id);
            void list.reload();
          }}
        />
      )}
    </div>
  );
}
