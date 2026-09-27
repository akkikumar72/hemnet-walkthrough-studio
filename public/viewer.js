import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { compileGeometry } from "./geometry.js";

export class HomeViewer {
  constructor(
    host,
    {
      onTime = () => {},
      onRoom = () => {},
      onRecord = () => {},
      onDownload = () => {},
    } = {},
  ) {
    this.host = host;
    this.onTime = onTime;
    this.onRoom = onRoom;
    this.onRecord = onRecord;
    this.onDownload = onDownload;
    this.time = 0;
    this.playing = false;
    this.walking = false;
    this.keys = new Set();
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    host.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#e4ebef");
    this.scene.environment = new THREE.PMREMGenerator(this.renderer).fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    this.scene.environmentIntensity = 0.55;
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.035, 300);
    this.camera.position.set(15, 13, 17);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.scene.add(new THREE.HemisphereLight("#e8f3ff", "#b5a189", 0.6));
    const sun = new THREE.DirectionalLight("#fff2da", 2.2);
    sun.position.set(5, 14, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -25,
      right: 25,
      top: 25,
      bottom: -25,
      near: 1,
      far: 65,
    });
    sun.shadow.normalBias = 0.03;
    this.scene.add(sun);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: "#dbe4e8", roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.controls.target.set(5.5, 0, 3);
    this.controls.update();
    this.last = performance.now();
    host.addEventListener("keydown", (e) => {
      if (
        [
          "w",
          "a",
          "s",
          "d",
          "ArrowLeft",
          "ArrowRight",
          "ArrowUp",
          "ArrowDown",
        ].includes(e.key)
      ) {
        e.preventDefault();
        this.keys.add(e.key.toLowerCase());
      }
    });
    host.addEventListener("keyup", (e) =>
      this.keys.delete(e.key.toLowerCase()),
    );
    host.addEventListener("blur", () => this.keys.clear());
    let drag = null;
    host.addEventListener("pointerdown", (e) => {
      if (this.walking) {
        drag = [e.clientX, e.clientY];
        host.setPointerCapture(e.pointerId);
        host.focus();
      }
    });
    host.addEventListener("pointermove", (e) => {
      if (!drag || !this.walking) return;
      this.yaw -= (e.clientX - drag[0]) * 0.003;
      this.pitch = THREE.MathUtils.clamp(
        this.pitch - (e.clientY - drag[1]) * 0.003,
        -1.2,
        1.2,
      );
      drag = [e.clientX, e.clientY];
      this.look();
    });
    host.addEventListener("pointerup", () => (drag = null));
    new ResizeObserver(() => this.resize()).observe(host);
    this.renderer.setAnimationLoop((t) => this.frame(t));
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) {
        this.playing = false;
        if (this.recorder?.state === "recording") this.stopRecording(true);
      }
    });
  }
  resize() {
    if (this.recording) return;
    const w = this.host.clientWidth,
      h = this.host.clientHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  load(data) {
    this.playing = false;
    this.walking = false;
    this.controls.enabled = true;
    this.keys.clear();
    if (this.home) {
      this.scene.remove(this.home);
      this.home.traverse((o) => {
        o.geometry?.dispose();
        if (o.material) o.material.dispose();
      });
    }
    this.data = data;
    this.primitives = compileGeometry(data);
    this.home = new THREE.Group();
    this.scene.add(this.home);
    const kinds = new Map(data.elements.map((e) => [e.id, e.kind]));
    for (const p of this.primitives) {
      let geo;
      if (p.kind === "sphere") geo = new THREE.SphereGeometry(0.5, 16, 12);
      else if (p.kind === "cylinder")
        geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
      else
        geo = new RoundedBoxGeometry(
          1,
          1,
          1,
          2,
          ["wall", "floor", "window", "stairs"].includes(kinds.get(p.element))
            ? 0.001
            : 0.045,
        );
      const mat = new THREE.MeshStandardMaterial({
        color: p.color,
        roughness: 0.78,
        metalness: 0,
        transparent: p.glass,
        opacity: p.glass ? 0.15 : 1,
        depthWrite: !p.glass,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = p.id;
      mesh.position.fromArray(p.position);
      mesh.scale.fromArray(p.size);
      mesh.rotation.y = (p.rotation * Math.PI) / 180;
      mesh.castShadow = !p.glass;
      mesh.receiveShadow = true;
      mesh.userData = { room: p.room, sourcePhoto: p.sourcePhoto };
      this.home.add(mesh);
    }
    this.duration = data.route.reduce((s, p) => s + p.seconds, 0);
    this.time = 0;
    this.overview();
    this.onTime(0, this.duration);
    this.onRoom(data.rooms[0]);
  }
  overview() {
    this.playing = false;
    this.walking = false;
    this.controls.enabled = true;
    this.keys.clear();
    if (!this.home) return;
    const box = new THREE.Box3().setFromObject(this.home),
      center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3()),
      d = Math.max(size.x, size.z);
    this.controls.target.copy(center);
    this.camera.position
      .copy(center)
      .add(new THREE.Vector3(d * 0.56, d * 0.68, d * 0.75));
    this.controls.update();
  }
  walk() {
    if (!this.data) return;
    this.playing = false;
    this.walking = true;
    this.controls.enabled = false;
    this.seek(this.time);
    const e = new THREE.Euler().setFromQuaternion(
      this.camera.quaternion,
      "YXZ",
    );
    this.yaw = e.y;
    this.pitch = e.x;
    this.host.focus();
  }
  look() {
    this.camera.quaternion.setFromEuler(
      new THREE.Euler(this.pitch, this.yaw, 0, "YXZ"),
    );
  }
  seek(time) {
    if (!this.data) return;
    this.time = THREE.MathUtils.clamp(time, 0, this.duration);
    let elapsed = 0;
    for (let i = 0; i < this.data.route.length; i++) {
      const b = this.data.route[i],
        a = this.data.route[Math.max(0, i - 1)];
      if (
        this.time <= elapsed + b.seconds ||
        i === this.data.route.length - 1
      ) {
        const t = THREE.MathUtils.smoothstep(
          (this.time - elapsed) / b.seconds,
          0,
          1,
        );
        this.camera.position
          .fromArray(a.position)
          .lerp(new THREE.Vector3(...b.position), t);
        this.camera.lookAt(
          new THREE.Vector3(...a.target).lerp(
            new THREE.Vector3(...b.target),
            t,
          ),
        );
        this.controls.enabled = false;
        this.onRoom(this.data.rooms.find((r) => r.id === b.room));
        break;
      }
      elapsed += b.seconds;
    }
    this.onTime(this.time, this.duration);
  }
  toggle() {
    if (!this.data) return;
    this.walking = false;
    this.keys.clear();
    if (this.time >= this.duration) this.time = 0;
    this.playing = !this.playing;
    this.controls.enabled = false;
    return this.playing;
  }
  jump(room) {
    this.walking = false;
    this.keys.clear();
    let t = 0;
    for (const point of this.data.route) {
      t += point.seconds;
      if (point.room === room) {
        this.playing = false;
        this.seek(t);
        return;
      }
    }
  }
  move(dt) {
    let x = 0,
      z = 0;
    if (this.keys.has("w") || this.keys.has("arrowup")) z -= 1;
    if (this.keys.has("s") || this.keys.has("arrowdown")) z += 1;
    if (this.keys.has("a")) x -= 1;
    if (this.keys.has("d")) x += 1;
    if (this.keys.has("arrowleft")) this.yaw += dt;
    if (this.keys.has("arrowright")) this.yaw -= dt;
    this.look();
    if (!x && !z) return;
    const delta = new THREE.Vector3(x, 0, z)
        .normalize()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw)
        .multiplyScalar(dt * 1.5),
      candidate = this.camera.position.clone().add(delta);
    const room = this.data.rooms.find(
      (r) =>
        candidate.x > r.bounds[0] + 0.15 &&
        candidate.x < r.bounds[0] + r.bounds[2] - 0.15 &&
        candidate.z > r.bounds[1] + 0.15 &&
        candidate.z < r.bounds[1] + r.bounds[3] - 0.15 &&
        Math.abs(candidate.y - 1.6 - r.elevation) < 0.3,
    );
    // Room unions include connecting edges; solid geometry below handles door clearance.
    const floor = this.data.rooms.find(
      (r) =>
        candidate.x >= r.bounds[0] &&
        candidate.x <= r.bounds[0] + r.bounds[2] &&
        candidate.z >= r.bounds[1] &&
        candidate.z <= r.bounds[1] + r.bounds[3] &&
        Math.abs(candidate.y - 1.6 - r.elevation) < 0.3,
    );
    if (!floor) return;
    const blocked = this.data.elements.some((e) => {
      if (["floor", "rug", "plant", "lamp"].includes(e.kind)) return false;
      const a = (-e.rotation * Math.PI) / 180,
        dx = candidate.x - e.position[0],
        dz = candidate.z - e.position[2],
        lx = dx * Math.cos(a) + dz * Math.sin(a),
        lz = -dx * Math.sin(a) + dz * Math.cos(a);
      return (
        Math.abs(lx) < e.size[0] / 2 + 0.16 &&
        Math.abs(lz) < e.size[2] / 2 + 0.16 &&
        e.position[1] + e.size[1] / 2 > candidate.y - 1.35 &&
        e.position[1] - e.size[1] / 2 < candidate.y + 0.15
      );
    });
    if (!blocked) {
      this.camera.position.copy(candidate);
      if (room) this.onRoom(room);
    }
  }
  frame(now) {
    const dt = Math.min((now - this.last) / 1000, 0.06);
    this.last = now;
    if (this.playing) {
      this.seek(this.time + dt);
      if (this.time >= this.duration) {
        this.playing = false;
        if (this.recording) this.stopRecording(false);
      }
    }
    if (this.walking) this.move(dt);
    if (this.controls.enabled) this.controls.update();
    this.renderer.render(this.scene, this.camera);
    if (this.recording) this.compose();
  }
  async glb() {
    return new GLTFExporter().parseAsync(this.home, { binary: true });
  }
  compose() {
    const c = this.recordContext,
      w = 1920,
      h = 1080;
    c.drawImage(this.renderer.domElement, 0, 0, w, h);
    c.fillStyle = "#14252dcc";
    c.fillRect(0, 0, w, 90);
    c.fillStyle = "white";
    c.font = "28px sans-serif";
    c.fillText(this.data.title, 40, 43);
    c.font = "15px sans-serif";
    c.fillText(
      "Editable reconstruction draft · Estimated dimensions · Three.js",
      40,
      72,
    );
    const img = document.querySelector("#source-image");
    if (
      !document.querySelector("#source").hidden &&
      img.complete &&
      img.naturalWidth
    ) {
      const sw = 320,
        sh = (sw * img.naturalHeight) / img.naturalWidth;
      c.fillStyle = "#14252dcc";
      c.fillRect(w - sw - 30, h - sh - 70, sw, 40);
      c.fillStyle = "white";
      c.fillText("Source photo", w - sw - 20, h - sh - 43);
      c.drawImage(img, w - sw - 30, h - sh - 30, sw, sh);
    }
  }
  record() {
    if (this.recording) {
      this.stopRecording(true);
      return;
    }
    if (!window.MediaRecorder)
      throw new Error("Video recording is unavailable in this browser.");
    const mime = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ].find((s) => MediaRecorder.isTypeSupported(s));
    if (!mime)
      throw new Error(
        "This browser cannot record WebM. Use Chrome or the Unreal export.",
      );
    const canvas = document.createElement("canvas");
    canvas.width = 1920;
    canvas.height = 1080;
    this.recordContext = canvas.getContext("2d");
    const stream = canvas.captureStream(30);
    try {
      this.recorder = new MediaRecorder(stream, {
        mimeType: mime,
        videoBitsPerSecond: 18000000,
      });
    } catch (error) {
      stream.getTracks().forEach((t) => t.stop());
      throw error;
    }
    this.recordCancelled = false;
    this.recording = true;
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(1920, 1080, false);
    this.camera.aspect = 16 / 9;
    this.camera.updateProjectionMatrix();
    this.walking = false;
    this.controls.enabled = false;
    this.seek(0);
    this.playing = true;
    this.parts = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data.size) this.parts.push(e.data);
    };
    this.recorder.onstop = () => {
      stream.getTracks().forEach((t) => t.stop());
      if (!this.recordCancelled) {
        this.onDownload(
          new Blob(this.parts, { type: "video/webm" }),
          "home-walkthrough-1080p.webm",
          "video/webm",
        );
      }
      this.parts = [];
    };
    try {
      this.recorder.start(1000);
    } catch (error) {
      stream.getTracks().forEach((t) => t.stop());
      this.recording = false;
      this.playing = false;
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.resize();
      throw error;
    }
    this.onRecord(
      "Recording 1080p WebM at a target 30 fps. Keep this tab visible. Click again to cancel.",
    );
  }
  stopRecording(cancelled) {
    this.recordCancelled = cancelled;
    this.recording = false;
    this.playing = false;
    this.recorder.stop();
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.resize();
    this.onRecord(
      cancelled
        ? "Recording cancelled."
        : "Video ready. Frame pacing depends on your GPU.",
    );
  }
}
