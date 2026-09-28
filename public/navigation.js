// Find actual supporting floor/step geometry, rather than treating room bounds as floors.
export function walkSupport(elements, position, feet, maxStep = 0.21) {
  let support = null;
  for (const e of elements) {
    if (
      e.kind !== "floor" &&
      e.kind !== "stairs" &&
      !e.id.startsWith("stair-tread-")
    )
      continue;
    const a = (e.rotation * Math.PI) / 180;
    const dx = position[0] - e.position[0],
      dz = position[2] - e.position[2];
    const x = dx * Math.cos(a) - dz * Math.sin(a),
      z = dx * Math.sin(a) + dz * Math.cos(a);
    if (Math.abs(x) > e.size[0] / 2 || Math.abs(z) > e.size[2] / 2) continue;
    let top = e.position[1] + e.size[1] / 2;
    if (e.kind === "stairs") {
      const n = Math.max(2, Math.ceil(e.size[1] / 0.18));
      const step = Math.min(n, Math.floor((z / e.size[2] + 0.5) * n) + 1);
      top = e.position[1] - e.size[1] / 2 + (step * e.size[1]) / n;
    }
    if (top > feet + maxStep || top < feet - maxStep) continue;
    if (!support || top > support.height)
      support = { height: top, room: e.room };
  }
  return support;
}
