# C.D.C.S. — Custom Designed Cadence Studio

C.D.C.S. is a zero-cost, browser-native songwriting constraint engine. It converts tempo, time signature, section bars, cadence profiles, density targets, and lyrics into a computed timeline with explainable validation.

## Why this rebuild exists

The original prototype looked convincing but its displayed facts contradicted its own inputs:

- section widths were divided by a hard-coded 76 bars while the sections totaled 72 bars;
- 72 bars at 145.2 BPM in 4/4 compute to roughly 119 seconds, not the hard-coded 185.4 seconds;
- a 104-syllable verse was marked `overflow` despite a displayed minimum of 192 syllables;
- React, Babel, and Tailwind were loaded from CDNs at runtime;
- transport buttons, editing, import/export, persistence, and the claimed backend were not functional.

This version removes those contradictions. Displayed values are derived from one deterministic engine rather than copied mock numbers.

## Capabilities

- mathematically computed bar and section timing;
- configurable BPM, time signature, cadence profile, bars, and density scale;
- explainable `underfilled`, `pass`, and `overflow` decisions;
- local project persistence through `localStorage`;
- JSON import with schema-style validation and rejection of invalid projects;
- JSON export containing both source inputs and computed results;
- local-only audio playback using the browser's native audio element;
- responsive, keyboard-accessible interface;
- no framework, CDN, API key, account, telemetry, build step, or paid service;
- deterministic Node test suite and GitHub Actions workflow.

## Run locally

Requirements: Python 3 or another static file server.

```bash
python3 -m http.server 4173
```

Open `http://localhost:4173`.

Opening the file directly with `file://` may be blocked by browser module security, so use the local server command above.

## Test

Requirements: Node.js 20 or newer.

```bash
npm test
```

The tests verify timing math, contiguous section boundaries, time-signature behavior, cadence budgets, density scaling, lyric classification, syllable estimation, and invalid-project rejection.

## Engineering rules

1. Source inputs are authoritative. Computed fields are regenerated, never trusted from imported JSON.
2. Every timeline boundary is derived from the previous boundary, preventing gaps and overlaps.
3. Validation messages expose the exact target and delta.
4. Audio remains on the user's machine. Loading audio creates only a temporary browser object URL.
5. This is a cadence planning tool, not a claim of perfect phonetic analysis. English syllable counts are deterministic estimates and can be extended with a pronunciation dictionary later.

## Architecture

```text
index.html                  Semantic application shell
styles.css                 Responsive visual system
src/app.js                 UI state, persistence, import/export, transport
src/cadence-engine.js      Pure timing and validation functions
test/cadence-engine.test.js Node built-in test suite
.github/workflows/test.yml Continuous verification
```

## Next production milestones

- tap-tempo and beat-grid calibration against loaded audio;
- optional waveform generation in a Web Worker;
- pronunciation overrides per project;
- section add, remove, duplicate, and drag-reorder controls;
- MusicXML/MIDI marker export;
- offline installable PWA packaging.

## License

MIT
