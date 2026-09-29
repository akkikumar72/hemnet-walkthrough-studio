import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createStudio } from "../src/server.js";
import { createSiteHandler } from "../src/site-handler.js";

test("landing integration preserves studio, legacy bookmarks and CSRF boundaries", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-site-"));
  const studio = await createStudio({
    workspace: path.join(root, "workspace"),
    apiKey: "",
  });
  const handler = createSiteHandler({
    studio,
    noaksRoot: root,
    nextHandler: (_req, res) => {
      res.writeHead(200);
      res.end("Next.js landing");
    },
  });
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    assert.equal(await (await fetch(base)).text(), "Next.js landing");
    assert.match(
      await (await fetch(base + "/studio/")).text(),
      /id="import-form"/,
    );
    const old = await fetch(base + "/?project=example", { redirect: "manual" });
    assert.equal(old.status, 307);
    assert.equal(old.headers.get("location"), "/studio/?project=example");
    const blocked = await fetch(base + "/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rights: true }),
    });
    assert.equal(blocked.status, 403);
    const config = await (await fetch(base + "/api/config")).json();
    const created = await fetch(base + "/api/projects", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Studio-Token": config.csrf,
        Origin: base,
      },
      body: JSON.stringify({ rights: true, title: "Landing handoff" }),
    });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).title, "Landing handoff");
    const externalStatus = await new Promise((resolve, reject) => {
      http
        .get(base, { headers: { Host: "external.example" } }, (response) => {
          response.resume();
          resolve(response.statusCode);
        })
        .on("error", reject);
    });
    assert.equal(externalStatus, 403);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});

test("showcase serves the exact film with seeking and exposes only named media", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "studio-media-"));
  const filmDir = path.join(root, "Results/Video");
  await mkdir(filmDir, { recursive: true });
  await writeFile(
    path.join(filmDir, "NoaksVag_Exterior14_4K60.mp4"),
    "0123456789",
  );
  const handler = createSiteHandler({
    studio: null,
    noaksRoot: root,
    nextHandler: (_req, res) => {
      res.writeHead(404);
      res.end();
    },
  });
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const url = base + "/showcase/noaks/film.mp4";
    const full = await fetch(url);
    assert.equal(full.status, 200);
    assert.equal(await full.text(), "0123456789");
    const range = await fetch(url, { headers: { Range: "bytes=2-5" } });
    assert.equal(range.status, 206);
    assert.equal(range.headers.get("content-range"), "bytes 2-5/10");
    assert.equal(await range.text(), "2345");
    assert.equal(
      await (await fetch(url, { headers: { Range: "bytes=-3" } })).text(),
      "789",
    );
    const head = await fetch(url, { method: "HEAD" });
    assert.equal(head.headers.get("content-length"), "10");
    assert.equal(await head.text(), "");
    for (const value of ["bytes=10-", "bytes=4-2", "bytes=-0", "bytes=1-2,4-5"])
      assert.equal(
        (await fetch(url, { headers: { Range: value } })).status,
        416,
      );
    for (const pathname of [
      "/showcase/noaks/manifest.json",
      "/showcase/noaks/missing.jpg",
      "/showcase/private-input/08.jpg",
    ])
      assert.equal((await fetch(base + pathname)).status, 404);
    assert.equal(
      (await fetch(base + "/showcase/noaks/kitchen.jpg")).status,
      404,
    );
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await rm(root, { recursive: true, force: true });
  }
});
