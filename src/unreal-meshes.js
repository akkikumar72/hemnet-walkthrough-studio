import { strToU8 } from "fflate";
import { primitiveShape, shapeKey } from "../public/shapes.js";

// Keep camera-visible shapes identical in both engines, including soft edges and foliage.
export function unrealMeshes(scene, primitives) {
  const elements = new Map(scene.elements.map((e) => [e.id, e]));
  const cache = new Map(),
    files = {},
    manifest = [];
  for (const p of primitives) {
    const element = elements.get(p.element),
      key = shapeKey(element, p);
    if (!cache.has(key)) {
      const name = `Shape_${String(cache.size).padStart(4, "0")}`;
      const geometry = primitiveShape(element, p);
      const g = geometry.index ? geometry.toNonIndexed() : geometry;
      const pos = g.attributes.position,
        normal = g.attributes.normal;
      const lines = [
        "# Original procedural geometry. Centimetres. No map imagery.",
        `o ${name}`,
      ];
      for (let i = 0; i < pos.count; i++)
        lines.push(
          `v ${(pos.getX(i) * 100).toFixed(5)} ${(-pos.getZ(i) * 100).toFixed(5)} ${(pos.getY(i) * 100).toFixed(5)}`,
        );
      const uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const u = uv ? uv.getX(i) : i % 3 === 1 ? 1 : 0;
        const v = uv ? uv.getY(i) : i % 3 === 2 ? 1 : 0;
        lines.push(`vt ${u.toFixed(5)} ${v.toFixed(5)}`);
      }
      for (let i = 0; i < pos.count; i++)
        lines.push(
          `vn ${normal.getX(i).toFixed(5)} ${(-normal.getZ(i)).toFixed(5)} ${normal.getY(i).toFixed(5)}`,
        );
      for (let i = 1; i <= pos.count; i += 3)
        lines.push(
          `f ${i}/${i}/${i} ${i + 1}/${i + 1}/${i + 1} ${i + 2}/${i + 2}/${i + 2}`,
        );
      files[`Meshes/${name}.obj`] = strToU8(lines.join("\n") + "\n");
      manifest.push({
        name,
        file: `Meshes/${name}.obj`,
        triangles: pos.count / 3,
      });
      cache.set(key, name);
      if (g !== geometry) g.dispose();
      geometry.dispose();
    }
    p.mesh = cache.get(key);
  }
  files["meshes.json"] = strToU8(JSON.stringify(manifest));
  return files;
}
