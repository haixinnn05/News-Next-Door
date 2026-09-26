// Admin-side types mirroring server/http/app.ts response shapes.

export type Category = "land_use" | "transportation" | "parks_environment" | "other";

export interface DraftEvent {
  key: string;
  type: string;
  title: string;
  description: string | null;
  date: string | null;
  time: string | null;
  location: string | null;
  meeting_url: string | null;
  comment_deadline: string | null;
  instructions: string | null;
  cancelled: boolean;
  is_demo?: boolean;
}

export interface Evidence {
  field: string;
  page: number;
  excerpt: string;
}

export interface DraftData {
  title: string;
  category: Category;
  location_text: string | null;
  address_key?: string | null;
  summary: string;
  purpose: string | null;
  stage: string | null;
  stage_kind: string;
  proposed_by: string | null;
  body_name: string | null;
  participation: string | null;
  events: DraftEvent[];
  evidence: Evidence[];
}

export interface Issue {
  level: "error" | "warning";
  field: string;
  message: string;
}

export interface DocumentRow {
  id: string;
  board: string;
  official_url: string;
  title: string;
  publication_date: string | null;
  retrieved_at: string;
  content_hash: string;
  mime_type: string;
  file_path: string;
  page_count: number;
  is_sample: number;
  created_at: string;
  file_url: string;
}

export interface DocDraftRef {
  id: string;
  status: DraftStatus;
  title: string;
  extractor: string;
  error: string | null;
  proposal_id: string | null;
}

export interface DocumentView extends DocumentRow {
  drafts: DocDraftRef[];
}

export interface ImportResult {
  document: DocumentView;
  duplicate: boolean;
  extraction: { draftIds: string[]; extractor: string; note?: string } | null;
  extraction_error: string | null;
}

export type DraftStatus = "extracting" | "needs_review" | "failed" | "published" | "discarded";

export interface DraftListItem {
  id: string;
  status: DraftStatus;
  extractor: string;
  title: string;
  document_title: string;
  issues: number;
  proposal_id: string | null;
  updated_at: string;
  is_sample: boolean;
}

export interface Page {
  page: number;
  text: string;
}

export interface DraftView {
  id: string;
  document_id: string;
  item_index: number;
  status: DraftStatus;
  extractor: string;
  model: string | null;
  data: DraftData;
  issues: Issue[];
  error: string | null;
  proposal_id: string | null;
  created_at: string;
  updated_at: string;
  document: DocumentRow;
  pages: Page[];
}

export interface DraftResponse {
  draft: DraftView;
  proposals: { id: string; title: string }[];
  enums: { categories: string[]; stage_kinds: string[]; event_types: string[] };
}

export interface PublishResult {
  proposal_id: string;
  version: number;
  changes: { kind: string; message: string; event_id?: string }[];
  update_drafts: number;
}

export interface AdminProposal {
  id: string;
  title: string;
  category: Category;
  location_text: string | null;
  stage: string | null;
  stage_kind: string;
  is_sample: boolean;
  last_checked_at: string;
  next_event: { title: string; date: string | null; starts_at: string | null; is_demo: boolean } | null;
  published: boolean;
  version: number;
  subscribers: number;
}

export type AudioStatus = "draft" | "pending" | "ready" | "failed";

export interface AudioSide {
  id: string;
  status: AudioStatus;
  method: string | null;
  script: string | null;
  script_approved: boolean;
  words: number;
  url: string | null;
  translation_review: "not_applicable" | "unreviewed" | "reviewed" | string;
  error: string | null;
  updated_at: string;
}

export interface AudioItem {
  proposal: { id: string; title: string; version: number; is_sample: boolean };
  en: AudioSide;
  zh: AudioSide | null;
}

export type MessageState = "draft" | "scheduled" | "sending" | "sent" | "failed" | "cancelled" | "uncertain";

export interface MessageGroup {
  key: string;
  label: string;
  kind: string;
  proposal_title: string | null;
  proposal_id: string | null;
  state: MessageState;
  due_at: string;
  recipients: number;
  ids: string[];
  is_demo: boolean;
  last_error: string | null;
  body: string;
}

export interface DeliveryLogRow {
  id: number;
  notification_id: string | null;
  direction: "inbound" | "outbound";
  transport: string;
  subscriber_id: string | null;
  handle: string | null;
  text: string;
  outcome: string;
  detail: string | null;
  at: string;
}

export interface Subscriber {
  id: string;
  handle: string;
  transport: string;
  preferred_language: string;
  opted_in_at: string;
  active: boolean;
  stopped_at: string | null;
  subscriptions: { proposal_id: string; title: string; active: number }[];
}

export interface Overview {
  documents: number;
  needs_review: number;
  published: number;
  subscribers: number;
  scheduled: number;
  uncertain: number;
  integrations: {
    grok: { enabled: boolean; model: string };
    elevenlabs: { enabled: boolean; voice: string; model: string; dub_target: string };
    photon: { enabled: boolean; line_address: string | null; sdk: string };
  };
  public_base_url: string;
  show_sample_data: boolean;
  team_sign_in: { mode: TeamSignIn; allowed_emails: number | null };
}

export type TeamSignIn = "google" | "token";
export interface TeamMember {
  email: string;
  name: string;
  image: string | null;
}
export interface Me {
  sign_in: TeamSignIn;
  member: TeamMember | null;
}

/** Grok's Simple English + Chinese version of a live city application, checked against the record. */
export interface AppVersion {
  project_id: string;
  status: "none" | "pending" | "ready" | "flagged" | "failed";
  source: "grok_api" | "grok_cursor" | null;
  model: string | null;
  simple_en: string | null;
  zh: string | null;
  issues: string[];
  error: string | null;
}
export interface AdminApplications {
  board: { id: string; name: string };
  grok_api: boolean;
  applications: { id: string; name: string; public_status: string; location: string; version: AppVersion }[];
}
