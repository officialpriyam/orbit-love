import { initDb } from "../src/server/db.ts";
await initDb();
console.log("Orbit schema initialized.");
if (globalThis.__orbitPool) await globalThis.__orbitPool.end();
