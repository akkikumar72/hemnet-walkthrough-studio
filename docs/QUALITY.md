# Quality and delivery boundaries

## What v0.1 can establish

An editable first layout, room inventory, procedural furniture placement, evidence links and a camera route. A model may infer hidden geometry incorrectly. A validated scene is structurally valid JSON, not verified architecture.

The release does not include photogrammetry, Gaussian splatting, automatic texture extraction, detailed asset retrieval, measured floor-plan tracing, production stair physics, or a public hosting service. The default objects are deliberately simple. A higher render resolution cannot make these assets photorealistic.

## Before a customer delivery

1. Reconcile the photo inventory and plans. Show every evidenced room, with missing areas listed.
2. Confirm scale, ceiling slopes, openings, stairs and floor connectivity. Close the roof over every indoor space, including narrow extensions and perimeter joins. Inspect eaves and gables from outside and ceiling joins from inside. Cutaway is an explicit inspection mode; tours keep the shell visible. Treat unknown measurements as estimates.
3. Match dominant objects, surface detail, color and lighting against original photos. Use licensed detailed assets where needed.
4. Traverse the complete route. Check doorway clearance, camera height, intersections, floating parts and room transitions. Same-floor walking and guided stair movement are different capabilities.
5. Inspect representative frames and decode the final file. Check source-photo clarity, readable title/labels, full room coverage, resolution and frame pacing.

Keep a defect list with room, source image, issue, severity and evidence of the fix. A blocking mismatch should prevent a premium-delivery claim even if a video exports successfully. The included skill has deeper photographic and physical-logic audits.

## Fair engine comparison

Use the same geometry, reference photos, camera route and output resolution. Record assets, render settings, capture method, runtime and unresolved defects. Separate missing reconstruction detail from rendering-engine quality. Three.js offers convenient local/browser interaction; Unreal offers editor workflows and offline rendering. This repository does not establish a universal quality winner.

Browser export renders every route frame at 1080p with exact 30 fps timestamps, then encodes a seekable WebM. GPU load affects export time, not the output timeline; keep the tab visible so export can progress. Unreal's 4K preset produces image frames when explicitly rendered. Neither setting guarantees a photorealistic result.

## Outside the property

The app does not fetch Google Maps data or recreate the neighborhood automatically. Use permitted exterior photos and licensed geospatial datasets with provenance. Do not redistribute scraped map tiles or street imagery. Local context and observed exterior geometry need the same evidence review as the interior.
