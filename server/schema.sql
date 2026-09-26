PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- Imported source documents. Content hash makes re-imports idempotent.
CREATE TABLE IF NOT EXISTS documents (
  id               TEXT PRIMARY KEY,
  board            TEXT NOT NULL DEFAULT 'queens-cb2',
  official_url     TEXT NOT NULL,
  title            TEXT NOT NULL,
  publication_date TEXT,              -- YYYY-MM-DD as entered by the team (never inferred)
  retrieved_at     TEXT NOT NULL,
  content_hash     TEXT NOT NULL UNIQUE,
  mime_type        TEXT NOT NULL,
  file_path        TEXT NOT NULL,
  page_count       INTEGER NOT NULL,
  is_sample        INTEGER NOT NULL DEFAULT 0,
  created_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS document_pages (
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  page        INTEGER NOT NULL,
  text        TEXT NOT NULL,
  PRIMARY KEY (document_id, page)
);

-- Extracted drafts are kept separate from published proposals.
CREATE TABLE IF NOT EXISTS drafts (
  id           TEXT PRIMARY KEY,
  document_id  TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  item_index   INTEGER NOT NULL DEFAULT 0,
  status       TEXT NOT NULL,           -- extracting | needs_review | failed | published | discarded
  extractor    TEXT NOT NULL,           -- grok | grok_cursor | manual | seed
  model        TEXT,
  data_json    TEXT NOT NULL,           -- DraftData
  issues_json  TEXT NOT NULL DEFAULT '[]',
  error        TEXT,
  proposal_id  TEXT,                    -- target proposal (set on publish or when merging into an existing one)
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  UNIQUE (document_id, item_index)
);

CREATE TABLE IF NOT EXISTS proposals (
  id               TEXT PRIMARY KEY,
  board            TEXT NOT NULL DEFAULT 'queens-cb2',
  title            TEXT NOT NULL,
  title_zh         TEXT,
  category         TEXT NOT NULL,       -- land_use | transportation | parks_environment | other
  location_text    TEXT,
  address_key      TEXT,                -- key into the curated address index
  summary          TEXT NOT NULL,
  summary_zh       TEXT,
  purpose          TEXT,
  stage            TEXT,                -- as stated in the source (free text)
  stage_kind       TEXT NOT NULL DEFAULT 'unknown',
  proposed_by      TEXT,
  participation    TEXT,
  body_name        TEXT,                -- the body/meeting named in the source
  version          INTEGER NOT NULL DEFAULT 1,
  is_sample        INTEGER NOT NULL DEFAULT 0,
  published        INTEGER NOT NULL DEFAULT 1,
  last_checked_at  TEXT NOT NULL,
  published_at     TEXT NOT NULL,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proposal_documents (
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  document_id TEXT NOT NULL REFERENCES documents(id),
  PRIMARY KEY (proposal_id, document_id)
);

CREATE TABLE IF NOT EXISTS evidence (
  id          TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  version     INTEGER NOT NULL,
  field       TEXT NOT NULL,            -- title | location | stage | summary | purpose | proposed_by | participation | event:<key>
  document_id TEXT NOT NULL REFERENCES documents(id),
  page        INTEGER NOT NULL,
  excerpt     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS evidence_by_proposal ON evidence(proposal_id, version);

CREATE TABLE IF NOT EXISTS events (
  id               TEXT PRIMARY KEY,
  proposal_id      TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  event_key        TEXT NOT NULL,       -- stable identity within a proposal (usually the type + ordinal)
  type             TEXT NOT NULL,       -- application_filed | community_discussion | public_hearing | committee_meeting | board_meeting | comment_deadline | board_review | decision | other
  title            TEXT NOT NULL,
  description      TEXT,
  date             TEXT,                -- YYYY-MM-DD (NYC) or NULL when not listed
  time             TEXT,                -- HH:MM (NYC) or NULL
  starts_at        TEXT,                -- UTC ISO when date+time known
  timezone         TEXT NOT NULL DEFAULT 'America/New_York',
  location         TEXT,
  meeting_url      TEXT,
  comment_deadline TEXT,
  instructions     TEXT,
  cancelled        INTEGER NOT NULL DEFAULT 0,
  is_demo          INTEGER NOT NULL DEFAULT 0,
  sort_order       INTEGER NOT NULL DEFAULT 0,
  version          INTEGER NOT NULL DEFAULT 1,
  created_at       TEXT NOT NULL,
  updated_at       TEXT NOT NULL,
  UNIQUE (proposal_id, event_key)
);

CREATE TABLE IF NOT EXISTS audio (
  id                 TEXT PRIMARY KEY,
  proposal_id        TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  proposal_version   INTEGER NOT NULL,
  language           TEXT NOT NULL,     -- en | zh
  script             TEXT,              -- English: approved script. Chinese: transcript returned by provider / fallback script.
  script_approved    INTEGER NOT NULL DEFAULT 0,
  method             TEXT,              -- tts | dubbing | tts_translated
  provider_job_json  TEXT,
  status             TEXT NOT NULL,     -- draft | pending | ready | failed
  file_path          TEXT,
  mime_type          TEXT,
  duration_s         REAL,
  translation_review TEXT NOT NULL DEFAULT 'not_applicable', -- not_applicable | unreviewed | reviewed
  error              TEXT,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL,
  UNIQUE (proposal_id, proposal_version, language)
);

CREATE TABLE IF NOT EXISTS subscribers (
  id                 TEXT PRIMARY KEY,
  handle             TEXT NOT NULL UNIQUE,  -- private: phone/email; never returned by public endpoints
  space_id           TEXT,
  transport          TEXT NOT NULL,         -- photon | simulator
  preferred_language TEXT NOT NULL DEFAULT 'en',
  opted_in_at        TEXT NOT NULL,
  active             INTEGER NOT NULL DEFAULT 1,
  stopped_at         TEXT,
  created_at         TEXT NOT NULL,
  user_id            TEXT                   -- Better Auth user who linked this phone by following while signed in
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id            TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL REFERENCES subscribers(id),
  proposal_id   TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  UNIQUE (subscriber_id, proposal_id)
);

CREATE TABLE IF NOT EXISTS follow_codes (
  code          TEXT PRIMARY KEY,
  proposal_id   TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  language      TEXT NOT NULL DEFAULT 'en',
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  used_at       TEXT,
  subscription_id TEXT,
  user_id       TEXT                        -- signed-in resident who requested the code, if any
);

CREATE TABLE IF NOT EXISTS saved_proposals (
  user_id     TEXT NOT NULL,                -- Better Auth user id
  proposal_id TEXT NOT NULL REFERENCES proposals(id) ON DELETE CASCADE,
  created_at  TEXT NOT NULL,
  PRIMARY KEY (user_id, proposal_id)
);

-- Live ZAP projects are not rows in proposals, so saves for them live here.
-- snapshot_json keeps the card if the city list is briefly unavailable.
CREATE TABLE IF NOT EXISTS saved_applications (
  user_id       TEXT NOT NULL,
  project_id    TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (user_id, project_id)
);

CREATE TABLE IF NOT EXISTS notifications (
  id                  TEXT PRIMARY KEY,
  delivery_key        TEXT NOT NULL UNIQUE,
  kind                TEXT NOT NULL,       -- confirmation | reminder | update | test | reply
  subscriber_id       TEXT NOT NULL REFERENCES subscribers(id),
  subscription_id     TEXT,
  proposal_id         TEXT,
  event_id            TEXT,
  event_version       INTEGER,
  proposal_version    INTEGER,
  label               TEXT NOT NULL,       -- short admin label
  body                TEXT NOT NULL,
  due_at              TEXT NOT NULL,
  state               TEXT NOT NULL,       -- draft | scheduled | sending | sent | failed | cancelled | uncertain
  attempts            INTEGER NOT NULL DEFAULT 0,
  provider_message_id TEXT,
  last_error          TEXT,
  sent_at             TEXT,
  is_demo             INTEGER NOT NULL DEFAULT 0,
  app_subscription_id TEXT,                -- set for messages about a followed live ZAP project
  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS notifications_due ON notifications(state, due_at);

-- Audio briefings for live ZAP projects. The script reads the city's own record aloud;
-- rows are keyed by a hash of that record, so a changed record gets fresh audio.
CREATE TABLE IF NOT EXISTS app_audio (
  id                TEXT PRIMARY KEY,
  project_id        TEXT NOT NULL,
  content_hash      TEXT NOT NULL,
  language          TEXT NOT NULL,           -- en | zh
  script            TEXT,                    -- English script, or the dub's translated transcript
  status            TEXT NOT NULL,           -- pending | ready | failed
  method            TEXT NOT NULL,           -- tts | dubbing
  provider_job_json TEXT,
  file_path         TEXT,
  mime_type         TEXT,
  error             TEXT,
  created_at        TEXT NOT NULL,
  updated_at        TEXT NOT NULL,
  UNIQUE (project_id, content_hash, language)
);

-- Grok's plain-English and Chinese versions of a live ZAP record, keyed by the record's hash.
-- A version is only used when every number, address and date matches the city's record (status 'ready');
-- otherwise it is 'flagged' and residents hear the city's own wording instead.
CREATE TABLE IF NOT EXISTS app_versions (
  project_id   TEXT NOT NULL,
  record_hash  TEXT NOT NULL,
  status       TEXT NOT NULL,           -- pending | ready | flagged | failed
  source       TEXT NOT NULL,           -- grok_api | grok_cursor
  model        TEXT,
  simple_en    TEXT,
  zh           TEXT,
  issues_json  TEXT NOT NULL DEFAULT '[]',
  error        TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  PRIMARY KEY (project_id, record_hash)
);

-- Follows for live ZAP projects, which are not rows in proposals. snapshot_json is the
-- status and milestone the subscriber was last told about.
CREATE TABLE IF NOT EXISTS app_follow_codes (
  code          TEXT PRIMARY KEY,
  project_id    TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  language      TEXT NOT NULL DEFAULT 'en',
  created_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  used_at       TEXT,
  subscription_id TEXT,
  user_id       TEXT
);

CREATE TABLE IF NOT EXISTS app_subscriptions (
  id            TEXT PRIMARY KEY,
  subscriber_id TEXT NOT NULL REFERENCES subscribers(id),
  project_id    TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  active        INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  checked_at    TEXT,
  UNIQUE (subscriber_id, project_id)
);

CREATE TABLE IF NOT EXISTS delivery_log (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  notification_id TEXT,
  direction       TEXT NOT NULL,     -- outbound | inbound
  transport       TEXT NOT NULL,     -- photon | simulator
  subscriber_id   TEXT,
  text            TEXT NOT NULL,
  outcome         TEXT NOT NULL,     -- sent | failed | received
  detail          TEXT,
  at              TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inbound_seen (
  provider_event_id TEXT PRIMARY KEY,
  at                TEXT NOT NULL
);

-- Simulated phone (used when Photon credentials are absent): outbound texts land here.
CREATE TABLE IF NOT EXISTS sim_messages (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  handle    TEXT NOT NULL,
  direction TEXT NOT NULL,  -- to_phone | from_phone
  text      TEXT NOT NULL,
  at        TEXT NOT NULL
);
