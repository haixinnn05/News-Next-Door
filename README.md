# Before the Vote

Plain-language, source-backed explanations of Queens Community Board 2 proposals, with English and Chinese audio briefings and iMessage reminders.

- **Grok (xAI)** reads an official PDF or HTML document and returns a structured draft. Every fact must quote the page it came from, and the server checks each quote against the extracted text before anything can be published.
- **ElevenLabs** narrates the reviewed English briefing (text-to-speech), then dubs it into Chinese (Dubbing API, v2 project + language-target flow).
- **Photon (Spectrum iMessage)** receives follow codes and STOP, then sends confirmations, 24-hour reminders, and reviewed updates.

## Run it

```bash
cd before-the-vote
npm install
cp .env.example .env        # add keys when you have them; everything is optional
npm run dev                 # API on :8790, web on http://localhost:5190
```

- Resident site: <http://localhost:5190>. **Sign in** (top right) with email and password, or Google once configured. Signed-in residents can save proposals and see saved and text-followed proposals at `/me`. Browsing and following by text still work without an account.
- Team console: <http://localhost:5190/admin>. Sign in with Google when `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` are set (only emails in `ADMIN_EMAILS` get in); otherwise the password is `ADMIN_TOKEN`, default `before-the-vote-team`
- Simulated phone (used when Photon isn't configured): <http://localhost:5190/phone>

Production: `npm run build && npm start` serves the built site and API from one persistent Node process on `PORT`. The reminder worker and Photon listener run in the same process. SQLite and audio files live in `DATA_DIR`, so use a host with a persistent disk (or a laptop plus a tunnel), not serverless.

### Sign in with Google (TODO)

Resident accounts work now with email and password. The same Google keys add **Continue with Google** for residents and switch the team console from the shared `ADMIN_TOKEN` password to Google sign-in (Better Auth):

1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), choose **Create credentials → OAuth client ID → Web application**. Set up the OAuth consent screen first if Google asks.
2. Add the authorized redirect URI `http://localhost:5190/api/auth/callback/google`.
3. Fill in `.env`:
   ```bash
   GOOGLE_CLIENT_ID=...apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   ADMIN_EMAILS=you@gmail.com,teammate@gmail.com   # only these accounts get into the team console
   BETTER_AUTH_SECRET=...                          # openssl rand -base64 32
   ```
4. Restart `npm run dev`. The startup log should show `team login : Google (N allowed emails)`, and `ADMIN_TOKEN` stops working.

For production, set `PUBLIC_BASE_URL` to the real domain, add `https://<your-domain>/api/auth/callback/google` as a second redirect URI, and set `BETTER_AUTH_SECRET` on the host (Better Auth refuses to start without it in production). Removing an email from `ADMIN_EMAILS` cuts off that person's access on their next request. Team members must use Google: an email/password account is never treated as a team member, even if its email is on the list, because the app doesn't send verification emails.

### Hour-one integration checks

```bash
npm run smoke:grok          # JSON-schema response from Grok
npm run smoke:elevenlabs    # writes data/audio/smoke.mp3
npm run smoke:photon        # text the line from a teammate's phone; it replies once
npm test                    # acceptance checks (in-memory DB, no network)
npm run seed:reset          # wipe local data and re-seed
```

## What's seeded

| Data | Status |
|---|---|
| **50-02 Queens Boulevard Rezoning Proposal**: real applicant presentation PDF from the Queens CB2 site | Published. All 14 excerpts are verified against the PDF text at seed time. The Chinese card text is a translation that hasn't been reviewed. |
| Sept 16 Land Use & Housing agenda, Sept 24 Parks agenda: real PDFs | Imported only. Run **Extract with Grok** in the console, then review. |
| 28-07 Jackson Ave, Torsney Playground, Roosevelt Ave Bus Priority | **Fictional samples** (`/samples/*.html`) that exercise hearing dates and reminders. They're labelled "Sample" and "DEMO" in the app and in every message. Turn them off with `SHOW_SAMPLE_DATA=false`. |

The real meetings in the seeded CB2 documents are all in the past. The 50-02 proposal therefore shows "Next meeting not announced", and its future ULURP stages are listed as TBD. To show a reminder, use **Review Proposals → Create DEMO reminder test**. It adds a meeting labelled DEMO whose reminder fires in about a minute. Real dates are never moved.

## Demo script (2 minutes)

1. Open the original CB2 PDF (proposal → **Source**), then show the card and its per-field citations.
2. **Audio** tab: play English, switch to 中文. The Chinese panel shows the dub method and "generated translation".
3. **Follow**: scan the QR code or tap *Open in iMessage*, then send the code. The page flips to "Following" only after the backend has processed the message.
4. Console → **Review Proposals → Create DEMO reminder test** → the reminder arrives within about a minute. Open its link back to the proposal.
5. Reply **STOP**: queued messages are cancelled immediately.

## Layout

```
server/
  main.ts                 persistent process: HTTP + worker + Photon listener
  schema.sql              documents, drafts (separate from) proposals, evidence, events, audio, subscribers, notifications
  services/documents.ts   PDF (unpdf) / HTML (cheerio) → page-numbered text; SHA-256 de-duplication
  services/extraction.ts  Grok structured extraction + validation (verbatim excerpts, evidence rules, date checks)
  services/proposals.ts   publish / version / reconcile events, public views, address-index search
  services/audio.ts       ElevenLabs TTS + Dubbing (+ Grok-translation fallback), cached per proposal version
  services/subscriptions.ts  follow codes, inbound handler (STOP/HELP/code), idempotent per provider event id
  services/notifications.ts  confirmations, reminders (24h before), update drafts, delivery worker, restart recovery
  services/photon.ts      spectrum-ts 12.10.1 transport
  lib/addresses.ts        curated CB2 address index (unknown addresses → "coverage unavailable")
web/src/                  React UI (resident site + /admin console)
```

## Safety rules the code enforces

- A publish is blocked if a location, participation instruction, or dated event lacks an excerpt, or if an excerpt doesn't appear on the cited page.
- A missing fact stays null and is shown as "Not listed in source". Past meetings are shown as past and never get reminders.
- If an event date equals the publication date, the draft is flagged for review.
- Re-importing identical bytes creates no duplicate. Re-sending a follow code sends no second confirmation.
- A reschedule or cancellation withdraws the old reminder. Update messages are created as drafts for the team to send.
- Every notification has a unique delivery key. The worker claims rows atomically. After a crash, in-flight sends are marked *uncertain* and never resent automatically.
- Phone numbers are never returned by public endpoints and are masked in the console.
- Document text is sent to Grok as delimited, untrusted data. The model has no tools.
