import {
  CADENCE_PROFILES,
  buildTimeline,
  cloneProject,
  formatDuration,
  validateProject
} from "./cadence-engine.js";

const STORAGE_KEY = "cdcs.project.v1";

const DEFAULT_PROJECT = Object.freeze({
  version: 1,
  title: "Percs on My Line",
  bpm: 145.2,
  key: "A Minor",
  timeSignature: { beatsPerBar: 4, beatUnit: 4 },
  sections: [
    { id: "intro", name: "Intro", bars: 4, cadence: "atmospheric_sparse", densityScale: 1, lyrics: "Wind through the night, distant sirens.\nYeah, talk it. I live it." },
    { id: "hook-1", name: "Hook 1", bars: 8, cadence: "bouncy_mid", densityScale: 1, lyrics: "Percs on my line, feeling divine\nPressure on time but the rhythm still mine\nBack through the smoke, put the truth in the light\nBuilt from the bottom, now the cadence is tight" },
    { id: "verse-1", name: "Verse 1", bars: 16, cadence: "staccato_rapid", densityScale: 1, lyrics: "Gucci on my feet, soul in the dirt\nLong nights taught me what the hard road worth\nCity keep moving while I sharpen every word\nNo fake numbers in the engine, every measure gets heard" },
    { id: "hook-2", name: "Hook 2", bars: 8, cadence: "bouncy_mid", densityScale: 1, lyrics: "Percs on my line, feeling divine\nPressure on time but the rhythm still mine" },
    { id: "verse-2", name: "Verse 2", bars: 16, cadence: "staccato_rapid", densityScale: 1, lyrics: "Second round pressure, still steady on beat\nCount every bar and put the proof on the screen" },
    { id: "bridge", name: "Bridge", bars: 8, cadence: "lazy_spaced", densityScale: 0.8, lyrics: "Breathe. Let the room turn slow.\nLeave enough silence for the feeling to grow." },
    { id: "outro", name: "Final Hook / Outro", bars: 12, cadence: "bouncy_mid", densityScale: 0.9, lyrics: "Run it one more time, let the last note glow\nEvery bar accounted for before we let it go" }
  ]
});

const byId = (id) => document.getElementById(id);
const elements = {
  title: byId("project-heading"),
  bpm: byId("bpm-input"),
  key: byId("key-input"),
  totalBars: byId("total-bars"),
  duration: byId("project-duration"),
  rulerEnd: byId("ruler-end"),
  timeline: byId("timeline"),
  playhead: byId("playhead"),
  validationSummary: byId("validation-summary"),
  validationLog: byId("validation-log"),
  inspectorHeading: byId("inspector-heading"),
  sectionStatus: byId("section-status"),
  sectionName: byId("section-name"),
  sectionBars: byId("section-bars"),
  sectionCadence: byId("section-cadence"),
  densityScale: byId("density-scale"),
  densityOutput: byId("density-output"),
  sectionLyrics: byId("section-lyrics"),
  estimated: byId("estimated-syllables"),
  budget: byId("target-budget"),
  sectionTime: byId("section-time"),
  exportButton: byId("export-button"),
  importFile: byId("import-file"),
  resetButton: byId("reset-button"),
  notice: byId("notice"),
  audioFile: byId("audio-file"),
  audio: byId("audio"),
  playButton: byId("play-button"),
  stopButton: byId("stop-button"),
  transportTime: byId("transport-time"),
  seek: byId("seek")
};

let project = loadProject();
let selectedSectionId = project.sections[0].id;
let renderedModel = null;
let audioObjectUrl = null;

function loadProject() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneProject(DEFAULT_PROJECT);
    const parsed = JSON.parse(raw);
    return validateProject(parsed).valid ? parsed : cloneProject(DEFAULT_PROJECT);
  } catch {
    return cloneProject(DEFAULT_PROJECT);
  }
}

function saveProject() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
}

function announce(message, isError = false) {
  elements.notice.textContent = message;
  elements.notice.dataset.kind = isError ? "error" : "success";
}

function selectedSection() {
  return project.sections.find((section) => section.id === selectedSectionId) || project.sections[0];
}

function render() {
  const validation = validateProject(project);
  if (!validation.valid) {
    announce(validation.errors.join(" "), true);
    return;
  }

  renderedModel = buildTimeline(project);
  elements.title.textContent = project.title;
  elements.bpm.value = String(project.bpm);
  elements.key.value = project.key;
  elements.totalBars.textContent = String(renderedModel.totalBars);
  elements.duration.textContent = formatDuration(renderedModel.durationSeconds);
  elements.rulerEnd.textContent = formatDuration(renderedModel.durationSeconds);

  renderTimeline();
  renderValidation();
  renderInspector();
  updateTransport();
  saveProject();
}

function renderTimeline() {
  elements.timeline.replaceChildren();
  for (const section of renderedModel.timeline) {
    const validation = renderedModel.validation.find((item) => item.sectionId === section.id);
    const button = document.createElement("button");
    button.type = "button";
    button.className = `timeline-block ${validation.status}${section.id === selectedSectionId ? " selected" : ""}`;
    button.style.flexGrow = String(section.bars);
    button.style.flexBasis = "0";
    button.dataset.sectionId = section.id;
    button.setAttribute("role", "listitem");
    button.setAttribute("aria-label", `${section.name}, ${section.bars} bars, ${validation.status}`);
    button.innerHTML = `
      <span class="block-name">${escapeHtml(section.name)}</span>
      <span class="block-meta">${section.bars} bars</span>
      <span class="block-meta">${formatDuration(section.startSeconds)}–${formatDuration(section.endSeconds)}</span>
      <span class="block-budget">${section.budgetMin}–${section.budgetMax} syl</span>
    `;
    button.addEventListener("click", () => {
      selectedSectionId = section.id;
      render();
    });
    elements.timeline.append(button);
  }
}

function renderValidation() {
  const counts = { pass: 0, underfilled: 0, overflow: 0 };
  renderedModel.validation.forEach((item) => counts[item.status] += 1);
  elements.validationSummary.innerHTML = Object.entries(counts)
    .map(([status, count]) => `<span class="status-badge ${status}">${count} ${status}</span>`)
    .join("");

  elements.validationLog.replaceChildren();
  for (const result of renderedModel.validation) {
    const section = project.sections.find((item) => item.id === result.sectionId);
    const card = document.createElement("article");
    card.className = "validation-card";
    card.innerHTML = `
      <div class="validation-card-heading">
        <strong>${escapeHtml(result.sectionName)}</strong>
        <span class="status-badge ${result.status}">${result.status}</span>
      </div>
      <p>${result.estimatedSyllables} syllables against a ${result.budgetMin}–${result.budgetMax} target.</p>
      <p>${escapeHtml(result.message)}</p>
      <pre>${escapeHtml(section.lyrics || "No lyrics yet.")}</pre>
    `;
    elements.validationLog.append(card);
  }
}

function renderInspector() {
  const section = selectedSection();
  const timelineSection = renderedModel.timeline.find((item) => item.id === section.id);
  const validation = renderedModel.validation.find((item) => item.sectionId === section.id);

  elements.inspectorHeading.textContent = section.name;
  elements.sectionStatus.textContent = validation.status;
  elements.sectionStatus.className = `status-badge ${validation.status}`;
  elements.sectionName.value = section.name;
  elements.sectionBars.value = String(section.bars);
  elements.sectionCadence.value = section.cadence;
  elements.densityScale.value = String(section.densityScale ?? 1);
  elements.densityOutput.value = `${Number(section.densityScale ?? 1).toFixed(2)}×`;
  elements.sectionLyrics.value = section.lyrics || "";
  elements.estimated.textContent = `${validation.estimatedSyllables} syllables`;
  elements.budget.textContent = `${validation.budgetMin}–${validation.budgetMax} syllables`;
  elements.sectionTime.textContent = `${formatDuration(timelineSection.startSeconds)}–${formatDuration(timelineSection.endSeconds)}`;
}

function updateSelected(patch) {
  project.sections = project.sections.map((section) => section.id === selectedSectionId ? { ...section, ...patch } : section);
  render();
}

function populateCadenceOptions() {
  for (const [value, profile] of Object.entries(CADENCE_PROFILES)) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = `${profile.label} (${profile.minSyllablesPerBar}–${profile.maxSyllablesPerBar}/bar)`;
    elements.sectionCadence.append(option);
  }
}

function exportProject() {
  const payload = {
    ...project,
    computed: {
      totalBars: renderedModel.totalBars,
      durationSeconds: renderedModel.durationSeconds,
      barSeconds: renderedModel.barSeconds,
      timeline: renderedModel.timeline,
      validation: renderedModel.validation
    }
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${slugify(project.title)}-cdcs.json`;
  anchor.click();
  URL.revokeObjectURL(url);
  announce("Project exported with computed timeline and validation evidence.");
}

async function importProject(file) {
  try {
    const parsed = JSON.parse(await file.text());
    delete parsed.computed;
    const validation = validateProject(parsed);
    if (!validation.valid) throw new Error(validation.errors.join(" "));
    project = parsed;
    selectedSectionId = project.sections[0].id;
    render();
    announce("Project imported and independently recalculated.");
  } catch (error) {
    announce(`Import rejected: ${error.message}`, true);
  } finally {
    elements.importFile.value = "";
  }
}

function loadAudio(file) {
  if (audioObjectUrl) URL.revokeObjectURL(audioObjectUrl);
  audioObjectUrl = URL.createObjectURL(file);
  elements.audio.src = audioObjectUrl;
  elements.audio.load();
  elements.playButton.disabled = false;
  elements.stopButton.disabled = false;
  elements.seek.disabled = false;
  announce(`Loaded ${file.name} locally. The file was not uploaded.`);
}

function updateTransport() {
  const duration = Number.isFinite(elements.audio.duration) ? elements.audio.duration : 0;
  const current = Number.isFinite(elements.audio.currentTime) ? elements.audio.currentTime : 0;
  elements.transportTime.textContent = `${formatDuration(current)} / ${formatDuration(duration)}`;
  elements.seek.value = duration > 0 ? String(Math.round((current / duration) * 1000)) : "0";
  const ratio = duration > 0 ? current / duration : 0;
  elements.playhead.style.left = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  elements.playButton.textContent = elements.audio.paused ? "▶" : "❚❚";
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"
  })[character]);
}

function slugify(value) {
  return String(value).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
}

populateCadenceOptions();

elements.bpm.addEventListener("change", () => {
  const bpm = Number(elements.bpm.value);
  if (bpm >= 40 && bpm <= 260) {
    project.bpm = bpm;
    render();
  } else {
    announce("BPM must be between 40 and 260.", true);
    elements.bpm.value = String(project.bpm);
  }
});
elements.key.addEventListener("change", () => { project.key = elements.key.value.trim() || "Unknown"; render(); });
elements.sectionName.addEventListener("change", () => updateSelected({ name: elements.sectionName.value.trim() || "Untitled section" }));
elements.sectionBars.addEventListener("change", () => updateSelected({ bars: Math.max(1, Math.min(128, Number.parseInt(elements.sectionBars.value, 10) || 1)) }));
elements.sectionCadence.addEventListener("change", () => updateSelected({ cadence: elements.sectionCadence.value }));
elements.densityScale.addEventListener("input", () => {
  elements.densityOutput.value = `${Number(elements.densityScale.value).toFixed(2)}×`;
});
elements.densityScale.addEventListener("change", () => updateSelected({ densityScale: Number(elements.densityScale.value) }));
elements.sectionLyrics.addEventListener("input", () => updateSelected({ lyrics: elements.sectionLyrics.value }));
elements.exportButton.addEventListener("click", exportProject);
elements.importFile.addEventListener("change", () => elements.importFile.files[0] && importProject(elements.importFile.files[0]));
elements.resetButton.addEventListener("click", () => {
  project = cloneProject(DEFAULT_PROJECT);
  selectedSectionId = project.sections[0].id;
  render();
  announce("Project reset to the verified example.");
});
elements.audioFile.addEventListener("change", () => elements.audioFile.files[0] && loadAudio(elements.audioFile.files[0]));
elements.playButton.addEventListener("click", () => elements.audio.paused ? elements.audio.play() : elements.audio.pause());
elements.stopButton.addEventListener("click", () => { elements.audio.pause(); elements.audio.currentTime = 0; updateTransport(); });
elements.seek.addEventListener("input", () => {
  if (Number.isFinite(elements.audio.duration)) elements.audio.currentTime = (Number(elements.seek.value) / 1000) * elements.audio.duration;
});
["loadedmetadata", "timeupdate", "play", "pause", "ended"].forEach((eventName) => elements.audio.addEventListener(eventName, updateTransport));
window.addEventListener("beforeunload", () => audioObjectUrl && URL.revokeObjectURL(audioObjectUrl));

render();
