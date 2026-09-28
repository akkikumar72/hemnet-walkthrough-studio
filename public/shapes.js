import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

// The same sized geometry is used in WebGL and the Unreal OBJ export.
export function shapeKey(element, primitive) {
  const soft =
    primitive.kind === "cushion" ||
    element.kind === "sofa" ||
    /^(duvet|pillow|throw|mattress|bed-base)-/.test(element.id);
  const hard = ["wall", "floor", "window", "gable"].includes(element.kind);
  return [
    primitive.kind,
    ...primitive.size,
    soft ? "soft" : hard ? "hard" : "round",
  ].join("_");
}

export function primitiveShape(element, p) {
  const [w, h, d] = p.size;
  let geo;
  if (p.kind === "perforated-back") {
    const shape = new THREE.Shape();
    const radius = 0.08;
    shape.moveTo(-0.5 + radius, -0.5);
    shape.lineTo(0.5 - radius, -0.5);
    shape.quadraticCurveTo(0.5, -0.5, 0.5, -0.5 + radius);
    shape.lineTo(0.5, 0.5 - radius);
    shape.quadraticCurveTo(0.5, 0.5, 0.5 - radius, 0.5);
    shape.lineTo(-0.5 + radius, 0.5);
    shape.quadraticCurveTo(-0.5, 0.5, -0.5, 0.5 - radius);
    shape.lineTo(-0.5, -0.5 + radius);
    shape.quadraticCurveTo(-0.5, -0.5, -0.5 + radius, -0.5);
    for (let row = 0; row < 6; row++)
      for (let col = 0; col < 8; col++) {
        const hole = new THREE.Path();
        hole.absellipse(
          (col - 3.5) * 0.11,
          (row - 2.5) * 0.145,
          0.035,
          (0.035 * w) / h,
          0,
          Math.PI * 2,
          true,
        );
        shape.holes.push(hole);
      }
    geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.2,
      bevelEnabled: false,
      curveSegments: 10,
      steps: 1,
    });
    const positions = geo.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i),
        y = positions.getY(i);
      positions.setZ(i, positions.getZ(i) + x * x * 1.5 - y * 0.25);
    }
    geo.computeBoundingBox();
    const center = geo.boundingBox.getCenter(new THREE.Vector3());
    const bounds = geo.boundingBox.getSize(new THREE.Vector3());
    geo.translate(-center.x, -center.y, -center.z);
    geo.scale(w / bounds.x, h / bounds.y, d / bounds.z);
    geo.computeVertexNormals();
    return geo;
  }
  if (["canopy", "hedge"].includes(p.kind)) return foliage(p.kind, p.size);
  if (["roof", "wedge"].includes(p.kind)) {
    // Rise along local +X. Roofs are closed, thin sloping slabs, not solid
    // attic volumes. A 180-degree yaw reverses the slope. Size is the AABB.
    const t = Math.min(0.08, h);
    const section =
      p.kind === "roof"
        ? [
            [-w / 2, -h / 2],
            [w / 2, h / 2 - t],
            [w / 2, h / 2],
            [-w / 2, -h / 2 + t],
          ]
        : [
            [-w / 2, -h / 2],
            [w / 2, -h / 2],
            [w / 2, h / 2],
          ];
    const n = section.length;
    const vertices = [-d / 2, d / 2].flatMap((z) =>
      section.map(([x, y]) => [x, y, z]),
    );
    const faces = [];
    for (let i = 1; i < n - 1; i++) {
      faces.push([0, i + 1, i], [n, n + i, n + i + 1]);
    }
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      faces.push([i, j, n + j], [i, n + j, n + i]);
    }
    geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        faces.flatMap((f) => f.flatMap((i) => vertices[i])),
        3,
      ),
    );
    geo.computeVertexNormals();
    return geo;
  }
  if (p.kind === "gable") {
    const v = [
      [-w / 2, -h / 2, -d / 2],
      [w / 2, -h / 2, -d / 2],
      [0, h / 2, -d / 2],
      [-w / 2, -h / 2, d / 2],
      [w / 2, -h / 2, d / 2],
      [0, h / 2, d / 2],
    ];
    const faces = [
      [0, 2, 1],
      [3, 4, 5],
      [0, 1, 4],
      [0, 4, 3],
      [1, 2, 5],
      [1, 5, 4],
      [2, 0, 3],
      [2, 3, 5],
    ];
    geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        faces.flatMap((f) => f.flatMap((i) => v[i])),
        3,
      ),
    );
    geo.computeVertexNormals();
    return geo;
  }
  if (p.kind === "sphere") geo = new THREE.SphereGeometry(0.5, 24, 16);
  else if (p.kind === "cylinder")
    geo = new THREE.CylinderGeometry(0.5, 0.5, 1, 24);
  else {
    const soft =
      p.kind === "cushion" ||
      element.kind === "sofa" ||
      /^(duvet|pillow|throw|mattress|bed-base)-/.test(element.id);
    if (
      ["wall", "floor", "window"].includes(element.kind) ||
      (p.kind !== "cushion" && Math.min(...p.size) < 0.06)
    )
      return new THREE.BoxGeometry(w, h, d);
    return new RoundedBoxGeometry(
      w,
      h,
      d,
      soft ? 4 : 2,
      Math.min(...p.size) * (soft ? 0.32 : 0.035),
    );
  }
  geo.scale(w, h, d);
  return geo;
}

function foliage(kind, [w, h, d]) {
  let seed = 72431;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const positions = [],
    colors = [];
  const count = Math.min(
    16000,
    Math.max(1600, Math.round((w * h + w * d + h * d) * 160)),
  );
  for (let i = 0; i < count; i++) {
    let x, y, z;
    if (kind === "canopy") {
      const a = random() * Math.PI * 2,
        b = Math.acos(2 * random() - 1),
        r = Math.cbrt(random());
      x = Math.sin(b) * Math.cos(a) * r * w * 0.5;
      y = Math.cos(b) * r * h * 0.5;
      z = Math.sin(b) * Math.sin(a) * r * d * 0.5;
    } else {
      x = (random() - 0.5) * w;
      y = (random() - 0.5) * h;
      z = (random() - 0.5) * d;
    }
    const center = new THREE.Vector3(x, y, z);
    const normal = new THREE.Vector3(
      random() - 0.5,
      random() - 0.2,
      random() - 0.5,
    ).normalize();
    const u = new THREE.Vector3()
      .crossVectors(normal, new THREE.Vector3(0, 1, 0))
      .normalize();
    const v = new THREE.Vector3().crossVectors(normal, u).normalize();
    const size = 0.035 + random() * 0.055;
    const points = [
      [0, -1],
      [0.5, -0.35],
      [0.46, 0.35],
      [0, 1],
      [-0.46, 0.35],
      [-0.5, -0.35],
    ].map(([a, b]) =>
      center
        .clone()
        .addScaledVector(u, a * size)
        .addScaledVector(v, b * size),
    );
    const tone = 0.64 + random() * 0.66;
    for (let j = 1; j < 5; j++)
      for (const k of [0, j, j + 1]) {
        positions.push(...points[k].toArray());
        colors.push(tone * 0.92, tone, tone * 0.78);
      }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  return geo;
}
