import test from "node:test";
import assert from "node:assert/strict";
import { primitiveShape } from "../public/shapes.js";
import { compileGeometry } from "../public/geometry.js";
import { unrealMeshes } from "../src/unreal-meshes.js";
import { strFromU8 } from "fflate";
import * as THREE from "three";

test("office-chair backs have real apertures and casters support a floor-level base", () => {
  const e = {
    id: "office-chair-test",
    room: "bedroom",
    kind: "office-chair",
    position: [0, 0.43, 0],
    size: [0.49, 0.86, 0.5],
    rotation: 90,
    color: "#eeeeee",
    sourcePhoto: "",
  };
  const ps = compileGeometry({ elements: [e] });
  const p = ps.find((p) => p.kind === "perforated-back");
  const g = primitiveShape(e, p);
  const mesh = new THREE.Mesh(
    g,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  mesh.updateMatrixWorld();
  const throughHole = new THREE.Raycaster(
    new THREE.Vector3(-0.055 * p.size[0], -0.0725 * p.size[1], -1),
    new THREE.Vector3(0, 0, 1),
  );
  const throughShell = new THREE.Raycaster(
    new THREE.Vector3(0, 0, -1),
    new THREE.Vector3(0, 0, 1),
  );
  assert.equal(throughHole.intersectObject(mesh).length, 0);
  assert(throughShell.intersectObject(mesh).length > 0);
  const casters = ps.filter((p) => p.kind === "sphere");
  assert.equal(casters.length, 5);
  for (const caster of casters)
    assert(Math.abs(caster.position[1] - caster.size[1] / 2) < 1e-6);
  assert(new Set(ps.map((p) => p.rotation)).size >= 5);
  const files = unrealMeshes({ elements: [e] }, ps);
  assert(ps.every((p) => files[`Meshes/${p.mesh}.obj`]));
  g.dispose();
  mesh.material.dispose();
});

test("upholstered task chairs have a solid back and desks preserve a shallow rotated footprint", () => {
  const chair = {
    id: "task-chair-test",
    room: "bedroom",
    kind: "task-chair",
    position: [0, 0.455, 0],
    size: [0.49, 0.91, 0.53],
    rotation: -90,
    color: "#44474b",
    sourcePhoto: "",
  };
  const parts = compileGeometry({ elements: [chair] });
  const back = parts[1];
  const geometry = primitiveShape(chair, back);
  const mesh = new THREE.Mesh(
    geometry,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  mesh.updateMatrixWorld();
  assert(
    new THREE.Raycaster(
      new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0, 0, 1),
    ).intersectObject(mesh).length > 0,
  );
  for (const wheel of parts.filter((p) => p.kind === "sphere"))
    assert(Math.abs(wheel.position[1] - wheel.size[1] / 2) < 1e-6);
  assert(
    parts[1].position[0] > parts[0].position[0],
    "Back stays behind the seat when facing west",
  );
  const desk = {
    ...chair,
    id: "desk",
    kind: "writing-desk",
    position: [0, 0.37, 0],
    size: [1, 0.74, 0.5],
    rotation: 90,
    color: "#ffffff",
  };
  const desktop = compileGeometry({ elements: [desk] })[0];
  const top = new THREE.Mesh(primitiveShape(desk, desktop));
  top.rotation.y = Math.PI / 2;
  top.updateMatrixWorld();
  const bounds = new THREE.Box3()
    .setFromObject(top)
    .getSize(new THREE.Vector3());
  assert(Math.abs(bounds.x - 0.5) < 1e-6 && Math.abs(bounds.z - 1) < 1e-6);
  const files = unrealMeshes({ elements: [chair] }, parts);
  assert(parts.every((p) => files[`Meshes/${p.mesh}.obj`]));
  geometry.dispose();
  mesh.material.dispose();
  top.geometry.dispose();
  top.material.dispose();
});

test("roof slabs are watertight and preserve clear space below their sloping underside", () => {
  const element = {
    id: "roof-test",
    kind: "roof",
    size: [8, 2.08, 5],
    position: [0, 0, 0],
    rotation: 0,
  };
  const p = compileGeometry({ elements: [element] })[0];
  const g = primitiveShape(element, p);
  const edges = new Map(),
    positions = g.attributes.position;
  for (let i = 0; i < positions.count; i += 3) {
    const vertices = [0, 1, 2].map((j) =>
      [
        positions.getX(i + j),
        positions.getY(i + j),
        positions.getZ(i + j),
      ].join(","),
    );
    for (let j = 0; j < 3; j++) {
      const key = [vertices[j], vertices[(j + 1) % 3]].sort().join("|");
      edges.set(key, (edges.get(key) || 0) + 1);
    }
  }
  assert(
    [...edges.values()].every((count) => count === 2),
    "Every edge must have two incident triangles",
  );
  const mesh = new THREE.Mesh(
    g,
    new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
  );
  mesh.updateMatrixWorld();
  for (const x of [-3.7, -1, 1.7, 3.6]) {
    const bottom = -1.04 + (x + 4) * 0.25;
    const up = new THREE.Raycaster(
      new THREE.Vector3(x, -3, 0.3),
      new THREE.Vector3(0, 1, 0),
    );
    const down = new THREE.Raycaster(
      new THREE.Vector3(x, 3, 0.3),
      new THREE.Vector3(0, -1, 0),
    );
    assert(Math.abs(up.intersectObject(mesh)[0].point.y - bottom) < 1e-5);
    assert(
      Math.abs(down.intersectObject(mesh)[0].point.y - bottom - 0.08) < 1e-5,
    );
  }
  g.dispose();
  mesh.material.dispose();
});

test("landscape primitives have finite geometry within their stated world bounds", () => {
  for (const kind of ["tree", "hedge", "gable", "roof", "wedge"]) {
    const e = {
      id: "test",
      room: "garden",
      kind,
      position: [0, 0, 0],
      size: [4, 5, 3],
      rotation: 0,
      color: "#496039",
      sourcePhoto: "",
    };
    for (const p of compileGeometry({ elements: [e] })) {
      const g = primitiveShape(e, p);
      g.computeBoundingBox();
      const size = g.boundingBox.getSize({
        set(x, y, z) {
          this.x = x;
          this.y = y;
          this.z = z;
          return this;
        },
        subVectors(a, b) {
          this.x = a.x - b.x;
          this.y = a.y - b.y;
          this.z = a.z - b.z;
          return this;
        },
      });
      assert([size.x, size.y, size.z].every(Number.isFinite));
      // Leaves may overhang by their physical length, under 18 cm in total.
      [size.x, size.y, size.z].forEach((v, i) => assert(v <= p.size[i] + 0.18));
      assert(g.attributes.position.count > 0);
      g.dispose();
    }
  }
});

test("Unreal OBJ export retains shared dimensions and assigns each primitive an existing mesh", () => {
  const e = {
    id: "bed-pillow",
    room: "bedroom",
    kind: "box",
    position: [1, 2, 3],
    size: [0.4, 0.2, 0.3],
    rotation: 90,
    color: "#cccccc",
    sourcePhoto: "",
  };
  const scene = { elements: [e] };
  const ps = compileGeometry(scene);
  const files = unrealMeshes(scene, ps);
  const manifest = JSON.parse(strFromU8(files["meshes.json"]));
  assert.equal(ps[0].mesh, manifest[0].name);
  const text = strFromU8(files[manifest[0].file]);
  const vertices = text
    .split("\n")
    .filter((s) => s.startsWith("v "))
    .map((s) => s.split(" ").slice(1).map(Number));
  const extent = [0, 1, 2].map(
    (axis) =>
      Math.max(...vertices.map((v) => v[axis])) -
      Math.min(...vertices.map((v) => v[axis])),
  );
  assert.deepEqual(extent, [40, 30, 20]);
  assert(text.includes("vn "));
  assert(text.includes("vt "));
});
