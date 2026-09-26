import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const serverRoot = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(serverRoot, "..");
dotenv.config({ path: path.join(projectRoot, ".env"), quiet: true });

const env = (k: string, d = "") => (process.env[k] ?? d).trim();
const resolveFromRoot = (p: string) => (path.isAbsolute(p) ? p : path.join(projectRoot, p));

const dataDir = resolveFromRoot(env("DATA_DIR", "./data"));

export const config = {
  serverRoot,
  projectRoot,
  port: Number(env("PORT", "8790")),
  publicBaseUrl: env("PUBLIC_BASE_URL", "http://localhost:5190").replace(/\/$/, ""),
  adminToken: env("ADMIN_TOKEN", "before-the-vote-team"),
  dataDir,
  dbPath: resolveFromRoot(env("DB_PATH", path.join(dataDir, "btv.sqlite"))),
  uploadsDir: path.join(dataDir, "documents"),
  audioDir: path.join(dataDir, "audio"),
  showSampleData: env("SHOW_SAMPLE_DATA", "false") !== "false",
  reminderLeadHours: Number(env("REMINDER_LEAD_HOURS", "24")),
  followCodeTtlMinutes: Number(env("FOLLOW_CODE_TTL_MINUTES", "30")),
  workerIntervalMs: Number(env("WORKER_INTERVAL_MS", "5000")),
  grok: {
    apiKey: env("XAI_API_KEY"),
    model: env("GROK_MODEL", "grok-4.7"),
    baseUrl: env("XAI_BASE_URL", "https://api.x.ai/v1"),
    get enabled() {
      return this.apiKey.length > 0;
    },
  },
  elevenlabs: {
    apiKey: env("ELEVENLABS_API_KEY"),
    voiceId: env("ELEVENLABS_VOICE_ID", "JBFqnCBsd6RMkjVDRZzb"),
    ttsModel: env("ELEVENLABS_TTS_MODEL", "eleven_multilingual_v2"),
    dubbingTarget: env("ELEVENLABS_DUB_TARGET", "zh"),
    get enabled() {
      return this.apiKey.length > 0;
    },
  },
  photon: {
    projectId: env("SPECTRUM_PROJECT_ID"),
    projectSecret: env("SPECTRUM_PROJECT_SECRET"),
    /** The iMessage address residents text (E.164 phone or email) — the Photon-provisioned line. */
    lineAddress: env("PHOTON_LINE_ADDRESS"),
    get enabled() {
      return this.projectId.length > 0 && this.projectSecret.length > 0;
    },
  },
  logLevel: env("LOG_LEVEL", "info"),
};

export function ensureDirs(): void {
  for (const d of [config.dataDir, config.uploadsDir, config.audioDir]) fs.mkdirSync(d, { recursive: true });
}
