import Ajv from "ajv";

const text = { type: "string", maxLength: 1000 };
const vec = {
  type: "array",
  items: { type: "number", minimum: -200, maximum: 200 },
  minItems: 3,
  maxItems: 3,
};
const object = (properties) => ({
  type: "object",
  additionalProperties: false,
  properties,
  required: Object.keys(properties),
});
export const sceneSchema = object({
  version: { type: "integer", const: 1 },
  title: text,
  summary: text,
  assumptions: { type: "array", items: text, maxItems: 40 },
  rooms: {
    type: "array",
    minItems: 1,
    maxItems: 40,
    items: object({
      id: text,
      name: text,
      floor: { type: "integer", minimum: 0, maximum: 9 },
      elevation: { type: "number", minimum: 0, maximum: 40 },
      bounds: {
        type: "array",
        items: { type: "number", minimum: -100, maximum: 100 },
        minItems: 4,
        maxItems: 4,
      },
      photoIds: { type: "array", items: text, maxItems: 30 },
    }),
  },
  elements: {
    type: "array",
    minItems: 1,
    maxItems: 1500,
    items: object({
      id: text,
      room: text,
      kind: {
        type: "string",
        enum: [
          "floor",
          "wall",
          "window",
          "door",
          "sofa",
          "bed",
          "table",
          "chair",
          "cabinet",
          "office-chair",
          "task-chair",
          "writing-desk",
          "vanity-desk",
          "drawer-chest",
          "plant",
          "tree",
          "hedge",
          "gable",
          "roof",
          "wedge",
          "lamp",
          "rug",
          "stairs",
          "box",
          "sphere",
          "cylinder",
        ],
      },
      position: vec,
      size: {
        type: "array",
        items: { type: "number", exclusiveMinimum: 0, maximum: 100 },
        minItems: 3,
        maxItems: 3,
      },
      rotation: { type: "number", minimum: -360, maximum: 360 },
      color: { type: "string", pattern: "^#[a-fA-F0-9]{6}$" },
      sourcePhoto: text,
      confidence: { type: "string", enum: ["observed", "estimated"] },
    }),
  },
  route: {
    type: "array",
    minItems: 2,
    maxItems: 160,
    items: object({
      room: text,
      position: vec,
      target: vec,
      seconds: { type: "number", minimum: 1, maximum: 20 },
    }),
  },
});
const validate = new Ajv({ allErrors: true }).compile(sceneSchema);
export function validateScene(scene, photos = null) {
  if (!validate(scene))
    throw new Error(
      "Invalid scene: " +
        validate.errors
          .slice(0, 4)
          .map((e) => `${e.instancePath} ${e.message}`)
          .join("; "),
    );
  const rooms = new Set(scene.rooms.map((r) => r.id));
  if (rooms.size !== scene.rooms.length || rooms.has(""))
    throw new Error("Room IDs must be unique and nonempty.");
  const ids = new Set();
  for (const room of scene.rooms)
    if (room.bounds[2] <= 0 || room.bounds[3] <= 0)
      throw new Error("Room widths and depths must be positive.");
  for (const e of scene.elements) {
    if (ids.has(e.id) || !e.id)
      throw new Error("Element IDs must be unique and nonempty.");
    ids.add(e.id);
    if (!rooms.has(e.room)) throw new Error("Element has an unknown room.");
  }
  for (const point of scene.route) {
    if (!rooms.has(point.room)) throw new Error("Route has an unknown room.");
    if (Math.hypot(...point.position.map((v, i) => v - point.target[i])) < 0.05)
      throw new Error("Camera target must differ from position.");
  }
  if (photos) {
    const known = new Set(photos.map((p) => p.id));
    for (const r of scene.rooms)
      for (const id of r.photoIds)
        if (!known.has(id)) throw new Error("Room cites an unknown photo.");
    for (const e of scene.elements)
      if (e.sourcePhoto && !known.has(e.sourcePhoto))
        throw new Error("Element cites an unknown photo.");
  }
  return scene;
}

// A warning is evidence to review, never an automatic statement of fidelity.
export function reviewScene(scene) {
  const warnings = [];
  const covered = new Set(scene.route.map((p) => p.room));
  for (const room of scene.rooms)
    if (!covered.has(room.id))
      warnings.push(`Route does not visit ${room.name}.`);
  const walls = scene.elements.filter((e) => e.kind === "wall");
  for (let n = 1; n < scene.route.length; n++) {
    const a = scene.route[n - 1],
      b = scene.route[n];
    const distance = Math.hypot(...b.position.map((v, i) => v - a.position[i]));
    if (distance / b.seconds > 1.8)
      warnings.push(`Route segment ${n} exceeds comfortable walking speed.`);
    if (Math.abs(a.position[1] - b.position[1]) > 0.5)
      warnings.push(
        `Review floor transition at segment ${n}; stairs and headroom need manual verification.`,
      );
    for (let j = 0; j <= 20; j++) {
      const pos = a.position.map((v, i) => v + ((b.position[i] - v) * j) / 20);
      if (walls.some((e) => insideBox(pos, e, 0.12))) {
        warnings.push(
          `Route segment ${n} intersects a wall; edit the route before delivery.`,
        );
        break;
      }
    }
  }
  return [...new Set(warnings)];
}
export function insideBox(p, e, margin = 0) {
  const a = (-e.rotation * Math.PI) / 180,
    dx = p[0] - e.position[0],
    dz = p[2] - e.position[2];
  const x = dx * Math.cos(a) + dz * Math.sin(a),
    z = -dx * Math.sin(a) + dz * Math.cos(a);
  return (
    Math.abs(x) < e.size[0] / 2 + margin &&
    Math.abs(p[1] - e.position[1]) < e.size[1] / 2 + margin &&
    Math.abs(z) < e.size[2] / 2 + margin
  );
}
