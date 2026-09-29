import path from "node:path";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));

// A fixed list keeps private inputs, other homes and project files inaccessible.
export function showcaseFiles(noaksRoot) {
  return new Map([
    [
      "/showcase/noaks/kitchen.jpg",
      path.join(noaksRoot, "PrivateInput/Hemnet/08.jpg"),
    ],
    [
      "/showcase/noaks/living.jpg",
      path.join(noaksRoot, "PrivateInput/Hemnet/14.jpg"),
    ],
    [
      "/showcase/noaks/attic.jpg",
      path.join(noaksRoot, "PrivateInput/Hemnet/31.jpg"),
    ],
    ["/showcase/noaks/poster.jpg", path.join(ROOT, ".local/noaks-poster.jpg")],
    [
      "/showcase/noaks/film.mp4",
      path.join(noaksRoot, "Results/Video/NoaksVag_Exterior14_4K60.mp4"),
    ],
  ]);
}

export async function streamMedia(req, res, file) {
  let size;
  try {
    size = (await stat(file)).size;
  } catch {
    res.writeHead(404);
    res.end("Showcase media is not installed on this computer.");
    return;
  }
  let start = 0,
    end = size - 1;
  const range = req.headers.range;
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!match || (!match[1] && !match[2])) start = size;
    else if (match[1]) {
      start = Number(match[1]);
      end = match[2] ? Math.min(Number(match[2]), end) : end;
    } else start = Math.max(0, size - Number(match[2]));
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start >= size ||
      start > end
    ) {
      res.writeHead(416, {
        "Content-Range": `bytes */${size}`,
        "Content-Length": "0",
      });
      res.end();
      return;
    }
  }
  res.writeHead(range ? 206 : 200, {
    "Content-Type": file.endsWith(".mp4") ? "video/mp4" : "image/jpeg",
    "Accept-Ranges": "bytes",
    "Content-Length": end - start + 1,
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
    ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  const stream = createReadStream(file, { start, end });
  stream.on("error", () => res.destroy());
  res.on("close", () => stream.destroy());
  stream.pipe(res);
}

export function createSiteHandler({
  studio,
  nextHandler,
  noaksRoot = process.env.NOAKS_HOME_DIR ||
    path.resolve(ROOT, "../noaks-vag-home"),
  tourURL = process.env.NOAKS_TOUR_URL || "http://127.0.0.1:8769/",
}) {
  const files = showcaseFiles(noaksRoot);
  return async (req, res) => {
    if (!/^(127\.0\.0\.1|localhost)(:\d+)?$/.test(req.headers.host || "")) {
      res.writeHead(403);
      res.end("Local access only.");
      return;
    }
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (
      url.pathname === "/showcase/config" &&
      ["GET", "HEAD"].includes(req.method)
    ) {
      const available = await stat(files.get("/showcase/noaks/film.mp4")).then(
        () => true,
        () => false,
      );
      let tourAvailable = false;
      try {
        const healthURL = new URL("/assets/quality.json", tourURL);
        if (["http:", "https:"].includes(healthURL.protocol)) {
          const response = await fetch(healthURL, {
            signal: AbortSignal.timeout(1200),
          });
          const quality = response.ok ? await response.json() : null;
          tourAvailable = !!quality?.connected_film && quality?.version === 14;
        }
      } catch {
        /* The standalone tour may not be running. */
      }
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(
        req.method === "HEAD"
          ? undefined
          : JSON.stringify({
              available,
              tourAvailable,
              tourURL,
              duration: 188.567,
            }),
      );
      return;
    }
    if (url.pathname.startsWith("/showcase/")) {
      const file = files.get(url.pathname);
      if (!file || !["GET", "HEAD"].includes(req.method)) {
        res.writeHead(404);
        res.end("Not found.");
        return;
      }
      await streamMedia(req, res, file);
      return;
    }
    // Old project bookmarks still open the workspace instead of the landing page.
    if (url.pathname === "/" && url.searchParams.has("project")) {
      res.writeHead(307, { Location: `/studio/${url.search}` });
      res.end();
      return;
    }
    if (url.pathname === "/studio" || url.pathname === "/studio/") {
      req.url = "/" + url.search;
      studio.emit("request", req, res);
      return;
    }
    if (
      url.pathname.startsWith("/api/") ||
      url.pathname.startsWith("/vendor/")
    ) {
      studio.emit("request", req, res);
      return;
    }
    await nextHandler(req, res);
  };
}
