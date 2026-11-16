// A clearly labelled static preview. The full app remains a Next.js Node server.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
const root = process.cwd();
const staging = path.join(root, ".preview-build");
const output = path.join(root, "dist");
for (const target of [staging, output]) {
  if (path.dirname(target) !== root) throw Error("Output escaped project root");
  fs.rmSync(target, { recursive: true, force: true });
}
fs.mkdirSync(path.join(staging, "src"), { recursive: true });
fs.cpSync("src/app", path.join(staging, "src/app"), {
  recursive: true,
  filter: (p) => !p.split(path.sep).includes("api"),
});
fs.cpSync("src/features", path.join(staging, "src/features"), {
  recursive: true,
});
fs.cpSync("public", path.join(staging, "public"), { recursive: true });
fs.copyFileSync("tsconfig.json", path.join(staging, "tsconfig.json"));
fs.copyFileSync("next-env.d.ts", path.join(staging, "next-env.d.ts"));
const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
fs.writeFileSync(
  path.join(staging, "package.json"),
  JSON.stringify({
    private: true,
    type: "module",
    dependencies: pkg.dependencies,
  }),
);
fs.writeFileSync(
  path.join(staging, "next.config.mjs"),
  `export default {output:'export',images:{unoptimized:true},turbopack:{root:${JSON.stringify(root)}}};`,
);
const result = spawnSync(
  process.execPath,
  [path.join(root, "node_modules/next/dist/bin/next"), "build", staging],
  {
    cwd: root,
    stdio: "inherit",
    env: {
      ...process.env,
      ORBIT_PREVIEW_EXPORT: "1",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
if (result.status !== 0) process.exit(result.status || 1);
fs.cpSync(path.join(staging, "out"), output, { recursive: true });
console.log("Built labelled interactive preview in dist/.");
