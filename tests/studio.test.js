import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { unzipSync, strFromU8 } from "fflate";
import { createStudio } from "../src/server.js";
import {
  extractListing,
  listingURL,
  imageURL,
  limitedFetch,
} from "../src/importer.js";
import { validateScene, reviewScene } from "../src/scene.js";
import { analyzeProject } from "../src/analyze.js";
import { compileGeometry } from "../public/geometry.js";
const demo = JSON.parse(
  await readFile(new URL("../examples/demo-scene.json", import.meta.url)),
);
const PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==";
const listing = "https://www.hemnet.se/bostad/lagenhet-2rum-test-12345";
const html =
  '<meta property="og:title" content="Test home"><script>{"image":"https:\\/\\/bilder.hemnet.se\\/images\\/example\\/test.jpg?width=200&amp;quality=70"}</script><img src="https://bilder.hemnet.se/images/example/test.jpg?width=1200">';

test("Hemnet parser deduplicates variants and rejects other networks", () => {
  const p = extractListing(html, listing);
  assert.equal(p.title, "Test home");
  assert.equal(p.imageURLs.length, 1);
  assert.match(p.imageURLs[0], /width=2048/);
  for (const url of [
    "http://www.hemnet.se/bostad/test",
    "https://hemnet.se.evil.com/bostad/test",
    "https://www.hemnet.se@127.0.0.1/bostad/test",
    "https://www.hemnet.se:4430/bostad/test",
    "https://www.hemnet.se/bostad/../admin",
  ])
    assert.throws(() => listingURL(url));
  assert.equal(imageURL("https://127.0.0.1/photo.jpg"), null);
  assert.equal(imageURL("https://bilder.hemnet.se/not-images/a.jpg"), null);
});
test("restricted listings, redirects and oversized downloads fail clearly", async () => {
  await assert.rejects(
    limitedFetch(listing, {
      kind: "listing",
      fetcher: async () => new Response("Forbidden", { status: 403 }),
    }),
    /HTTP 403/,
  );
  await assert.rejects(
    limitedFetch(listing, {
      kind: "listing",
      fetcher: async () =>
        new Response("", {
          status: 302,
          headers: { location: "http://127.0.0.1" },
        }),
    }),
    /redirected/,
  );
  await assert.rejects(
    limitedFetch(listing, {
      kind: "listing",
      maxBytes: 5,
      fetcher: async () => new Response("123456"),
    }),
    /limit/,
  );
});
test("scene validates geometry and rejects invalid camera and photo references", () => {
  validateScene(demo);
  assert.deepEqual(reviewScene(demo), []);
  assert(compileGeometry(demo).length > demo.elements.length);
  const bad = structuredClone(demo);
  bad.elements[0].size[0] = -1;
  assert.throws(() => validateScene(bad), /Invalid scene/);
  const route = structuredClone(demo);
  route.route[0].target = route.route[0].position;
  assert.throws(() => validateScene(route), /target/);
  const photo = structuredClone(demo);
  photo.rooms[0].photoIds = ["missing"];
  assert.throws(() => validateScene(photo, []), /unknown photo/);
  const blocked = structuredClone(demo);
  blocked.route[1].position = [0, 1.6, 3];
  assert(reviewScene(blocked).some((s) => s.includes("intersects a wall")));
});

async function harness(fn, { fetcher = fetch, apiKey = "" } = {}) {
  const workspace = await mkdtemp(
    path.join(os.tmpdir(), "walkthrough-studio-test-"),
  );
  const server = await createStudio({ workspace, fetcher, apiKey });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const config = await (await fetch(base + "/api/config")).json();
  const call = async (url, method = "GET", data, headers = {}) => {
    const response = await fetch(base + url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-Studio-Token": config.csrf,
        ...headers,
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    return { status: response.status, data: await response.json() };
  };
  try {
    await fn({ call, base, workspace, config });
  } finally {
    await new Promise((r) => server.close(r));
    await rm(workspace, { recursive: true, force: true });
  }
}
test("local HTTP API enforces permission, request token and origin", async () =>
  harness(async ({ call, base }) => {
    assert.equal(
      (await call("/api/projects", "POST", { title: "Test" })).status,
      400,
    );
    assert.equal(
      (
        await call(
          "/api/projects",
          "POST",
          { rights: true },
          { "X-Studio-Token": "" },
        )
      ).status,
      403,
    );
    assert.equal(
      (
        await call(
          "/api/projects",
          "POST",
          { rights: true },
          { Origin: "https://untrusted.example" },
        )
      ).status,
      403,
    );
    const r = await fetch(base + "/workspace/anything");
    assert.equal(r.status, 404);
    assert.equal((await call("/api/example")).data.title, demo.title);
  }));
test("photo workflow, model request, versioned scene and Unreal export", async () => {
  const secret = "test-key-not-a-real-credential";
  let request;
  await harness(
    async ({ call, base, workspace, config }) => {
      assert.equal(config.apiKeyConfigured, false);
      assert(!JSON.stringify(config).includes(secret));
      const { data: p } = await call("/api/projects", "POST", {
        title: "Test home",
        rights: true,
      });
      const prefix = "/api/projects/" + p.id;
      assert.equal(
        (
          await call(prefix + "/photos", "POST", {
            data: "data:image/jpeg;base64,bm90YW5pbWFnZQ==",
          })
        ).status,
        400,
      );
      const uploaded = await call(prefix + "/photos", "POST", {
        data: "data:image/png;base64," + PNG,
      });
      assert.equal(uploaded.status, 201);
      assert.equal(uploaded.data.photos[0].type, "png");
      assert.equal(
        (
          await call(prefix + "/photos", "PATCH", {
            photos: [{ id: "001", selected: true, category: "floor-plan" }],
          })
        ).status,
        200,
      );
      assert.equal(
        (
          await call(prefix + "/analyze", "POST", {
            apiKey: secret,
            consent: false,
          })
        ).status,
        400,
      );
      assert.equal(
        (
          await call(prefix + "/analyze", "POST", {
            apiKey: secret,
            consent: true,
            model: "gpt-6-astra",
          })
        ).status,
        202,
      );
      let done;
      for (let i = 0; i < 100; i++) {
        done = (await call(prefix)).data;
        if (!done.busy) break;
        await new Promise((r) => setTimeout(r, 10));
      }
      assert.equal(done.status, "draft");
      assert.equal(request.store, false);
      assert.equal(request.text.format.type, "json_schema");
      assert.equal(
        request.input[0].content.filter((c) => c.type === "input_image").length,
        1,
      );
      const before = await readFile(
        path.join(workspace, p.id, "project.json"),
        "utf8",
      );
      assert(!before.includes(secret));
      assert(!before.includes("base64"));
      const edited = structuredClone(done.scene);
      edited.title = "Edited home";
      assert.equal((await call(prefix + "/scene", "PUT", edited)).status, 200);
      assert(
        (await readdir(path.join(workspace, p.id))).some((n) =>
          n.startsWith("scene-"),
        ),
      );
      const zip = await fetch(base + prefix + "/unreal");
      assert.equal(zip.status, 200);
      const entries = unzipSync(new Uint8Array(await zip.arrayBuffer()));
      assert(entries["StudioHome.uproject"]);
      assert(entries["build_unreal.py"]);
      const geometry = JSON.parse(strFromU8(entries["geometry.json"]));
      assert.equal(geometry.length, compileGeometry(edited).length);
      assert(!Object.keys(entries).some((n) => n.startsWith("photos/")));
    },
    {
      fetcher: async (url, options) => {
        assert.equal(url, "https://api.openai.com/v1/responses");
        assert.equal(options.headers.Authorization, "Bearer " + secret);
        request = JSON.parse(options.body);
        return Response.json({
          status: "completed",
          output: [
            { content: [{ type: "output_text", text: JSON.stringify(demo) }] },
          ],
          usage: { input_tokens: 100, output_tokens: 100 },
        });
      },
    },
  );
});
test("API errors do not expose provider response bodies or keys", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "walkthrough-model-test-"));
  try {
    const p = {
      title: "Test",
      photos: [
        {
          id: "001",
          file: "photo.png",
          type: "png",
          category: "interior",
          selected: true,
        },
      ],
    };
    const { mkdir, writeFile } = await import("node:fs/promises");
    await mkdir(path.join(dir, "photos"));
    await writeFile(
      path.join(dir, "photos/photo.png"),
      Buffer.from(PNG, "base64"),
    );
    for (const [status, pattern] of [
      [401, /rejected/],
      [429, /budget/],
      [500, /HTTP 500/],
    ])
      await assert.rejects(
        analyzeProject(p, dir, {
          key: "test-key-not-real",
          fetcher: async () => new Response("secret details", { status }),
        }),
        pattern,
      );
    await assert.rejects(
      analyzeProject(p, dir, {
        key: "test-key-not-real",
        fetcher: async () => Response.json({ status: "incomplete" }),
      }),
      /did not complete/,
    );
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

// Import progress must preserve evidence even if a later gallery item fails.
test("partial gallery remains available after a download failure", async () => {
  let images = 0;
  await harness(
    async ({ call }) => {
      const { data: project } = await call("/api/projects", "POST", {
        url: listing,
        rights: true,
      });
      let done;
      for (let i = 0; i < 100; i++) {
        done = (await call("/api/projects/" + project.id)).data;
        if (!done.busy) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      assert.equal(done.status, "import-failed");
      assert.equal(done.photos.length, 1);
      assert.equal(done.expectedPhotos, 2);
      assert.match(done.message, /403/);
      const uploaded = await call(
        "/api/projects/" + project.id + "/photos",
        "POST",
        { data: "data:image/png;base64," + PNG },
      );
      assert.equal(uploaded.status, 201);
      assert.equal(uploaded.data.photos.length, 2);
      assert.equal(uploaded.data.photos[1].id, "002");
    },
    {
      fetcher: async (url) => {
        if (url.includes("www.hemnet.se"))
          return new Response(
            html +
              '<img src="https://bilder.hemnet.se/images/another/image.jpg">',
          );
        images++;
        return images === 1
          ? new Response(Buffer.from(PNG, "base64"))
          : new Response("Denied", { status: 403 });
      },
    },
  );
});
