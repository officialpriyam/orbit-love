import type { DbRow } from "./db";
import {
  locationSchema,
  locationSettings,
  locationComplete,
} from "./location-settings";
import { readJsonBody as body } from "./request-body";
import { randomUUID } from "node:crypto";
import {
  transaction,
  currentRound,
  audit,
  now,
  isNeon,
  production,
} from "./db";
import {
  HttpError,
  checkOrigin,
  currentUser,
  publicUser,
  hashPassword,
  checkPassword,
  session,
  cookie,
  hash,
  clearCookie,
  redis,
  rateLimit,
} from "./security";
import {
  parse,
  loginSchema,
  registerSchema,
  profileSchema,
  surveySchema,
  submissionSchema,
  scheduleSchema,
  deletionSchema,
} from "./validation";

const json = (
  body: unknown,
  status = 200,
  headers: Record<string, string> = {},
) =>
  Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};
function openRound(r: DbRow) {
  if (r.status !== "open" || r.closes_at <= now())
    fail(409, "This matching round is closed. Your answers are locked.");
}
function cleanProfile(profile: Record<string, unknown>) {
  const { llm_consent: _legacy, ...rest } = profile;
  return rest;
}
function roundView(r: DbRow) {
  return {
    ...r,
    status: r.status === "open" && r.closes_at <= now() ? "closed" : r.status,
  };
}
export async function handle(request: Request, segments: string[]) {
  try {
    checkOrigin(request);
    const path = segments.join("/"),
      method = request.method;
    if (path === "health" && method === "GET")
      return json({
        status: "ok",
        service: "orbit-nextjs",
        database: isNeon() ? "neon" : "local-development",
      });
    if (["register", "login"].includes(path) && method === "POST") {
      const data = parse(
        registerSchema.partial({ name: true, consent: true }),
        await body(request),
      );
      // Email throttling is authoritative; untrusted proxy headers cannot bypass it.
      await rateLimit("account:" + data.email);
      await rateLimit("global-auth", 60, 60);
      let u;
      if (path === "register") {
        const registration = parse(registerSchema, data);
        const passwordHash = await hashPassword(registration.password);
        u = await transaction(async (db) => {
          const existing = await db.one("SELECT id FROM users WHERE email=?", [
            data.email,
          ]);
          if (existing)
            fail(409, "Unable to create this account. Try logging in.");
          const r = await currentRound(db, true);
          openRound(r);
          const id = randomUUID();
          await db.query(
            "INSERT INTO users(id,email,name,password_hash,is_admin,created_at) VALUES(?,?,?,?,?,?)",
            [id, data.email, registration.name, passwordHash, 0, now()],
          );
          return {
            id,
            email: data.email,
            name: registration.name,
            is_admin: 0,
          };
        });
      } else {
        u = await transaction((db) =>
          db.one("SELECT * FROM users WHERE email=?", [data.email]),
        );
        const valid = await checkPassword(u?.password_hash, data.password);
        if (!u || !valid) fail(401, "Email or password is incorrect.");
      }
      if (!u) throw new HttpError(401, "Unable to log in.");
      return json(publicUser(u), 200, {
        "Set-Cookie": await session(u.id, !!u.is_admin),
      });
    }
    const u = await currentUser(request, path.startsWith("admin"));
    if (method !== "GET") await rateLimit("write:" + u.id, 120, 60);
    if (path === "me" && method === "GET") return json(publicUser(u));
    if (path === "logout" && method === "POST") {
      await transaction((db) =>
        db.query("DELETE FROM sessions WHERE token_hash=?", [
          hash(cookie(request)),
        ]),
      );
      return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
    }
    if (path === "account" && method === "DELETE") {
      await rateLimit("delete:" + u.id, 5, 900);
      const data = parse(deletionSchema, await body(request));
      if (!(await checkPassword(u.password_hash, data.password)))
        fail(401, "Password confirmation failed.");
      await transaction(async (db) => {
        await currentRound(db, true);
        await db.query("DELETE FROM users WHERE id=?", [u.id]);
        await audit(db, "An account and its associated records were deleted.");
      });
      return json({ ok: true }, 200, { "Set-Cookie": clearCookie() });
    }
    if (path === "profile" && method === "PUT") {
      const data = parse(profileSchema, await body(request));
      await transaction(async (db) => {
        const r = await currentRound(db, true);
        openRound(r);
        const settings = await locationSettings(db, r.id);
        if (!locationComplete(data, settings))
          fail(422, "Complete the enabled country and city fields.");
        if (!settings.country_enabled) data.country = "";
        if (!settings.outside_country_enabled) data.outside_country = false;
        if (!settings.city_enabled) {
          data.city = "";
          data.any_city = false;
        }
        await db.query(
          "INSERT INTO profiles(user_id,data,updated_at) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,updated_at=excluded.updated_at",
          [u.id, JSON.stringify(data), now()],
        );
      });
      return json({ ok: true });
    }
    if (
      (path === "survey" && method === "PUT") ||
      (path === "survey/submit" && method === "POST")
    ) {
      const submit = path.endsWith("submit");
      const data = parse(
        submit ? submissionSchema : surveySchema,
        await body(request),
      );
      await transaction(async (db) => {
        const r = await currentRound(db, true);
        openRound(r);
        const profile = await db.one(
          "SELECT data FROM profiles WHERE user_id=?",
          [u.id],
        );
        if (
          !profile ||
          !locationComplete(
            JSON.parse(profile.data),
            await locationSettings(db, r.id),
          )
        )
          fail(
            409,
            "Complete your profile and the currently enabled location fields first.",
          );
        const previous = await db.one(
          "SELECT submitted FROM responses WHERE user_id=? AND round_id=?",
          [u.id, r.id],
        );
        await db.query(
          "INSERT INTO responses(user_id,round_id,answers,submitted,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(user_id,round_id) DO UPDATE SET answers=excluded.answers,submitted=excluded.submitted,updated_at=excluded.updated_at",
          [
            u.id,
            r.id,
            JSON.stringify(data.answers),
            submit ? 1 : previous?.submitted || 0,
            now(),
          ],
        );
      });
      return json({ ok: true });
    }
    if (path === "dashboard" && method === "GET")
      return json(
        await transaction(async (db) => {
          const r = await currentRound(db),
            p = await db.one("SELECT data FROM profiles WHERE user_id=?", [
              u.id,
            ]),
            s = await db.one(
              "SELECT answers,submitted FROM responses WHERE user_id=? AND round_id=?",
              [u.id, r.id],
            );
          const a = s ? JSON.parse(s.answers) : {};
          const settings = await locationSettings(db, r.id);
          const matches =
            r.status === "published"
              ? await db.all(
                  "SELECT m.score,m.details,u.name,p.data FROM matches m JOIN users u ON u.id=m.other_id JOIN profiles p ON p.user_id=m.other_id WHERE m.user_id=? AND m.round_id=? ORDER BY m.score DESC",
                  [u.id, r.id],
                )
              : [];
          return {
            round: roundView(r),
            profile: p ? cleanProfile(JSON.parse(p.data)) : null,
            location_settings: settings,
            answers: a,
            has_profile: !!p,
            answered: Object.keys(a).length,
            submitted: !!s?.submitted,
            matches: matches.map((m) => {
              const profile = JSON.parse(m.data);
              return {
                name: m.name,
                age: profile.age,
                city: [
                  settings.city_enabled ? profile.city : "",
                  settings.country_enabled ? profile.country : "",
                ]
                  .filter(Boolean)
                  .join(", "),
                occupation: profile.occupation,
                score: m.score,
                ...JSON.parse(m.details),
              };
            }),
          };
        }),
      );
    if (path === "admin" && method === "GET")
      return json(
        await transaction(async (db) => {
          const r = await currentRound(db);
          return {
            round: roundView(r),
            participants: Number(
              (await db.one(
                "SELECT COUNT(*) AS n FROM responses WHERE round_id=?",
                [r.id],
              ))!.n,
            ),
            submitted: Number(
              (await db.one(
                "SELECT COUNT(*) AS n FROM responses WHERE round_id=? AND submitted=1",
                [r.id],
              ))!.n,
            ),
            emails_pending: Number(
              (await db.one(
                "SELECT COUNT(*) AS n FROM outbox WHERE round_id=? AND status<>'sent'",
                [r.id],
              ))!.n,
            ),
            events: await db.all(
              "SELECT action,created_at FROM events ORDER BY created_at DESC LIMIT 20",
            ),
            job: await db.one(
              "SELECT id,status,attempts,error FROM jobs WHERE round_id=? ORDER BY created_at DESC LIMIT 1",
              [r.id],
            ),
            database: isNeon() ? "Neon Postgres" : "SQLite (development)",
            location_settings: await locationSettings(db, r.id),
            cache: redis() ? "Upstash Redis" : "memory (development)",
            email_configured: process.env.EMAIL_DELIVERY_CONFIGURED === "true",
          };
        }),
      );
    if (path === "admin/location-settings" && method === "PUT") {
      const data = parse(locationSchema, await body(request));
      await transaction(async (db) => {
        const r = await currentRound(db, true);
        if (!["open", "closed"].includes(r.status))
          fail(409, "Location controls are locked after matching starts.");
        await db.query(
          "INSERT INTO round_settings(round_id,data) VALUES(?,?) ON CONFLICT(round_id) DO UPDATE SET data=excluded.data",
          [r.id, JSON.stringify(data)],
        );
        await audit(db, "Location controls updated: " + JSON.stringify(data));
      });
      return json({ ok: true, location_settings: data });
    }
    if (path === "admin/round" && method === "PUT") {
      const data = parse(scheduleSchema, await body(request));
      if (data.closes_at <= now())
        fail(422, "Choose a closing time in the future.");
      await transaction(async (db) => {
        const r = await currentRound(db, true);
        if (!["open", "closed"].includes(r.status))
          fail(409, "Cannot edit this round after matching starts.");
        await db.query("UPDATE rounds SET title=?,closes_at=? WHERE id=?", [
          data.title,
          data.closes_at,
          r.id,
        ]);
        await audit(db, "Round schedule updated.");
      });
      return json({ ok: true });
    }
    if (path.startsWith("admin/") && method === "POST") {
      const action = path.split("/")[1];
      let jobId: string | undefined;
      const result = await transaction(async (db) => {
        const r = await currentRound(db, true);
        const effective = roundView(r).status;
        if (action === "close") {
          if (r.status !== "open") fail(409, "Round is already closed.");
          await db.query("UPDATE rounds SET status='closed' WHERE id=?", [
            r.id,
          ]);
          await audit(db, "Survey closed.");
        } else if (action === "reopen") {
          if (!["closed", "open"].includes(r.status) || effective !== "closed")
            fail(409, "Only an unmatched closed round can reopen.");
          if (r.closes_at <= now())
            fail(422, "Set a future closing time before reopening.");
          await db.query("UPDATE rounds SET status='open' WHERE id=?", [r.id]);
          await audit(db, "Survey reopened.");
        } else if (action === "generate") {
          if (!["closed", "failed"].includes(effective))
            fail(409, "Close the survey before generating results.");
          const count = Number(
            (await db.one(
              "SELECT COUNT(*) AS n FROM responses WHERE round_id=? AND submitted=1",
              [r.id],
            ))!.n,
          );
          if (count < 1) fail(409, "There are no submitted surveys to match.");
          const settings = await locationSettings(db, r.id);
          const profiles = await db.all(
            "SELECT p.data FROM profiles p JOIN responses s ON s.user_id=p.user_id WHERE s.round_id=? AND s.submitted=1",
            [r.id],
          );
          const incomplete = profiles.filter(
            (p) => !locationComplete(JSON.parse(p.data), settings),
          ).length;
          if (incomplete)
            fail(
              409,
              `${incomplete} submitted profiles need updated location fields. Reopen the round or disable those fields.`,
            );
          jobId = randomUUID();
          await db.query(
            "INSERT INTO jobs(id,round_id,status,created_at) VALUES(?,?,?,?)",
            [jobId, r.id, "queued", now()],
          );
          await db.query("UPDATE rounds SET status='matching' WHERE id=?", [
            r.id,
          ]);
          await audit(db, "Matching job queued.");
        } else if (action === "publish") {
          if (r.status !== "ready")
            fail(409, "Wait for matching to finish before revealing results.");
          await db.query("UPDATE rounds SET status='published' WHERE id=?", [
            r.id,
          ]);
          const participants = await db.all(
            "SELECT user_id FROM responses WHERE round_id=? AND submitted=1",
            [r.id],
          );
          for (const row of participants)
            await db.query(
              "INSERT INTO outbox(id,round_id,user_id,status) VALUES(?,?,?,?) ON CONFLICT(round_id,user_id) DO NOTHING",
              [randomUUID(), r.id, row.user_id, "pending"],
            );
          await audit(db, "Results revealed and notification emails queued.");
        } else if (action === "new-round") {
          if (r.status !== "published")
            fail(409, "Reveal the current round before opening another.");
          const nextId = randomUUID();
          const settings = await locationSettings(db, r.id);
          await db.query(
            "INSERT INTO rounds(id,title,status,closes_at,created_at) VALUES(?,?,?,?,?)",
            [nextId, "A new orbit", "open", now() + 3 * 86400, now()],
          );
          await db.query(
            "INSERT INTO round_settings(round_id,data) VALUES(?,?)",
            [nextId, JSON.stringify(settings)],
          );
          await audit(db, "A new matching round opened.");
        } else if (action === "retry-emails") {
          await db.query(
            "UPDATE outbox SET status='pending',attempts=0,next_attempt=0,error=NULL WHERE round_id=? AND status='failed'",
            [r.id],
          );
          await audit(db, "Failed email notifications queued for retry.");
        } else fail(404, "Unknown admin action.");
        return { ok: true, job_id: jobId || null };
      });
      // Neon is the durable source of truth. Redis only accelerates discovery.
      if (jobId) {
        try {
          await redis()?.lpush("orbit:matching:jobs", jobId);
        } catch {
          console.warn(
            "Redis wake-up unavailable; worker will discover durable job.",
          );
        }
      }
      return json(result, action === "generate" ? 202 : 200);
    }
    fail(404, "This endpoint does not exist.");
  } catch (caught) {
    const error =
      caught instanceof HttpError
        ? caught
        : new HttpError(
            500,
            "The service could not complete this request. Please try again.",
          );
    if (error.status === 500)
      console.error("Orbit request failed:", error.name);
    return json(
      {
        detail: error.status
          ? error.message
          : "The service could not complete this request. Please try again.",
      },
      error.status || 500,
    );
  }
}
