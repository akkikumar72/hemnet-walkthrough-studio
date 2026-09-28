import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/addons/lights/RectAreaLightUniformsLib.js";

// Same world-space sun direction as the Unreal export: pitch -42, yaw -115.
export const SUN_DIRECTION = new THREE.Vector3(
  -Math.cos((42 * Math.PI) / 180) * Math.cos((-115 * Math.PI) / 180),
  Math.sin((42 * Math.PI) / 180),
  -Math.cos((42 * Math.PI) / 180) * Math.sin((-115 * Math.PI) / 180),
).normalize();

export function windowLights(data, primitives) {
  const rooms = new Map(data.rooms.map((r) => [r.id, r]));
  const elements = new Map(data.elements.map((e) => [e.id, e]));
  return primitives
    .filter(
      (p) =>
        p.glass &&
        elements.get(p.element)?.kind === "window" &&
        !p.element.startsWith("shower"),
    )
    .map((p) => {
      const r = rooms.get(p.room);
      const [x, z, w, d] = r.bounds;
      const target = [x + w / 2, p.position[1], z + d / 2];
      // These primitives retain local dimensions. Rotation, not world size, locates the pane.
      return {
        room: r.id,
        position: p.position,
        target,
        width: p.size[0],
        height: p.size[1],
      };
    });
}

export class HomeLighting {
  constructor(scene, renderer) {
    this.scene = scene;
    this.renderer = renderer;
    RectAreaLightUniformsLib.init();
    this.fill = new THREE.HemisphereLight("#dcecff", "#c3ac89", 0.08);
    this.sun = new THREE.DirectionalLight("#fff1dd", 4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(4096, 4096);
    this.sun.shadow.normalBias = 0.012;
    this.sun.shadow.bias = -0.00004;
    this.sun.shadow.radius = 3;
    scene.add(this.fill, this.sun, this.sun.target);
    this.windows = new THREE.Group();
    scene.add(this.windows);
    this.probes = new Map();
    this.pmrem = new THREE.PMREMGenerator(renderer);
    this.generation = 0;
  }
  configure(data, primitives) {
    this.generation++;
    this.windows.clear();
    for (const probe of this.probes.values()) probe.dispose();
    this.probes = new Map();
    const bounds = new THREE.Box3();
    for (const r of data.rooms) {
      const [x, z, w, d] = r.bounds;
      bounds.expandByPoint(new THREE.Vector3(x, r.elevation, z));
      bounds.expandByPoint(new THREE.Vector3(x + w, r.elevation + 3, z + d));
    }
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = bounds.getSize(new THREE.Vector3()).length() * 0.55;
    this.sun.target.position.copy(center);
    this.sun.position.copy(center).addScaledVector(SUN_DIRECTION, radius + 35);
    Object.assign(this.sun.shadow.camera, {
      left: -radius,
      right: radius,
      top: radius,
      bottom: -radius,
      near: 1,
      far: radius * 2 + 75,
    });
    this.sun.shadow.camera.updateProjectionMatrix();
    for (const pane of windowLights(data, primitives)) {
      const light = new THREE.RectAreaLight(
        "#fff8ed",
        3.2,
        pane.width,
        pane.height,
      );
      light.position.fromArray(pane.position);
      light.lookAt(new THREE.Vector3(...pane.target));
      this.windows.add(light);
    }
    this.renderer.shadowMap.needsUpdate = true;
  }
  async bake(data, home, onProgress) {
    const generation = this.generation;
    // Capture the actual closed rooms. This is local image-based lighting, not Lumen GI.
    const ceilings = home.children.filter((m) => m.userData.ceiling);
    const cube = new THREE.WebGLCubeRenderTarget(128, {
      type: THREE.HalfFloatType,
    });
    const camera = new THREE.CubeCamera(0.08, 100, cube);
    try {
      for (let i = 0; i < data.rooms.length; i++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        if (generation !== this.generation) return;
        const room = data.rooms[i];
        const point = data.route.find((p) => p.room === room.id);
        if (!point) continue;
        const visibility = ceilings.map((m) => m.visible);
        ceilings.forEach((m) => (m.visible = true));
        this.renderer.shadowMap.needsUpdate = true;
        camera.position.fromArray(point.position);
        camera.update(this.renderer, this.scene);
        const probe = this.pmrem.fromCubemap(cube.texture);
        this.probes.set(room.id, probe);
        ceilings.forEach((m, n) => (m.visible = visibility[n]));
        this.renderer.shadowMap.needsUpdate = true;
        onProgress(i + 1, data.rooms.length);
      }
      // Assign together so captures do not depend on which room was baked first.
      for (const mesh of home.children) {
        const probe = this.probes.get(mesh.userData.room);
        if (probe) {
          mesh.material.envMap = probe.texture;
          mesh.material.envMapIntensity = 0.55;
          mesh.material.needsUpdate = true;
        }
      }
    } finally {
      cube.dispose();
    }
  }
}
