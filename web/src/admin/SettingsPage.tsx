import type { ReactNode } from "react";
import { adminRequest } from "../lib/api";
import { Link } from "../lib/router";
import { Icon, type IconName } from "../components/Icon";
import type { Overview } from "./types";
import { ErrorBanner, PageHead, SkeletonRows, useLoad } from "./ui";

export function SettingsPage() {
  const ov = useLoad(() => adminRequest<Overview>("/overview"));
  const o = ov.data;

  return (
    <div className="adm-page">
      <PageHead title="Settings" subtitle="System status and integrations. Configuration lives in the server’s .env file." />
      <ErrorBanner error={ov.error} onRetry={ov.reload} />
      {!o ? (
        !ov.error && <SkeletonRows n={4} />
      ) : (
        <>
          <div className="adm-stats">
            <Stat label="Documents" value={o.documents} to="/admin/import" />
            <Stat label="Needs review" value={o.needs_review} to="/admin/review" tone={o.needs_review ? "amber" : undefined} />
            <Stat label="Published proposals" value={o.published} to="/admin/review" />
            <Stat label="Active subscribers" value={o.subscribers} to="/admin/subscribers" />
            <Stat label="Scheduled messages" value={o.scheduled} to="/admin/messages" />
            <Stat label="Uncertain deliveries" value={o.uncertain} to="/admin/messages" tone={o.uncertain ? "amber" : undefined} />
          </div>

          <section className="adm-section">
            <div className="adm-section-head">
              <h2>Integrations</h2>
            </div>
            <div className="adm-integrations">
              <Integration
                icon="sparkle"
                name="Grok (xAI)"
                purpose="Extracts proposals, dates and evidence from imported documents; translates card text."
                enabled={o.integrations.grok.enabled}
                env={["XAI_API_KEY"]}
                details={[["Model", o.integrations.grok.model]]}
                off="Without it, imports create a blank draft for manual entry."
              />
              <Integration
                icon="audio"
                name="ElevenLabs"
                purpose="English text-to-speech and Chinese dubbing for audio overviews."
                enabled={o.integrations.elevenlabs.enabled}
                env={["ELEVENLABS_API_KEY"]}
                details={[
                  ["Voice", o.integrations.elevenlabs.voice],
                  ["TTS model", o.integrations.elevenlabs.model],
                  ["Dub target", o.integrations.elevenlabs.dub_target],
                ]}
                off="Scripts can still be written and approved; audio generation is disabled."
              />
              <Integration
                icon="send"
                name="Photon (iMessage / SMS)"
                purpose="Receives follow codes and delivers reminders to residents’ phones."
                enabled={o.integrations.photon.enabled}
                env={["SPECTRUM_PROJECT_ID", "SPECTRUM_PROJECT_SECRET", "PHOTON_LINE_ADDRESS"]}
                details={[
                  ["Line address", o.integrations.photon.line_address ?? "—"],
                  ["SDK", o.integrations.photon.sdk],
                ]}
                off={
                  <>
                    Messages go to the simulated phone instead —{" "}
                    <a href="/phone" target="_blank" rel="noreferrer" className="link">
                      open /phone
                    </a>{" "}
                    to follow a proposal and receive reminders. Everything there is labelled SIMULATED.
                  </>
                }
              />
            </div>
          </section>

          <section className="adm-section">
            <div className="adm-section-head">
              <h2>Environment</h2>
            </div>
            <div className="card adm-env">
              <dl className="adm-meta">
                <div>
                  <dt>Public base URL</dt>
                  <dd className="adm-mono">{o.public_base_url}</dd>
                </div>
                <div>
                  <dt>Sample data</dt>
                  <dd>{o.show_sample_data ? "Shown on the public site (labelled Sample)" : "Hidden from the public site"}</dd>
                </div>
                <div>
                  <dt>Admin token</dt>
                  <dd>
                    Set <code>ADMIN_TOKEN</code> in <code>.env</code> (development default: <code>before-the-vote-team</code>).
                  </dd>
                </div>
              </dl>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, to, tone }: { label: string; value: number; to: string; tone?: "amber" }) {
  return (
    <Link to={to} className={`adm-stat${tone ? ` ${tone}` : ""}`}>
      <span className="adm-stat-value">{value}</span>
      <span className="adm-stat-label">{label}</span>
    </Link>
  );
}

function Integration({ icon, name, purpose, enabled, env, details, off }: { icon: IconName; name: string; purpose: string; enabled: boolean; env: string[]; details: [string, string][]; off: ReactNode }) {
  return (
    <div className="card adm-integration">
      <div className="adm-integration-head">
        <span className="adm-integration-ic">
          <Icon name={icon} size={18} />
        </span>
        <div className="grow">
          <h3>{name}</h3>
          <p className="subtle small">{purpose}</p>
        </div>
        <span className={`pill ${enabled ? "green" : "amber"}`}>{enabled ? "Connected" : "Not configured"}</span>
      </div>
      {enabled ? (
        <dl className="adm-kv">
          {details.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd className="adm-mono">{v}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className="adm-integration-off">
          <div className="small">
            Set {env.map((e, i) => (
              <span key={e}>
                {i > 0 && (i === env.length - 1 ? " and " : ", ")}
                <code>{e}</code>
              </span>
            ))}{" "}
            in <code>.env</code>, then restart the server.
          </div>
          <div className="subtle small">{off}</div>
        </div>
      )}
    </div>
  );
}
