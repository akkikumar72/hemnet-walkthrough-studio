import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  encodeTour,
  drawTourTitle,
  VIDEO_TITLE_HOLD,
  VIDEO_INTRO_DURATION,
} from "./video.js";
import { HomeLighting, SUN_DIRECTION } from "./lighting.js";
import { primitiveShape } from "./shapes.js";
import { Sky } from "three/addons/objects/Sky.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { compileGeometry } from "./geometry.js";
import { walkSupport } from "./navigation.js";
import { surfaceMaterial } from "./surfaces.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { SSAOPass } from "three/addons/postprocessing/SSAOPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";

export class HomeViewer {
  constructor(
    host,
    {
      onTime = () => {},
      onRoom = () => {},
      onRecord = () => {},
      onDownload = () => {},
      onQuality = () => {},
    } = {},
  ) {
    this.host = host;
    this.onTime = onTime;
    this.onRoom = onRoom;
    this.onRecord = onRecord;
    this.onDownload = onDownload;
    this.onQuality = onQuality;
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
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    host.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#e4ebef");
    this.scene.environment = new THREE.PMREMGenerator(this.renderer).fromScene(
      new RoomEnvironment(),
      0.04,
    ).texture;
    this.scene.environmentIntensity = 0.3;
    this.camera = new THREE.PerspectiveCamera(68, 1, 0.06, 100);
    this.camera.position.set(15, 13, 17);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.maxPolarAngle = Math.PI * 0.49;
    this.lighting = new HomeLighting(this.scene, this.renderer);
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(400, 400),
      new THREE.MeshStandardMaterial({ color: "#dbe4e8", roughness: 1 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    this.ground = ground;
    this.outdoorSky = new Sky();
    this.outdoorSky.scale.setScalar(90);
    this.outdoorSky.material.fragmentShader =
      this.outdoorSky.material.fragmentShader.replace(
        "gl_FragColor = vec4( texColor, 1.0 );",
        "gl_FragColor = vec4( texColor * 0.35, 1.0 );",
      );
    const skyUniforms = this.outdoorSky.material.uniforms;
    skyUniforms.turbidity.value = 3;
    skyUniforms.rayleigh.value = 2;
    skyUniforms.mieCoefficient.value = 0.004;
    skyUniforms.mieDirectionalG.value = 0.8;
    skyUniforms.sunPosition.value.copy(SUN_DIRECTION);
    this.outdoorSky.visible = false;
    this.scene.add(this.outdoorSky);
    this.controls.target.set(5.5, 0, 3);
    this.controls.update();
    const target = new THREE.WebGLRenderTarget(1, 1, {
      type: THREE.HalfFloatType,
      samples: Math.min(4, this.renderer.capabilities.maxSamples),
    });
    this.composer = new EffectComposer(this.renderer, target);
    this.ao = new SSAOPass(this.scene, this.camera, 640, 360, 32);
    this.ao.kernelRadius = 0.26;
    this.ao.minDistance = 0.0005;
    this.ao.maxDistance = 0.012;
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(this.ao);
    this.composer.addPass(new OutputPass());
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
        // Offline export resumes when visible without dropping tour frames.
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
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(w, h);
    this.needsRender = true;
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
    const hasLandscape = data.elements.some((e) =>
      ["tree", "hedge"].includes(e.kind),
    );
    this.outdoorSky.visible = hasLandscape;
    this.ground.material.color.set(hasLandscape ? "#65734a" : "#dbe4e8");
    this.ground.position.y = hasLandscape ? -0.3 : -0.2;
    this.primitives = compileGeometry(data);
    this.home = new THREE.Group();
    this.scene.add(this.home);
    const elements = new Map(data.elements.map((e) => [e.id, e]));
    for (const p of this.primitives) {
      const element = elements.get(p.element);
      const geo = primitiveShape(element, p);
      const mat = surfaceMaterial(element, p);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.name = p.id;
      mesh.position.fromArray(p.position);

      mesh.rotation.y = (p.rotation * Math.PI) / 180;
      mesh.castShadow = !p.glass;
      mesh.receiveShadow = true;
      mesh.userData = {
        room: p.room,
        sourcePhoto: p.sourcePhoto,
        ceiling: element.kind === "roof" || /^(ceiling-|roof-)/.test(p.element),
      };
      this.home.add(mesh);
    }
    this.lighting.configure(data, this.primitives);
    this.onQuality("Preparing room lighting…");
    this.ready = this.lighting
      .bake(data, this.home, (done, total) => {
        this.needsRender = true;
        this.onQuality(
          done === total
            ? "Cinematic lighting ready"
            : `Preparing room lighting ${done}/${total}…`,
        );
      })
      .catch((error) => {
        console.error("Room lighting capture failed", error);
        this.onQuality("Daylight preview ready; room reflections unavailable");
        this.needsRender = true;
      });
    this.duration = data.route.reduce((s, p) => s + p.seconds, 0);
    this.time = 0;
    this.overview();
    this.onTime(0, this.duration);
    this.onRoom(data.rooms[0]);
  }
  setShellVisible(visible) {
    this.home?.children.forEach((mesh) => {
      if (mesh.userData.ceiling && mesh.visible !== visible) {
        mesh.visible = visible;
        this.renderer.shadowMap.needsUpdate = true;
      }
    });
  }
  overview(cutaway = false) {
    this.playing = false;
    this.walking = false;
    this.controls.enabled = true;
    this.keys.clear();
    if (!this.home) return;
    this.setShellVisible(!cutaway);
    // Fit the home, not distant neighboring buildings or a landscape horizon.
    const box = new THREE.Box3();
    for (const room of this.data.rooms) {
      const [x, z, w, d] = room.bounds;
      box.expandByPoint(new THREE.Vector3(x, room.elevation, z));
      box.expandByPoint(new THREE.Vector3(x + w, room.elevation + 2.6, z + d));
    }
    const center = box.getCenter(new THREE.Vector3()),
      size = box.getSize(new THREE.Vector3()),
      d = Math.max(size.x, size.z);
    this.controls.target.copy(center);
    this.camera.position
      .copy(center)
      .add(new THREE.Vector3(d * 0.56, d * 0.68, d * 0.75));
    this.controls.update();
    this.needsRender = true;
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
    this.needsRender = true;
  }
  seek(time) {
    if (!this.data) return;
    this.setShellVisible(true);
    this.needsRender = true;
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
        this.currentRoom = this.data.rooms.find((r) => r.id === b.room);
        this.onRoom(this.currentRoom);
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
    const support = walkSupport(
      this.data.elements,
      candidate.toArray(),
      this.camera.position.y - 1.6,
    );
    if (!support) return;
    candidate.y = support.height + 1.6;
    const room = this.data.rooms.find((r) => r.id === support.room);
    const blocked = this.data.elements.some((e) => {
      if (
        ["floor", "rug", "plant", "lamp", "stairs"].includes(e.kind) ||
        e.id.startsWith("stair-tread-")
      )
        return false;
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
    if (this.recording) {
      this.last = now;
      return;
    }
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
    const orbitChanged = this.controls.enabled && this.controls.update();
    // Static previews need no continuous GPU work. Keep resources available
    // for exports and Unreal while still drawing every interactive change.
    if (this.playing || this.walking || orbitChanged || this.needsRender) {
      this.composer.render();
      this.needsRender = false;
    }
    if (this.recording) this.compose();
  }
  async glb() {
    return new GLTFExporter().parseAsync(this.home, {
      binary: true,
      onlyVisible: false,
    });
  }
  compose() {
    const c = this.recordContext,
      w = 1920,
      h = 1080;
    c.drawImage(this.renderer.domElement, 0, 0, w, h);
    c.save();
    c.textAlign = "left";
    c.textBaseline = "alphabetic";
    const fit = (text) => {
      if (c.measureText(text).width <= 640) return text;
      while (text.length && c.measureText(text + "…").width > 640)
        text = text.slice(0, -1);
      return text + "…";
    };
    c.font = "500 34px Roboto, sans-serif";
    const address = fit(this.data.title),
      addressWidth = c.measureText(address).width;
    c.font = "400 22px Roboto, sans-serif";
    const room = fit(this.currentRoom?.name || ""),
      labelWidth = Math.max(addressWidth, c.measureText(room).width) + 48;
    c.fillStyle = "#0a0e1294";
    c.beginPath();
    c.roundRect(32, 28, labelWidth, 102, 12);
    c.fill();
    c.fillStyle = "white";
    c.font = "500 34px Roboto, sans-serif";
    c.fillText(address, 56, 70);
    c.fillStyle = "#e0e3e6";
    c.font = "400 22px Roboto, sans-serif";
    c.fillText(room, 56, 106);
    const img = document.querySelector("#source-image");
    if (
      !document.querySelector("#source").hidden &&
      img.complete &&
      img.naturalWidth
    ) {
      const scale = Math.min(340 / img.naturalWidth, 227 / img.naturalHeight);
      const sw = img.naturalWidth * scale,
        sh = img.naturalHeight * scale,
        x = w - 40 - sw,
        y = h - 40 - sh;
      c.save();
      c.shadowColor = "#00000066";
      c.shadowBlur = 18;
      c.shadowOffsetY = 4;
      c.fillStyle = "#ffffffb3";
      c.beginPath();
      c.roundRect(x - 1, y - 1, sw + 2, sh + 2, 10);
      c.fill();
      c.restore();
      c.beginPath();
      c.roundRect(x, y, sw, sh, 9);
      c.clip();
      c.imageSmoothingQuality = "high";
      c.drawImage(img, x, y, sw, sh);
    }
    c.restore();
  }
  async record() {
    if (this.recording) {
      this.stopRecording();
      return;
    }
    this.recording = true;
    this.recordCancelled = false;
    this.playing = false;
    this.walking = false;
    this.keys.clear();
    this.controls.enabled = false;
    this.onRecord("Preparing full 1080p export. Click again to cancel.");
    let completed = false;
    try {
      await this.ready;
      await Promise.all([
        document.fonts.load("500 34px Roboto"),
        document.fonts.load("400 22px Roboto"),
        document.fonts.load("500 72px Roboto"),
        document.fonts.load("400 44px Roboto"),
      ]);
      await document.fonts.ready;
      let titleBackground = null;
      if (this.titleBackgroundUrl) {
        titleBackground = new Image();
        titleBackground.src = this.titleBackgroundUrl;
        await titleBackground.decode();
      }
      if (this.recordCancelled) return;
      const canvas = document.createElement("canvas");
      canvas.width = 1920;
      canvas.height = 1080;
      this.recordContext = canvas.getContext("2d");
      this.renderer.setPixelRatio(1);
      this.renderer.setSize(1920, 1080, false);
      this.camera.aspect = 16 / 9;
      this.camera.updateProjectionMatrix();
      this.composer.setPixelRatio(1);
      this.composer.setSize(1920, 1080);
      let lastPhoto;
      const blob = await encodeTour({
        canvas,
        duration: this.duration + VIDEO_INTRO_DURATION,
        cancelled: () => this.recordCancelled,
        progress: (frame, total) =>
          this.onRecord(
            `Rendering 1080p · ${Math.floor((frame / total) * 100)}% · ${frame.toLocaleString()}/${total.toLocaleString()} frames. Click to cancel.`,
          ),
        draw: async (time) => {
          this.seek(Math.max(0, time - VIDEO_INTRO_DURATION));
          const img = document.querySelector("#source-image");
          if (
            !document.querySelector("#source").hidden &&
            img.src !== lastPhoto
          ) {
            await img.decode();
            lastPhoto = img.src;
          }
          this.composer.render();
          this.compose();
          if (time < VIDEO_INTRO_DURATION) {
            const opacity =
              time <= VIDEO_TITLE_HOLD
                ? 1
                : (VIDEO_INTRO_DURATION - time) /
                  (VIDEO_INTRO_DURATION - VIDEO_TITLE_HOLD);
            drawTourTitle(
              this.recordContext,
              this.data.title,
              opacity,
              titleBackground,
            );
          }
        },
      });
      if (blob && !this.recordCancelled) {
        completed = true;
        this.seek(this.duration);
        this.onDownload(blob, "home-walkthrough-1080p.webm", "video/webm");
      }
    } finally {
      this.recording = false;
      this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
      this.resize();
      this.onRecord(
        this.recordCancelled
          ? "Export cancelled."
          : completed
            ? "1080p video ready · 30 fps · Complete route"
            : "Video export failed. See the error below.",
      );
    }
  }
  stopRecording() {
    this.recordCancelled = true;
  }
}
