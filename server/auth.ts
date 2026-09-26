import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { getMigrations } from "better-auth/db/migration";
import { config } from "./config.ts";
import type { Db } from "./db.ts";

/**
 * Team membership is the ADMIN_EMAILS allowlist, checked on every console request. Requiring a verified
 * email means only Google accounts qualify: email/password accounts are never verified (no mail is sent).
 */
export function isTeamEmail(email: string | null | undefined, emailVerified: boolean): boolean {
  return !!email && emailVerified && config.auth.adminEmails.includes(email.toLowerCase());
}

function resolveSecret(): string {
  if (config.auth.secret) return config.auth.secret;
  if (process.env.NODE_ENV === "production") throw new Error("BETTER_AUTH_SECRET is required in production.");
  const fp = path.join(config.dataDir, "auth-secret");
  if (!fs.existsSync(fp)) fs.writeFileSync(fp, crypto.randomBytes(32).toString("base64"), { mode: 0o600 });
  return fs.readFileSync(fp, "utf8").trim();
}

function authOptions(db: Db, secret: string) {
  return {
    database: db,
    baseURL: config.publicBaseUrl,
    secret,
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    socialProviders: config.auth.googleEnabled
      ? {
          google: {
            clientId: config.auth.googleClientId,
            clientSecret: config.auth.googleClientSecret,
            prompt: "select_account" as const,
          },
        }
      : {},
  } satisfies BetterAuthOptions;
}

/**
 * Creates or updates Better Auth's tables (user, session, account, verification) in the app database.
 * Must run before createAuth: the auth instance validates its tables as soon as it is created.
 */
export async function migrateAuth(db: Db): Promise<void> {
  const { runMigrations } = await getMigrations({ ...authOptions(db, resolveSecret()), advanced: { database: { validateSchema: false } } });
  await runMigrations();
}

export function createAuth(db: Db) {
  return betterAuth(authOptions(db, resolveSecret()));
}

export type Auth = ReturnType<typeof createAuth>;
