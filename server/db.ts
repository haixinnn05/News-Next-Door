import { DatabaseSync, type SQLInputValue } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";
import { config, ensureDirs } from "./config.ts";

export type Db = DatabaseSync;
let instance: DatabaseSync | undefined;

function applySchema(db: DatabaseSync, memory = false) {
  let schema = fs.readFileSync(path.join(config.serverRoot, "schema.sql"), "utf8");
  if (memory) schema = schema.replace("PRAGMA journal_mode = WAL;", "");
  db.exec(schema);
}

export function openDb(dbPath = config.dbPath): DatabaseSync {
  if (instance) return instance;
  ensureDirs();
  instance = new DatabaseSync(dbPath);
  applySchema(instance);
  return instance;
}

export function openMemoryDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  applySchema(db, true);
  return db;
}

export function tx<T>(db: DatabaseSync, fn: () => T): T {
  if (db.isTransaction) return fn();
  db.exec("BEGIN IMMEDIATE");
  try {
    const out = fn();
    db.exec("COMMIT");
    return out;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

export function all<T>(db: DatabaseSync, sql: string, ...params: SQLInputValue[]): T[] {
  return db.prepare(sql).all(...params) as T[];
}
export function get<T>(db: DatabaseSync, sql: string, ...params: SQLInputValue[]): T | undefined {
  return db.prepare(sql).get(...params) as T | undefined;
}
export function run(db: DatabaseSync, sql: string, ...params: SQLInputValue[]) {
  return db.prepare(sql).run(...params);
}
