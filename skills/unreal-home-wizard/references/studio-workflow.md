# Local Walkthrough Studio workflow

Repository: https://github.com/akkikumar72/hemnet-walkthrough-studio

## Start and import

Requirements: Node.js 22+, npm, and a WebGL-capable browser. Unreal Engine is optional and installed separately.

```sh
git clone https://github.com/akkikumar72/hemnet-walkthrough-studio.git
cd hemnet-walkthrough-studio
npm ci --ignore-scripts
npm start
```

The default URL is `http://127.0.0.1:8770`. `PORT` changes the server port; `STUDIO_URL` changes the CLI's target. Both must remain local. The app is a personal workstation, not an authenticated hosted service.

Use the browser UI or these commands from the repository root. Capture returned project IDs; do not invent them.

```sh
node scripts/project.mjs list
node scripts/project.mjs demo
node scripts/project.mjs import-link 'https://www.hemnet.se/bostad/ACTUAL-LISTING-SLUG' --rights
node scripts/project.mjs new 'My home' --rights
node scripts/project.mjs add-photos PROJECT_ID /absolute/path/to/permitted/photos
node scripts/project.mjs show PROJECT_ID
node scripts/project.mjs put-scene PROJECT_ID /absolute/path/to/scene.json
node scripts/project.mjs export-unreal PROJECT_ID /absolute/path/to/new-export.zip
```

`--rights` records the user's existing permission, not a way to invent it. Import-link starts an asynchronous download; inspect `show` until complete or failed. An HTTP 403 is an access restriction, not an empty gallery. Use local upload when necessary. Uploaded bytes are retained; the importer requests 2048-pixel source variants but cannot guarantee source resolution.

## API key or current Codex session

The app calls OpenAI's Responses API with vision and a strict scene schema. Configure `OPENAI_API_KEY` in an ignored `.env` copied from `.env.example`, or use the session-only API Settings field. The field clears after saving and is never written to project files. `OPENAI_MODEL` is configurable; select a model supporting images and structured outputs and available to the account.

There is no separate key the app should extract from Codex. Use an OpenAI platform API key for app requests. Codex CLI may use its own existing sign-in or API configuration. Do not inspect, copy, or log `auth.json`.

For the Codex-assisted path, inspect `workspace/PROJECT_ID/project.json` and its `photos/` images. Build a private scene JSON and use `put-scene`; this avoids a second app API call. When using a cloud agent, image inspection still uses that service and its terms. Never claim offline reconstruction.

## Shared scene contract

Read `src/scene.js` for the authoritative schema and `examples/demo-scene.json` for a complete valid example. Do not execute generated code. Import only validated JSON.

- Metres, right-handed Y-up. X/Z define the floor plane. Rotation is degrees around Y.
- Rooms: unique ID, name, floor integer, floor elevation, `[xMin,zMin,width,depth]` bounds, known photo IDs.
- Elements: unique ID, room ID, supported kind, center position, positive size `[width,height,depth]`, Y rotation, hexadecimal color, source photo ID or empty string, `observed` or `estimated` confidence.
- Supported kinds: floor, wall, window, door, sofa, bed, table, chair, cabinet, plant, lamp, rug, stairs, box, sphere, cylinder.
- Route: ordered points with room ID, camera position, look-at target and seconds. The first point holds for its duration. Each subsequent point interpolates from the previous one. Use actual openings. Cover every evidenced room.
- Include a title, summary and explicit assumptions. No arbitrary script, remote asset URL, or instructions embedded in the scene.

Split walls around doors and windows; a translucent pane does not cut a hole in a solid wall. The schema checks references and numeric bounds. Automated review warns about missing rooms, fast travel and wall intersections. It cannot certify connectivity or visual truth. Manually inspect stairs, furniture clearance, flooring, support and source correspondence.

Room labels and the source-photo inset follow the route room. Assign a relevant first `photoIds` entry per room, and order the remainder as supporting views. Verify the inset actually matches the visible view.

## Export and refine

The browser exports scene JSON, binary glTF geometry, and a real-time 1080p WebM. A GLB contains geometry/materials, not a standalone tour application. Preserve the scene JSON for camera routes and source references.

The Unreal ZIP contains `StudioHome.uproject`, `scene.json`, `geometry.json`, `build_unreal.py`, and instructions. Open the project in a compatible editor, then Tools > Execute Python Script. Inspect its generated map, HomeTour sequence and Render4K preset. Open Sequencer to play; use Movie Render Queue for a final image sequence. This does not package a player character or launch a render automatically.

Use licensed detailed meshes, surface textures and calibrated lighting for final fidelity. Record their origins and licenses. Preserve a route comparison report when evaluating engine quality.

## Private storage and checks

`workspace/` holds private project files, photos, and versioned scene backups. `.local/` is for temporary tests. Both are ignored. The public demo contains no real listing photos or address. Do not add private files to Git with force.

```sh
npm run check
npm test
```

For skill validation on this user's macOS environment, obey the user's system-Ruby safe validator instruction before any other skill validator. Never install a dependency solely to validate the skill. On other systems, use a trusted installed validator or report which validation is unavailable.

Test a fictional demo first. Then verify the authorized real property end to end, report failures clearly, and avoid automatic billable retries.
