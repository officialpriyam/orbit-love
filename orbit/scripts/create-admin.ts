import readline from "node:readline/promises";
import { randomUUID } from "node:crypto";
import { transaction, now } from "../src/server/db.ts";
import { hashPassword } from "../src/server/security.ts";
import { parse, registerSchema } from "../src/server/validation.ts";
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});
try {
  const email = await rl.question("Admin email: "),
    name = await rl.question("Admin display name: ");
  // Supply password through stdin; never command-line arguments or source files.
  const password = await rl.question(
    "Admin password (12+ characters; terminal input is visible): ",
  );
  const input = parse(registerSchema, { email, name, password, consent: true });
  const encoded = await hashPassword(input.password);
  await transaction(async (db) => {
    const existing = await db.one("SELECT id FROM users WHERE email=?", [
      input.email,
    ]);
    if (existing)
      throw Error(
        "Account exists. Use a deliberate database migration to promote an existing account.",
      );
    await db.query(
      "INSERT INTO users(id,email,name,password_hash,is_admin,created_at) VALUES(?,?,?,?,?,?)",
      [randomUUID(), input.email, input.name, encoded, 1, now()],
    );
  });
  console.log("Admin created.");
} finally {
  rl.close();
  if (globalThis.__orbitPool) await globalThis.__orbitPool.end();
}
