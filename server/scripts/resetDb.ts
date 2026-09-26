/** Delete the local database and generated files, then re-seed. `npm run seed:reset` */
import fs from "node:fs";
import { config } from "../config.ts";
import { openDb } from "../db.ts";
import { seedIfEmpty } from "../seed/seed.ts";

for (const f of [config.dbPath, `${config.dbPath}-wal`, `${config.dbPath}-shm`]) fs.rmSync(f, { force: true });
fs.rmSync(config.uploadsDir, { recursive: true, force: true });
fs.rmSync(config.audioDir, { recursive: true, force: true });
await seedIfEmpty(openDb());
console.log("Database reset and re-seeded at", config.dbPath);
