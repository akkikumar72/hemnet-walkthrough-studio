import http from "node:http";
import { readFile, writeFile, mkdir, readdir, rename } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID, randomBytes } from "node:crypto";
import { importListing, listingURL, savePhoto } from "./importer.js";
import { analyzeProject } from "./analyze.js";
import { validateScene, reviewScene } from "./scene.js";
import { unrealBundle } from "./unreal.js";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
export async function createStudio({
  workspace = path.join(ROOT, "workspace"),
  fetcher = fetch,
  apiKey = process.env.OPENAI_API_KEY || "",
  model = process.env.OPENAI_MODEL || "gpt-6-astra",
} = {}) {
  await mkdir(workspace, { recursive: true, mode: 0o700 });
  const csrf = randomBytes(32).toString("hex"),
    running = new Set();
  const folder = (id) => {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid project ID.");
    return path.join(workspace, id);
  };
  const load = async (id) =>
    JSON.parse(await readFile(path.join(folder(id), "project.json")));
  const save = async (p) => {
    const dir = folder(p.id);
    await mkdir(dir, { recursive: true });
    p.updatedAt = new Date().toISOString();
    const tmp = path.join(dir, `${randomUUID()}.tmp`);
    await writeFile(tmp, JSON.stringify(p, null, 2), { mode: 0o600 });
    await rename(tmp, path.join(dir, "project.json"));
  };
  const send = (res, status, data, type = "application/json") => {
    res.writeHead(status, {
      "Content-Type": type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
    });
    res.end(type === "application/json" ? JSON.stringify(data) : data);
  };
  async function body(req) {
    let size = 0,
      parts = [];
    for await (const c of req) {
      size += c.length;
      if (size > 22 * 1024 * 1024)
        throw new Error(
          "Request too large. Upload one photo at a time, under 15 MB.",
        );
      parts.push(c);
    }
    try {
      return JSON.parse(Buffer.concat(parts).toString() || "{}");
    } catch {
      throw new Error("Invalid JSON body.");
    }
  }
  const publicProject = (p) => ({ ...p, busy: running.has(p.id) });
  const server = http.createServer(async (req, res) => {
    try {
      if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || ""))
        return send(res, 403, { error: "Local access only." });
      const url = new URL(req.url, "http://" + req.headers.host),
        parts = url.pathname.split("/").filter(Boolean);
      if (req.method !== "GET" && req.method !== "HEAD") {
        if (req.headers["x-studio-token"] !== csrf)
          return send(res, 403, {
            error: "Refresh this local page before making changes.",
          });
        if (req.headers.origin && req.headers.origin !== url.origin)
          return send(res, 403, {
            error: "Cross-origin requests are not allowed.",
          });
        if (!req.headers["content-type"]?.startsWith("application/json"))
          return send(res, 415, { error: "JSON required." });
      }
      if (url.pathname === "/api/config" && req.method === "GET")
        return send(res, 200, { csrf, apiKeyConfigured: !!apiKey, model });
      if (url.pathname === "/api/example" && req.method === "GET")
        return send(
          res,
          200,
          JSON.parse(
            await readFile(path.join(ROOT, "examples/demo-scene.json")),
          ),
        );
      if (url.pathname === "/api/projects" && req.method === "GET") {
        const projects = [];
        for (const id of await readdir(workspace)) {
          if (!/^[a-f0-9-]{36}$/.test(id)) continue;
          try {
            const p = await load(id);
            projects.push({
              id: p.id,
              title: p.title,
              status: running.has(id)
                ? p.status
                : p.status === "analyzing" || p.status === "importing"
                  ? "interrupted"
                  : p.status,
              updatedAt: p.updatedAt,
              photoCount: p.photos.length,
              hasScene: !!p.scene,
            });
          } catch {
            /* Ignore incomplete folders. */
          }
        }
        return send(
          res,
          200,
          projects.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
        );
      }
      if (url.pathname === "/api/projects" && req.method === "POST") {
        const b = await body(req);
        if (b.rights !== true)
          throw new Error(
            "Confirm that you have permission to use the reference photos.",
          );
        if (b.url) listingURL(b.url);
        const p = {
          id: randomUUID(),
          title: String(b.title || "Untitled home").slice(0, 200),
          url: b.url ? listingURL(b.url) : "",
          description: "",
          photos: [],
          status: b.url ? "importing" : "references",
          message: "",
          rightsConfirmedAt: new Date().toISOString(),
          scene: null,
          warnings: [],
        };
        await save(p);
        if (p.url) {
          running.add(p.id);
          (async () => {
            try {
              Object.assign(
                p,
                await importListing(
                  p.url,
                  folder(p.id),
                  async (message, partial) => {
                    Object.assign(p, partial);
                    p.message = message;
                    await save(p);
                  },
                  fetcher,
                ),
              );
              p.status = "references";
              p.message =
                "Photos imported. Review and select the evidence before generating.";
            } catch (error) {
              p.status = "import-failed";
              p.message =
                (p.expectedPhotos
                  ? `Downloaded ${p.photos.length} of ${p.expectedPhotos} photos. `
                  : "") + error.message;
            } finally {
              try {
                await save(p);
              } finally {
                running.delete(p.id);
              }
            }
          })();
        }
        return send(res, 201, publicProject(p));
      }
      if (url.pathname === "/api/demo" && req.method === "POST") {
        const scene = JSON.parse(
          await readFile(path.join(ROOT, "examples/demo-scene.json")),
        );
        validateScene(scene);
        const p = {
          id: randomUUID(),
          title: scene.title,
          url: "",
          description:
            "Original fictional demonstration. No listing photographs.",
          photos: [],
          status: "draft",
          message:
            "Fictional demo. Import your own listing to create a new reconstruction.",
          scene,
          warnings: reviewScene(scene),
          demo: true,
        };
        await save(p);
        return send(res, 201, p);
      }
      if (parts[0] === "api" && parts[1] === "projects" && parts[2]) {
        const p = await load(parts[2]),
          dir = folder(p.id),
          action = parts[3];
        if (req.method === "GET" && !action) {
          if (
            !running.has(p.id) &&
            ["analyzing", "importing"].includes(p.status)
          ) {
            p.status = "interrupted";
            p.message =
              "The previous process stopped. Review saved photos and retry explicitly.";
          }
          return send(res, 200, publicProject(p));
        }
        if (req.method === "GET" && action === "photos" && parts[4]) {
          const photo = p.photos.find((x) => x.id === parts[4]);
          if (!photo) return send(res, 404, { error: "Photo not found." });
          return send(
            res,
            200,
            await readFile(path.join(dir, "photos", photo.file)),
            `image/${photo.type}`,
          );
        }
        if (req.method === "GET" && action === "scene")
          return send(res, 200, p.scene);
        if (req.method === "GET" && action === "unreal") {
          if (!p.scene) throw new Error("Generate or import a scene first.");
          res.setHeader(
            "Content-Disposition",
            'attachment; filename="UnrealHome.zip"',
          );
          return send(res, 200, await unrealBundle(p.scene), "application/zip");
        }
        if (running.has(p.id))
          return send(res, 409, {
            error:
              "This project is busy. Wait for the current operation to finish.",
          });
        if (req.method === "POST" && action === "photos") {
          if (p.photos.length >= 150)
            throw new Error("A project supports up to 150 photos.");
          const b = await body(req);
          if (
            typeof b.data !== "string" ||
            !/^data:image\/(jpeg|png|webp);base64,/.test(b.data)
          )
            throw new Error("Upload a JPEG, PNG or WebP photo.");
          p.photos.push(
            await savePhoto(
              dir,
              Buffer.from(b.data.split(",")[1], "base64"),
              p.photos.length + 1,
            ),
          );
          p.status = "references";
          p.message = "Photos ready for review.";
          await save(p);
          return send(res, 201, p);
        }
        if (req.method === "PATCH" && action === "photos") {
          const b = await body(req);
          if (!Array.isArray(b.photos))
            throw new Error("Photo selections are required.");
          for (const item of b.photos) {
            const photo = p.photos.find((p) => p.id === item.id);
            if (
              !photo ||
              typeof item.selected !== "boolean" ||
              ![
                "unreviewed",
                "interior",
                "floor-plan",
                "exterior",
                "exclude",
              ].includes(item.category)
            )
              throw new Error("Invalid photo selection.");
            photo.selected = item.selected && item.category !== "exclude";
            photo.category = item.category;
          }
          await save(p);
          return send(res, 200, p);
        }
        if (req.method === "POST" && action === "analyze") {
          const b = await body(req);
          if (b.consent !== true)
            throw new Error(
              "Confirm sending selected photos to OpenAI for a billable request.",
            );
          const key =
            typeof b.apiKey === "string" && b.apiKey ? b.apiKey : apiKey;
          if (!key)
            throw new Error("Add an OpenAI API key in Settings or .env.");
          running.add(p.id);
          p.status = "analyzing";
          p.message =
            "OpenAI is reconstructing the selected photos. This can take several minutes.";
          await save(p);
          (async () => {
            try {
              const result = await analyzeProject(p, dir, {
                key,
                model: b.model || model,
                notes: b.notes || "",
                fetcher,
              });
              if (p.scene)
                await writeFile(
                  path.join(dir, `scene-${Date.now()}-${randomUUID()}.json`),
                  JSON.stringify(p.scene),
                );
              Object.assign(p, result);
              p.status = "draft";
              p.message =
                "Editable draft ready. Review geometry and source correspondence.";
            } catch (error) {
              p.status = "analysis-failed";
              p.message = error.message.replaceAll(key, "[redacted]");
            } finally {
              try {
                await save(p);
              } finally {
                running.delete(p.id);
              }
            }
          })();
          return send(res, 202, publicProject(p));
        }
        if (req.method === "PUT" && action === "scene") {
          const b = await body(req);
          validateScene(b, p.photos.length ? p.photos : null);
          if (p.scene)
            await writeFile(
              path.join(dir, `scene-${Date.now()}-${randomUUID()}.json`),
              JSON.stringify(p.scene),
            );
          p.scene = b;
          p.title = b.title;
          p.warnings = reviewScene(b);
          p.status = "draft";
          await save(p);
          return send(res, 200, p);
        }
        return send(res, 404, { error: "Unknown project action." });
      }
      if (req.method !== "GET") return send(res, 404, { error: "Not found." });
      let file;
      if (url.pathname.startsWith("/vendor/"))
        file = path.join(ROOT, "node_modules/three", url.pathname.slice(8));
      else
        file = path.join(
          ROOT,
          "public",
          url.pathname === "/" ? "index.html" : url.pathname,
        );
      const base = url.pathname.startsWith("/vendor/")
        ? path.join(ROOT, "node_modules/three")
        : path.join(ROOT, "public");
      if (!file.startsWith(base + path.sep))
        return send(res, 403, { error: "Invalid path." });
      const types = {
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript",
        ".css": "text/css",
        ".svg": "image/svg+xml",
        ".png": "image/png",
      };
      return send(
        res,
        200,
        await readFile(file),
        types[path.extname(file)] || "application/octet-stream",
      );
    } catch (error) {
      const status = error.code === "ENOENT" ? 404 : 400;
      send(res, status, {
        error: status === 404 ? "Not found." : error.message,
      });
    }
  });
  return server;
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const server = await createStudio();
  const port = Number(process.env.PORT || 8770);
  server.listen(port, "127.0.0.1", () =>
    console.log(`Walkthrough Studio: http://127.0.0.1:${port}`),
  );
}
