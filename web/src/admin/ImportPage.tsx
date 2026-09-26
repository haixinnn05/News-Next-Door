import { useRef, useState, type DragEvent, type FormEvent } from "react";
import { adminJson, adminRequest } from "../lib/api";
import { fmtDate, fmtRelative } from "../lib/format";
import { Link } from "../lib/router";
import { Icon } from "../components/Icon";
import type { DocumentView, ImportResult } from "./types";
import { DraftPill, Empty, ErrorBanner, PageHead, SkeletonRows, Spinner, useAction, useAdmin, useLoad } from "./ui";

const ACCEPT = ".pdf,.html,.htm,application/pdf,text/html";

export function ImportPage() {
  const { toast } = useAdmin();
  const docs = useLoad(() => adminRequest<DocumentView[]>("/documents"));
  const act = useAction();
  const fileInput = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const [pubDate, setPubDate] = useState("");
  const [title, setTitle] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);

  const pick = (f: File | undefined | null) => {
    if (!f) return;
    if (!/\.(pdf|html?)$/i.test(f.name) && !/pdf|html/.test(f.type)) {
      act.setError("Only PDF or HTML files are supported.");
      return;
    }
    act.setError(null);
    setFile(f);
  };
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  };

  const canSubmit = !!file || /^https?:\/\//i.test(url.trim());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      act.setError("Choose a file, or enter an official URL to fetch.");
      return;
    }
    setResult(null);
    const fd = new FormData();
    if (file) fd.append("file", file);
    fd.append("official_url", url.trim());
    fd.append("publication_date", pubDate);
    fd.append("title", title.trim());
    const r = await act.run("import", () => adminRequest<ImportResult>("/documents", { method: "POST", body: fd }));
    if (r) {
      setResult(r);
      if (!r.duplicate) {
        setFile(null);
        setTitle("");
        if (fileInput.current) fileInput.current.value = "";
      }
      void docs.reload();
    }
  };

  const extract = async (d: DocumentView) => {
    const r = await act.run(`extract:${d.id}`, () => adminJson<{ draftIds: string[]; extractor: string; note?: string }>("POST", `/documents/${d.id}/extract`));
    if (r) {
      toast(r.note ?? `Extracted ${r.draftIds.length} draft${r.draftIds.length === 1 ? "" : "s"}.`);
      void docs.reload();
    }
  };

  return (
    <div className="adm-page">
      <PageHead title="Import a document" subtitle="Upload an official document from a trusted source. We'll extract key details for review." />

      <form className="adm-import" onSubmit={submit}>
        <div
          className={`adm-drop${dragging ? " drag" : ""}${file ? " has-file" : ""}`}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            fileInput.current?.click();
          }}
        >
          <div className="adm-drop-ic">
            <Icon name={file ? "doc" : "upload"} size={26} />
          </div>
          {file ? (
            <>
              <div className="adm-drop-title">{file.name}</div>
              <div className="subtle small">{(file.size / 1024).toFixed(file.size > 1024 * 1024 ? 0 : 1)} KB · ready to import</div>
              <div className="row" style={{ marginTop: 14 }}>
                <button type="button" className="btn sm" onClick={() => fileInput.current?.click()}>
                  Choose another
                </button>
                <button
                  type="button"
                  className="btn sm ghost"
                  onClick={() => {
                    setFile(null);
                    if (fileInput.current) fileInput.current.value = "";
                  }}
                >
                  Remove
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="adm-drop-title">Drag and drop a PDF or HTML file</div>
              <div className="subtle small">or</div>
              <button type="button" className="btn adm-outline" onClick={() => fileInput.current?.click()}>
                Choose file
              </button>
            </>
          )}
          <input ref={fileInput} type="file" accept={ACCEPT} hidden onChange={(e) => pick(e.target.files?.[0])} />
        </div>

        <div className="adm-import-form">
          <div className="field">
            <label htmlFor="imp-url">Source URL (official)</label>
            <input id="imp-url" className="input" type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            {!file && url.trim() && <span className="subtle xs">No file chosen — we'll fetch this URL.</span>}
          </div>
          <div className="field">
            <label htmlFor="imp-date">Publication date</label>
            <input id="imp-date" className="input" type="date" value={pubDate} onChange={(e) => setPubDate(e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor="imp-title">
              Title <span className="subtle adm-optional">(optional)</span>
            </label>
            <input id="imp-title" className="input" placeholder="Defaults to the document's own title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <button className="btn primary block adm-mt" disabled={act.busy === "import"}>
            {act.busy === "import" ? (
              <>
                <Spinner /> Importing and extracting…
              </>
            ) : (
              "Import and extract"
            )}
          </button>
        </div>
      </form>
      <p className="subtle xs adm-footnote">Supports text-based PDFs and HTML. Scanned documents may not work in this demo.</p>

      {act.busy === "import" && (
        <div className="banner info adm-mb">
          <Spinner /> Reading the document and asking Grok to extract proposals. This can take up to a minute for long PDFs.
        </div>
      )}
      <ErrorBanner error={act.error} />
      {result && <ImportResultCard r={result} onClose={() => setResult(null)} />}

      <section className="adm-section">
        <div className="adm-section-head">
          <h2>Imported documents</h2>
          <button className="btn sm ghost" onClick={() => void docs.reload()} disabled={docs.loading}>
            <Icon name="refresh" size={14} /> Refresh
          </button>
        </div>
        <ErrorBanner error={docs.error} onRetry={docs.reload} />
        {!docs.data && docs.loading ? (
          <SkeletonRows n={4} />
        ) : docs.data && docs.data.length === 0 ? (
          <Empty icon="doc" title="No documents yet">
            Import an agenda, application or notice above to get started.
          </Empty>
        ) : (
          docs.data && (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Document</th>
                    <th>Published</th>
                    <th className="num">Pages</th>
                    <th>Drafts</th>
                    <th className="right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {docs.data.map((d) => {
                    const canExtract = d.drafts.length === 0 || d.drafts.every((x) => x.status === "failed");
                    return (
                      <tr key={d.id}>
                        <td>
                          <div className="adm-cell-title">
                            {d.title} {!!d.is_sample && <span className="chip sample">Sample</span>}
                          </div>
                          <div className="subtle xs">
                            {d.mime_type.includes("pdf") ? "PDF" : "HTML"} · imported {fmtRelative(d.created_at)}
                          </div>
                        </td>
                        <td className="nowrap">{d.publication_date ? fmtDate(d.publication_date) : <span className="subtle">—</span>}</td>
                        <td className="num">{d.page_count}</td>
                        <td>
                          {d.drafts.length === 0 ? (
                            <span className="subtle small">None</span>
                          ) : (
                            <div className="adm-draft-list">
                              {d.drafts.map((x) => (
                                <Link key={x.id} to={`/admin/review/${x.id}`} className="adm-draft-ref" title={x.error ?? x.title}>
                                  <DraftPill status={x.status} />
                                  <span>{x.title}</span>
                                </Link>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="right">
                          <div className="adm-actions">
                            {canExtract && (
                              <button className="btn sm" onClick={() => void extract(d)} disabled={!!act.busy}>
                                {act.busy === `extract:${d.id}` ? <Spinner /> : <Icon name="sparkle" size={14} />} Extract with Grok
                              </button>
                            )}
                            <a className="btn sm ghost" href={d.file_url} target="_blank" rel="noreferrer" title="Open the stored copy">
                              <Icon name="doc" size={14} /> File
                            </a>
                            {d.official_url && (
                              <a className="btn sm ghost" href={d.official_url} target="_blank" rel="noreferrer" title={d.official_url}>
                                <Icon name="external" size={14} /> Source
                              </a>
                            )}
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
      </section>
    </div>
  );
}

function ImportResultCard({ r, onClose }: { r: ImportResult; onClose: () => void }) {
  const drafts = r.document.drafts.filter((d) => !r.extraction || r.extraction.draftIds.includes(d.id));
  return (
    <div className="card adm-result">
      <div className="row between">
        <div className="row">
          <span className="adm-result-ic">
            <Icon name="check" size={16} />
          </span>
          <div>
            <div className="adm-cell-title">{r.document.title}</div>
            <div className="subtle xs">
              {r.document.page_count} page{r.document.page_count === 1 ? "" : "s"}
              {r.document.publication_date && ` · published ${fmtDate(r.document.publication_date)}`}
              {r.extraction && ` · extractor: ${r.extraction.extractor}`}
            </div>
          </div>
        </div>
        <button className="icon-btn" onClick={onClose} aria-label="Dismiss">
          <Icon name="x" size={14} />
        </button>
      </div>
      <div className="adm-result-body">
        {r.duplicate && (
          <div className="banner info">
            <Icon name="info" size={16} />
            <div>Already imported — no duplicate created.</div>
          </div>
        )}
        {r.extraction?.note && (
          <div className="banner amber">
            <Icon name="info" size={16} />
            <div>{r.extraction.note}</div>
          </div>
        )}
        {r.extraction_error && (
          <div className="banner red">
            <Icon name="alert" size={16} />
            <div>
              <strong>Extraction failed:</strong> {r.extraction_error} You can retry with “Extract with Grok” below.
            </div>
          </div>
        )}
        {drafts.length > 0 && (
          <div>
            <div className="label adm-mb-sm">Drafts ready for review</div>
            <div className="adm-draft-links">
              {drafts.map((d) => (
                <Link key={d.id} to={`/admin/review/${d.id}`} className="adm-draft-link">
                  <DraftPill status={d.status} />
                  <span className="grow">{d.title}</span>
                  <span className="link small">
                    Review <Icon name="arrowRight" size={13} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
