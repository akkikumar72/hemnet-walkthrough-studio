# Logic and fidelity audit

Use this audit after every meaningful geometry or furnishing pass and before showing review images. Codex, not the beginner, is responsible for finding obvious errors.

## Evidence ledger

For each key photograph record camera direction and likely height; architectural boundaries and openings; large furniture and landmark relationships; materials and lighting; object support relationships; repeated features; contradictions; and occluded areas.

Every dominant visible element must be accounted for. Do not add a dominant object merely to make the room look designed.

## Physical-logic pass

Use rendered close-ups plus geometry bounds, directional traces, and collision inspection when available. Check floors, walls, furniture contact points, cushions, rugs, table objects, wall fixtures, curtains, lights, cabinets, stairs, rails, doors, and drawers.

A visible unexplained gap between an object and its expected support is a critical defect.

## Photo-match pass

For every key photograph:

1. render from the matched Unreal camera at the same aspect ratio;
2. compare source and render side by side and use an overlay or difference view when practical;
3. compare dominant architectural lines and furniture silhouettes;
4. compare occlusion order;
5. compare materials, texture direction, light direction, contrast, and exterior visibility;
6. record every discrepancy before editing.

Beauty angles never replace matched-camera evidence.

## Severity

- `Critical`: wrong room connection, major opening, floor or ceiling relationship; missing dominant object; floating or physically impossible object; severe camera mismatch.
- `Major`: wrong scale or placement of large furniture; wrong silhouette; obvious material, texture, lighting, intersection, gap, or light-leak error in a key view.
- `Minor`: small decorative difference that does not alter layout, silhouette, physical logic, or room identity.

## Mandatory correction loop

1. Capture all key views.
2. Run physical-logic and photo-match passes.
3. Write a defect list with evidence image, object, severity, and correction.
4. Fix all critical defects, then all major defects.
5. Recapture every affected view.
6. Repeat until every key view contains zero critical and zero major defects.
7. List unavoidable minor deviations only when caused by missing evidence, unavailable legal assets, or a confirmed user choice.

Never mark the project complete after the first render pass.
