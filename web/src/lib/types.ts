export type Category = "land_use" | "transportation" | "parks_environment" | "other";

export type ZapPublicStatus = "Filed" | "In Public Review" | "Noticed";

export interface ZapApplication {
  id: string;
  name: string;
  brief: string | null;
  public_status: ZapPublicStatus;
  applicant: string | null;
  applicant_type: string | null;
  ulurp_numbers: string | null;
  ceqr_number: string | null;
  districts: string;
  council_district: string | null;
  actions: { code: string; label: string }[];
  milestone: string | null;
  milestone_date: string | null;
  filed_date: string | null;
  noticed_date: string | null;
  certified_date: string | null;
  zap_url: string;
  location: { label: string; lat: number; lng: number; lot_count: number } | null;
}

export interface Board {
  id: string;
  name: string;
  shortName: string;
  borough: string;
  number: number;
  zapCode: string;
  boroCd: number;
  neighborhoods: string[];
}

export interface DistrictGeometry {
  type: "Polygon" | "MultiPolygon";
  coordinates: number[][][] | number[][][][];
}

export interface ZapFeed {
  source: { name: string; dataset_url: string; board_id: string; board: string; fetched_at: string };
  applications: ZapApplication[];
}

export interface PublicEvent {
  id: string;
  key: string;
  type: string;
  title: string;
  description: string | null;
  date: string | null;
  time: string | null;
  starts_at: string | null;
  timezone: string;
  location: string | null;
  meeting_url: string | null;
  comment_deadline: string | null;
  instructions: string | null;
  cancelled: boolean;
  is_demo: boolean;
  timing: "upcoming" | "past" | "tbd" | "cancelled";
}

export interface Address {
  key: string;
  label: string;
  full: string;
  neighborhood: string;
  lat: number;
  lng: number;
}

export interface ProposalCard {
  id: string;
  title: string;
  title_zh: string | null;
  category: Category;
  location_text: string | null;
  address: Address | null;
  summary: string;
  summary_zh: string | null;
  stage: string | null;
  stage_kind: string;
  is_sample: boolean;
  last_checked_at: string;
  next_event: PublicEvent | null;
}

export interface AudioView {
  language: "en" | "zh";
  status: "draft" | "pending" | "ready" | "failed";
  method: string | null;
  url: string | null;
  transcript: string | null;
  translation_review: string;
  duration_s: number | null;
  error: string | null;
}

export interface SourceDocument {
  id: string;
  title: string;
  official_url: string;
  publication_date: string | null;
  retrieved_at: string;
  page_count: number;
  mime_type: string;
  is_sample: boolean;
  file_url: string;
}

export interface Evidence {
  field: string;
  document_id: string;
  page: number;
  excerpt: string;
}

export interface ProposalDetail extends ProposalCard {
  purpose: string | null;
  proposed_by: string | null;
  participation: string | null;
  body_name: string | null;
  version: number;
  published_at: string;
  events: PublicEvent[];
  documents: SourceDocument[];
  evidence: Evidence[];
  audio: { en: AudioView | null; zh: AudioView | null };
}

export interface SearchResponse {
  status: "ok" | "empty" | "unsupported_address" | "no_proposals_at_address";
  matched_address: { key: string; label: string; full: string; neighborhood: string } | null;
  results: ProposalCard[];
}

export interface Meta {
  board: { id: string; name: string; shortName: string; neighborhoods: string[]; office: string; website: string; documentsPage: string };
  coverage: { addresses: Address[] };
  messaging: { mode: "photon" | "simulator"; line_address: string | null };
  integrations: { grok: boolean; elevenlabs: boolean; photon: boolean };
  show_sample_data: boolean;
  reminder_lead_hours: number;
  team_sign_in: "google" | "token";
  account_sign_in: { email: boolean; google: boolean };
}

export interface MyProposals {
  saved: ProposalCard[];
  following: (ProposalCard & { phone: string })[];
  phones: string[];
  applications: ZapApplication[];
}

/** Audio for a live city application: the city's record read aloud, and an ElevenLabs Chinese dub. */
export interface AppAudioSide {
  status: "pending" | "ready" | "failed";
  url: string | null;
  transcript: string | null;
  method: string;
}
export interface AppAudioView {
  available: boolean;
  /** Grok's Simple English / Chinese, used only after it matched the city's record. Null → the city's own wording. */
  version: { source: string; model: string | null; simple_en: string; zh: string } | null;
  en: AppAudioSide | null;
  zh: AppAudioSide | null;
}

export interface FollowResponse {
  code: string;
  expires_at: string;
  link: string;
  qr_svg: string;
  line_address: string | null;
  mode: "photon" | "simulator";
}
