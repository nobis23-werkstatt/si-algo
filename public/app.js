import { GoogleGenAI } from "@google/genai";
import {
  generateBrowserAcidMidiBytes,
  generateBrowserEscapePuzzle,
  recordBrowserBrierVote,
  runBrowserArena,
  runBrowserTheater,
  runBrowserTriadRound,
} from "./browser-engines.js";
import { PlayableWorld3D, ProceduralAudioEngine } from "./world3d.js";

const KEY_MAP = {
  KeyW: "key_w",
  KeyA: "key_a",
  KeyS: "key_s",
  KeyD: "key_d",
  ArrowUp: "arrow_up",
  ArrowDown: "arrow_down",
  ArrowLeft: "arrow_left",
  ArrowRight: "arrow_right",
  KeyE: "key_e",
  Space: "space",
};

const USD_PER_SEC = 0.101;
const IDLE_CUTOFF_MS = 6000;

const els = {
  video: document.getElementById("genieVideo"),
  canvas: document.getElementById("holoCanvas"),
  hudState: document.getElementById("hudState"),
  hudTimer: document.getElementById("hudTimer"),
  firewallBadge: document.getElementById("firewallBadge"),
  budgetModeSelect: document.getElementById("budgetModeSelect"),
  dailyBudgetText: document.getElementById("dailyBudgetText"),
  chkIdleCutoff: document.getElementById("chkIdleCutoff"),
  chkUse3DRef: document.getElementById("chkUse3DRef"),
  chkFoleyAudio: document.getElementById("chkFoleyAudio"),
  chkLiveClis: document.getElementById("chkLiveClis"),
  btnRecordToggle: document.getElementById("btnRecordToggle"),
  btnSnapshot: document.getElementById("btnSnapshot"),
  btnTriadSpark: document.getElementById("btnTriadSpark"),
  btnStartGenie: document.getElementById("btnStartGenie"),
  btnStopGenie: document.getElementById("btnStopGenie"),
  btnResetCam: document.getElementById("btnResetCam"),
  btnSteerNow: document.getElementById("btnSteerNow"),
  transportSelect: document.getElementById("transportSelect"),
  refImageInput: document.getElementById("refImageInput"),
  seedInput: document.getElementById("seedInput"),
  triadFeed: document.getElementById("triadFeed"),
  downloadsBox: document.getElementById("downloadsBox"),
  gateBadge: document.getElementById("gateBadge"),
  metricIntegral: document.getElementById("metricIntegral"),
  metricOverlap: document.getElementById("metricOverlap"),
  metricLatency: document.getElementById("metricLatency"),
  keyForm: document.getElementById("keyForm"),
  apiKeyInput: document.getElementById("apiKeyInput"),
  keyLabel: document.getElementById("keyLabel"),
  dotKey: document.getElementById("dot-key"),
  // Jockey
  rngBpm: document.getElementById("rngBpm"),
  rngCutoff: document.getElementById("rngCutoff"),
  rngEnergy: document.getElementById("rngEnergy"),
  lblBpm: document.getElementById("lblBpm"),
  lblCutoff: document.getElementById("lblCutoff"),
  lblEnergy: document.getElementById("lblEnergy"),
  btnAcidToggle: document.getElementById("btnAcidToggle"),
  btnExportMidi: document.getElementById("btnExportMidi"),
  btnTriggerDrop: document.getElementById("btnTriggerDrop"),
  btnVoteKeep: document.getElementById("btnVoteKeep"),
  btnVoteDrift: document.getElementById("btnVoteDrift"),
  // Escape
  escapeSeedInput: document.getElementById("escapeSeedInput"),
  btnNewEscape: document.getElementById("btnNewEscape"),
  btnExitEscape: document.getElementById("btnExitEscape"),
  escapeOracleStatus: document.getElementById("escapeOracleStatus"),
  // Arena
  arenaConceptInput: document.getElementById("arenaConceptInput"),
  btnRunArena: document.getElementById("btnRunArena"),
  btnExportArena: document.getElementById("btnExportArena"),
  arenaGrid: document.getElementById("arenaGrid"),
  // Theater
  theaterTopicInput: document.getElementById("theaterTopicInput"),
  btnRunTheater: document.getElementById("btnRunTheater"),
  btnAutoTrailer: document.getElementById("btnAutoTrailer"),
};

const audio = new ProceduralAudioEngine();
const world3d = new PlayableWorld3D(els.canvas, audio);

let activeSession = null;
let activeInteractionId = null;
let sessionStartMs = 0;
let activeBurstCapSec = 12;
let lastActivityMs = Date.now();
let billingTimer = null;
let lastTriadRound = null;
let lastArenaResult = null;
let uploadedRefImage = null;
let mediaRecorder = null;
let recordedChunks = [];
let isStaticPagesMode = false;
const heldKeys = new Set();

// --- 60 FPS Zero-Cost 3D Render & Physics Loop ---
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

// --- Mode Tabs ---
for (const btn of document.querySelectorAll(".tab-btn")) {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".mode-pane").forEach((p) => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.pane)?.classList.add("active");
  });
}

// --- Feed & Downloads Helpers ---
function appendFeed({ agent, mode, text, latencyMs }) {
  const div = document.createElement("div");
  div.className = `msg ${agent}`;
  const time = new Date().toLocaleTimeString();
  div.innerHTML = `
    <div class="msg-meta">
      <b>${agent}</b>
      <span>${mode || "live"}${latencyMs != null ? ` · ${latencyMs}ms` : ""} · ${time}</span>
    </div>
    <div></div>
  `;
  div.lastElementChild.textContent = text;
  els.triadFeed.prepend(div);
  while (els.triadFeed.children.length > 45) {
    els.triadFeed.lastElementChild.remove();
  }
}

function offerDownload(blob, filename, label) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.className = "dl-link";
  a.textContent = `⬇ ${label}`;
  els.downloadsBox.prepend(a);
}

// --- Budget & Firewall Sync ---
function renderBudgetStatus(budget) {
  if (!budget) return;
  els.dailyBudgetText.textContent = `Heute: ${budget.usedSecToday}s / ${budget.dailyCapSec}s (~$${budget.estimatedSpentUsdToday.toFixed(2)})`;
  if (budget.zeroCostLock) {
    els.firewallBadge.className = "pill firewall-locked";
    els.firewallBadge.textContent = "🔒 0€ Lock Active";
  } else {
    els.firewallBadge.className = "pill firewall-armed";
    els.firewallBadge.textContent = `⚡ Burst Armed (${budget.maxBurstSec}s Cap)`;
  }
}

els.budgetModeSelect.addEventListener("change", async () => {
  const val = els.budgetModeSelect.value;
  if (isStaticPagesMode) {
    els.budgetModeSelect.value = "lock";
    appendFeed({
      agent: "genie",
      mode: "github-pages",
      text: "Öffentliche GitHub-Pages-Instanz bleibt dauerhaft im kostenlosen 0€-3D-Modus. Für bezahlte Genie-4-WebRTC-Bursts einfach lokal `npm start` nutzen.",
    });
    return;
  }
  const payload =
    val === "lock"
      ? { zeroCostLock: true }
      : { zeroCostLock: false, maxBurstSec: Number(val) };
  const resp = await fetch("./api/budget", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).then((r) => r.json());
  renderBudgetStatus(resp.budget);
  appendFeed({
    agent: "genie",
    mode: "firewall",
    text:
      val === "lock"
        ? "0-€-Firewall aktiviert: Genie-4-Abrechnung ist serverseitig gesperrt ($0.00 garantiert)."
        : `Burst-Modus entsperrt: max. ${val}s (~$${(Number(val) * USD_PER_SEC).toFixed(2)}) pro Take mit hartem Auto-Complete().`,
  });
});

els.chkFoleyAudio.addEventListener("change", () => {
  audio.enabled = els.chkFoleyAudio.checked;
});

els.btnResetCam.addEventListener("click", () => world3d.resetCamera());

// --- MediaRecorder (.webm) & Keyframe (.png) ---
function startRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") return;
  recordedChunks = [];
  const stream =
    !els.video.classList.contains("hidden") && els.video.srcObject
      ? els.video.srcObject
      : els.canvas.captureStream(24);

  const mime = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
    ? "video/webm;codecs=vp9,opus"
    : "video/webm";
  mediaRecorder = new MediaRecorder(stream, { mimeType: mime });
  mediaRecorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) recordedChunks.push(e.data);
  };
  mediaRecorder.onstop = () => {
    const blob = new Blob(recordedChunks, { type: "video/webm" });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    offerDownload(blob, `5d-triad-${stamp}.webm`, `Video (${(blob.size / 1024).toFixed(0)} KB .webm)`);
    els.btnRecordToggle.textContent = "⏺ Record (.webm)";
  };
  mediaRecorder.start(250);
  els.btnRecordToggle.textContent = "⏹ Stop Rec";
}

function stopRecording() {
  if (mediaRecorder && mediaRecorder.state === "recording") {
    mediaRecorder.stop();
  }
}

els.btnRecordToggle.addEventListener("click", () => {
  if (mediaRecorder && mediaRecorder.state === "recording") stopRecording();
  else startRecording();
});

els.btnSnapshot.addEventListener("click", () => {
  const snap = document.createElement("canvas");
  snap.width = 1280;
  snap.height = 720;
  const sctx = snap.getContext("2d");
  const source = !els.video.classList.contains("hidden") ? els.video : els.canvas;
  sctx.drawImage(source, 0, 0, 1280, 720);
  snap.toBlob((blob) => {
    if (blob) offerDownload(blob, `keyframe-${Date.now()}.png`, "Keyframe (.png)");
  }, "image/png");
});

// --- Initial Status & Automatic GitHub Pages Serverless Detection ---
let sse = null;
function connectLocalSse() {
  sse = new EventSource("./api/events");
  sse.onmessage = (e) => {
    try {
      const evt = JSON.parse(e.data);
      if (evt.type === "agent.message") {
        appendFeed(evt);
      } else if (evt.type === "triad.complete") {
        els.metricIntegral.textContent = evt.gate.sovereign_integral.toFixed(3);
        els.metricOverlap.textContent = `ovl:${evt.gate.agy_grok_overlap.toFixed(2)}`;
        els.gateBadge.textContent = `${evt.gate.decision} (${evt.totalLatencyMs}ms)`;
        if (evt.worldBlueprint) {
          world3d.applyBlueprint(evt.worldBlueprint, evt.steerPrompt);
        }
      } else if (evt.type === "brier.updated") {
        const c = evt.calibration;
        const sign = c.brier_delta >= 0 ? "+" : "";
        els.metricOverlap.textContent = `${sign}${c.brier_delta.toFixed(2)} / d:${c.goodhart_drift.toFixed(2)}`;
      } else if (evt.type === "budget.updated") {
        renderBudgetStatus(evt.budget);
      } else if (evt.type === "jockey.pulse") {
        els.rngBpm.value = evt.bpm;
        els.lblBpm.textContent = evt.bpm;
        audio.setJockeyParams(evt);
        world3d.triggerBeat(evt.energy, evt.drop);
        if (evt.drop && evt.promptMutation) {
          els.seedInput.value = evt.promptMutation;
          void triggerTriadRound({ isInitial: false });
        }
      }
    } catch {}
  };
}

async function refreshStatus() {
  try {
    const resp = await fetch("./api/status");
    if (!resp.ok) throw new Error("Static host");
    const st = await resp.json();
    if (!sse) connectLocalSse();
    for (const a of st.agents || []) {
      const dot = document.getElementById(`dot-${a.id}`);
      if (dot) {
        dot.className = `dot ${a.installed ? "ok" : "warn"}`;
        dot.parentElement.title = a.installed ? `${a.version}` : a.error;
      }
    }
    if (st.genieKey?.configured) {
      els.dotKey.className = "dot ok";
      if (st.genieKey.source === "gcloud-cli") {
        els.keyLabel.textContent = `gcloud: ${st.genieKey.projectId} (Ready)`;
        els.keyForm.style.display = "none";
      } else {
        els.keyLabel.textContent = `Key: ${st.genieKey.masked}`;
      }
    } else {
      els.dotKey.className = "dot warn";
      els.keyLabel.textContent = "Key: 0€ Local Only";
    }
    renderBudgetStatus(st.budget);
  } catch {
    // Running serverless on public GitHub Pages!
    isStaticPagesMode = true;
    for (const id of ["agy", "grok", "claude"]) {
      const dot = document.getElementById(`dot-${id}`);
      if (dot) dot.className = "dot ok";
    }
    els.dotKey.className = "dot ok";
    els.keyLabel.textContent = "GitHub Pages (0€ Browser Engine)";
    els.keyForm.style.display = "none";
    els.dailyBudgetText.textContent = "Public Web Mode ($0.00 Forever)";
    appendFeed({
      agent: "claude",
      mode: "github-pages-live",
      latencyMs: 1,
      text: "Willkommen auf der öffentlichen 5D Triad Forge Instanz! Alle 5 Module (60fps 3D-Welt, Acid-303 + .mid Export, A* Escape Room, Variant-Arena & Auto-Trailer .webm Recorder) laufen 100 % kostenlos direkt in deinem Browser.",
    });
  }
}
void refreshStatus();

els.keyForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const apiKey = els.apiKeyInput.value.trim();
  if (!apiKey) return;
  await fetch("/api/config/key", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ apiKey }),
  });
  els.apiKeyInput.value = "";
  await refreshStatus();
});

// --- Custom Reference Image Upload (< 40KB JPEG) ---
els.refImageInput.addEventListener("change", async (e) => {
  const file = e.target.files?.[0];
  if (!file) {
    uploadedRefImage = null;
    return;
  }
  const bmp = await createImageBitmap(file);
  const off = document.createElement("canvas");
  off.width = 640;
  off.height = 360;
  off.getContext("2d").drawImage(bmp, 0, 0, 640, 360);
  let q = 0.76;
  let url = off.toDataURL("image/jpeg", q);
  while (url.length > 50_000 && q > 0.3) {
    q -= 0.1;
    url = off.toDataURL("image/jpeg", q);
  }
  uploadedRefImage = { mime_type: "image/jpeg", data: url.split(",")[1] };
  appendFeed({ agent: "genie", mode: "ref-image", text: "Custom reference image compressed < 40 KB." });
});

// --- Module 1: Triad Creative Round ---
async function triggerTriadRound({ isInitial = true, customSeed = null } = {}) {
  els.btnTriadSpark.disabled = true;
  try {
    if (isStaticPagesMode) {
      const data = runBrowserTriadRound(customSeed || els.seedInput.value);
      appendFeed(data.agents.agy);
      appendFeed(data.agents.grok);
      appendFeed(data.agents.claude);
      els.metricIntegral.textContent = data.gate.sovereign_integral.toFixed(3);
      els.metricOverlap.textContent = `ovl:${data.gate.agy_grok_overlap.toFixed(2)}`;
      els.gateBadge.textContent = `${data.gate.decision} (${data.totalLatencyMs}ms)`;
      lastTriadRound = data;
      world3d.clearEscapePuzzle();
      world3d.applyBlueprint(data.worldBlueprint, data.steerPrompt);
      return data;
    }

    const refImg = isInitial
      ? uploadedRefImage ||
        (els.chkUse3DRef.checked
          ? (() => {
              const snap = world3d.captureReferenceJpegUnder40KB();
              return { mime_type: snap.mime_type, data: snap.data };
            })()
          : null)
      : null;

    const res = await fetch("./api/triad/round", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        seed: customSeed || els.seedInput.value,
        isInitial,
        useLocalClis: els.chkLiveClis.checked,
        referenceImage: refImg,
        transport: els.transportSelect.value,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Triad round failed");
    lastTriadRound = data;
    world3d.clearEscapePuzzle();
    world3d.applyBlueprint(data.worldBlueprint, data.steerPrompt);
    return data;
  } finally {
    els.btnTriadSpark.disabled = false;
  }
}

els.btnTriadSpark.addEventListener("click", () => {
  void triggerTriadRound({ isInitial: !activeSession }).catch((err) =>
    appendFeed({ agent: "genie", mode: "error", text: err.message })
  );
});

els.btnSteerNow.addEventListener("click", async () => {
  try {
    const r = await triggerTriadRound({ isInitial: !activeSession });
    if (activeSession && r.gate.decision !== "VETO_REJECT") {
      lastActivityMs = Date.now();
      await activeSession.send(r.steerPrompt);
      appendFeed({ agent: "genie", mode: "live-steer", text: `Genie 4 steered: "${r.steerPrompt}"` });
    }
  } catch (err) {
    appendFeed({ agent: "genie", mode: "error", text: err.message });
  }
});

for (const chip of document.querySelectorAll(".chip")) {
  chip.addEventListener("click", () => {
    els.seedInput.value = chip.dataset.seed;
    void triggerTriadRound({ isInitial: !activeSession });
  });
}

// --- Module 2: Audio-Visual World-Jockey ---
function syncJockeySliders() {
  const bpm = Number(els.rngBpm.value);
  const cutoff = Number(els.rngCutoff.value) / 100;
  const energy = Number(els.rngEnergy.value) / 100;
  els.lblBpm.textContent = String(bpm);
  els.lblCutoff.textContent = `${els.rngCutoff.value}%`;
  els.lblEnergy.textContent = `${els.rngEnergy.value}%`;
  audio.setJockeyParams({ bpm, cutoff, energy });
}
els.rngBpm.addEventListener("input", syncJockeySliders);
els.rngCutoff.addEventListener("input", syncJockeySliders);
els.rngEnergy.addEventListener("input", syncJockeySliders);

els.btnAcidToggle.addEventListener("click", () => {
  const next = !audio.acidRunning;
  audio.toggleAcidPulse(next, () => {
    world3d.triggerBeat(Number(els.rngEnergy.value) / 100, false);
  });
  els.btnAcidToggle.textContent = next
    ? "⏹ Stop 0€ Acid-303 Synth"
    : "▶ Start 0€ Acid-303 Synth";
});

els.btnExportMidi?.addEventListener("click", async () => {
  const bpm = Number(els.rngBpm.value);
  if (isStaticPagesMode) {
    const bytes = generateBrowserAcidMidiBytes({ bpm, bars: 2, seed: els.seedInput.value });
    const blob = new Blob([bytes], { type: "audio/midi" });
    offerDownload(blob, `acid303-${bpm}bpm.mid`, `303 Pattern (${bpm} BPM .mid)`);
    appendFeed({
      agent: "grok",
      mode: "browser-midi",
      latencyMs: 1,
      text: `2-bar TB-303 Acid SMF (.mid) @ ${bpm} BPM direkt im Browser erzeugt!`,
    });
    return;
  }
  const resp = await fetch("./api/jockey/midi", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      seed: els.seedInput.value,
      bpm,
      energy: Number(els.rngEnergy.value) / 100,
      bars: 2,
    }),
  }).then((r) => r.json());
  if (!resp.ok) return;
  const bin = atob(resp.base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const blob = new Blob([bytes], { type: "audio/midi" });
  offerDownload(blob, `acid303-${resp.bpm}bpm.mid`, `303 Pattern (${resp.bpm} BPM .mid)`);
});

async function submitBrierVote(outcome) {
  if (isStaticPagesMode) {
    const c = recordBrowserBrierVote(outcome, lastTriadRound?.gate?.sovereign_integral || 0.88);
    const sign = c.brier_delta >= 0 ? "+" : "";
    els.metricOverlap.textContent = `${sign}${c.brier_delta.toFixed(2)} / d:${c.goodhart_drift.toFixed(2)}`;
    return;
  }
  await fetch("./api/si-algo/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      outcome,
      prob: lastTriadRound?.gate?.sovereign_integral || 0.85,
      roundId: lastTriadRound?.roundId || null,
    }),
  });
}
els.btnVoteKeep?.addEventListener("click", () => void submitBrierVote(1));
els.btnVoteDrift?.addEventListener("click", () => void submitBrierVote(0));

els.btnTriggerDrop.addEventListener("click", async () => {
  world3d.triggerBeat(1.0, true);
  audio.playChime("portal");
  const dropPrompts = [
    "Clockwork skylight shatters open into amber aurora beams over wet basalt arches",
    "Subterranean tide-locks surge with bioluminescent cyan mist and spinning brass turbines",
    "Gravity-defying travertine bridges unfold in rhythmic waves beneath crimson storm clouds",
  ];
  const pick = dropPrompts[Math.floor(Math.random() * dropPrompts.length)];
  els.seedInput.value = pick;
  const r = await triggerTriadRound({ isInitial: !activeSession, customSeed: pick });
  if (activeSession) {
    lastActivityMs = Date.now();
    await activeSession.send(r.steerPrompt).catch(() => {});
  }
});

// --- Module 3: Infinite Escape Room (BFS Verified) ---
els.btnNewEscape.addEventListener("click", async () => {
  const seed = `${els.escapeSeedInput.value}-${Date.now() % 997}`;
  const puzzle = isStaticPagesMode
    ? generateBrowserEscapePuzzle(seed)
    : await fetch("./api/escape/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed }),
      }).then((r) => r.json());

  world3d.loadEscapePuzzle(puzzle, (state) => {
    els.escapeOracleStatus.textContent =
      `[${puzzle.theme.title}] A*-Speedup: ${puzzle.oracle.expandedAStar} vs ${puzzle.oracle.expandedBfs} BFS-Knoten (${puzzle.oracle.aStarSpeedupRatio}x) · ${puzzle.oracle.shortestSteps} Schritte · 0 Dead-Ends · ` +
      `Raum: ${state.room?.name || "?"} · Maske: ${(state.mask & 15).toString(2).padStart(4, "0")} ` +
      (state.escaped ? "🏆 ENTKOMMEN!" : `— Tipp: ${state.room?.hint || ""}`);
  });
});

els.btnExitEscape.addEventListener("click", () => {
  world3d.clearEscapePuzzle();
  els.escapeOracleStatus.textContent = "Escape-Modus beendet — freier 3D-Twin aktiv.";
});

// --- Module 4: Game-Prototyping Variant-Arena ---
els.btnRunArena.addEventListener("click", async () => {
  const arena = isStaticPagesMode
    ? runBrowserArena(els.arenaConceptInput.value)
    : await fetch("./api/arena/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ concept: els.arenaConceptInput.value }),
      }).then((r) => r.json());

  lastArenaResult = arena;
  els.btnExportArena.disabled = false;
  els.arenaGrid.innerHTML = "";

  arena.candidates.forEach((cand, idx) => {
    const card = document.createElement("div");
    card.className = `arena-card ${idx === 0 ? "winner" : ""}`;
    card.innerHTML = `
      <strong>${idx === 0 ? "🏆 " : ""}${cand.title}</strong>
      <div style="color:#93a1c2;margin:4px 0;">Score: <b>${cand.score}</b> · I_SI: ${cand.gate.sovereign_integral}</div>
      <button type="button" style="width:100%;margin-top:4px;">Load in 3D Viewport</button>
    `;
    card.querySelector("button").addEventListener("click", () => {
      world3d.clearEscapePuzzle();
      world3d.resetCamera();
      world3d.applyBlueprint(cand.worldBlueprint, `${cand.title} — ${cand.concept}`);
      els.seedInput.value = cand.worldPrompt;
    });
    els.arenaGrid.appendChild(card);
  });

  // Auto-load winner into 3D viewport!
  world3d.clearEscapePuzzle();
  world3d.resetCamera();
  world3d.applyBlueprint(arena.candidates[0].worldBlueprint, `🏆 ${arena.winnerTitle}`);
});

els.btnExportArena.addEventListener("click", () => {
  if (!lastArenaResult) return;
  const blob = new Blob([JSON.stringify(lastArenaResult.exportSpec, null, 2)], {
    type: "application/json",
  });
  offerDownload(blob, `level-spec-${lastArenaResult.arenaId}.json`, "level-spec.json");
});

// --- Module 5: 5D Philosophy Theater & 1-Click Auto-Micro-Trailer ---
async function playChoreography(actions = []) {
  for (const step of actions) {
    lastActivityMs = Date.now();
    setKeyCapVisual(step.input, true);
    heldKeys.add(step.input);
    if (activeSession) {
      await activeSession
        .send({ event_type: "user_action", action: "key_down", input: step.input })
        .catch(() => {});
    }
    await new Promise((r) => setTimeout(r, step.holdMs));
    heldKeys.delete(step.input);
    setKeyCapVisual(step.input, false);
    if (activeSession) {
      await activeSession
        .send({ event_type: "user_action", action: "key_up", input: step.input })
        .catch(() => {});
    }
  }
}

els.btnRunTheater.addEventListener("click", async () => {
  els.btnRunTheater.disabled = true;
  try {
    const theater = isStaticPagesMode
      ? runBrowserTheater(els.theaterTopicInput.value)
      : await fetch("./api/theater/debate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: els.theaterTopicInput.value,
            useLocalClis: els.chkLiveClis.checked,
          }),
        }).then((r) => r.json());

    world3d.clearEscapePuzzle();
    world3d.resetCamera();

    for (const act of theater.acts) {
      appendFeed({ agent: act.speaker, mode: act.title, text: act.line });
      world3d.applyBlueprint(act.blueprint, `${act.title}: ${act.line}`);
      audio.playChime(act.act === 2 ? "trap" : act.act === 3 ? "portal" : "unlock");
      await playChoreography([act.cameraCue]);
    }
  } finally {
    els.btnRunTheater.disabled = false;
  }
});

els.btnAutoTrailer.addEventListener("click", async () => {
  els.btnAutoTrailer.disabled = true;
  try {
    els.seedInput.value = els.theaterTopicInput.value;
    const round = await triggerTriadRound({ isInitial: true, customSeed: els.theaterTopicInput.value });
    world3d.resetCamera();

    // If user unlocked a Genie 4 burst, run live Genie 4; otherwise shoot a $0.00 3D Trailer!
    if (els.budgetModeSelect.value !== "lock" && !activeSession) {
      await startGenieWorld(round);
    }

    startRecording();
    appendFeed({
      agent: "genie",
      mode: "trailer-director",
      text: "🎬 Auto-Trailer läuft (11s Kamerafahrt + Live-Mutation + automatischer .webm-Mitschnitt)...",
    });

    await playChoreography([
      { input: "key_w", holdMs: 3600 },
      { input: "arrow_right", holdMs: 480 },
    ]);

    // Mid-trailer dramatic twist at ~4.1s
    world3d.triggerBeat(1.0, true);
    world3d.applyBlueprint(
      { particles: "embers", portalColor: "#fbbf24" },
      `Act II Twist: ${round.steerPrompt}`
    );
    if (activeSession) {
      lastActivityMs = Date.now();
      await activeSession.send(round.steerPrompt).catch(() => {});
    }

    await playChoreography([
      { input: "key_w", holdMs: 3800 },
      { input: "arrow_left", holdMs: 420 },
      { input: "key_w", holdMs: 2600 },
    ]);

    stopRecording();
    if (activeSession) {
      await stopGenieWorld("Auto-Trailer abgeschlossen — Genie 4 gestoppt & .webm gespeichert!");
    } else {
      appendFeed({
        agent: "genie",
        mode: "0€-trailer-ready",
        text: "0-€-3D-Trailer fertig geschnitten! Rechts oben über den grünen Link als .webm herunterladen.",
      });
    }
  } finally {
    els.btnAutoTrailer.disabled = false;
  }
});

// --- Live Genie 4 Burst Connection (Guarded by Cost Firewall) ---
async function startGenieWorld(precomputedRound = null) {
  if (activeSession) return;
  if (isStaticPagesMode) {
    appendFeed({
      agent: "genie",
      mode: "github-pages",
      text: "Auf GitHub Pages läuft der kostenlose 60fps-3D-Modus (API-Keys gehören niemals ins öffentliche Frontend). Klone das Repo lokal (`npm start`) für Keyless-gcloud Genie-4-WebRTC-Streams!",
    });
    return;
  }
  els.btnStartGenie.disabled = true;

  try {
    const round = precomputedRound || (await triggerTriadRound({ isInitial: true }));

    const sessionResp = await fetch("/api/genie/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestedBurstSec:
          els.budgetModeSelect.value === "lock" ? null : Number(els.budgetModeSelect.value),
      }),
    });
    const sessionData = await sessionResp.json();
    if (!sessionResp.ok) {
      throw new Error(sessionData.error || "Genie 4 Start blockiert");
    }

    const { interactionId, authToken, burstCapSec } = sessionData;
    activeInteractionId = interactionId;
    activeBurstCapSec = burstCapSec || 12;
    const transport = els.transportSelect.value;

    const clientAi = new GoogleGenAI({ apiKey: authToken, apiVersion: "v1beta" });
    const session = await clientAi.interactions.connect(
      interactionId,
      { transport, api_version: "v1beta" },
      { timeout_ms: 30_000 }
    );
    activeSession = session;

    if (transport === "webrtc") {
      session.transport.setVideoElement(els.video);
      els.video.classList.remove("hidden");
    } else {
      els.video.classList.add("hidden");
      world3d.paused = true;
    }

    // WebSocket PCM16LE 48kHz stereo fallback decoder (Syzygos Fix #1)
    let wsAudioCtx = null;
    let wsNextTime = 0;
    const playWsPcm48k = (b64) => {
      if (!wsAudioCtx) {
        wsAudioCtx = new AudioContext({ sampleRate: 48000 });
        wsNextTime = wsAudioCtx.currentTime;
      }
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const samples = new Int16Array(bytes.buffer);
      const frames = Math.floor(samples.length / 2);
      if (frames <= 0) return;
      const buf = wsAudioCtx.createBuffer(2, frames, 48000);
      const chL = buf.getChannelData(0);
      const chR = buf.getChannelData(1);
      for (let i = 0; i < frames; i++) {
        chL[i] = samples[i * 2] / 32768;
        chR[i] = samples[i * 2 + 1] / 32768;
      }
      const src = wsAudioCtx.createBufferSource();
      src.buffer = buf;
      src.connect(wsAudioCtx.destination);
      const t = Math.max(wsAudioCtx.currentTime, wsNextTime);
      src.start(t);
      wsNextTime = t + buf.duration;
    };

    session._receiveLoop = (async () => {
      try {
        for await (const event of session.receive()) {
          if (event.event_type === "step.delta" && transport === "websocket") {
            if (event.delta?.type === "video" && event.delta.data) {
              const img = new Image();
              img.onload = () => {
                els.canvas.getContext("2d").drawImage(img, 0, 0, els.canvas.width, els.canvas.height);
              };
              img.src = `data:image/jpeg;base64,${event.delta.data}`;
            } else if (event.delta?.type === "audio" && event.delta.data) {
              playWsPcm48k(event.delta.data);
            }
          } else if (event.event_type === "error") {
            appendFeed({ agent: "genie", mode: "stream-error", text: JSON.stringify(event.error) });
          } else if (
            event.event_type === "interaction.completed" ||
            event.event_type === "interaction.canceled"
          ) {
            break;
          }
        }
      } catch {}
    })();

    await session.send(round.genieEvents.world_setup);
    sessionStartMs = Date.now();
    lastActivityMs = Date.now();
    els.btnStopGenie.disabled = false;
    els.hudState.textContent = `LIVE GENIE 4 (${activeBurstCapSec}s CAP · 24 FPS)`;

    // Auto-record every paid Genie 4 burst so not a single cent goes unrecorded!
    startRecording();

    billingTimer = setInterval(() => {
      const sec = (Date.now() - sessionStartMs) / 1000;
      const cost = (sec * USD_PER_SEC).toFixed(2);
      els.hudTimer.textContent = `${sec.toFixed(1)}s / ${activeBurstCapSec}s · ~$${cost}`;

      if (sec >= activeBurstCapSec) {
        void stopGenieWorld(`Burst-Limit (${activeBurstCapSec}s) erreicht -> session.complete() ausgeführt.`);
      } else if (
        els.chkIdleCutoff.checked &&
        Date.now() - lastActivityMs > IDLE_CUTOFF_MS
      ) {
        void stopGenieWorld("6s Inaktivitäts-Schutz -> session.complete() spart sofort Kosten!");
      }
    }, 250);
  } catch (err) {
    appendFeed({ agent: "genie", mode: "firewall-info", text: err.message });
    els.btnStartGenie.disabled = false;
  }
}

async function stopGenieWorld(reason = "Session beendet; Abrechnung sofort gestoppt.") {
  if (billingTimer) {
    clearInterval(billingTimer);
    billingTimer = null;
  }
  stopRecording();
  releaseAllKeys();

  const session = activeSession;
  const interactionId = activeInteractionId;
  const elapsedSec = sessionStartMs ? +((Date.now() - sessionStartMs) / 1000).toFixed(1) : 0;
  activeSession = null;
  activeInteractionId = null;

  els.video.classList.add("hidden");
  world3d.paused = false;
  els.btnStopGenie.disabled = true;
  els.btnStartGenie.disabled = false;
  els.hudState.textContent = "MODE: 0€ PLAYABLE 3D TWIN ($0.00/s)";
  els.hudTimer.textContent = "00:00 · $0.00";

  if (session) {
    try {
      await session.complete();
      await session._receiveLoop;
    } catch {}
    await fetch("/api/genie/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interactionId, elapsedSec }),
    }).catch(() => {});
    appendFeed({ agent: "genie", mode: "complete()", text: reason });
  }
}

els.btnStartGenie.addEventListener("click", () => void startGenieWorld());
els.btnStopGenie.addEventListener("click", () => void stopGenieWorld());

// --- Keyboard Controls (3D Twin + Live Genie 4 simultaneously) ---
function setKeyCapVisual(input, active) {
  const cap = document.querySelector(`.keycap[data-key="${input}"]`);
  if (cap) cap.classList.toggle("active", active);
}

function isTyping(target) {
  return target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT");
}

window.addEventListener("keydown", (e) => {
  if (e.repeat || isTyping(e.target)) return;
  const input = KEY_MAP[e.code];
  if (!input || heldKeys.has(input)) return;
  e.preventDefault();
  lastActivityMs = Date.now();

  if (input === "key_e") {
    setKeyCapVisual("key_e", true);
    setTimeout(() => setKeyCapVisual("key_e", false), 180);
    world3d.tryInteract();
  } else {
    heldKeys.add(input);
    setKeyCapVisual(input, true);
  }

  if (activeSession) {
    void activeSession
      .send({ event_type: "user_action", action: "key_down", input })
      .catch(() => {});
  }
});

window.addEventListener("keyup", (e) => {
  const input = KEY_MAP[e.code];
  if (!input || !heldKeys.delete(input)) return;
  e.preventDefault();
  lastActivityMs = Date.now();
  setKeyCapVisual(input, false);
  if (activeSession) {
    void activeSession
      .send({ event_type: "user_action", action: "key_up", input })
      .catch(() => {});
  }
});

function releaseAllKeys() {
  for (const input of heldKeys) {
    setKeyCapVisual(input, false);
    if (activeSession) {
      void activeSession
        .send({ event_type: "user_action", action: "key_up", input })
        .catch(() => {});
    }
  }
  heldKeys.clear();
}

window.addEventListener("blur", releaseAllKeys);

window.addEventListener("pagehide", () => {
  if (activeInteractionId) {
    const elapsedSec = sessionStartMs ? +((Date.now() - sessionStartMs) / 1000).toFixed(1) : 1;
    const blob = new Blob([JSON.stringify({ interactionId: activeInteractionId, elapsedSec })], {
      type: "application/json",
    });
    navigator.sendBeacon("/api/genie/cancel", blob);
  }
});
