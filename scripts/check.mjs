import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
async function files(dir) {
  return (
    await Promise.all(
      (await readdir(dir, { withFileTypes: true })).map((e) =>
        e.isDirectory()
          ? files(path.join(dir, e.name))
          : [path.join(dir, e.name)],
      ),
    )
  ).flat();
}
const source = (
  await Promise.all(["src", "public", "scripts", "tests"].map(files))
)
  .flat()
  .filter((f) => /\.(js|mjs)$/.test(f));
for (const file of source) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });
  if (result.status) process.exit(result.status);
}
const html = await readFile("public/index.html", "utf8");
const ids = [...html.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
if (new Set(ids).size !== ids.length) throw new Error("Duplicate HTML IDs");
const app = await readFile("public/app.js", "utf8");
for (const m of app.matchAll(/\$\(["']([^"']+)["']\)/g))
  if (!ids.includes(m[1])) throw new Error("Missing DOM target: " + m[1]);
console.log(
  `Syntax checked ${source.length} modules; DOM bindings are consistent.`,
);
