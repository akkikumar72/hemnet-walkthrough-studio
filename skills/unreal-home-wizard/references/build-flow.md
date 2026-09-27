# Build flow

Read this after minimum intake is complete and local construction is authorized. Also read `quality-bar.md` and `logic-and-fidelity-audit.md`.

## 1. Organize inputs

- Preserve original references unchanged in a private directory.
- Inventory rooms, views, repeated landmarks, known dimensions, contradictions, and unknown areas.
- Record visible support relationships and update `HOME_PROJECT_BRIEF.md`.

## 2. Rough layout

- Establish units, floors, walls, openings, ceilings, stairs, fixed elements, and large furniture volumes.
- Add a gravity-bound walking character, collision, safe spawn, and boundaries around unmodeled areas.
- Create one matched camera for every key photograph.
- Use neutral diagnostic lighting and simple draft materials.

Show 3–8 clear screenshots and a top view when useful. Ask whether the room relationships, openings, stairs, and large furniture are correct.

## 3. Detailed build

After layout approval:

- finish architecture and eliminate gaps, overlaps, floating elements, and Z-fighting;
- match large furniture silhouettes before small decoration;
- add licensed materials with physically plausible scale, orientation, roughness, and normal detail;
- reproduce reference lighting without concealing defects;
- add requested interaction and subtle spatial audio;
- block unmodeled exterior areas unless exploration was requested.

Do not substitute a generic furniture set or loosely similar room in strict reconstruction mode.

## 4. QA loop

Run the full capture → compare → defect list → repair → recapture loop. Compare each key photograph with its matched camera, test physical support and collision, and perform a manual walkthrough.

Final review is allowed only when all key views contain zero critical and zero major defects.

## Final approval

Ask only after the release gate passes:

> Does the final view work for you?
>
> 1. Yes — create the launchable version
> 2. Changes are needed
> 3. Show another angle

## 5. Handoff

Prefer a packaged build. If packaging is unavailable, provide a launcher that opens directly in walk mode. Avoid machine-specific hardcoded paths.

Visible handoff:

```text
Launch Home
Controls.txt
Results/
```

Keep developer sources separate.
