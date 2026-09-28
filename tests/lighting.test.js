import test from "node:test";
import assert from "node:assert/strict";
import { windowLights, SUN_DIRECTION } from "../public/lighting.js";
import { compileGeometry } from "../public/geometry.js";

test("daylight enters rotated windows, retains their dimensions and excludes shower glass", () => {
  const data = {
    rooms: [{ id: "living", bounds: [2, 3, 5, 6] }],
    elements: [
      {
        id: "window-west",
        kind: "window",
        room: "living",
        position: [2, 1.5, 6],
        size: [1.6, 2.1, 0.03],
        rotation: 90,
        color: "#aabbcc",
      },
      {
        id: "shower-screen",
        kind: "window",
        room: "living",
        position: [3, 1, 6],
        size: [1, 2, 0.02],
        rotation: 0,
        color: "#aabbcc",
      },
    ],
  };
  const lights = windowLights(data, compileGeometry(data));
  assert.equal(lights.length, 1);
  assert.deepEqual(lights[0].position, [2, 1.5, 6]);
  assert.deepEqual(lights[0].target, [4.5, 1.5, 6]);
  assert.equal(lights[0].width, 1.6);
  assert.equal(lights[0].height, 2.1);
  assert(Math.abs(SUN_DIRECTION.y - Math.sin((42 * Math.PI) / 180)) < 1e-10);
});
