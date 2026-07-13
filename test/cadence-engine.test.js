import test from "node:test";
import assert from "node:assert/strict";
import {
  buildTimeline,
  computeBudget,
  estimateSyllables,
  secondsPerBar,
  validateProject,
  validateSection
} from "../src/cadence-engine.js";

const project = {
  version: 1,
  title: "Test Track",
  bpm: 120,
  key: "C Minor",
  timeSignature: { beatsPerBar: 4, beatUnit: 4 },
  sections: [
    { id: "intro", name: "Intro", bars: 4, cadence: "lazy_spaced", densityScale: 1, lyrics: "Slow glow in the room" },
    { id: "verse", name: "Verse", bars: 8, cadence: "bouncy_mid", densityScale: 1, lyrics: "Every line lands clean and every count stays true" }
  ]
};

test("calculates seconds per bar for common time", () => {
  assert.equal(secondsPerBar(120, 4, 4), 2);
});

test("respects compound time signatures", () => {
  assert.equal(secondsPerBar(120, 6, 8), 1.5);
});

test("builds a contiguous timeline from bar counts", () => {
  const result = buildTimeline(project);
  assert.equal(result.totalBars, 12);
  assert.equal(result.durationSeconds, 24);
  assert.equal(result.timeline[0].startSeconds, 0);
  assert.equal(result.timeline[0].endSeconds, result.timeline[1].startSeconds);
  assert.equal(result.timeline[1].endSeconds, result.durationSeconds);
});

test("computes budgets from bars and cadence profile", () => {
  const budget = computeBudget(project.sections[1]);
  assert.deepEqual({ min: budget.min, max: budget.max }, { min: 48, max: 80 });
});

test("classifies text below the minimum as underfilled", () => {
  const result = validateSection(project.sections[1]);
  assert.equal(result.status, "underfilled");
  assert.ok(result.delta > 0);
});

test("density scale changes the target window deterministically", () => {
  const normal = computeBudget(project.sections[1]);
  const half = computeBudget({ ...project.sections[1], densityScale: 0.5 });
  assert.equal(half.min, Math.round(normal.min * 0.5));
  assert.equal(half.max, Math.round(normal.max * 0.5));
});

test("rejects malformed or contradictory projects", () => {
  const invalid = {
    ...project,
    bpm: 0,
    sections: [{ id: "same", name: "A", bars: 0, cadence: "invented", lyrics: 99 }]
  };
  const result = validateProject(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.errors.length >= 4);
});

test("syllable estimator returns stable nonzero counts", () => {
  assert.equal(estimateSyllables("Silent studio rhythm"), 7);
  assert.equal(estimateSyllables(""), 0);
});
