# Final quality bar

A blockout, generic template, or collection of primitive boxes is not a final result. Keep working until the reviewed views read as deliberate architectural visualization, or report the concrete external blocker.

## Reference fidelity

Each key camera must preserve visible room proportions; floor, wall, and ceiling lines; openings and structural features; large furniture silhouettes and placement; occlusion order; camera height, direction, field of view, and crop; material families; and lighting direction.

Do not replace the room with a merely similar interior. Hidden areas use the minimum plausible inference.

## Geometry and physical logic

- No floating cabinets, furniture, trims, switches, fixtures, or loose objects.
- Cushions visibly settle against a seat, back, or neighboring cushion.
- Floor lamps meet the floor; table lamps meet their table; wall lights meet their mount; pendant lights connect visibly to the ceiling.
- Furniture legs, plinths, appliances, planters, and props meet their supporting surface.
- No visible intersections, Z-fighting, open holes, broken rails, paper-thin walls, or light leaks.
- Dominant curved, upholstered, carved, or profiled objects are not replaced by crude boxes.
- Major furniture matches the reference silhouette closely.

## Materials and lighting

- No placeholder or flat debug material remains in a final camera.
- Texture scale and direction are believable; wood, flooring, tile, grout, fabric, and bark read correctly.
- Use base color, roughness, and normal detail where visible.
- Avoid obvious repetition, plastic cloth, mirror-like wood, flat ambient light, clipped highlights, muddy shadows, and excessive bloom.
- Reproduce the reference daylight direction and interior contrast, with indirect bounce and contact shadows.

## Release gate

All must pass:

- every key photograph has a reviewed matched-camera render;
- zero critical and zero major defects remain;
- every visible object has credible support or mounting;
- no placeholders, floating objects, intersections, holes, Z-fighting, or light leaks remain;
- materials and lighting reach presentation quality;
- walking, stairs, collision, look controls, and boundaries were manually tested;
- engine warnings and debug overlays are absent from user-facing captures.

If any item fails, label the output work in progress and continue.
