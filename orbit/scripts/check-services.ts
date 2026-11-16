import { initDb, transaction } from "../src/server/db";
import { redis } from "../src/server/security";

try {
  await initDb();
  const row = await transaction((db) => db.one("SELECT 1 AS ok"));
  console.log(
    "Neon database: " +
      (Number(row?.ok) === 1
        ? "connected; schema ready"
        : "unexpected response"),
  );
  const cache = redis();
  if (!cache) throw new Error("Redis is not configured");
  console.log("Upstash Redis: " + (await cache.ping()));
} catch (error) {
  console.error(
    "Service verification failed: " +
      (error instanceof Error ? error.name : "unknown error"),
  );
  process.exitCode = 1;
} finally {
  await globalThis.__orbitPool?.end();
}
