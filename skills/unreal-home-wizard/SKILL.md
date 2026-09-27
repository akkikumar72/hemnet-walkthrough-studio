---
name: unreal-home-wizard
description: Reconstruct a home from a Hemnet listing, room photographs, or floor plans. Use for a local Three.js browser walkthrough, an editable Unreal Engine project, a comparison of both engines, or a narrated source-photo comparison video. Handles intake, evidence review, estimated layout, camera routes, local setup, and fidelity checks for beginners.
---

# Unreal Home Wizard

Guide the user from reference photographs to a reviewable home walkthrough. Offer Three.js for browser delivery and Unreal Engine for an editable production scene. Reuse answers and permissions from the conversation. Handle routine setup and repair without making the user learn 3D tooling.

This edition extends the Apache-2.0 [upstream wizard](https://github.com/amirmushichge/unreal-home-wizard/tree/v0.2.0) with the local Walkthrough Studio workflow. The studio produces editable geometry drafts. It does not automatically deliver a photographically accurate digital twin.

## Start with the next useful action

1. Identify the reference link or folder, desired output, and permission to use the images. A request to use the user's own photos normally supplies that permission. Ask only for missing information that affects the result.
2. Choose the requested engine. If unspecified, start with the browser preview and retain the shared scene for Unreal export. Do not install Unreal just to try the browser demo.
3. Inspect the workspace and current project before changing files. Create an isolated project for a new property. Never reuse another client's geometry or photographs.
4. Record scope, evidence, rights, measurements, assumptions, engine, status, and next action in an ignored `HOME_PROJECT_BRIEF.md` inside the private project folder.

Use ordinary household language. Explain unavoidable technical terms once. Give concise progress updates about what is complete and what evidence is missing. Do not restart the original questionnaire when the conversation already supplies the answers.

## Local studio route

Read [references/studio-workflow.md](references/studio-workflow.md) for setup, CLI commands, the scene contract, private storage, engine export, and API-key choices.

Locate a checkout of `hemnet-walkthrough-studio`; check its `package.json`, scripts, and README. If none exists, clone `https://github.com/akkikumar72/hemnet-walkthrough-studio` to a new user workspace, inspect the scripts, then run `npm ci --ignore-scripts` and `npm start`. Open its printed loopback URL. Do not stop an unrelated server or assume a fixed local filesystem path.

For a Hemnet URL, use the app importer or `scripts/project.mjs import-link`. If Hemnet refuses automated access, preserve the failed-import message and use permitted photos downloaded by the user. Do not bypass access controls, CAPTCHA, login gates, or scrape a different host as an undisclosed workaround. Validate the image count against the available gallery. Never silently claim all images were imported.

There are two reconstruction paths:

- **App API:** the user configures an OpenAI platform API key locally and explicitly chooses Generate. Selected photos and notes go to OpenAI in a billable request. Do not ask them to paste a key in chat or read Codex credentials. No automatic paid retries.
- **Codex-assisted:** inspect the private images with available image tools, write a scene JSON satisfying the repository schema, and import it using `put-scene`. Use the current Codex session's configured access. Do not require an additional app API key. Explain that photos inspected by a cloud agent are handled by that agent's service; this is not offline inference.

The demo needs neither an app API key nor Unreal. Use it for installation checks, never as a reconstruction of the user's property.

## Evidence and fidelity

Default to strict reconstruction of visible evidence. Do not beautify, redesign, invent missing rooms, or substitute generic furnishings without labeling the change or obtaining the user's requested direction.

- Inventory every usable image. Group by room, floor, exterior, floor plan, detail, and duplicates. Relate every modeled room and dominant object to its source photos.
- Record observed and estimated geometry separately. Prefer the floor plan for connectivity and known measurements for scale. Unknown ceilings and hidden dimensions remain estimates.
- Preserve original-resolution photos. Inspect image dimensions before promising sharp close-ups. Do not pretend upscaling restores unseen details, and do not use generated images as proof of reconstruction accuracy.
- Match architecture, window and door openings, stair voids, ceiling slopes, finishes, furniture silhouettes, and dominant colors. Correct intersections, floating objects, unsupported lights, and misplaced decor.
- Include all evidenced rooms in the route, not only two attractive rooms. Explain omissions. Test camera height, doorway clearance, room transitions, and stairs.
- Show matched camera comparisons with the original photo. Record unresolved issues and refine before describing the result as premium, photorealistic, or ready for customers.

For full construction read [references/quality-bar.md](references/quality-bar.md) and [references/logic-and-fidelity-audit.md](references/logic-and-fidelity-audit.md). Treat their review gates as checkpoints; existing user authorization still applies. Show the rough layout and final comparisons when ready. Ask for a decision only when an unresolved choice affects the result.

The studio schema is a constrained draft format using procedural furnishings and flat colors. For higher fidelity, export to Unreal or extend the Three.js scene with licensed assets, calibrated materials and lighting. Describe this work explicitly. The viewer does not implement photogrammetry, Gaussian splats, automatic texture reconstruction, or full stair physics.

## Unreal route

Use the studio's Unreal ZIP when a shared scene exists. Extract into a new private folder, inspect `build_unreal.py`, and run it inside the installed editor. It creates a timestamped map, route cameras, a continuous `HomeTour` sequence, and a `Render4K` Movie Render Queue preset. Inspect `build-report.json` and the actual saved assets. Preparing the preset is not evidence that a video was rendered.

For a standalone Unreal project, read [references/build-flow.md](references/build-flow.md). On macOS use `scripts/preflight-macos.sh`; on Windows use `scripts/preflight.ps1`. Run the bundled smoke test against the exact project before building. Prefer Unreal's built-in Python bridge via the included platform invocation scripts. Preserve existing maps and assets.

Ask before a large engine/compiler download, a purchase, account sign-in, or license acceptance unless already authorized. State the reason and known download size. Never disable OS security protections. Technical checks must use the installed engine's current capabilities rather than assuming engine parity across operating systems.

## Tour and video delivery

- Browser controls: overview orbit, same-floor WASD and drag-to-look, room selection, continuous tour, and 1080p WebM recording where MediaRecorder is supported. Real-time recordings depend on GPU frame pacing.
- Unreal controls: editable map and sequence. Set up and verify collision, a player pawn, gravity and stairs separately before promising a packaged walkable executable.
- Video: cover every evidenced room, move through real openings, use gentle speed and turns, and keep transitions spatially plausible. Show the property title, engine/output label, and matching source photo when available and permitted. Keep text readable and away from controls.
- Examine rendered frames at the start, end, transitions, and representative views of every room. Decode the exported video to verify dimensions and duration. A running preview does not prove an exported file works.
- Compare engines with the same geometry, route, evidence, resolution, and stated quality settings. Distinguish engine limitations from missing assets and uncertain reconstruction.

## Surroundings and privacy

Use supplied exterior photos and appropriately licensed map or building data with provenance and required attribution. Google Maps is useful for visual reference, but do not scrape or redistribute its tiles, street imagery, or geometry. Unknown surroundings remain clearly approximate.

Keep private inputs, addresses, scenes, logs, exports, `.env`, and keys out of public commits. A public code request does not publish client media. Use fictional or explicitly licensed examples in documentation. Never publish or send a project to another service merely because an export button exists.

## Completion

Deliver a working local URL or launcher, the editable project, selected verified media, and a short list of approximate or unfinished areas. Report which engine and export were actually tested. If live API reconstruction, another operating system, packaged walking, or final photorealism is unverified, say so. Continue authorized independent work when one component is blocked.
