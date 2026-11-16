import test from "node:test";
import assert from "node:assert/strict";
import { allowedOrigins, production } from "../src/server/origins";
import { checkOrigin } from "../src/server/security";

const deployment = {
  VERCEL: "1",
  VERCEL_ENV: "production",
  VERCEL_URL: "orbit-abc-team.vercel.app",
  VERCEL_BRANCH_URL: "orbit-git-main-team.vercel.app",
  VERCEL_PROJECT_PRODUCTION_URL: "orbit.example.com",
};
test("Vercel allows only exact project deployment and production origins", () => {
  assert.deepEqual(allowedOrigins(deployment), [
    "https://orbit-abc-team.vercel.app",
    "https://orbit-git-main-team.vercel.app",
    "https://orbit.example.com",
  ]);
  assert.equal(production({ ...deployment, APP_ENV: "development" }), true);
  assert.equal(
    allowedOrigins(deployment).includes("https://unrelated.vercel.app"),
    false,
  );
  assert.deepEqual(allowedOrigins({ ...deployment, VERCEL_ENV: "preview" }), [
    "https://orbit-abc-team.vercel.app",
    "https://orbit-git-main-team.vercel.app",
  ]);
});
test("explicit domains are normalized and merged; invalid origins fail closed", () => {
  assert.ok(
    allowedOrigins({
      ...deployment,
      APP_URL: "https://custom.example/",
      ALLOWED_ORIGINS: " https://extra.example ,https://custom.example",
    }).includes("https://custom.example"),
  );
  for (const value of [
    "http://localhost:3000",
    "https://*.vercel.app",
    "https://user:pass@example.com",
    "https://example.com/path",
    "https://example.com?x=1",
    "null",
  ]) {
    assert.throws(() =>
      allowedOrigins({ ...deployment, ALLOWED_ORIGINS: value }),
    );
  }
  assert.throws(() => allowedOrigins({ APP_ENV: "production" }));
  assert.deepEqual(allowedOrigins({ APP_ENV: "development" }), [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
});
test("Vercel mutation checks reject foreign origins even with forged host headers", () => {
  const values = {
    ...deployment,
    APP_ENV: "production",
    APP_URL: "",
    ALLOWED_ORIGINS: "",
  };
  const before = Object.fromEntries(
    Object.keys(values).map((k) => [k, process.env[k]]),
  );
  try {
    Object.assign(process.env, values);
    const request = (origin: string) =>
      new Request("https://orbit.example.com/api/profile", {
        method: "PUT",
        headers: {
          origin,
          "content-type": "application/json",
          host: "evil.vercel.app",
          "x-forwarded-host": "evil.vercel.app",
        },
      });
    assert.doesNotThrow(() =>
      checkOrigin(request("https://orbit.example.com")),
    );
    assert.throws(() => checkOrigin(request("https://evil.vercel.app")));
    assert.throws(() =>
      checkOrigin(request("https://orbit.example.com.evil.test")),
    );
  } finally {
    for (const [key, value] of Object.entries(before)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
