export const CADENCE_PROFILES = Object.freeze({
  atmospheric_sparse: Object.freeze({
    label: "Atmospheric sparse",
    minSyllablesPerBar: 1,
    maxSyllablesPerBar: 3,
    description: "Ad-libs, scene setting, pauses, and long tails."
  }),
  lazy_spaced: Object.freeze({
    label: "Lazy spaced",
    minSyllablesPerBar: 3,
    maxSyllablesPerBar: 6,
    description: "Relaxed pocket with deliberate breathing room."
  }),
  bouncy_mid: Object.freeze({
    label: "Bouncy mid",
    minSyllablesPerBar: 6,
    maxSyllablesPerBar: 10,
    description: "Clear bounce with room for emphasis and rests."
  }),
  staccato_rapid: Object.freeze({
    label: "Staccato rapid",
    minSyllablesPerBar: 9,
    maxSyllablesPerBar: 14,
    description: "Tight consonants and fast phrase turnover."
  }),
  double_time: Object.freeze({
    label: "Double time",
    minSyllablesPerBar: 12,
    maxSyllablesPerBar: 18,
    description: "Dense subdivisions with minimal empty space."
  })
});

const SPECIAL_SYLLABLES = Object.freeze({
  "ai": 2,
  "bpm": 3,
  "cdcs": 4,
  "every": 2,
  "family": 3,
  "fire": 1,
  "hour": 1,
  "our": 1,
  "people": 2,
  "queue": 1,
  "rhythm": 2,
  "silent": 2,
  "studio": 3,
  "yeah": 1
});

function assertFiniteNumber(value, label) {
  if (!Number.isFinite(value)) {
    throw new TypeError(`${label} must be a finite number.`);
  }
}

export function secondsPerBar(bpm, beatsPerBar = 4, beatUnit = 4) {
  assertFiniteNumber(bpm, "bpm");
  assertFiniteNumber(beatsPerBar, "beatsPerBar");
  assertFiniteNumber(beatUnit, "beatUnit");

  if (bpm <= 0 || beatsPerBar <= 0 || beatUnit <= 0) {
    throw new RangeError("Tempo and time-signature values must be greater than zero.");
  }

  return (60 / bpm) * beatsPerBar * (4 / beatUnit);
}

export function formatDuration(totalSeconds) {
  assertFiniteNumber(totalSeconds, "totalSeconds");
  const safeSeconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function countWordSyllables(rawWord) {
  const word = String(rawWord)
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z]/g, "");

  if (!word) return 0;
  if (SPECIAL_SYLLABLES[word] !== undefined) return SPECIAL_SYLLABLES[word];
  if (word.length <= 3) return 1;

  let count = (word.match(/[aeiouy]+/g) || []).length;

  if (word.endsWith("e") && !word.endsWith("le") && count > 1) {
    count -= 1;
  }

  if (word.endsWith("es") && !/(ses|xes|zes|ches|shes)$/.test(word) && count > 1) {
    count -= 1;
  }

  if (word.endsWith("ed") && !/(ted|ded)$/.test(word) && count > 1) {
    count -= 1;
  }

  return Math.max(1, count);
}

export function estimateSyllables(text) {
  const tokens = String(text).match(/[A-Za-z]+(?:[’'][A-Za-z]+)*/g) || [];
  return tokens.reduce((total, token) => total + countWordSyllables(token), 0);
}

export function computeBudget(section, profiles = CADENCE_PROFILES) {
  const profile = profiles[section.cadence];
  if (!profile) {
    throw new RangeError(`Unknown cadence profile: ${section.cadence}`);
  }

  const densityScale = Number.isFinite(section.densityScale) ? section.densityScale : 1;
  if (densityScale <= 0) {
    throw new RangeError("densityScale must be greater than zero.");
  }

  const min = Math.max(0, Math.round(section.bars * profile.minSyllablesPerBar * densityScale));
  const max = Math.max(min, Math.round(section.bars * profile.maxSyllablesPerBar * densityScale));
  return { min, max, densityScale, profile };
}

export function validateSection(section, profiles = CADENCE_PROFILES) {
  const estimatedSyllables = estimateSyllables(section.lyrics || "");
  const budget = computeBudget(section, profiles);

  let status = "pass";
  let delta = 0;
  let message = "Lyric density is inside the configured cadence window.";

  if (estimatedSyllables < budget.min) {
    status = "underfilled";
    delta = budget.min - estimatedSyllables;
    message = `Add about ${delta} syllable${delta === 1 ? "" : "s"}, lower the density target, or keep the space intentionally.`;
  } else if (estimatedSyllables > budget.max) {
    status = "overflow";
    delta = estimatedSyllables - budget.max;
    message = `Remove about ${delta} syllable${delta === 1 ? "" : "s"}, raise the density target, or add bars.`;
  }

  const midpoint = (budget.min + budget.max) / 2;
  const fillRatio = midpoint === 0 ? 0 : estimatedSyllables / midpoint;

  return {
    sectionId: section.id,
    sectionName: section.name,
    estimatedSyllables,
    budgetMin: budget.min,
    budgetMax: budget.max,
    status,
    delta,
    fillRatio,
    message
  };
}

export function buildTimeline(project, profiles = CADENCE_PROFILES) {
  const validation = validateProject(project, profiles);
  if (!validation.valid) {
    throw new TypeError(validation.errors.join(" "));
  }

  const barSeconds = secondsPerBar(
    project.bpm,
    project.timeSignature.beatsPerBar,
    project.timeSignature.beatUnit
  );

  let elapsed = 0;
  const timeline = project.sections.map((section) => {
    const startSeconds = elapsed;
    const endSeconds = startSeconds + section.bars * barSeconds;
    elapsed = endSeconds;
    const budget = computeBudget(section, profiles);

    return {
      ...section,
      startSeconds,
      endSeconds,
      durationSeconds: endSeconds - startSeconds,
      budgetMin: budget.min,
      budgetMax: budget.max
    };
  });

  return {
    timeline,
    totalBars: project.sections.reduce((sum, section) => sum + section.bars, 0),
    durationSeconds: elapsed,
    barSeconds,
    validation: project.sections.map((section) => validateSection(section, profiles))
  };
}

export function validateProject(project, profiles = CADENCE_PROFILES) {
  const errors = [];

  if (!project || typeof project !== "object" || Array.isArray(project)) {
    return { valid: false, errors: ["Project must be an object."] };
  }

  if (typeof project.title !== "string" || !project.title.trim()) {
    errors.push("Project title is required.");
  }

  if (!Number.isFinite(project.bpm) || project.bpm < 40 || project.bpm > 260) {
    errors.push("BPM must be between 40 and 260.");
  }

  const signature = project.timeSignature;
  if (!signature || !Number.isInteger(signature.beatsPerBar) || signature.beatsPerBar < 1 || signature.beatsPerBar > 12) {
    errors.push("beatsPerBar must be an integer from 1 to 12.");
  }
  if (!signature || ![1, 2, 4, 8, 16].includes(signature.beatUnit)) {
    errors.push("beatUnit must be one of 1, 2, 4, 8, or 16.");
  }

  if (!Array.isArray(project.sections) || project.sections.length === 0) {
    errors.push("At least one section is required.");
  } else {
    const ids = new Set();
    project.sections.forEach((section, index) => {
      const prefix = `Section ${index + 1}`;
      if (!section || typeof section !== "object") {
        errors.push(`${prefix} must be an object.`);
        return;
      }
      if (typeof section.id !== "string" || !section.id.trim()) {
        errors.push(`${prefix} requires an id.`);
      } else if (ids.has(section.id)) {
        errors.push(`${prefix} has duplicate id '${section.id}'.`);
      } else {
        ids.add(section.id);
      }
      if (typeof section.name !== "string" || !section.name.trim()) {
        errors.push(`${prefix} requires a name.`);
      }
      if (!Number.isInteger(section.bars) || section.bars < 1 || section.bars > 128) {
        errors.push(`${prefix} bars must be an integer from 1 to 128.`);
      }
      if (!profiles[section.cadence]) {
        errors.push(`${prefix} uses unknown cadence '${section.cadence}'.`);
      }
      if (section.densityScale !== undefined && (!Number.isFinite(section.densityScale) || section.densityScale < 0.25 || section.densityScale > 2)) {
        errors.push(`${prefix} densityScale must be between 0.25 and 2.`);
      }
      if (section.lyrics !== undefined && typeof section.lyrics !== "string") {
        errors.push(`${prefix} lyrics must be a string.`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}

export function cloneProject(project) {
  return JSON.parse(JSON.stringify(project));
}
