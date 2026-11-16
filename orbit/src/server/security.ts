import {
  createHash,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
import { Redis } from "@upstash/redis";
import { transaction, now, production } from "./db";
const scrypt = (
  password: string,
  salt: string,
  length: number,
  options: import("node:crypto").ScryptOptions,
) =>
  new Promise<Buffer>((resolve, reject) =>
    scryptCallback(password, salt, length, options, (err, key) =>
      err ? reject(err) : resolve(key),
    ),
  );
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.status = status;
  }
}
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  return `${salt}:${derived.toString("hex")}`;
}
export async function checkPassword(
  encoded: string | undefined,
  password: string,
) {
  const [salt, key] = (
    encoded || "00000000000000000000000000000000:" + "00".repeat(64)
  ).split(":");
  const derived = await scrypt(password, salt, 64, {
    N: 32768,
    r: 8,
    p: 1,
    maxmem: 64 * 1024 * 1024,
  });
  const expected = Buffer.from(key, "hex");
  return (
    expected.length === derived.length && timingSafeEqual(derived, expected)
  );
}
export function redis() {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null;
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}
const local = new Map();
export async function rateLimit(key: string, limit = 12, window = 900) {
  const k = "orbit:rate:" + hash(key);
  const r = redis();
  let count;
  if (r) {
    try {
      count = Number(
        await r.eval(
          "local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('EXPIRE',KEYS[1],ARGV[1]) end; return n",
          [k],
          [window],
        ),
      );
    } catch {
      throw new HttpError(
        503,
        "Sign-in is temporarily unavailable. Please try again shortly.",
      );
    }
  } else {
    if (production())
      throw new HttpError(503, "Rate limiting is not configured");
    const t = now();
    for (const [key, value] of local) if (value.expires < t) local.delete(key);
    const item = local.get(k) || { count: 0, expires: t + window };
    item.count++;
    local.set(k, item);
    count = item.count;
  }
  if (count > limit)
    throw new HttpError(429, "Too many attempts. Please try again later.");
}
export function checkOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  if (request.headers.get("sec-fetch-site") === "cross-site")
    throw new HttpError(403, "Cross-site requests are not allowed.");
  if (
    request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !==
    "application/json"
  )
    throw new HttpError(415, "Use application/json for this request.");
  const origin = request.headers.get("origin");
  const allowed = (
    process.env.ALLOWED_ORIGINS ||
    process.env.APP_URL ||
    "http://localhost:3000,http://127.0.0.1:3000"
  )
    .split(",")
    .map((s) => s.trim());
  if (origin && !allowed.includes(origin))
    throw new HttpError(403, "This request origin is not allowed.");
  if (!origin) throw new HttpError(403, "An origin header is required.");
}
export function cookie(request: Request) {
  return (
    request.headers
      .get("cookie")
      ?.split(";")
      .map((s) => s.trim())
      .find((s) => s.startsWith("orbit_session="))
      ?.slice(14) || ""
  );
}
export function publicUser(u: import("./db").DbRow) {
  return { id: u.id, name: u.name, email: u.email, is_admin: !!u.is_admin };
}
export async function currentUser(request: Request, admin = false) {
  const token = cookie(request);
  if (!token) throw new HttpError(401, "Please log in to continue.");
  const u = await transaction((db) =>
    db.one(
      "SELECT u.* FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token_hash=? AND s.expires_at>?",
      [hash(token), now()],
    ),
  );
  if (!u)
    throw new HttpError(401, "Your session has expired. Please log in again.");
  if (admin && !u.is_admin)
    throw new HttpError(403, "This page is available to administrators only.");
  return u;
}
export async function session(userId: string, admin = false) {
  const lifetime = admin ? 3600 : 7 * 86400;
  const token = randomBytes(48).toString("base64url");
  await transaction(async (db) => {
    await db.query("DELETE FROM sessions WHERE expires_at<?", [now()]);
    await db.query(
      "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
      [hash(token), userId, now() + lifetime],
    );
  });
  return `orbit_session=${token}; HttpOnly; Path=/; SameSite=Strict; Max-Age=${lifetime}${production() ? "; Secure" : ""}`;
}
export const clearCookie = () =>
  `orbit_session=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${production() ? "; Secure" : ""}`;
