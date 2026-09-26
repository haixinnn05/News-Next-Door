/** Hour-one check: TTS works with our key and voice. Writes data/audio/smoke.mp3. `npm run smoke:elevenlabs` */
import fs from "node:fs";
import path from "node:path";
import { config, ensureDirs } from "../config.ts";

if (!config.elevenlabs.enabled) {
  console.error("Set ELEVENLABS_API_KEY in .env first.");
  process.exit(2);
}
ensureDirs();
const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${config.elevenlabs.voiceEn}?output_format=mp3_44100_128`, {
  method: "POST",
  headers: { "xi-api-key": config.elevenlabs.apiKey, "Content-Type": "application/json" },
  body: JSON.stringify({ text: "News Next Door. This is a test of the English briefing voice.", model_id: config.elevenlabs.ttsModel }),
});
if (!res.ok) {
  console.error(`TTS failed (${res.status}):`, await res.text());
  process.exit(1);
}
const out = path.join(config.audioDir, "smoke.mp3");
fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
console.log("ElevenLabs TTS OK →", out);
console.log("Dubbing is exercised from the admin console (Audio Generation → Dub to Chinese); it bills per project, so it is not run here.");
