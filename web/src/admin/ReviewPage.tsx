import { useEffect, useMemo, useState, type ReactNode } from "react";
import { adminJson, adminRequest } from "../lib/api";
import { eventTypeLabel, fmtDate, fmtDateTimeShort, stageLabel } from "../lib/format";
import { Link } from "../lib/router";
import { Icon } from "../components/Icon";
import { excerptFound, Highlighted } from "./highlight";
import type { DraftData, DraftEvent, DraftResponse, DraftView, Evidence, Issue, PublishResult } from "./types";
import { DraftPill, ErrorBanner, SkeletonRows, Spinner, useAction, useAdmin, useLoad } from "./ui";

const CATEGORY_LABEL: Record<string, string> = {
  land_use: "Land Use",
  transportation: "Transportation",
  parks_environment: "Parks & Environment",
  other: "Other",
};

const FIELD_LABEL: Record<string, string> = {
  title: "Title",
  location: "Location",
  stage: "Stage",
  summary: "Summary",
  purpose: "Stated purpose",
  proposed_by: "Proposed by",
  participation: "Participation instructions",
};
const fieldLabel = (f: string, events: DraftEvent[]) => {
  if (f.startsWith("event:")) {
    const e = events.find((x) => `event:${x.key}` === f);
    return e ? `Event: ${e.title || e.key}` : `Event: ${f.slice(6)}`;
  }
  return FIELD_LABEL[f] ?? f;
};

type Tab = "details" | "text" | "source";

/** Empty strings become null for nullable fields. */
const nv = (s: string): string | null => (s.trim() === "" ? null : s);

export function ReviewPage({ id }: { id: string }) {
  const res = useLoad(() => adminRequest<DraftResponse>(`/drafts/${id}`), [id]);
  const { toast } = useAdmin();
  const act = useAction();
  const [tab, setTab] = useState<Tab>("details");
  const [data, setData] = useState<DraftData | null>(null);
  const [saved, setSaved] = useState<string>("");
  const [proposalId, setProposalId] = useState("");
  const [published, setPublished] = useState<PublishResult | null>(null);

  const draft = res.data?.draft;
  // (Re)initialise the local editing copy whenever a fresh draft arrives from the server.
  useEffect(() => {
    if (!draft) return;
    setData(structuredClone(draft.data));
    setSaved(JSON.stringify(draft.data));
    setProposalId(draft.proposal_id ?? "");
  }, [draft]);

  const dirty = !!data && JSON.stringify(data) !== saved;
  useEffect(() => {
    if (!dirty) return;
    const on = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", on);
    return () => removeEventListener("beforeunload", on);
  }, [dirty]);

  if (!res.data || !draft || !data) {
    return (
      <div className="adm-page">
        <BackLink />
        <ErrorBanner error={res.error} onRetry={res.reload} />
        {!res.error && <SkeletonRows n={6} />}
      </div>
    );
  }

  const { proposals, enums } = res.data;
  const readOnly = draft.status === "published" || draft.status === "discarded";
  const issues = draft.issues;
  const errors = issues.filter((i) => i.level === "error");
  const warnings = issues.filter((i) => i.level === "warning");

  const save = async (): Promise<DraftView | undefined> => {
    const r = await act.run("save", () => adminJson<DraftView>("PUT", `/drafts/${id}`, { data, proposal_id: proposalId || null }));
    if (r) res.setData({ ...res.data!, draft: r });
    return r;
  };
  const onSave = async () => {
    const r = await save();
    if (r) toast(r.issues.some((i) => i.level === "error") ? "Saved — some issues still need fixing before publishing." : "Draft saved.");
  };
  const onPublish = async () => {
    const r = await save();
    if (!r) return;
    if (r.issues.some((i) => i.level === "error")) {
      act.setError("Saved, but this draft still has blocking issues (shown above). Fix them before publishing.");
      scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const p = await act.run("publish", () => adminJson<PublishResult>("POST", `/drafts/${id}/publish`, { proposal_id: proposalId || null }));
    if (p) {
      setPublished(p);
      toast(`Published v${p.version}.`);
      await res.reload();
      scrollTo({ top: 0, behavior: "smooth" });
    }
  };
  const onDiscard = async () => {
    if (!confirm("Discard this draft? It will not be published. You can re-extract the document later.")) return;
    const r = await act.run("discard", () => adminJson("POST", `/drafts/${id}/discard`));
    if (r) {
      toast("Draft discarded.");
      void res.reload();
    }
  };
  const onRestore = async () => {
    const r = await save();
    if (r) toast("Draft restored to Needs Review.");
  };

  const set = <K extends keyof DraftData>(k: K, v: DraftData[K]) => setData((d) => (d ? { ...d, [k]: v } : d));

  const showInText = (page: number) => {
    setTab("text");
    setTimeout(() => document.getElementById(`adm-page-${page}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  return (
    <div className="adm-page adm-review">
      <BackLink />
      <div className="adm-head">
        <div className="grow">
          <h1>Review extracted proposal</h1>
          <p>
            From <strong className="adm-ink">{draft.document.title}</strong>
            {draft.document.publication_date && ` · published ${fmtDate(draft.document.publication_date)}`} · extractor: {draft.extractor}
            {draft.model && ` (${draft.model})`}
          </p>
        </div>
        <div className="adm-head-right">
          {dirty && !readOnly && <span className="adm-unsaved">Unsaved changes</span>}
          <DraftPill status={draft.status} />
        </div>
      </div>

      {published && <PublishedCard r={published} onClose={() => setPublished(null)} />}
      {draft.status === "published" && !published && (
        <div className="banner green adm-mb">
          <Icon name="check" size={16} />
          <div className="grow">
            This draft has been published and is read-only. To change the proposal, import a newer document and publish it as an update.
          </div>
          {draft.proposal_id && (
            <a className="btn sm" href={`/p/${draft.proposal_id}`} target="_blank" rel="noreferrer">
              View public page <Icon name="external" size={13} />
            </a>
          )}
        </div>
      )}
      {draft.status === "discarded" && (
        <div className="banner info adm-mb">
          <Icon name="info" size={16} />
          <div className="grow">This draft was discarded and is read-only.</div>
          <button className="btn sm" onClick={() => void onRestore()} disabled={!!act.busy}>
            Restore for review
          </button>
        </div>
      )}
      {draft.error && (
        <div className="banner red adm-mb">
          <Icon name="alert" size={16} />
          <div>
            <strong>Extraction error:</strong> {draft.error}
          </div>
        </div>
      )}

      {!readOnly && issues.length > 0 && <IssuesPanel errors={errors} warnings={warnings} events={data.events} />}
      {!readOnly && issues.length === 0 && (
        <div className="banner green adm-mb">
          <Icon name="check" size={16} />
          <div>All checks passed — every cited excerpt was found in the source. Still read it through before publishing.</div>
        </div>
      )}

      <div className="tabs adm-tabs" role="tablist">
        {(
          [
            ["details", "Details"],
            ["text", "Extracted Text"],
            ["source", "Source Pages"],
          ] as [Tab, string][]
        ).map(([t, l]) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : undefined} onClick={() => setTab(t)}>
            {l}
            {t === "text" && <span className="adm-tab-count">{draft.pages.length}</span>}
          </button>
        ))}
      </div>

      {tab === "details" && (
        <fieldset className="adm-fieldset" disabled={readOnly}>
          <DetailsForm data={data} set={set} enums={enums} draft={draft} onShowInText={showInText} />

          <div className="adm-target card">
            <div className="field">
              <label htmlFor="rv-target">
                Update existing proposal <span className="subtle adm-optional">(optional)</span>
              </label>
              <select id="rv-target" className="select" value={proposalId} onChange={(e) => setProposalId(e.target.value)}>
                <option value="">— Publish as a new proposal —</option>
                {proposals.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <span className="subtle xs">
                Choose a proposal when this newer document updates it (for example a rescheduled hearing). Subscribers get an update message draft for material changes.
              </span>
            </div>
          </div>
        </fieldset>
      )}

      {tab === "text" && <ExtractedText draft={draft} evidence={data.evidence} />}
      {tab === "source" && <SourcePages draft={draft} />}

      <ErrorBanner error={act.error} />

      {!readOnly && (
        <div className="adm-footer-bar">
          <span className="subtle small grow">
            {errors.length > 0 ? `${errors.length} blocking issue${errors.length === 1 ? "" : "s"} — publishing is disabled until fixed and saved.` : dirty ? "You have unsaved edits." : "Saved."}
          </span>
          <button className="btn ghost danger" onClick={() => void onDiscard()} disabled={!!act.busy}>
            {act.busy === "discard" ? <Spinner /> : null} Discard
          </button>
          <button className="btn" onClick={() => void onSave()} disabled={!!act.busy}>
            {act.busy === "save" ? <Spinner /> : null} Save Draft
          </button>
          <button className="btn primary" onClick={() => void onPublish()} disabled={!!act.busy || (errors.length > 0 && !dirty)} title={errors.length > 0 && !dirty ? "Resolve the flagged errors first" : undefined}>
            {act.busy === "publish" ? <Spinner /> : <Icon name="check" size={15} />} Publish
          </button>
        </div>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/admin/review" className="back-link adm-back">
      <Icon name="arrowLeft" size={15} /> Review proposals
    </Link>
  );
}

// ---------------------------------------------------------------- issues
function IssuesPanel({ errors, warnings, events }: { errors: Issue[]; warnings: Issue[]; events: DraftEvent[] }) {
  return (
    <div className="adm-issues">
      {errors.length > 0 && (
        <div className="banner red">
          <Icon name="alert" size={16} />
          <div className="grow">
            <strong>
              {errors.length} error{errors.length === 1 ? "" : "s"} must be fixed before publishing
            </strong>
            <ul>
              {errors.map((i, n) => (
                <li key={n}>
                  <span className="adm-issue-field">{fieldLabel(i.field, events)}</span> {i.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {warnings.length > 0 && (
        <div className="banner amber">
          <Icon name="info" size={16} />
          <div className="grow">
            <strong>
              {warnings.length} warning{warnings.length === 1 ? "" : "s"} to check
            </strong>
            <ul>
              {warnings.map((i, n) => (
                <li key={n}>
                  <span className="adm-issue-field">{fieldLabel(i.field, events)}</span> {i.message}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      <p className="subtle xs">Issues reflect the last saved version. Save to re-check.</p>
    </div>
  );
}

// ---------------------------------------------------------------- details form
function Cite({ field, evidence, hasValue }: { field: string; evidence: Evidence[]; hasValue: boolean }) {
  const pages = [...new Set(evidence.filter((e) => e.field === field).map((e) => e.page))].sort((a, b) => a - b);
  if (pages.length) return <span className="adm-cite ok">✓ cited p.{pages.join(", ")}</span>;
  if (!hasValue) return null;
  return <span className="adm-cite missing">no excerpt</span>;
}

function F({ label, htmlFor, cite, children, hint }: { label: string; htmlFor: string; cite?: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="field">
      <label htmlFor={htmlFor} className="adm-flabel">
        <span>{label}</span>
        {cite}
      </label>
      {children}
      {hint && <span className="subtle xs">{hint}</span>}
    </div>
  );
}

function DetailsForm({
  data,
  set,
  enums,
  draft,
  onShowInText,
}: {
  data: DraftData;
  set: <K extends keyof DraftData>(k: K, v: DraftData[K]) => void;
  enums: DraftResponse["enums"];
  draft: DraftView;
  onShowInText: (page: number) => void;
}) {
  const ev = data.evidence;
  const c = (field: string, value: unknown) => <Cite field={field} evidence={ev} hasValue={!!value} />;

  return (
    <div className="adm-details">
      <div className="adm-grid2">
        <div className="adm-col">
          <F label="Title" htmlFor="rv-title" cite={c("title", data.title)}>
            <input id="rv-title" className="input" value={data.title} onChange={(e) => set("title", e.target.value)} />
          </F>
          <F label="Category" htmlFor="rv-cat">
            <select id="rv-cat" className="select" value={data.category} onChange={(e) => set("category", e.target.value as DraftData["category"])}>
              {enums.categories.map((k) => (
                <option key={k} value={k}>
                  {CATEGORY_LABEL[k] ?? k}
                </option>
              ))}
            </select>
          </F>
          <F label="Location" htmlFor="rv-loc" cite={c("location", data.location_text)}>
            <input id="rv-loc" className="input" value={data.location_text ?? ""} placeholder="Not stated" onChange={(e) => set("location_text", nv(e.target.value))} />
          </F>
          <F label="Stage" htmlFor="rv-stage" cite={c("stage", data.stage)} hint="Stage as written in the source, plus the closest standard stage.">
            <div className="adm-pair">
              <input id="rv-stage" className="input" value={data.stage ?? ""} placeholder="As stated in the document" onChange={(e) => set("stage", nv(e.target.value))} />
              <select className="select" aria-label="Stage kind" value={data.stage_kind} onChange={(e) => set("stage_kind", e.target.value)}>
                {enums.stage_kinds.map((k) => (
                  <option key={k} value={k}>
                    {stageLabel(k)}
                  </option>
                ))}
              </select>
            </div>
          </F>
          <F label="Proposed by" htmlFor="rv-by" cite={c("proposed_by", data.proposed_by)}>
            <input id="rv-by" className="input" value={data.proposed_by ?? ""} placeholder="Not stated" onChange={(e) => set("proposed_by", nv(e.target.value))} />
          </F>
          <F label="Body / meeting name" htmlFor="rv-body">
            <input id="rv-body" className="input" value={data.body_name ?? ""} placeholder="e.g. Land Use and Housing Committee" onChange={(e) => set("body_name", nv(e.target.value))} />
          </F>
          <F label="Participation instructions" htmlFor="rv-part" cite={c("participation", data.participation)}>
            <textarea id="rv-part" className="textarea" rows={4} value={data.participation ?? ""} placeholder="How residents can attend, comment or testify — only if stated" onChange={(e) => set("participation", nv(e.target.value))} />
          </F>
        </div>
        <div className="adm-col">
          <F label="Summary" htmlFor="rv-sum" cite={c("summary", data.summary)} hint="2–3 plain-language sentences, based only on the document.">
            <textarea id="rv-sum" className="textarea" rows={7} value={data.summary} onChange={(e) => set("summary", e.target.value)} />
          </F>
          <F label="Stated purpose" htmlFor="rv-purpose" cite={c("purpose", data.purpose)}>
            <textarea id="rv-purpose" className="textarea" rows={6} value={data.purpose ?? ""} placeholder="Not stated" onChange={(e) => set("purpose", nv(e.target.value))} />
          </F>
        </div>
      </div>

      <EventsEditor data={data} set={set} eventTypes={enums.event_types} />
      <EvidenceEditor data={data} set={set} draft={draft} onShowInText={onShowInText} />
    </div>
  );
}

// ---------------------------------------------------------------- events
function EventsEditor({ data, set, eventTypes }: { data: DraftData; set: <K extends keyof DraftData>(k: K, v: DraftData[K]) => void; eventTypes: string[] }) {
  const events = data.events;
  const update = (i: number, patch: Partial<DraftEvent>) => {
    const old = events[i];
    const next = events.map((e, n) => (n === i ? { ...e, ...patch } : e));
    set("events", next);
    // keep evidence attached when an event key is renamed
    if (patch.key !== undefined && patch.key !== old.key) {
      set(
        "evidence",
        data.evidence.map((x) => (x.field === `event:${old.key}` ? { ...x, field: `event:${patch.key}` } : x)),
      );
    }
  };
  const add = () => {
    let n = events.length + 1;
    while (events.some((e) => e.key === `event_${n}`)) n++;
    set("events", [
      ...events,
      { key: `event_${n}`, type: "public_hearing", title: "", description: null, date: null, time: null, location: null, meeting_url: null, comment_deadline: null, instructions: null, cancelled: false },
    ]);
  };
  const remove = (i: number) => {
    if (!confirm(`Remove “${events[i].title || events[i].key}”?`)) return;
    set(
      "events",
      events.filter((_, n) => n !== i),
    );
  };

  return (
    <section className="adm-subsection">
      <div className="adm-section-head">
        <div>
          <h2>Events (date, time, place)</h2>
          <p className="subtle small">Only dates and times stated for this specific event. The document’s own publication date is not an event date.</p>
        </div>
        <button type="button" className="btn sm" onClick={add}>
          <Icon name="plus" size={14} /> Add event
        </button>
      </div>
      {events.length === 0 && <div className="adm-empty-inline">No events. Add one if the document lists a meeting, hearing or deadline for this proposal.</div>}
      <div className="adm-events">
        {events.map((e, i) => {
          const id = `rv-ev-${i}`;
          return (
            <div key={i} className={`adm-event card${e.cancelled ? " cancelled" : ""}`}>
              <div className="adm-event-head">
                <span className="adm-event-n">{i + 1}</span>
                <strong className="grow">{e.title || <span className="subtle">Untitled event</span>}</strong>
                {e.is_demo && <span className="chip demo">DEMO</span>}
                <Cite field={`event:${e.key}`} evidence={data.evidence} hasValue={!!(e.date || e.time || e.location || e.instructions)} />
                <button type="button" className="btn sm ghost danger" onClick={() => remove(i)} aria-label="Remove event">
                  <Icon name="x" size={14} />
                </button>
              </div>
              <div className="adm-event-grid">
                <F label="Type" htmlFor={`${id}-type`}>
                  <select id={`${id}-type`} className="select" value={e.type} onChange={(x) => update(i, { type: x.target.value })}>
                    {eventTypes.map((t) => (
                      <option key={t} value={t}>
                        {eventTypeLabel(t)}
                      </option>
                    ))}
                  </select>
                </F>
                <F label="Title" htmlFor={`${id}-title`}>
                  <input id={`${id}-title`} className="input" value={e.title} onChange={(x) => update(i, { title: x.target.value })} placeholder="e.g. Public hearing" />
                </F>
                <F label="Key" htmlFor={`${id}-key`}>
                  <input id={`${id}-key`} className="input adm-mono" value={e.key} onChange={(x) => update(i, { key: x.target.value.replace(/\s+/g, "_") })} />
                </F>
                <F label="Date" htmlFor={`${id}-date`}>
                  <input id={`${id}-date`} className="input" type="date" value={e.date ?? ""} onChange={(x) => update(i, { date: nv(x.target.value) })} />
                </F>
                <F label="Time (New York)" htmlFor={`${id}-time`}>
                  <input id={`${id}-time`} className="input" type="time" value={e.time ?? ""} onChange={(x) => update(i, { time: nv(x.target.value) })} />
                </F>
                <F label="Comment deadline" htmlFor={`${id}-cd`}>
                  <input id={`${id}-cd`} className="input" value={e.comment_deadline ?? ""} placeholder="If stated" onChange={(x) => update(i, { comment_deadline: nv(x.target.value) })} />
                </F>
                <F label="Location" htmlFor={`${id}-loc`}>
                  <input id={`${id}-loc`} className="input" value={e.location ?? ""} placeholder="Not stated" onChange={(x) => update(i, { location: nv(x.target.value) })} />
                </F>
                <F label="Meeting URL" htmlFor={`${id}-url`}>
                  <input id={`${id}-url`} className="input" value={e.meeting_url ?? ""} placeholder="https://…" onChange={(x) => update(i, { meeting_url: nv(x.target.value) })} />
                </F>
                <label className="adm-check">
                  <input type="checkbox" checked={e.cancelled} onChange={(x) => update(i, { cancelled: x.target.checked })} /> Cancelled
                </label>
                <div className="adm-span2">
                  <F label="Instructions" htmlFor={`${id}-ins`}>
                    <textarea id={`${id}-ins`} className="textarea" rows={2} value={e.instructions ?? ""} placeholder="How to attend or comment" onChange={(x) => update(i, { instructions: nv(x.target.value) })} />
                  </F>
                </div>
                <div className="adm-span2">
                  <F label="Description" htmlFor={`${id}-desc`}>
                    <textarea id={`${id}-desc`} className="textarea" rows={2} value={e.description ?? ""} onChange={(x) => update(i, { description: nv(x.target.value) })} />
                  </F>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- evidence
function EvidenceEditor({ data, set, draft, onShowInText }: { data: DraftData; set: <K extends keyof DraftData>(k: K, v: DraftData[K]) => void; draft: DraftView; onShowInText: (page: number) => void }) {
  const ev = data.evidence;
  const pageText = useMemo(() => new Map(draft.pages.map((p) => [p.page, p.text])), [draft.pages]);
  const fieldOptions = [...Object.keys(FIELD_LABEL), ...data.events.map((e) => `event:${e.key}`)];
  const update = (i: number, patch: Partial<Evidence>) =>
    set(
      "evidence",
      ev.map((x, n) => (n === i ? { ...x, ...patch } : x)),
    );
  const add = () => set("evidence", [...ev, { field: "title", page: 1, excerpt: "" }]);
  const remove = (i: number) =>
    set(
      "evidence",
      ev.filter((_, n) => n !== i),
    );

  return (
    <section className="adm-subsection">
      <div className="adm-section-head">
        <div>
          <h2>Evidence</h2>
          <p className="subtle small">Verbatim excerpts from the source that support each field. Excerpts are checked against the page text when you save.</p>
        </div>
        <button type="button" className="btn sm" onClick={add}>
          <Icon name="plus" size={14} /> Add excerpt
        </button>
      </div>
      {ev.length === 0 ? (
        <div className="adm-empty-inline">No evidence yet. Location, participation and event details need a supporting excerpt before publishing.</div>
      ) : (
        <div className="adm-table-wrap">
          <table className="adm-table adm-evidence">
            <thead>
              <tr>
                <th style={{ width: 210 }}>Field</th>
                <th style={{ width: 90 }}>Page</th>
                <th>Excerpt</th>
                <th style={{ width: 150 }}>Check</th>
                <th style={{ width: 44 }} />
              </tr>
            </thead>
            <tbody>
              {ev.map((x, i) => {
                const found = x.excerpt.trim() ? excerptFound(x.excerpt, pageText.get(x.page)) : null;
                const options = fieldOptions.includes(x.field) ? fieldOptions : [...fieldOptions, x.field];
                return (
                  <tr key={i}>
                    <td>
                      <select className="select" value={x.field} onChange={(e) => update(i, { field: e.target.value })} aria-label="Field">
                        {options.map((f) => (
                          <option key={f} value={f}>
                            {fieldLabel(f, data.events)}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <input
                        className="input"
                        type="number"
                        min={1}
                        max={draft.document.page_count}
                        value={x.page}
                        aria-label="Page"
                        onChange={(e) => update(i, { page: Math.max(1, Math.floor(Number(e.target.value) || 1)) })}
                      />
                    </td>
                    <td>
                      <textarea className="textarea adm-excerpt" rows={2} value={x.excerpt} aria-label="Excerpt" onChange={(e) => update(i, { excerpt: e.target.value })} placeholder="Copy the exact words from the page" />
                    </td>
                    <td>
                      {found === null ? (
                        <span className="subtle xs">—</span>
                      ) : found ? (
                        <span className="adm-cite ok">✓ found on p.{x.page}</span>
                      ) : (
                        <span className="adm-cite bad">not found on p.{x.page}</span>
                      )}
                      <button type="button" className="adm-textbtn" onClick={() => onShowInText(x.page)}>
                        View page
                      </button>
                    </td>
                    <td>
                      <button type="button" className="btn sm ghost danger" onClick={() => remove(i)} aria-label="Remove excerpt">
                        <Icon name="x" size={14} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------- extracted text / source
function ExtractedText({ draft, evidence }: { draft: DraftView; evidence: Evidence[] }) {
  const located = evidence.filter((e) => e.excerpt.trim() && excerptFound(e.excerpt, draft.pages.find((p) => p.page === e.page)?.text)).length;
  const total = evidence.filter((e) => e.excerpt.trim()).length;
  if (!draft.pages.length) return <div className="adm-empty-inline">No text was extracted from this document. It may be a scanned PDF.</div>;
  return (
    <div className="adm-pages">
      <div className="row between adm-mb-sm">
        <span className="subtle small">
          {draft.pages.length} page{draft.pages.length === 1 ? "" : "s"} · <mark className="adm-mark">highlighted</mark> text is cited as evidence
        </span>
        {total > 0 && (
          <span className={`pill ${located === total ? "green" : "amber"}`}>
            {located} of {total} excerpts located
          </span>
        )}
      </div>
      {draft.pages.map((p) => (
        <div key={p.page} id={`adm-page-${p.page}`} className="adm-pagetext">
          <div className="adm-pagetext-head">
            <span>Page {p.page}</span>
            <span className="subtle xs">{evidence.filter((e) => e.page === p.page).length} excerpt(s) cited</span>
          </div>
          <pre>
            <Highlighted text={p.text} marks={evidence.filter((e) => e.page === p.page)} />
          </pre>
        </div>
      ))}
    </div>
  );
}

function SourcePages({ draft }: { draft: DraftView }) {
  const d = draft.document;
  const isHtml = d.mime_type.includes("html");
  return (
    <div>
      <dl className="adm-meta">
        <div>
          <dt>Official URL</dt>
          <dd>
            {d.official_url ? (
              <a href={d.official_url} target="_blank" rel="noreferrer" className="link adm-break">
                {d.official_url}
              </a>
            ) : (
              <span className="subtle">—</span>
            )}
          </dd>
        </div>
        <div>
          <dt>Publication date</dt>
          <dd>{d.publication_date ? fmtDate(d.publication_date) : <span className="subtle">Not entered</span>}</dd>
        </div>
        <div>
          <dt>Retrieved</dt>
          <dd>{fmtDateTimeShort(d.retrieved_at)}</dd>
        </div>
        <div>
          <dt>Pages</dt>
          <dd>{d.page_count}</dd>
        </div>
        <div>
          <dt>Stored copy</dt>
          <dd>
            <a href={d.file_url} target="_blank" rel="noreferrer" className="link">
              Open in new tab <Icon name="external" size={12} style={{ display: "inline" }} />
            </a>
          </dd>
        </div>
      </dl>
      {/* HTML sources are untrusted: sandbox them (no scripts). PDFs need an unsandboxed frame for the browser viewer. */}
      <iframe className="adm-frame" src={d.file_url} title={`Source document: ${d.title}`} {...(isHtml ? { sandbox: "" } : {})} />
    </div>
  );
}

function PublishedCard({ r, onClose }: { r: PublishResult; onClose: () => void }) {
  return (
    <div className="card adm-result adm-mb">
      <div className="row between">
        <div className="row">
          <span className="adm-result-ic">
            <Icon name="check" size={16} />
          </span>
          <div>
            <div className="adm-cell-title">Published as version {r.version}</div>
            <div className="subtle xs">It is now visible on the public site.</div>
          </div>
        </div>
        <div className="row">
          <a className="btn sm" href={`/p/${r.proposal_id}`} target="_blank" rel="noreferrer">
            View public page <Icon name="external" size={13} />
          </a>
          <button className="icon-btn" onClick={onClose} aria-label="Dismiss">
            <Icon name="x" size={14} />
          </button>
        </div>
      </div>
      <div className="adm-result-body">
        {r.changes.length > 0 && (
          <div>
            <div className="label adm-mb-sm">Material changes detected</div>
            <ul className="adm-changes">
              {r.changes.map((c, i) => (
                <li key={i}>
                  <span className="adm-tag">{c.kind.replace(/_/g, " ")}</span> {c.message}
                </li>
              ))}
            </ul>
          </div>
        )}
        {r.update_drafts > 0 && (
          <div className="banner amber">
            <Icon name="send" size={16} />
            <div className="grow">
              {r.update_drafts} update message{r.update_drafts === 1 ? "" : "s"} drafted for subscribers — review them in{" "}
              <Link to="/admin/messages" className="link">
                Message Delivery
              </Link>
              . Nothing is sent until you approve.
            </div>
          </div>
        )}
        <div className="subtle xs">
          Audio is cached per version — regenerate it in{" "}
          <Link to="/admin/audio" className="link">
            Audio Generation
          </Link>
          .
        </div>
      </div>
    </div>
  );
}
