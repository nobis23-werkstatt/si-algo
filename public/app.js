import { GoogleGenAI } from "@google/genai";
import {
  generateBrowserAcidMidiBytes,
  generateBrowserEscapePuzzle,
  recordBrowserBrierVote,
  runBrowserArena,
  runBrowserTheater,
  runBrowserTriadRound,
} from "./browser-engines.js";
import { setupTouchControls } from "./touch-controls.js";
import { MotivationTrackSync } from "./track-sync.js";
import { PlayableWorld3D, ProceduralAudioEngine } from "./world3d.js";

const KEY_MAP = {
  KeyW: "key_w", KeyA: "key_a", KeyS: "key_s", KeyD: "key_d",
  ArrowUp: "arrow_up", ArrowDown: "arrow_down", ArrowLeft: "arrow_left", ArrowRight: "arrow_right",
  KeyE: "key_e", Space: "space",
};
const USD_PER_SEC = 0.101;
const IDLE_CUTOFF_MS = 6000;
const $ = (id) => document.getElementById(id);

const els = {
  viewportWrap: $("viewportWrap"), video: $("genieVideo"), canvas: $("holoCanvas"),
  hudState: $("hudState"), hudTimer: $("hudTimer"), firewallBadge: $("firewallBadge"),
  budgetModeSelect: $("budgetModeSelect"), dailyBudgetText: $("dailyBudgetText"),
  chkIdleCutoff: $("chkIdleCutoff"), chkUse3DRef: $("chkUse3DRef"),
  chkFoleyAudio: $("chkFoleyAudio"), chkLiveClis: $("chkLiveClis"),
  btnTouchToggle: $("btnTouchToggle"), btnRecordToggle: $("btnRecordToggle"), btnSnapshot: $("btnSnapshot"),
  btnTriadSpark: $("btnTriadSpark"), btnStartGenie: $("btnStartGenie"), btnStopGenie: $("btnStopGenie"),
  btnResetCam: $("btnResetCam"), archetypeSelect: $("archetypeSelect"), transportSelect: $("transportSelect"),
  seedInput: $("seedInput"), btnSteerNow: $("btnSteerNow"), refImageInput: $("refImageInput"),
  // Jockey & 180-BPM Track Sync
  btnSyncTrack: $("btnSyncTrack"), motivationAudio: $("motivationAudio"), trackCueLabel: $("trackCueLabel"),
  rngBpm: $("rngBpm"), rngCutoff: $("rngCutoff"), rngEnergy: $("rngEnergy"),
  lblBpm: $("lblBpm"), lblCutoff: $("lblCutoff"), lblEnergy: $("lblEnergy"),
  btnAcidToggle: $("btnAcidToggle"), midiScaleSelect: $("midiScaleSelect"),
  btnExportMidi: $("btnExportMidi"), btnExportStemMidi: $("btnExportStemMidi"), btnTriggerDrop: $("btnTriggerDrop"),
  // Escape, Arena, Theater
  escapeSeedInput: $("escapeSeedInput"), escapeTierSelect: $("escapeTierSelect"),
  btnNewEscape: $("btnNewEscape"), btnExitEscape: $("btnExitEscape"), escapeOracleStatus: $("escapeOracleStatus"),
  arenaConceptInput: $("arenaConceptInput"), btnRunArena: $("btnRunArena"), btnExportArena: $("btnExportArena"), arenaGrid: $("arenaGrid"),
  theaterTopicInput: $("theaterTopicInput"), btnRunTheater: $("btnRunTheater"), btnAutoTrailer: $("btnAutoTrailer"),
  // Coins & Feed
  coinBalance: $("coinBalance"), coinCodeInput: $("coinCodeInput"), btnRedeemCoin: $("btnRedeemCoin"),
  triadFeed: $("triadFeed"), downloadsBox: $("downloadsBox"), gateBadge: $("gateBadge"),
  metricIntegral: $("metricIntegral"), metricOverlap: $("metricOverlap"),
  btnVoteKeep: $("btnVoteKeep"), btnVoteDrift: $("btnVoteDrift"),
  keyForm: $("keyForm"), apiKeyInput: $("apiKeyInput"), keyLabel: $("keyLabel"), dotKey: $("dot-key"),
};

const audio = new ProceduralAudioEngine();
const world3d = new PlayableWorld3D(els.canvas, audio);
const heldKeys = new Set();

let activeSession = null, activeInteractionId = null, sessionStartMs = 0, activeBurstCapSec = 12;
let lastActivityMs = Date.now(), billingTimer = null, lastTriadRound = null, lastArenaResult = null;
let uploadedRefImage = null, mediaRecorder = null, recordedChunks = [], isStaticPagesMode = false;

// --- Touch Controls (Mobile / Android APK) ---
const touchCtrl = setupTouchControls({
  viewportEl: els.viewportWrap,
  heldKeys,
  world3d,
  onDrop: () => els.btnTriggerDrop.click(),
  onActivity: () => { lastActivityMs = Date.now(); },
});
els.btnTouchToggle.addEventListener("click", () => touchCtrl.setVisible(!touchCtrl.isVisible()));

// --- 180-BPM B-Minor Motivation Track FFT Sync ---
const trackSync = new MotivationTrackSync(els.motivationAudio, {
  onCueChange(cue) {
    els.trackCueLabel.textContent = cue.label;
    world3d.applyBlueprint(cue.blueprint, `🎧 ${cue.label}`);
    if (cue.drop) world3d.triggerBeat(1.0, true);
    appendFeed({ agent: "grok", mode: "180bpm-sync", latencyMs: 0, text: cue.label });
  },
  onFrameSpectrum(frame) {
    world3d.setSpectrumFrame(frame);
    const mm = String(Math.floor(frame.curSec / 60)).padStart(2, "0");
    const ss = String(Math.floor(frame.curSec % 60)).padStart(2, "0");
    if (!activeSession) els.hudTimer.textContent = `SYNC ${mm}:${ss} / 05:04 · 180 BPM B-MIN`;
  },
});

els.btnSyncTrack.addEventListener("click", async () => {
  const playing = await trackSync.togglePlay();
  world3d.autoFly = playing;
  els.btnSyncTrack.textContent = playing ? "⏸ PAUSE 180-BPM SYNC" : "▶ SYNC 180-BPM TRACK + AUTO-FLY!";
  els.hudState.textContent = playing ? "🔥 180-BPM B-MINOR LIVE FFT SYNC" : "MODE: 0€ PLAYABLE 3D TWIN";
});
els.motivationAudio.addEventListener("ended", () => {
  world3d.autoFly = false;
  world3d.spectrumBars = null;
  els.btnSyncTrack.textContent = "▶ SYNC 180-BPM TRACK + AUTO-FLY!";
});

// --- 60 FPS Render Loop ---
let prevTime = performance.now();
function frameLoop(now) {
  const dt = Math.min(0.05, (now - prevTime) / 1000);
  prevTime = now;
  if (els.video.classList.contains("hidden")) {
    world3d.update(dt, heldKeys);
    world3d.render(now / 1000);
  }
  requestAnimationFrame(frameLoop);
}
requestAnimationFrame(frameLoop);

// --- Tabs & Archetype Selector ---
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".mode-pane").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.pane)?.classList.add("active");
  });
});

els.archetypeSelect.addEventListener("change", () => {
  world3d.applyBlueprint({ archetype: els.archetypeSelect.value }, `Archetype: ${els.archetypeSelect.value}`);
});

function appendFeed({ agent, mode, text, latencyMs }) {
  const div = document.createElement("div");
  div.className = `msg ${agent}`;
  div.innerHTML = `<div class="msg-meta"><b>${agent}</b><span>${mode || "live"}${latencyMs != null ? ` · ${latencyMs}ms` : ""}</span></div><div></div>`;
  div.lastElementChild.textContent = text;
  els.triadFeed.prepend(div);
  while (els.triadFeed.children.length > 40) els.triadFeed.lastElementChild.remove();
}

function offerDownload(blob, filename, label) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.className = "dl-link";
  a.textContent = `⬇ ${label}`;
  els.downloadsBox.prepend(a);
}

// --- Budget & World-Coins ---
function renderBudgetStatus(budget) {
  if (!budget) return;
  els.dailyBudgetText.textContent = `Heute: ${budget.usedSecToday}s / ${budget.dailyCapSec}s (~$${budget.estimatedSpentUsdToday.toFixed(2)})`;
  const modeVal = els.budgetModeSelect.value;
  if (modeVal === "coin") {
    els.firewallBadge.className = "pill firewall-armed";
    els.firewallBadge.textContent = "🪙 Prepaid Coin Armed (12s)";
  } else if (budget.zeroCostLock) {
    els.firewallBadge.className = "pill firewall-locked";
    els.firewallBadge.textContent = "🔒 0€ Lock Active";
  } else {
    els.firewallBadge.className = "pill firewall-armed";
    els.firewallBadge.textContent = `⚡ Burst (${budget.maxBurstSec}s Cap)`;
  }
}

els.budgetModeSelect.addEventListener("change", async () => {
  const val = els.budgetModeSelect.value;
  if (isStaticPagesMode) {
    els.budgetModeSelect.value = "lock";
    return appendFeed({ agent: "genie", mode: "github-pages", text: "Public GitHub Pages runs 100% free in 3D mode." });
  }
  if (val === "coin") {
    renderBudgetStatus({ zeroCostLock: true, usedSecToday: 0, dailyCapSec: 48, estimatedSpentUsdToday: 0 });
    return appendFeed({ agent: "genie", mode: "world-coins", text: "Prepaid Coin Modus aktiv: Nächster Genie-4-Start bucht atomar 1 World-Coin (12s Take)." });
  }
  const payload = val === "lock" ? { zeroCostLock: true } : { zeroCostLock: false, maxBurstSec: Number(val) };
  const resp = await fetch("./api/budget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }).then((r) => r.json());
  renderBudgetStatus(resp.budget);
});

els.btnRedeemCoin.addEventListener("click", async () => {
  const code = els.coinCodeInput.value.trim();
  if (!code) return;
  if (isStaticPagesMode) {
    if (code.toUpperCase() === "N23-GOLD-180BPM") {
      els.coinBalance.textContent = String(Number(els.coinBalance.textContent || 0) + 3);
      els.coinCodeInput.value = "";
      return appendFeed({ agent: "genie", mode: "demo-wallet", text: "+3 Demo World-Coins gutgeschrieben!" });
    }
    return appendFeed({ agent: "genie", mode: "wallet", text: "Live Gumroad-Einlösung erfordert das lokale/Serverless Backend." });
  }
  const res = await fetch("./api/coins/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
  const data = await res.json();
  if (!res.ok) return appendFeed({ agent: "genie", mode: "wallet-err", text: data.error });
  els.coinBalance.textContent = String(data.wallet.balance);
  els.coinCodeInput.value = "";
  appendFeed({ agent: "genie", mode: "world-coins", text: `+${data.addedCoins} World-Coins eingelöst! Kontostand: ${data.wallet.balance} Coins.` });
});

// --- MediaRecorder & Snapshot ---
function startRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") return;
  recordedChunks = [];
  const stream = !els.video.classList.contains("hidden") && els.video.srcObject ? els.video.srcObject : els.canvas.captureStream(24);
  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus") ? "video/webm;codecs=vp9,opus" : "video/webm";
  mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
  mediaRecorder.ondataavailable = (e) => { if (e.data?.size > 0) recordedChunks.push(e.data); };
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    offerDownload(blob, `5d-triad-${Date.now()}.webm`, `Video (${(blob.size / 1024).toFixed(0)} KB .webm)`);
    els.btnRecordToggle.textContent = "⏺ Record (.webm)";
  };
  mediaRecorder.start(250);
  els.btnRecordToggle.textContent = "⏹ Stop Rec";
}
function stopRecording() { if (mediaRecorder?.state === "recording") mediaRecorder.stop(); }
els.btnRecordToggle.addEventListener("click", () => mediaRecorder?.state === "recording" ? stopRecording() : startRecording());
els.btnSnapshot.addEventListener("click", () => {
  const snap = document.createElement("canvas");
  snap.width = 1280; snap.height = 720;
  snap.getContext("2d").drawImage(!els.video.classList.contains("hidden") ? els.video : els.canvas, 0, 0, 1280, 720);
  snap.toBlob((b) => b && offerDownload(b, `keyframe-${Date.now()}.png`, "Keyframe (.png)"), "image/png");
});

// --- Status & SSE ---
let sse = null;
function connectLocalSse() {
  sse = new EventSource("./api/events");
  sse.onmessage = (e) => {
    try {
      const evt = JSON.parse(e.data);
      if (evt.type === "agent.message") appendFeed(evt);
      else if (evt.type === "triad.complete") {
        els.metricIntegral.textContent = evt.gate.sovereign_integral.toFixed(3);
        els.metricOverlap.textContent = `ovl:${evt.gate.agy_grok_overlap.toFixed(2)}`;
        els.gateBadge.textContent = `${evt.gate.decision} (${evt.totalLatencyMs}ms)`;
        if (evt.worldBlueprint) world3d.applyBlueprint(evt.worldBlueprint, evt.steerPrompt);
      } else if (evt.type === "brier.updated") {
        const c = evt.calibration;
        els.metricOverlap.textContent = `${c.brier_delta >= 0 ? "+" : ""}${c.brier_delta.toFixed(2)} / d:${c.goodhart_drift.toFixed(2)}`;
      } else if (evt.type === "budget.updated") renderBudgetStatus(evt.budget);
      else if (evt.type === "wallet.updated") els.coinBalance.textContent = String(evt.wallet.balance);
      else if (evt.type === "jockey.pulse") {
        els.rngBpm.value = evt.bpm; els.lblBpm.textContent = evt.bpm;
        audio.setJockeyParams(evt); world3d.triggerBeat(evt.energy, evt.drop);
      }
    } catch {}
  };
}

async function refreshStatus() {
  try {
    const resp = await fetch("./api/status");
    if (!resp.ok) throw new Error("Static");
    const st = await resp.json();
    if (!sse) connectLocalSse();
    (st.agents || []).forEach((a) => { const d = $(`dot-${a.id}`); if (d) d.className = `dot ${a.installed ? "ok" : "warn"}`; });
    if (st.genieKey?.configured) {
      els.dotKey.className = "dot ok";
      els.keyLabel.textContent = st.genieKey.source === "gcloud-cli" ? `gcloud: ${st.genieKey.projectId}` : `Key: ${st.genieKey.masked}`;
      if (st.genieKey.source === "gcloud-cli") els.keyForm.style.display = "none";
    }
    if (st.wallet) els.coinBalance.textContent = String(st.wallet.balance);
    renderBudgetStatus(st.budget);
  } catch {
    isStaticPagesMode = true;
    ["agy", "grok", "claude", "key"].forEach((id) => { const d = $(`dot-${id}`); if (d) d.className = "dot ok"; });
    els.keyLabel.textContent = "Public 0€ Web Engine";
    els.keyForm.style.display = "none";
  }
}
void refreshStatus();

els.chkFoleyAudio.addEventListener("change", () => { audio.enabled = els.chkFoleyAudio.checked; });
els.btnResetCam.addEventListener("click", () => world3d.resetCamera());
els.keyForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!els.apiKeyInput.value.trim()) return;
  await fetch("./api/config/key", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: els.apiKeyInput.value.trim() }) });
  els.apiKeyInput.value = "";
  await refreshStatus();
});

// --- Triad Morph, Jockey MIDI, Escape, Arena, Theater ---
async function triggerTriadRound({ isInitial = true, customSeed = null } = {}) {
  els.btnTriadSpark.disabled = true;
  try {
    if (isStaticPagesMode) {
      const d = runBrowserTriadRound(customSeed || els.seedInput.value);
      [d.agents.agy, d.agents.grok, d.agents.claude].forEach(appendFeed);
      lastTriadRound = d; world3d.clearEscapePuzzle(); world3d.applyBlueprint(d.worldBlueprint, d.steerPrompt);
      return d;
    }
    const refImg = isInitial ? (uploadedRefImage || (els.chkUse3DRef.checked ? world3d.captureReferenceJpegUnder40KB() : null)) : null;
    const res = await fetch("./api/triad/round", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seed: customSeed || els.seedInput.value, isInitial, useLocalClis: els.chkLiveClis.checked, referenceImage: refImg ? { mime_type: refImg.mime_type, data: refImg.data } : null, transport: els.transportSelect.value }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error);
    lastTriadRound = data; world3d.clearEscapePuzzle(); world3d.applyBlueprint(data.worldBlueprint, data.steerPrompt);
    return data;
  } finally {
    els.btnTriadSpark.disabled = false;
  }
}
els.btnTriadSpark.addEventListener("click", () => void triggerTriadRound({ isInitial: !activeSession }));
els.btnSteerNow.addEventListener("click", async () => {
  const r = await triggerTriadRound({ isInitial: !activeSession });
  if (activeSession) await activeSession.send(r.steerPrompt);
});
document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => { els.seedInput.value = c.dataset.seed; void triggerTriadRound({ isInitial: !activeSession }); }));

const syncSliders = () => {
  els.lblBpm.textContent = els.rngBpm.value; els.lblCutoff.textContent = `${els.rngCutoff.value}%`; els.lblEnergy.textContent = `${els.rngEnergy.value}%`;
  audio.setJockeyParams({ bpm: Number(els.rngBpm.value), cutoff: Number(els.rngCutoff.value) / 100, energy: Number(els.rngEnergy.value) / 100 });
};
[els.rngBpm, els.rngCutoff, els.rngEnergy].forEach((el) => el.addEventListener("input", syncSliders));

els.btnAcidToggle.addEventListener("click", () => {
  const next = !audio.acidRunning;
  audio.toggleAcidPulse(next, () => world3d.triggerBeat(Number(els.rngEnergy.value) / 100, false));
  els.btnAcidToggle.textContent = next ? "⏹ Stop Acid Synth" : "▶ 0€ B-Min Acid Synth";
});

async function exportMidi(multiTrack) {
  const bpm = Number(els.rngBpm.value);
  const scale = els.midiScaleSelect.value;
  if (isStaticPagesMode) {
    const bytes = generateBrowserAcidMidiBytes({ bpm, bars: 4, seed: els.seedInput.value });
    return offerDownload(new Blob([bytes], { type: "audio/midi" }), `n23-${scale}-${bpm}bpm.mid`, `MIDI (${bpm} BPM .mid)`);
  }
  const resp = await fetch("./api/jockey/midi", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ seed: els.seedInput.value, bpm, energy: Number(els.rngEnergy.value) / 100, bars: 4, scale, multiTrack }),
  }).then((r) => r.json());
  if (!resp.ok) return;
  const bin = atob(resp.base64);
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  offerDownload(new Blob([bytes], { type: "audio/midi" }), `n23-${multiTrack ? "4stem" : "303"}-${scale}-${bpm}bpm.mid`, `${multiTrack ? "4-Stem Kit" : "303"} (${bpm} BPM .mid)`);
}
els.btnExportMidi.addEventListener("click", () => void exportMidi(false));
els.btnExportStemMidi.addEventListener("click", () => void exportMidi(true));
els.btnTriggerDrop.addEventListener("click", () => { world3d.triggerBeat(1.0, true); audio.playChime("portal"); void triggerTriadRound({ isInitial: !activeSession }); });

els.btnNewEscape.addEventListener("click", async () => {
  const seed = `${els.escapeSeedInput.value}-${Date.now() % 997}`;
  const tier = Number(els.escapeTierSelect.value) || 4;
  const puzzle = isStaticPagesMode
    ? generateBrowserEscapePuzzle(seed)
    : await fetch("./api/escape/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ seed, tier }) }).then((r) => r.json());
  world3d.loadEscapePuzzle(puzzle, (st) => {
    els.escapeOracleStatus.textContent = `[Tier ${puzzle.tier || 2} · ${puzzle.theme.title}] MinHeap-A*: ${puzzle.oracle.expandedAStar} vs ${puzzle.oracle.expandedBfs} BFS (${puzzle.oracle.aStarSpeedupRatio}x) · ${puzzle.oracle.reachableStates} States · 0 Dead-Ends · Raum: ${st.room?.name || "?"} ${st.escaped ? "🏆 ENTKOMMEN!" : ""}`;
  });
});
els.btnExitEscape.addEventListener("click", () => world3d.clearEscapePuzzle());

els.btnRunArena.addEventListener("click", async () => {
  const arena = isStaticPagesMode
    ? runBrowserArena(els.arenaConceptInput.value)
    : await fetch("./api/arena/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ concept: els.arenaConceptInput.value, limit: 6 }) }).then((r) => r.json());
  lastArenaResult = arena; els.btnExportArena.disabled = false; els.arenaGrid.innerHTML = "";
  arena.candidates.forEach((cand, idx) => {
    const card = document.createElement("div");
    card.className = `arena-card ${idx === 0 ? "winner" : ""}`;
    card.innerHTML = `<strong>${idx === 0 ? "🏆 " : ""}${cand.title}</strong><div style="color:#93a1c2;margin:4px 0;">Score: <b>${cand.score}</b></div><button type="button" style="width:100%;">Play in 3D</button>`;
    card.querySelector("button").addEventListener("click", () => { world3d.clearEscapePuzzle(); world3d.resetCamera(); world3d.applyBlueprint(cand.worldBlueprint, cand.title); });
    els.arenaGrid.appendChild(card);
  });
  world3d.applyBlueprint(arena.candidates[0].worldBlueprint, `🏆 ${arena.winnerTitle}`);
});
els.btnExportArena.addEventListener("click", () => lastArenaResult && offerDownload(new Blob([JSON.stringify(lastArenaResult.exportSpec, null, 2)], { type: "application/json" }), `level-spec-${lastArenaResult.arenaId}.json`, "level-spec.json"));

async function playChoreography(actions = []) {
  for (const s of actions) {
    lastActivityMs = Date.now(); heldKeys.add(s.input);
    if (activeSession) await activeSession.send({ event_type: "user_action", action: "key_down", input: s.input }).catch(() => {});
    await new Promise((r) => setTimeout(r, s.holdMs));
    heldKeys.delete(s.input);
    if (activeSession) await activeSession.send({ event_type: "user_action", action: "key_up", input: s.input }).catch(() => {});
  }
}

els.btnRunTheater.addEventListener("click", async () => {
  const th = isStaticPagesMode ? runBrowserTheater(els.theaterTopicInput.value) : await fetch("./api/theater/debate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: els.theaterTopicInput.value, useLocalClis: els.chkLiveClis.checked }) }).then((r) => r.json());
  for (const act of th.acts) { appendFeed({ agent: act.speaker, mode: act.title, text: act.line }); world3d.applyBlueprint(act.blueprint, act.title); await playChoreography([act.cameraCue]); }
});

els.btnAutoTrailer.addEventListener("click", async () => {
  const r = await triggerTriadRound({ isInitial: true, customSeed: els.theaterTopicInput.value });
  world3d.resetCamera();
  if (els.budgetModeSelect.value !== "lock" && !activeSession && !isStaticPagesMode) await startGenieWorld(r);
  startRecording();
  await playChoreography([{ input: "key_w", holdMs: 3500 }, { input: "arrow_right", holdMs: 450 }]);
  world3d.triggerBeat(1.0, true);
  if (activeSession) await activeSession.send(r.steerPrompt).catch(() => {});
  await playChoreography([{ input: "key_w", holdMs: 4200 }]);
  stopRecording();
  if (activeSession) await stopGenieWorld("Auto-Trailer gespeichert & Genie 4 gestoppt.");
});

els.btnVoteKeep.addEventListener("click", () => isStaticPagesMode ? recordBrowserBrierVote(1) : fetch("./api/si-algo/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: 1, prob: 0.88 }) }));
els.btnVoteDrift.addEventListener("click", () => isStaticPagesMode ? recordBrowserBrierVote(0) : fetch("./api/si-algo/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ outcome: 0, prob: 0.88 }) }));

// --- Genie 4 Live WebRTC / WebSocket Session (Budget + Prepaid Coin Gatekeeper) ---
async function startGenieWorld(preRound = null) {
  if (activeSession || isStaticPagesMode) return;
  els.btnStartGenie.disabled = true;
  try {
    const round = preRound || (await triggerTriadRound({ isInitial: true }));
    const modeVal = els.budgetModeSelect.value;
    const sessionResp = await fetch("./api/genie/session", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ useWorldCoin: modeVal === "coin", requestedBurstSec: modeVal === "coin" ? 12 : Number(modeVal) || null }),
    });
    const sessionData = await sessionResp.json();
    if (!sessionResp.ok) throw new Error(sessionData.error || "Start blockiert");

    activeInteractionId = sessionData.interactionId;
    activeBurstCapSec = sessionData.burstCapSec || 12;
    const transport = els.transportSelect.value;
    const clientAi = new GoogleGenAI({ apiKey: sessionData.authToken, apiVersion: "v1beta" });
    const session = await clientAi.interactions.connect(activeInteractionId, { transport, api_version: "v1beta" }, { timeout_ms: 30_000 });
    activeSession = session;

    if (transport === "webrtc") { session.transport.setVideoElement(els.video); els.video.classList.remove("hidden"); }
    else { els.video.classList.add("hidden"); world3d.paused = true; }

    session._receiveLoop = (async () => {
      try {
        for await (const ev of session.receive()) {
          if (ev.event_type === "step.delta" && transport === "websocket" && ev.delta?.type === "video" && ev.delta.data) {
            const img = new Image();
            img.onload = () => els.canvas.getContext("2d").drawImage(img, 0, 0, els.canvas.width, els.canvas.height);
            img.src = `data:image/jpeg;base64,${ev.delta.data}`;
          } else if (ev.event_type === "interaction.completed" || ev.event_type === "interaction.canceled") break;
        }
      } catch {}
    })();

    await session.send(round.genieEvents.world_setup);
    sessionStartMs = Date.now(); lastActivityMs = Date.now();
    els.btnStopGenie.disabled = false;
    startRecording();
    billingTimer = setInterval(() => {
      const sec = (Date.now() - sessionStartMs) / 1000;
      els.hudTimer.textContent = `${sec.toFixed(1)}s / ${activeBurstCapSec}s · ~$${(sec * USD_PER_SEC).toFixed(2)}`;
      if (sec >= activeBurstCapSec || (els.chkIdleCutoff.checked && Date.now() - lastActivityMs > IDLE_CUTOFF_MS)) {
        void stopGenieWorld("Auto-Cutoff -> session.complete() ausgeführt.");
      }
    }, 250);
  } catch (err) {
    appendFeed({ agent: "genie", mode: "gatekeeper", text: err.message });
    els.btnStartGenie.disabled = false;
  }
}

async function stopGenieWorld(reason = "Session beendet.") {
  if (billingTimer) { clearInterval(billingTimer); billingTimer = null; }
  stopRecording();
  const session = activeSession, id = activeInteractionId;
  const elapsedSec = sessionStartMs ? +((Date.now() - sessionStartMs) / 1000).toFixed(1) : 0;
  activeSession = null; activeInteractionId = null;
  els.video.classList.add("hidden"); world3d.paused = false;
  els.btnStopGenie.disabled = true; els.btnStartGenie.disabled = false;
  if (session) {
    try { await session.complete(); await session._receiveLoop; } catch {}
    await fetch("./api/genie/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ interactionId: id, elapsedSec }) }).catch(() => {});
    appendFeed({ agent: "genie", mode: "complete()", text: reason });
  }
}
els.btnStartGenie.addEventListener("click", () => void startGenieWorld());
els.btnStopGenie.addEventListener("click", () => void stopGenieWorld());

// --- Keyboard Listeners ---
const isInput = (t) => t && ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
window.addEventListener("keydown", (e) => {
  if (e.repeat || isInput(e.target)) return;
  const input = KEY_MAP[e.code];
  if (!input || heldKeys.has(input)) return;
  e.preventDefault(); lastActivityMs = Date.now();
  if (input === "key_e") world3d.tryInteract();
  else { heldKeys.add(input); document.querySelector(`.keycap[data-key="${input}"]`)?.classList.add("active"); }
  if (activeSession) void activeSession.send({ event_type: "user_action", action: "key_down", input }).catch(() => {});
});
window.addEventListener("keyup", (e) => {
  const input = KEY_MAP[e.code];
  if (!input || !heldKeys.delete(input)) return;
  document.querySelector(`.keycap[data-key="${input}"]`)?.classList.remove("active");
  if (activeSession) void activeSession.send({ event_type: "user_action", action: "key_up", input }).catch(() => {});
});
window.addEventListener("blur", () => { heldKeys.clear(); });
window.addEventListener("pagehide", () => {
  if (activeInteractionId) navigator.sendBeacon("./api/genie/cancel", new Blob([JSON.stringify({ interactionId: activeInteractionId })], { type: "application/json" }));
});
