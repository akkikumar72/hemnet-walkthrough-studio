import { HomeViewer } from "./viewer.js";
const $ = (id) => document.getElementById(id);
let config,
  project = null,
  key = "",
  poll = null,
  currentRoom = "",
  recording = false;
const status = (text, error = false) => {
  $("status").textContent = text;
  $("status").classList.toggle("error", error);
  $("status").dataset.state = error ? "error" : "success";
};
const run =
  (fn) =>
  async (...args) => {
    try {
      await fn(...args);
    } catch (e) {
      status(e.message, true);
    }
  };
async function api(url, method = "GET", data) {
  const response = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Studio-Token": config?.csrf || "",
    },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Request failed.");
  return result;
}
let exportURL;
const download = (data, name, type) => {
  if (exportURL) URL.revokeObjectURL(exportURL);
  exportURL = URL.createObjectURL(new Blob([data], { type }));
  const a = $("export-link");
  a.href = exportURL;
  a.download = name;
  a.textContent = `Download ${name}`;
  a.hidden = false;
  a.click();
  status(
    "Export ready. Use the download link if your browser did not save it automatically.",
  );
};
const viewer = new HomeViewer($("viewport"), {
  onDownload: download,
  onQuality: (message) => {
    $("quality-status").textContent = message;
  },
  onTime: (t, d) => {
    $("timeline").max = d;
    $("timeline").value = t;
    $("time").textContent =
      `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(Math.floor(t % 60)).padStart(2, "0")}`;
    if (t >= d) $("play").textContent = "Replay tour";
  },
  onRoom: (room) => {
    if (!room || room.id === currentRoom) return;
    currentRoom = room.id;
    $("room-jump").value = room.id;
    const photo = room.photoIds
      .map((id) => project?.photos.find((p) => p.id === id))
      .find(Boolean);
    $("source").hidden = !photo;
    if (photo) {
      $("source-image").src = `/api/projects/${project.id}/photos/${photo.id}`;
      $("source-image").dataset.category = photo.category;
    }
  },
  onRecord: (message) => {
    $("record-status").textContent = message;
    recording = viewer.recording;
    $("record").textContent = recording ? "Cancel recording" : "Record video";
    document.querySelectorAll("button,input,select,textarea").forEach((el) => {
      if (el.id !== "record") el.disabled = recording;
    });
    if (!recording) refreshBusy();
  },
});
function tab(which) {
  const panel = document.querySelector(".viewer-panel");
  if (which === "scene") $("scene-panel").prepend(panel);
  else $("main").insertBefore(panel, document.querySelector("main > footer"));
  $("references-panel").hidden = which !== "references";
  $("scene-panel").hidden = which !== "scene";
  for (const b of document.querySelectorAll("[data-tab]")) {
    b.setAttribute("aria-selected", String(b.dataset.tab === which));
    b.tabIndex = b.dataset.tab === which ? 0 : -1;
  }
}
function refreshBusy() {
  const busy = !!project?.busy;
  for (const id of ["generate", "add-photos", "save-scene"])
    $(id).disabled = busy;
  $("generate").textContent = busy ? "Working…" : "Generate 3D draft";
  $("generate").setAttribute("aria-busy", String(busy));
}
function setScene(scene) {
  if (exportURL) {
    URL.revokeObjectURL(exportURL);
    exportURL = null;
  }
  $("export-link").hidden = true;
  currentRoom = "";
  viewer.titleBackgroundUrl = project?.videoBackground
    ? `/api/projects/${project.id}/video-background`
    : null;
  viewer.load(scene);
  $("play").textContent = "Play tour";
  $("orbit").setAttribute("aria-pressed", "true");
  $("walk").setAttribute("aria-pressed", "false");
  $("cutaway").setAttribute("aria-pressed", "false");
  $("view-title").textContent = scene.title;
  $("view-label").textContent =
    !project || project.demo
      ? "Fictional demonstration"
      : "Photo-based reconstruction";
  $("scene-stat").textContent =
    `${scene.rooms.length} rooms · ${scene.elements.length} editable elements · Dimensions estimated`;
  $("room-jump").replaceChildren(
    ...scene.rooms.map((r) => {
      const o = document.createElement("option");
      o.value = r.id;
      o.textContent = r.name;
      return o;
    }),
  );
  $("empty-scene").hidden = true;
  for (const id of ["orbit", "room-jump", "timeline"]) $(id).disabled = false;
  $("play").disabled = false;
  $("record").disabled = false;
  $("walk").disabled = false;
  $("cutaway").disabled = false;
  exteriorReference();
}
function exteriorReference() {
  const id = project?.scene?.elements.find(
    (e) => e.id.startsWith("roof-metal-") && e.sourcePhoto,
  )?.sourcePhoto;
  const photo = project?.photos.find((p) => p.id === id);
  currentRoom = "";
  $("source").hidden = !photo;
  if (photo) {
    $("source-image").src = `/api/projects/${project.id}/photos/${photo.id}`;
    $("source-image").dataset.category = photo.category;
  }
}
async function projects() {
  const rows = await api("/api/projects");
  $("projects").replaceChildren(
    ...rows.map((p) => {
      const b = document.createElement("button");
      b.classList.toggle("active", project?.id === p.id);
      if (project?.id === p.id) b.setAttribute("aria-current", "page");
      const title = document.createElement("span");
      title.textContent = p.title;
      const sub = document.createElement("small");
      sub.textContent = `${p.photoCount} photos · ${p.status.replaceAll("-", " ")}`;
      b.append(title, sub);
      b.onclick = run(() => openProject(p.id));
      return b;
    }),
  );
}
function photos() {
  $("photo-count").textContent =
    `${project.photos.length} photos · ${project.photos.filter((p) => p.selected).length} selected for reconstruction`;
  $("photos").replaceChildren(
    ...project.photos.map((photo) => {
      const card = document.createElement("div");
      card.className = "photo-tile";
      const img = document.createElement("img");
      img.src = `/api/projects/${project.id}/photos/${photo.id}`;
      img.alt = `Reference ${photo.id}`;
      img.loading = "lazy";
      const label = document.createElement("label");
      label.className = "check";
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = photo.selected;
      check.disabled = project.busy;
      label.append(check, document.createTextNode(`Photo ${photo.id}`));
      const select = document.createElement("select");
      select.setAttribute("aria-label", `Category for photo ${photo.id}`);
      for (const c of [
        "unreviewed",
        "interior",
        "floor-plan",
        "exterior",
        "exclude",
      ]) {
        const o = document.createElement("option");
        o.value = c;
        o.textContent = c.replace("-", " ");
        select.append(o);
      }
      select.value = photo.category;
      select.disabled = project.busy;
      const save = run(async () => {
        const category = select.value;
        project = await api(`/api/projects/${project.id}/photos`, "PATCH", {
          photos: [
            {
              id: photo.id,
              selected: category === "exclude" ? false : check.checked,
              category,
            },
          ],
        });
        photos();
      });
      check.onchange = save;
      select.onchange = save;
      card.append(img, label, select);
      return card;
    }),
  );
}
function showProject() {
  $("intake").hidden = true;
  $("project-panel").hidden = false;
  $("project-title").textContent = project.title;
  $("project-status").textContent = project.status.replaceAll("-", " ");
  photos();
  refreshBusy();
  status(project.message || "", /failed/.test(project.status));
  if (project.scene) {
    setScene(project.scene);
    $("scene-summary").textContent = project.scene.summary;
    $("scene-json").value = JSON.stringify(project.scene, null, 2);
    $("warnings").replaceChildren(
      ...[...project.scene.assumptions, ...project.warnings].map((t) => {
        const li = document.createElement("li");
        li.textContent = t;
        return li;
      }),
    );
    tab("scene");
  } else {
    tab("references");
    $("empty-scene").hidden = false;
    $("play").disabled = true;
    $("record").disabled = true;
    $("cutaway").disabled = true;
    $("walk").disabled = true;
    $("source").hidden = true;
    viewer.playing = false;
    viewer.walking = false;
    if (viewer.home) viewer.home.visible = false;
    $("view-title").textContent = project.title;
    $("view-label").textContent = "Awaiting reconstruction";
    $("scene-stat").textContent = "No scene generated yet";
    $("export-link").hidden = true;
    $("scene-json").value = "";
    $("scene-summary").textContent =
      "Import scene JSON or generate from references.";
    $("warnings").replaceChildren();
    $("room-jump").replaceChildren();
    for (const id of ["orbit", "room-jump", "timeline"]) $(id).disabled = true;
  }
}
async function openProject(id) {
  if (recording) throw new Error("Stop recording before switching projects.");
  clearTimeout(poll);
  project = await api(`/api/projects/${id}`);
  history.replaceState(null, "", `?project=${id}`);
  showProject();
  await projects();
  if (project.busy) watch();
}
function watch() {
  poll = setTimeout(
    run(async () => {
      const id = project.id;
      const updated = await api(`/api/projects/${id}`);
      if (project?.id !== id) return;
      project = updated;
      if (project.busy) {
        status(project.message);
        watch();
      } else {
        showProject();
        await projects();
        if (project.scene && $("engine").value === "unreal")
          status(
            "Draft ready. Choose Unreal project to download the editable project.",
          );
      }
    }),
    2200,
  );
}
async function fresh() {
  clearTimeout(poll);
  project = null;
  viewer.playing = false;
  setScene(await api("/api/example"));
  $("source").hidden = true;
  history.replaceState(null, "", "/");
  $("intake").hidden = false;
  $("project-panel").hidden = true;
  tab("references");
  status("");
  projects();
  $("listing-url").focus();
}
$("new-project").onclick = run(fresh);
$("new-from-panel").onclick = run(fresh);
$("import-form").onsubmit = run(async (event) => {
  event.preventDefault();
  if (!$("listing-url").value)
    throw new Error("Paste a Hemnet link, or use photo upload.");
  const p = await api("/api/projects", "POST", {
    url: $("listing-url").value,
    rights: $("rights").checked,
  });
  await openProject(p.id);
});
$("upload-start").onclick = run(async () => {
  if (!$("rights").checked)
    throw new Error("Confirm permission to use these photos first.");
  const p = await api("/api/projects", "POST", {
    title: "My home",
    rights: true,
  });
  await openProject(p.id);
  $("photo-files").click();
});
$("add-photos").onclick = () => $("photo-files").click();
$("photo-files").onchange = run(async (event) => {
  const files = [...event.target.files];
  for (const [i, file] of files.entries()) {
    if (file.size > 15 * 1024 * 1024)
      throw new Error(`${file.name} exceeds 15 MB.`);
    status(`Saving photo ${i + 1} of ${files.length} locally…`);
    const data = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("Unable to read photo."));
      r.readAsDataURL(file);
    });
    project = await api(`/api/projects/${project.id}/photos`, "POST", { data });
  }
  event.target.value = "";
  showProject();
  tab("references");
  await projects();
});
$("demo").onclick = run(async () => {
  const p = await api("/api/demo", "POST", {});
  await openProject(p.id);
});
for (const b of document.querySelectorAll("[data-tab]")) {
  b.onclick = () => tab(b.dataset.tab);
  b.onkeydown = (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? "references"
        : event.key === "End"
          ? "scene"
          : b.dataset.tab === "references"
            ? "scene"
            : "references";
    tab(next);
    document.querySelector(`[data-tab="${next}"]`).focus();
  };
}
$("generate").onclick = run(async () => {
  if (!$("ai-consent").checked)
    throw new Error("Confirm sending the selected photos to OpenAI.");
  if (!key && !config.apiKeyConfigured) {
    $("settings").showModal();
    return;
  }
  project = await api(`/api/projects/${project.id}/analyze`, "POST", {
    consent: true,
    apiKey: key,
    model: $("model").value,
    notes: $("notes").value,
  });
  showProject();
  tab("references");
  watch();
});
$("settings-open").onclick = () => $("settings").showModal();
$("settings-close").onclick = () => $("settings").close();
$("settings-form").onsubmit = (e) => {
  e.preventDefault();
  key = $("api-key").value.trim();
  $("api-key").value = "";
  $("key-status").textContent = key
    ? "A key is held in memory for this session."
    : config.apiKeyConfigured
      ? "Using the server environment key."
      : "No key configured.";
  $("settings").close();
};
$("save-scene").onclick = run(async () => {
  if (!project) throw new Error("Create a project first.");
  project = await api(
    `/api/projects/${project.id}/scene`,
    "PUT",
    JSON.parse($("scene-json").value),
  );
  showProject();
  status(
    "Scene validated and saved. The previous version is retained locally.",
  );
});
$("scene-file").onchange = run(async (e) => {
  if (e.target.files[0]) $("scene-json").value = await e.target.files[0].text();
});
$("download-json").onclick = run(() => {
  if (!project?.scene) throw new Error("No scene to export.");
  download(
    JSON.stringify(project.scene, null, 2),
    "scene.json",
    "application/json",
  );
});
$("download-unreal").onclick = run(() => {
  if (!project?.scene) throw new Error("Generate or import a scene first.");
  const a = document.createElement("a");
  a.href = `/api/projects/${project.id}/unreal`;
  a.download = "UnrealHome.zip";
  a.click();
  status(
    "Unzip the project, open StudioHome.uproject in Unreal, then run build_unreal.py using Tools → Execute Python Script.",
  );
});
$("download-glb").onclick = run(async () => {
  if (!project?.scene) throw new Error("No scene to export.");
  download(await viewer.glb(), "home.glb", "model/gltf-binary");
});
function tourMode() {
  $("view-hint").textContent = "Continuous room-to-room camera route";
  $("orbit").setAttribute("aria-pressed", "false");
  $("walk").setAttribute("aria-pressed", "false");
  $("cutaway").setAttribute("aria-pressed", "false");
}
$("play").onclick = () => {
  tourMode();
  $("play").textContent = viewer.toggle() ? "Pause tour" : "Play tour";
  $("view-hint").textContent =
    "Continuous camera route · Review doorway clearance";
};
$("timeline").oninput = (e) => {
  tourMode();
  viewer.playing = false;
  viewer.walking = false;
  viewer.seek(+e.target.value);
  $("play").textContent = "Play tour";
};
$("room-jump").onchange = (e) => {
  tourMode();
  viewer.jump(e.target.value);
  $("play").textContent = "Play tour";
};
$("orbit").onclick = () => {
  viewer.overview();
  exteriorReference();
  $("orbit").setAttribute("aria-pressed", "true");
  $("walk").setAttribute("aria-pressed", "false");
  $("cutaway").setAttribute("aria-pressed", "false");
  $("view-hint").textContent = "Drag to orbit · Scroll to zoom";
  $("play").textContent = "Play tour";
};
$("cutaway").onclick = () => {
  viewer.overview(true);
  $("source").hidden = true;
  currentRoom = "";
  $("cutaway").setAttribute("aria-pressed", "true");
  $("orbit").setAttribute("aria-pressed", "false");
  $("walk").setAttribute("aria-pressed", "false");
  $("view-hint").textContent =
    "Roof hidden for interior inspection · Drag to orbit";
  $("play").textContent = "Play tour";
};
$("walk").onclick = () => {
  viewer.walk();
  $("walk").setAttribute("aria-pressed", "true");
  $("orbit").setAttribute("aria-pressed", "false");
  $("cutaway").setAttribute("aria-pressed", "false");
  $("view-hint").textContent = "WASD to walk · Drag to look";
};
$("record").onclick = run(() => {
  tourMode();
  return viewer.record();
});
await run(async () => {
  config = await api("/api/config");
  $("model").value = config.model;
  $("key-status").textContent = config.apiKeyConfigured
    ? "Server API key is configured."
    : "No server API key. The demo and local Codex workflow need no app key.";
  await projects();
  const id = new URLSearchParams(location.search).get("project");
  if (id) await openProject(id);
  else {
    const sample = await api("/api/example");
    setScene(sample);
  }
})();

$("fullscreen").onclick = run(async () => {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.querySelector(".viewer-panel").requestFullscreen();
});
document.addEventListener("fullscreenchange", () => {
  $("fullscreen").textContent = document.fullscreenElement
    ? "Exit full screen"
    : "Full screen";
});
