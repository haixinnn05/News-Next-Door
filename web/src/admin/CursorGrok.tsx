import { useState } from "react";
import { adminJson, adminRequest } from "../lib/api";
import { Icon } from "../components/Icon";
import { ErrorBanner, Modal, Spinner, useAction, useAdmin } from "./ui";

/**
 * Manual Grok route for when the team has no xAI API credit: copy a prompt into Grok in Cursor chat,
 * paste the JSON reply back. The server applies the same schema and source checks as the API route.
 */
export function CursorGrokModal({
  title,
  promptPath,
  pastePath,
  submitLabel,
  askModel = false,
  onDone,
  onClose,
}: {
  title: string;
  promptPath: string;
  pastePath: string;
  submitLabel: string;
  askModel?: boolean;
  onDone: (result: unknown) => void;
  onClose: () => void;
}) {
  const { toast } = useAdmin();
  const act = useAction();
  const [prompt, setPrompt] = useState<string | null>(null);
  const [json, setJson] = useState("");
  const [model, setModel] = useState("");

  const copy = async () => {
    const r = prompt ?? (await act.run("prompt", () => adminRequest<{ prompt: string }>(promptPath)))?.prompt;
    if (!r) return;
    setPrompt(r);
    try {
      await navigator.clipboard.writeText(r);
      toast("Prompt copied. Paste it into Cursor chat with a Grok model selected.");
    } catch {
      toast("Couldn't copy automatically. Select the prompt below and copy it.");
    }
  };

  const submit = async () => {
    const r = await act.run("paste", () => adminJson("POST", pastePath, askModel ? { json, model: model.trim() || null } : { json }));
    if (r !== undefined) onDone(r);
  };

  return (
    <Modal title={title} onClose={onClose} width={640}>
      <ol className="small adm-steps">
        <li>
          Copy the prompt, open Cursor chat, pick a <strong>Grok</strong> model, and paste it in.
        </li>
        <li>Copy Grok's whole JSON reply and paste it below.</li>
      </ol>
      <div className="adm-actions left adm-mb">
        <button className="btn sm" onClick={() => void copy()} disabled={!!act.busy}>
          {act.busy === "prompt" ? <Spinner /> : <Icon name="copy" size={14} />} Copy prompt
        </button>
      </div>
      {prompt && <textarea className="textarea mono adm-mb" rows={4} readOnly value={prompt} onFocus={(e) => e.currentTarget.select()} aria-label="Prompt for Grok" />}
      {askModel && (
        <div className="field">
          <label htmlFor="cg-model">
            Grok model used <span className="subtle adm-optional">(optional, shown on the draft)</span>
          </label>
          <input id="cg-model" className="input" placeholder="e.g. grok-4 in Cursor" value={model} onChange={(e) => setModel(e.target.value)} />
        </div>
      )}
      <div className="field">
        <label htmlFor="cg-json">Grok's reply (JSON)</label>
        <textarea id="cg-json" className="textarea mono" rows={10} value={json} onChange={(e) => setJson(e.target.value)} placeholder='{"proposals": [ … ]}' />
      </div>
      <ErrorBanner error={act.error} />
      <div className="adm-actions">
        <button className="btn sm ghost" onClick={onClose}>
          Cancel
        </button>
        <button className="btn sm primary" onClick={() => void submit()} disabled={!!act.busy || !json.trim()}>
          {act.busy === "paste" && <Spinner />} {submitLabel}
        </button>
      </div>
    </Modal>
  );
}
