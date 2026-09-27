// This renderer-neutral primitive list also drives the Unreal exporter.
export function compileGeometry(scene) {
  const out = [];
  for (const e of scene.elements) {
    let index = 0;
    const [w, h, d] = e.size,
      a = (e.rotation * Math.PI) / 180;
    const part = (kind, x, y, z, sx, sy, sz, color = e.color) => {
      out.push({
        id: `${e.id}_${index++}`,
        element: e.id,
        room: e.room,
        kind,
        position: [
          e.position[0] + x * Math.cos(a) + z * Math.sin(a),
          e.position[1] + y,
          e.position[2] - x * Math.sin(a) + z * Math.cos(a),
        ],
        size: [sx, sy, sz],
        rotation: e.rotation,
        color,
        glass: e.kind === "window",
        sourcePhoto: e.sourcePhoto,
      });
    };
    const box = (x, y, z, sx, sy, sz, c) => part("box", x, y, z, sx, sy, sz, c);
    const legs = (top, th = 0.055) => {
      for (const x of [-w * 0.38, w * 0.38])
        for (const z of [-d * 0.35, d * 0.35])
          box(x, -h / 2 + top / 2, z, th, top, th, "#514438");
    };
    switch (e.kind) {
      case "sofa":
        box(0, -h * 0.17, 0, w, h * 0.42, d);
        box(0, h * 0.18, -d * 0.4, w, h * 0.64, d * 0.18);
        box(-w * 0.46, 0, 0, w * 0.08, h * 0.74, d);
        box(w * 0.46, 0, 0, w * 0.08, h * 0.74, d);
        for (let j = 0; j < 3; j++)
          box((j - 1) * w * 0.28, h * 0.065, 0, w * 0.27, h * 0.13, d * 0.69);
        legs(h * 0.12);
        break;
      case "bed":
        box(0, -h * 0.27, 0, w, h * 0.25, d, "#8b7968");
        box(0, -h * 0.06, 0.015, w * 0.98, h * 0.2, d * 0.95);
        box(0, h * 0.04, d * 0.16, w * 0.99, h * 0.065, d * 0.62, "#dedbd2");
        box(0, h * 0.16, -d * 0.47, w, h * 0.69, d * 0.06, "#77898b");
        for (const x of [-w * 0.25, w * 0.25])
          box(x, h * 0.08, -d * 0.29, w * 0.41, h * 0.12, d * 0.2, "#f5f3ed");
        break;
      case "chair":
        box(0, -h * 0.08, 0, w, h * 0.12, d);
        box(0, h * 0.25, -d * 0.43, w, h * 0.46, d * 0.12);
        legs(h * 0.42, 0.04);
        break;
      case "table":
        box(0, h * 0.44, 0, w, h * 0.12, d);
        legs(h * 0.9);
        break;
      case "cabinet":
        box(0, 0, 0, w, h, d);
        for (const x of [-w * 0.25, w * 0.25])
          box(x, 0, d * 0.51, 0.025, h * 0.3, 0.025, "#a59b86");
        break;
      case "plant":
        part("cylinder", 0, -h * 0.35, 0, w * 0.5, h * 0.3, d * 0.5, "#b5aa96");
        part("cylinder", 0, 0, 0, 0.035, h * 0.65, 0.035, "#645b40");
        for (let j = 0; j < 9; j++) {
          const angle = j * 2.399;
          part(
            "sphere",
            Math.sin(angle) * w * 0.24,
            h * 0.1 + (j % 3) * h * 0.1,
            Math.cos(angle) * d * 0.24,
            w * 0.5,
            h * 0.19,
            d * 0.34,
            j % 2 ? "#486957" : "#728264",
          );
        }
        break;
      case "lamp":
        part("cylinder", 0, -h * 0.1, 0, 0.025, h * 0.75, 0.025, "#9d8a60");
        part("cylinder", 0, h * 0.33, 0, w, h * 0.26, d);
        part(
          "cylinder",
          0,
          -h * 0.47,
          0,
          w * 0.5,
          h * 0.04,
          d * 0.5,
          "#9d8a60",
        );
        break;
      case "stairs": {
        const steps = Math.max(2, Math.ceil(h / 0.18));
        for (let j = 0; j < steps; j++) {
          const sh = (h * (j + 1)) / steps;
          box(
            0,
            -h / 2 + sh / 2,
            -d / 2 + (d * (j + 0.5)) / steps,
            w,
            sh,
            d / steps,
          );
        }
        break;
      }
      case "sphere":
      case "cylinder":
        part(e.kind, 0, 0, 0, w, h, d);
        break;
      default:
        box(0, 0, 0, w, h, d);
    }
  }
  return out;
}
