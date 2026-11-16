import { randomUUID } from "node:crypto";
import path from "node:path";
import fs from "node:fs";
import pg from "pg";
import { allowedOrigins, production } from "./origins";
export { production } from "./origins";

export interface DbRow extends pg.QueryResultRow {}
export interface Database {
  query(
    sql: string,
    params?: (string | number | null)[],
  ): Promise<{ rows: DbRow[]; rowCount: number | null }>;
  one(
    sql: string,
    params?: (string | number | null)[],
  ): Promise<DbRow | undefined>;
  all(sql: string, params?: (string | number | null)[]): Promise<DbRow[]>;
}
declare global {
  var __orbitPool: pg.Pool | undefined;
}
const schema = [
  `CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password_hash TEXT NOT NULL,is_admin INTEGER NOT NULL DEFAULT 0,created_at DOUBLE PRECISION NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,expires_at DOUBLE PRECISION NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS rounds(id TEXT PRIMARY KEY,title TEXT NOT NULL,status TEXT NOT NULL,closes_at DOUBLE PRECISION NOT NULL,created_at DOUBLE PRECISION NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS round_settings(round_id TEXT PRIMARY KEY REFERENCES rounds(id),data TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS profiles(user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,data TEXT NOT NULL,updated_at DOUBLE PRECISION NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS responses(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,round_id TEXT NOT NULL REFERENCES rounds(id),answers TEXT NOT NULL,submitted INTEGER NOT NULL DEFAULT 0,updated_at DOUBLE PRECISION NOT NULL,PRIMARY KEY(user_id,round_id))`,
  `CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,round_id TEXT NOT NULL REFERENCES rounds(id),status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,lease_until DOUBLE PRECISION NOT NULL DEFAULT 0,lease_token TEXT,error TEXT,created_at DOUBLE PRECISION NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS matches(round_id TEXT NOT NULL REFERENCES rounds(id),user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,other_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,score INTEGER NOT NULL,details TEXT NOT NULL,PRIMARY KEY(round_id,user_id,other_id))`,
  `CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY,round_id TEXT NOT NULL REFERENCES rounds(id),user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,next_attempt DOUBLE PRECISION NOT NULL DEFAULT 0,error TEXT,UNIQUE(round_id,user_id))`,
  `CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY,action TEXT NOT NULL,created_at DOUBLE PRECISION NOT NULL)`,
  `CREATE INDEX IF NOT EXISTS idx_jobs_pending ON jobs(status,lease_until)`,
  `CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox(status,next_attempt)`,
];
export const now = () => Date.now() / 1000;
export const isNeon = () => Boolean(process.env.DATABASE_URL);
let initPromise: Promise<void> | null;
let localQueue: Promise<unknown> = Promise.resolve();
function configCheck() {
  if (production()) {
    allowedOrigins();
    if (!process.env.UPSTASH_REDIS_REST_URL?.startsWith("https://"))
      throw Error("Production requires HTTPS Redis");
    const database = new URL(
      process.env.DATABASE_URL || "postgresql://invalid",
    );
    if (
      !["require", "verify-ca", "verify-full"].includes(
        database.searchParams.get("sslmode") || "",
      )
    )
      throw Error("Production requires database TLS");
  }
  if (
    production() &&
    (!isNeon() ||
      !process.env.UPSTASH_REDIS_REST_URL ||
      !process.env.UPSTASH_REDIS_REST_TOKEN)
  )
    throw Error("Production requires Neon and Upstash configuration");
}
async function rawTransaction<T>(fn: (db: Database) => Promise<T>): Promise<T> {
  configCheck();
  if (isNeon()) {
    globalThis.__orbitPool ||= new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      connectionTimeoutMillis: 15000,
    });
    const client = await globalThis.__orbitPool.connect();
    const db: Database = {
      query: async (sql, params = []) => {
        let n = 0;
        return client.query(
          sql.replace(/\?/g, () => `$${++n}`),
          params,
        );
      },
      one: async function (sql, p = []) {
        return (await this.query(sql, p)).rows[0];
      },
      all: async function (sql, p = []) {
        return (await this.query(sql, p)).rows;
      },
    };
    try {
      await client.query("BEGIN");
      const result = await fn(db);
      await client.query("COMMIT");
      return result;
    } catch (e) {
      await client.query("ROLLBACK");
      throw e;
    } finally {
      client.release();
    }
  }
  const { DatabaseSync } = await import("node:sqlite");
  const sqlitePath = path.resolve(
    /* turbopackIgnore: true */ process.env.SQLITE_PATH || ".local/orbit.db",
  );
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
  const run = async () => {
    const client = new DatabaseSync(sqlitePath);
    client.exec(
      "PRAGMA foreign_keys=ON;PRAGMA journal_mode=WAL;PRAGMA busy_timeout=15000;BEGIN IMMEDIATE",
    );
    const db: Database = {
      query: async (sql, p = []) => {
        const s = client.prepare(sql);
        if (/^\s*(SELECT|WITH)/i.test(sql)) {
          const rows = s.all(...p);
          return { rows, rowCount: rows.length };
        }
        const r = s.run(...p);
        return { rows: [], rowCount: Number(r.changes) };
      },
      one: async function (sql, p = []) {
        return (await this.query(sql, p)).rows[0];
      },
      all: async function (sql, p = []) {
        return (await this.query(sql, p)).rows;
      },
    };
    try {
      const result = await fn(db);
      client.exec("COMMIT");
      return result;
    } catch (e) {
      client.exec("ROLLBACK");
      throw e;
    } finally {
      client.close();
    }
  };
  const next = localQueue.then(run, run);
  localQueue = next.catch(() => {});
  return next;
}
export function initDb() {
  initPromise ||= rawTransaction(async (db) => {
    for (const sql of schema) await db.query(sql);
    await db.query(
      "INSERT INTO rounds(id,title,status,closes_at,created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING",
      ["round-001", "The first orbit", "open", now() + 3 * 86400, now()],
    );
  }).catch((e) => {
    initPromise = null;
    throw e;
  });
  return initPromise;
}
export async function transaction<T>(
  fn: (db: Database) => Promise<T>,
): Promise<T> {
  await initDb();
  return rawTransaction(fn);
}
export async function currentRound(db: Database, lock = false) {
  const row = await db.one(
    "SELECT * FROM rounds ORDER BY created_at DESC LIMIT 1" +
      (lock && isNeon() ? " FOR UPDATE" : ""),
  );
  if (!row) throw Error("No round configured");
  return row;
}
export async function audit(db: Database, action: string) {
  return db.query("INSERT INTO events(id,action,created_at) VALUES(?,?,?)", [
    randomUUID(),
    action,
    now(),
  ]);
}
