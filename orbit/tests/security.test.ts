import test from "node:test";
import assert from "node:assert/strict";
import {
  checkOrigin,
  hashPassword,
  checkPassword,
  HttpError,
} from "../src/server/security";
import { readJsonBody } from "../src/server/request-body";
import { profileSchema, parse } from "../src/server/validation";
process.env.APP_ENV = "development";
process.env.ALLOWED_ORIGINS = "http://localhost:3000";

test("mutation checks reject missing origins, foreign origins and non-JSON bodies", () => {
  const make = (headers: Record<string, string>) =>
    new Request("http://localhost:3000/api/profile", {
      method: "PUT",
      headers,
    });
  assert.throws(
    () => checkOrigin(make({ "content-type": "application/json" })),
    HttpError,
  );
  assert.throws(
    () =>
      checkOrigin(
        make({
          origin: "https://evil.example",
          "content-type": "application/json",
        }),
      ),
    HttpError,
  );
  assert.throws(
    () =>
      checkOrigin(
        make({ origin: "http://localhost:3000", "content-type": "text/plain" }),
      ),
    HttpError,
  );
  assert.throws(
    () =>
      checkOrigin(
        make({
          origin: "http://localhost:3000",
          "content-type": "application/json",
          "sec-fetch-site": "cross-site",
        }),
      ),
    HttpError,
  );
  assert.doesNotThrow(() =>
    checkOrigin(
      make({
        origin: "http://localhost:3000",
        "content-type": "application/json; charset=utf-8",
      }),
    ),
  );
});
test("JSON reader bounds bytes even without a content-length header", async () => {
  const request = new Request("http://localhost/api", {
    method: "POST",
    body: JSON.stringify({ value: "💚".repeat(7000) }),
  });
  await assert.rejects(
    readJsonBody(request),
    (e) => e instanceof HttpError && e.status === 413,
  );
  await assert.rejects(
    readJsonBody(
      new Request("http://localhost/api", { method: "POST", body: "not json" }),
    ),
    (e) => e instanceof HttpError && e.status === 400,
  );
  assert.deepEqual(
    await readJsonBody(
      new Request("http://localhost/api", {
        method: "POST",
        body: '{"ok":true}',
      }),
    ),
    { ok: true },
  );
});
test("password hashes use independent salts and compare correctly", async () => {
  const a = await hashPassword("a-test-password-123"),
    b = await hashPassword("a-test-password-123");
  assert.notEqual(a, b);
  assert.ok(await checkPassword(a, "a-test-password-123"));
  assert.equal(await checkPassword(a, "another-password-123"), false);
  assert.equal(await checkPassword(undefined, "a-test-password-123"), false);
});
test("profile validation does not accept permission escalation fields", () => {
  assert.throws(() =>
    parse(profileSchema, {
      age: 25,
      city: "City",
      occupation: "Designer",
      gender: "Man",
      orientation: "",
      intention: "Dating",
      seeking: ["Woman"],
      min_age: 18,
      max_age: 40,
      any_city: false,
      bio: "",
      is_admin: true,
    }),
  );
});
