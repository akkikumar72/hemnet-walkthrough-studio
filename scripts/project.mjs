#!/usr/bin/env node
// Local automation bridge for Codex and ordinary command-line use.
import { readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
const [command, ...args] = process.argv.slice(2);
const base = new URL(process.env.STUDIO_URL || "http://127.0.0.1:8770");
if (
  !["127.0.0.1", "localhost"].includes(base.hostname) ||
  base.protocol !== "http:"
)
  throw new Error("STUDIO_URL must be a local HTTP address.");
const usage = `Usage: node scripts/project.mjs <command>
  list
  demo
  new "Project title" --rights
  import-link "https://www.hemnet.se/bostad/..." --rights
  show PROJECT_ID
  add-photos PROJECT_ID DIRECTORY
  put-scene PROJECT_ID SCENE.json
  export-unreal PROJECT_ID OUTPUT.zip
The local app must be running. No API key is needed for these commands.
Use only photos you have permission to use. Private data stays in workspace/.`;
if (!command || command === "--help") {
  console.log(usage);
  process.exit(0);
}
try {
  const config = await (await fetch(new URL("/api/config", base))).json();
  async function call(route, method = "GET", data) {
    const r = await fetch(new URL(route, base), {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Studio-Token": config.csrf,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    if (!r.ok) {
      const e = await r.json();
      throw new Error(e.error);
    }
    return r;
  }
  const id = args[0];
  const projectPath = () => {
    if (!/^[a-f0-9-]{36}$/.test(id || ""))
      throw new Error("Provide a project ID from the list command.");
    return "/api/projects/" + id;
  };
  let result;
  switch (command) {
    case "list":
      result = await (await call("/api/projects")).json();
      break;
    case "demo":
      result = await (await call("/api/demo", "POST", {})).json();
      break;
    case "new":
    case "import-link":
      if (!args[0] || !args.includes("--rights"))
        throw new Error(
          "Supply the title/link and --rights to confirm photo-use permission.",
        );
      result = await (
        await call("/api/projects", "POST", {
          [command === "new" ? "title" : "url"]: args[0],
          rights: true,
        })
      ).json();
      break;
    case "show":
      result = await (await call(projectPath())).json();
      break;
    case "add-photos": {
      if (!args[1]) throw new Error("Supply the photo directory.");
      const files = (await readdir(args[1], { withFileTypes: true }))
        .filter((f) => f.isFile() && /\.(jpe?g|png|webp)$/i.test(f.name))
        .sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true }),
        );
      if (!files.length) throw new Error("No JPEG, PNG or WebP files found.");
      for (const file of files) {
        const bytes = await readFile(path.join(args[1], file.name));
        if (bytes.length > 15 * 1024 * 1024)
          throw new Error(file.name + " exceeds 15 MB.");
        const ext = path.extname(file.name).toLowerCase(),
          type = ext === ".png" ? "png" : ext === ".webp" ? "webp" : "jpeg";
        result = await (
          await call(projectPath() + "/photos", "POST", {
            data: `data:image/${type};base64,${bytes.toString("base64")}`,
          })
        ).json();
        console.error("Imported " + file.name);
      }
      break;
    }
    case "put-scene":
      if (!args[1]) throw new Error("Supply scene.json.");
      result = await (
        await call(
          projectPath() + "/scene",
          "PUT",
          JSON.parse(await readFile(args[1], "utf8")),
        )
      ).json();
      break;
    case "export-unreal": {
      if (!args[1]) throw new Error("Supply the output ZIP path.");
      const response = await call(projectPath() + "/unreal");
      await writeFile(args[1], Buffer.from(await response.arrayBuffer()), {
        flag: "wx",
      });
      result = { exported: path.resolve(args[1]) };
      break;
    }
    default:
      throw new Error(usage);
  }
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(
    error.cause?.code === "ECONNREFUSED"
      ? "Start the app with npm start first."
      : error.message,
  );
  process.exitCode = 1;
}
