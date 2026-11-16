import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
const temp = mkdtempSync(path.join(tmpdir(), "orbit-test-"));
process.env.SQLITE_PATH = path.join(temp, "orbit.db");
process.env.APP_ENV = "development";
// Explicit empty values prevent the Python service's dotenv loader from using live credentials.
process.env.DATABASE_URL = "";
process.env.UPSTASH_REDIS_REST_URL = "";
process.env.UPSTASH_REDIS_REST_TOKEN = "";
const { handle } = await import("../src/server/api.ts");
const { transaction } = await import("../src/server/db.ts");
const answers = Object.fromEntries(
  Array.from({ length: 40 }, (_, i) => [String(i + 1), "A"]),
);
const base = {
  age: 25,
  city: "Bengaluru",
  occupation: "Designer",
  gender: "Non-binary",
  orientation: "Queer",
  intention: "Dating",
  seeking: ["Non-binary"],
  min_age: 18,
  max_age: 40,
  any_city: false,
  bio: "Hello",
};
async function request(
  endpoint: string,
  method = "GET",
  data?: unknown,
  cookie = "",
  origin = "http://localhost:3000",
) {
  const r = await handle(
    new Request("http://localhost:3000/api/" + endpoint, {
      method,
      headers: { origin, cookie, "Content-Type": "application/json" },
      ...(data ? { body: JSON.stringify(data) } : {}),
    }),
    endpoint.split("/"),
  );
  return {
    status: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0] || "",
  };
}
test("registration → submission → independent worker → private reveal → deletion", async () => {
  try {
    assert.equal((await request("admin")).status, 401);
    const a = await request("register", "POST", {
      name: "Alex",
      email: "alex@example.com",
      password: "long-password-one",
      consent: true,
    });
    const b = await request("register", "POST", {
      name: "River",
      email: "river@example.com",
      password: "long-password-two",
      consent: true,
    });
    assert.equal(a.status, 200);
    assert.equal(b.status, 200);
    assert.equal(
      (await request("admin", "GET", undefined, a.cookie)).status,
      403,
    );
    assert.equal(
      (
        await request(
          "profile",
          "PUT",
          base,
          a.cookie,
          "https://attacker.example",
        )
      ).status,
      403,
    );
    assert.equal(
      (await request("profile", "PUT", { ...base, age: 17 }, a.cookie)).status,
      422,
    );
    assert.equal(
      (
        await request("login", "POST", {
          email: "alex@example.com",
          password: "wrong-password-here",
        })
      ).status,
      401,
    );
    for (const cookie of [a.cookie, b.cookie]) {
      assert.equal((await request("profile", "PUT", base, cookie)).status, 200);
      assert.equal(
        (
          await request(
            "survey/submit",
            "POST",
            { answers: { "1": "A" }, consent: true },
            cookie,
          )
        ).status,
        422,
      );
      assert.equal(
        (
          await request(
            "survey/submit",
            "POST",
            { answers, consent: true },
            cookie,
          )
        ).status,
        200,
      );
    }
    await transaction((db) =>
      db.query("UPDATE users SET is_admin=1 WHERE id=?", [a.data.id]),
    );
    const settings = {
      country_enabled: false,
      outside_country_enabled: false,
      city_enabled: false,
    };
    assert.equal(
      (await request("admin/location-settings", "PUT", settings, b.cookie))
        .status,
      403,
    );
    assert.equal(
      (
        await request(
          "admin/location-settings",
          "PUT",
          { ...settings, outside_country_enabled: true },
          a.cookie,
        )
      ).status,
      422,
    );
    assert.equal(
      (
        await request(
          "admin/location-settings",
          "PUT",
          { ...settings, country_enabled: true },
          a.cookie,
        )
      ).status,
      200,
    );
    assert.equal((await request("profile", "PUT", base, b.cookie)).status, 422);
    assert.equal(
      (
        await request(
          "survey/submit",
          "POST",
          { answers, consent: true },
          b.cookie,
        )
      ).status,
      409,
    );
    assert.equal(
      (await request("admin/location-settings", "PUT", settings, a.cookie))
        .status,
      200,
    );
    assert.equal(
      (await request("profile", "PUT", { ...base, city: "" }, b.cookie)).status,
      200,
    );
    assert.equal(
      (await request("admin/generate", "POST", {}, a.cookie)).status,
      409,
    );
    assert.equal(
      (await request("admin/close", "POST", {}, a.cookie)).status,
      200,
    );
    assert.equal(
      (await request("survey", "PUT", { answers }, b.cookie)).status,
      409,
    );
    assert.equal((await request("profile", "PUT", base, b.cookie)).status, 409);
    assert.equal(
      (await request("admin/generate", "POST", {}, a.cookie)).status,
      202,
    );
    assert.equal(
      (await request("admin/location-settings", "PUT", settings, a.cookie))
        .status,
      409,
    );
    assert.equal(
      (await request("admin/generate", "POST", {}, a.cookie)).status,
      409,
    );
    const python =
      process.env.TEST_PYTHON ||
      path.resolve("../orbit-matching-service/.venv/Scripts/python.exe");
    const result = spawnSync(python, ["-m", "matching.worker", "--once"], {
      cwd: path.resolve("../orbit-matching-service"),
      env: { ...process.env, RESEND_API_KEY: "", OPENROUTER_API_KEY: "" },
      encoding: "utf8",
      timeout: 60000,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      (await request("admin", "GET", undefined, a.cookie)).data.round.status,
      "ready",
    );
    assert.equal(
      (await request("dashboard", "GET", undefined, b.cookie)).data.matches
        .length,
      0,
    );
    assert.equal(
      (await request("admin/publish", "POST", {}, a.cookie)).status,
      200,
    );
    assert.equal(
      (await request("admin/publish", "POST", {}, a.cookie)).status,
      409,
    );
    const d = (await request("dashboard", "GET", undefined, b.cookie)).data;
    assert.equal(d.matches.length, 1);
    assert.equal(d.matches[0].score, 100);
    assert.equal(d.matches[0].email, undefined);
    assert.equal(d.matches[0].orientation, undefined);
    assert.equal(d.matches[0].answers, undefined);
    assert.equal(d.matches[0].city, "");
    assert.equal(
      (await request("admin", "GET", undefined, a.cookie)).data.emails_pending,
      2,
    );
    assert.equal(
      (await request("account", "DELETE", {}, b.cookie)).status,
      422,
    );
    assert.equal(
      (
        await request(
          "account",
          "DELETE",
          { password: "incorrect-password" },
          b.cookie,
        )
      ).status,
      401,
    );
    assert.equal((await request("me", "GET", undefined, b.cookie)).status, 200);
    assert.equal(
      (
        await request(
          "account",
          "DELETE",
          { password: "long-password-two" },
          b.cookie,
        )
      ).status,
      200,
    );
    assert.equal((await request("me", "GET", undefined, b.cookie)).status, 401);
    assert.equal(
      (await request("dashboard", "GET", undefined, a.cookie)).data.matches
        .length,
      0,
    );
    assert.equal(
      (await request("admin/new-round", "POST", {}, a.cookie)).status,
      200,
    );
    assert.equal(
      (await request("dashboard", "GET", undefined, a.cookie)).data.submitted,
      false,
    );
    assert.deepEqual(
      (await request("admin", "GET", undefined, a.cookie)).data
        .location_settings,
      settings,
    );
    assert.equal((await request("logout", "POST", {}, a.cookie)).status, 200);
    assert.equal((await request("me", "GET", undefined, a.cookie)).status, 401);
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
});
