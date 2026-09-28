import { test } from "node:test";
import assert from "node:assert/strict";
import { walkSupport } from "../public/navigation.js";
const slab = (id, x, y, width, height, kind = "floor") => ({
  id,
  kind,
  room: "hall",
  position: [x, y, 0],
  size: [width, height, 1],
  rotation: 0,
});
test("walk follows a three-riser transition in both directions without a floor jump", () => {
  const elements = [
    slab("floor-low", -1, -0.07, 2, 0.14),
    slab("stair-tread-1", 0.175, 0.08, 0.35, 0.16, "box"),
    slab("stair-tread-2", 0.525, 0.16, 0.35, 0.32, "box"),
    slab("stair-tread-3", 0.875, 0.24, 0.35, 0.48, "box"),
    slab("floor-high", 2, 0.41, 1.9, 0.14),
  ];
  let feet = 0;
  for (const x of [-0.1, 0.15, 0.5, 0.85, 1.1])
    feet = walkSupport(elements, [x, feet + 1.6, 0], feet).height;
  assert.ok(Math.abs(feet - 0.48) < 1e-6);
  for (const x of [0.85, 0.5, 0.15, -0.1])
    feet = walkSupport(elements, [x, feet + 1.6, 0], feet).height;
  assert.equal(feet, 0);
  assert.equal(walkSupport(elements, [2, 1.6, 0], 0), null);
  assert.equal(walkSupport(elements, [0, 1.6, 2], 0), null);
});
