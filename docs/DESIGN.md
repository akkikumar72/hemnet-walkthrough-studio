# Design: Walkthrough Studio

<!-- Hallmark · Workbench · studied-DNA: Lumen · P4 H4 E4 S5 R5 V4 -->

Lumen is the app's current design system, applied on 2026-09-27 at the user's request. [Hallmark's Lumen 01 example](https://www.usehallmark.com/examples/lumen-01/) is the public visual reference. The app uses a dark architectural workbench with a project rail, photo evidence and a prominent interactive viewer. Use this system consistently when adding app surfaces.

The earlier cool-white, blue-slate and Georgia direction is superseded. Property photographs, 3D lighting and scene materials retain their own colours.

### Verified reference

The example identifies itself as Lumen / Night Foundry. Its [theme tokens](https://www.usehallmark.com/examples/lumen-01/tokens.css) and [stylesheet](https://www.usehallmark.com/examples/lumen-01/styles.css) were inspected:

- Cool charcoal background: `oklch(13% 0.014 265)`, with layered surfaces at 17% and 22% lightness.
- Warm brass primary accent: `oklch(76% 0.17 50)`. Use sparingly for the primary action and active selection.
- Instrument Serif for display headings, Geist for interface text, JetBrains Mono for occasional technical metadata.
- Fine borders, restrained corner radii and a clear separation between surfaces.
- The reference is a marketing page with a large hero, floating navigation and statement footer. Adapt its visual language to the existing app workbench rather than importing those page sections.

The app raises muted text to 72% OKLCH lightness and control borders to 52% for contrast on the dark surfaces. Semantic tokens live in `public/tokens.css`; the root `tokens.css` is a symlink to that same source. Font files and OFL licenses are bundled under `public/fonts/`, with no runtime font CDN request.

### App structure and interaction

1. Keep the real 3D viewer prominent, with clear project navigation and a compact tour toolbar. In Scene & review, the viewer precedes exports and expandable reconstruction notes. References retains the photo-led editing flow.
2. Use the dark surface hierarchy for the project rail, photo review, scene controls and API settings. Keep property photos and rendered scene lighting true to their sources.
3. Use warm accents for import, generate and play actions according to context. Keep secondary actions quiet and source-photo comparison readable.
4. Preserve Hemnet intake, photo selection, measurements, Three.js and Unreal workflows, project state and exports.
5. Use shared semantic tokens and verify keyboard focus, loading/error/disabled states and responsive layouts at 320, 375, 414 and 768 pixels, plus desktop. Preserve the instant focus ring, native form semantics and keyboard-operable tabs.

### Design choices

- Macrostructure: Workbench, adapted to a working app. Navigation: edge-aligned wordmark and API settings, plus the existing project rail. Footer: one quiet line.
- Type: Instrument Serif 400 for project and viewer titles, Geist 400/500/600 for controls and text, JetBrains Mono 400 for timeline and code metadata. Three families maximum.
- Colour: near-black violet-tinted surfaces, light neutral text, warm brass for the primary action, active tab and focus. Success and error colours carry explicit text feedback.
- Spacing: named 4-pixel scale. Controls use a 44-pixel minimum height. On mobile, project navigation scrolls within its rail and playback controls reflow into three rows.
- Motion: brief button press feedback only. Reduced-motion preference disables it. No decorative animation or marketing illustration in the workbench.
- States: default, hover, focus, pressed, disabled, busy, validation error and success feedback are styled. Input border widths remain fixed between states.

### Verification

The rendered app was checked for root overflow at all four required CSS widths. Primary text contrast ranges from 6.99:1 for muted text on raised surfaces to 17.94:1 for body text; brass button text measures 8.70:1. UI source and tests are checked with `npm run check`, `npm run format:check` and `npm test`. Screenshot evidence is local under `.local/lumen-review/` and is not published with property media.

The interface treatment does not improve reconstructed geometry or photo fidelity by itself. Keep reconstruction status and estimated dimensions visible. Do not borrow the reference's marketing claims, metrics, branding or decorative reactor illustration.
