#!/usr/bin/env node
import { cp, mkdir, rename, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const args = process.argv.slice(2);
if (args.length && !(args.length === 2 && args[0] === "--dest"))
  throw new Error("Usage: npm run skill:install [-- --dest /path/to/skills]");
const parent = path.resolve(
  args[1] ||
    path.join(
      process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
      "skills",
    ),
);
const dest = path.join(parent, "unreal-home-wizard");
const source = fileURLToPath(
  new URL("../skills/unreal-home-wizard", import.meta.url),
);
if (dest === source || source.startsWith(dest + path.sep))
  throw new Error(
    "Choose an installation directory outside this source skill.",
  );
await mkdir(parent, { recursive: true });
const previous = await stat(dest).then(
  () => true,
  (e) => {
    if (e.code === "ENOENT") return false;
    throw e;
  },
);
if (previous) {
  const backupParent = path.join(parent, ".backups");
  await mkdir(backupParent, { recursive: true });
  const backup = path.join(
    backupParent,
    "unreal-home-wizard-" + new Date().toISOString().replace(/[:.]/g, "-"),
  );
  await rename(dest, backup);
  console.log("Previous skill backed up to " + backup);
}
await cp(source, dest, { recursive: true, errorOnExist: true, force: false });
console.log(
  "Installed " +
    dest +
    "\nStart a fresh Codex task, then invoke $unreal-home-wizard.",
);
