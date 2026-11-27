// Zero-Cost ($0.00/s) Playable 3D World Engine v4.0 — 16 Architectural Archetypes + Live FFT Spectrum!
// Scaled x4 for /scale-it -4:
// - 16 distinct geometry & vault silhouettes (cathedral, library, canyon, spire, tekno_bunker_909,
//   acid_reactor_bmin, quantum_lattice, gravity_colosseum, obsidian_vault, solarpunk_observatory,
//   ice_citadel, cyber_canal, orbital_ring, desert_monolith, sub_abyss, sovereign_citadel)
// - Live 16-band FFT Horizon Equalizer synced to Paul's 180.00 BPM B-Minor Motivation Track!
// - Dynamic multi-tier Escape Room barriers (Tiers 1..4).

function hexToRgb(hex, fallback = [56, 189, 248]) {
  const m = String(hex || "")
    .trim()
    .match(/^#?([0-9a-f]{6})$/i);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgba([r, g, b], a = 1) {
  return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
}

export const ARCHETYPE_SPECS = {
  cathedral: { halfW: 5.2, archH: 5.4, roofPeak: 1.9, rings: true, ribs: "pointed" },
  library: { halfW: 5.0, archH: 5.8, roofPeak: 0.0, rings: false, ribs: "monolith" },
  canyon: { halfW: 6.4, archH: 5.2, roofPeak: 0.8, rings: false, ribs: "torii" },
  spire: { halfW: 4.8, archH: 7.0, roofPeak: 2.8, rings: true, ribs: "pointed" },
  tekno_bunker_909: { halfW: 5.8, archH: 4.4, roofPeak: 0.3, rings: true, ribs: "bunker" },
  acid_reactor_bmin: { halfW: 5.4, archH: 5.6, roofPeak: 1.2, rings: true, ribs: "hexagon" },
  quantum_lattice: { halfW: 5.6, archH: 6.0, roofPeak: 1.5, rings: true, ribs: "diamond" },
  gravity_colosseum: { halfW: 6.8, archH: 5.8, roofPeak: 1.4, rings: true, ribs: "colosseum" },
  obsidian_vault: { halfW: 4.9, archH: 5.2, roofPeak: 2.2, rings: false, ribs: "pointed" },
  solarpunk_observatory: { halfW: 6.0, archH: 6.2, roofPeak: 2.0, rings: true, ribs: "dome" },
  ice_citadel: { halfW: 5.1, archH: 7.2, roofPeak: 3.1, rings: false, ribs: "pointed" },
  cyber_canal: { halfW: 6.2, archH: 4.9, roofPeak: 1.0, rings: true, ribs: "dome" },
  orbital_ring: { halfW: 6.6, archH: 6.4, roofPeak: 1.8, rings: true, ribs: "hexagon" },
  desert_monolith: { halfW: 6.5, archH: 6.6, roofPeak: 0.0, rings: false, ribs: "monolith" },
  sub_abyss: { halfW: 5.3, archH: 5.0, roofPeak: 1.6, rings: true, ribs: "dome" },
  sovereign_citadel: { halfW: 6.2, archH: 6.8, roofPeak: 2.6, rings: true, ribs: "diamond" },
  resonance_sanctuary: { halfW: 6.5, archH: 6.4, roofPeak: 2.4, rings: true, ribs: "dome" },
};

export class ProceduralAudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.acidRunning = false;
    this.acidTimer = null;
    this.stepIdx = 0;
    this.bpm = 180;
    this.cutoff = 0.68;
    this.energy = 0.82;
  }

  _init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    // Ear-Safety & Spatial Comfort Chain (19 Hz DC-Blocker -> 18 kHz Warmth LPF -> Soft-Knee Limiter)
    const dc = this.ctx.createBiquadFilter();
    dc.type = "highpass";
    dc.frequency.value = 19;
    const warmLpf = this.ctx.createBiquadFilter();
    warmLpf.type = "lowpass";
    warmLpf.frequency.value = 18_000;
    const lim = this.ctx.createDynamicsCompressor();
    lim.threshold.value = -8;
    lim.ratio.value = 10;
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.2; // -14 dBFS gentle ear-safe headroom
    this.master.connect(dc).connect(warmLpf).connect(lim).connect(this.ctx.destination);
  }

  playFootstep(surface = "stone", panX = 0) {
    if (!this.enabled) return;
    this._init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
    osc.type = "sine"; // Gentle organic low thud, zero harsh transients
    osc.frequency.setValueAtTime(surface === "metal" ? 144 : 96, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.065);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.11, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.07);
    if (pan) {
      pan.pan.value = Math.max(-0.6, Math.min(0.6, panX));
      osc.connect(gain).connect(pan).connect(this.master);
    } else {
      osc.connect(gain).connect(this.master);
    }
    osc.start(now);
    osc.stop(now + 0.075);
  }

  playChime(kind = "unlock") {
    if (!this.enabled) return;
    this._init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Pure Just Intonation on neutral 200 Hz root (1:1=200, 5:4=250, 3:2=300, 2:1=400 Hz)!
    // Zero 12-TET beating roughness; gentle non-punitive descending fifth (300 -> 200 Hz) on locked cues!
    const freqs =
      kind === "trap"
        ? [300, 200]
        : kind === "portal"
          ? [200, 250, 300, 400]
          : [200, 250, 300];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const pan = this.ctx.createStereoPanner ? this.ctx.createStereoPanner() : null;
      osc.type = "sine";
      const t0 = now + idx * 0.075;
      osc.frequency.setValueAtTime(f, t0);
      g.gain.setValueAtTime(0.0005, t0);
      g.gain.linearRampToValueAtTime(0.13, t0 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + 0.55);
      if (pan) {
        pan.pan.value = ((idx % 3) - 1) * 0.45; // 360°-feeling wide stereo bloom
        osc.connect(g).connect(pan).connect(this.master);
      } else {
        osc.connect(g).connect(this.master);
      }
      osc.start(t0);
      osc.stop(t0 + 0.58);
    });
  }

  setJockeyParams({ bpm, cutoff, energy }) {
    if (typeof bpm === "number") this.bpm = Math.max(70, Math.min(220, bpm));
    if (typeof cutoff === "number") this.cutoff = Math.max(0.05, Math.min(1, cutoff));
    if (typeof energy === "number") this.energy = Math.max(0, Math.min(1, energy));
  }

  toggleAcidPulse(active, onBeatCallback) {
    this.acidRunning = Boolean(active);
    if (this.acidTimer) {
      clearTimeout(this.acidTimer);
      this.acidTimer = null;
    }
    if (!this.acidRunning) return;
    this._init();

    // B-Minor 303 Acid Pattern (B1=61.74 Hz, B2=123.47, D2=73.42, F#2=92.50, A2=110.0)
    const notes = [61.74, 61.74, 123.47, 61.74, 73.42, 92.5, 110.0, 123.47];
    const accents = [1, 0, 1, 0, 0, 1, 0, 1];

    const tick = () => {
      if (!this.acidRunning || !this.ctx) return;
      const stepDurSec = 60 / this.bpm / 4;
      const now = this.ctx.currentTime;
      const idx = this.stepIdx % notes.length;
      const freq = notes[idx];
      const isAccent = accents[idx] === 1;

      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now);

      filter.type = "lowpass";
      filter.Q.value = 6 + this.energy * 11;
      const baseCut = 150 + this.cutoff * 2400 + (isAccent ? 950 : 0);
      filter.frequency.setValueAtTime(baseCut, now);
      filter.frequency.exponentialRampToValueAtTime(95, now + stepDurSec * 0.88);

      const amp = (0.14 + this.energy * 0.16) * (isAccent ? 1.25 : 0.85);
      g.gain.setValueAtTime(amp, now);
      g.gain.exponentialRampToValueAtTime(0.002, now + stepDurSec * 0.92);

      osc.connect(filter).connect(g).connect(this.master);
      osc.start(now);
      osc.stop(now + stepDurSec * 0.95);

      if (this.stepIdx % 4 === 0 && onBeatCallback) onBeatCallback(this.stepIdx / 4);
      this.stepIdx++;
      this.acidTimer = setTimeout(tick, stepDurSec * 1000);
    };
    tick();
  }
}

export class PlayableWorld3D {
  constructor(canvas, audioEngine) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.audio = audioEngine;
    this.paused = false;

    this.cam = { x: 0, y: 1.75, z: 4, yaw: 0, pitch: 0, vy: 0 };
    this.stepDistance = 0;

    this.blueprint = {
      archetype: "tekno_bunker_909",
      skyColor: "#091326",
      accentColor: "#38bdf8",
      portalColor: "#34d399",
      particles: "embers",
      fogDensity: 0.32,
      ringCount: 10,
      pillarSpacing: 7.0,
      corridorLength: 84,
    };

    this.beatPulse = 0;
    this.dropFlash = 0;
    this.spectrumBars = null; // 16-bar live FFT array when Motivation Track plays!
    this.autoFly = false;
    this.sanctuaryFrame = null; // Live 360° Breath-Coherence & Spatial HRTF Orbs!

    // Private God Mode & Neo-Blick (#razz) state (inactive for all public visitors)
    this.god = {
      active: false,
      noclip: false,
      neoBlick: false,
      speedMult: 2.6,
      fov: 690,
    };
    this.fpsSmooth = 60;
    this.matrixDrops = Array.from({ length: 28 }, (_, i) => ({
      x: -13 + i * 0.96,
      y: Math.random() * 9,
      z: -6 - (i * 7) % 68,
      speed: 2.4 + (i % 5) * 0.65,
      glyph: "01RAZZNEO909303SI"[i % 17],
    }));

    this.escapePuzzle = null;
    this.escapeMask = 0;
    this.escaped = false;
    this.bannerText = "5D Triad Forge v4.0 · Walk: WASD / Touch-Stick · Sync our 180-BPM B-Minor Track in Tab 2!";
    this.nearestInteractable = null;

    this.particles = Array.from({ length: 105 }, () => ({
      x: (Math.random() - 0.5) * 22,
      y: Math.random() * 9,
      z: -Math.random() * 82,
      speed: 0.45 + Math.random() * 1.25,
    }));
  }

  applyBlueprint(bp = {}, caption = null) {
    this.blueprint = { ...this.blueprint, ...bp };
    if (caption) this.bannerText = caption;
  }

  setSpectrumFrame({ kick = 0, acid = 0, bars = null, kickTransient = false }) {
    this.spectrumBars = bars;
    this.beatPulse = Math.max(this.beatPulse, kick * 1.15 + acid * 0.45);
    if (kickTransient && kick > 0.66) {
      this.dropFlash = Math.max(this.dropFlash, 0.32);
    }
  }

  loadEscapePuzzle(puzzle, onStatusChange) {
    this.escapePuzzle = puzzle;
    this.escapeMask = 0;
    this.escaped = false;
    this.onEscapeChange = onStatusChange;
    this.cam = { x: 0, y: 1.75, z: 2, yaw: 0, pitch: 0, vy: 0 };
    this.applyBlueprint(
      puzzle.worldBlueprint,
      `[Tier ${puzzle.tier}] ${puzzle.theme.title} — ${puzzle.rooms[0].hint}`
    );
    this._notifyEscape();
  }

  clearEscapePuzzle() {
    this.escapePuzzle = null;
    this.escapeMask = 0;
    this.escaped = false;
  }

  triggerBeat(energy = 0.8, isDrop = false) {
    this.beatPulse = Math.min(1.5, 0.55 + energy * 0.75);
    if (isDrop) this.dropFlash = 1.0;
  }

  resetCamera() {
    this.cam = { x: 0, y: 1.75, z: 4, yaw: 0, pitch: 0, vy: 0 };
  }

  tryInteract() {
    if (!this.escapePuzzle || !this.nearestInteractable) {
      this.bannerText = "Move closer to a glowing pedestal or portal, then press [E] / USE.";
      return null;
    }
    const item = this.nearestInteractable;
    if (item.requiresMask && (this.escapeMask & item.requiresMask) !== item.requiresMask) {
      this.audio?.playChime("trap");
      this.bannerText = `Locked! "${item.label}" requires earlier stage alignment first.`;
      this._notifyEscape();
      return { ok: false, locked: true, item };
    }

    if (item.kind === "switch") {
      this.escapeMask |= item.flagBit;
      this.audio?.playChime("unlock");
      this.bannerText = item.effectText;
    } else if (item.kind === "decoy") {
      this.escapeMask &= ~item.resetsBit;
      this.dropFlash = 0.85;
      this.audio?.playChime("trap");
      this.bannerText = item.effectText;
    } else if (item.kind === "portal") {
      this.escaped = true;
      this.dropFlash = 1.0;
      this.audio?.playChime("portal");
      this.bannerText = `${item.effectText} (Solved cleanly!)`;
    }
    this._notifyEscape();
    return { ok: true, item, mask: this.escapeMask, escaped: this.escaped };
  }

  _notifyEscape() {
    if (!this.onEscapeChange || !this.escapePuzzle) return;
    const roomIdx = Math.min(
      this.escapePuzzle.rooms.length - 1,
      Math.max(0, Math.floor((-this.cam.z + 4) / 15))
    );
    this.onEscapeChange({
      room: this.escapePuzzle.rooms[roomIdx],
      roomIdx,
      mask: this.escapeMask,
      goalMask: this.escapePuzzle.goalMask || 15,
      escaped: this.escaped,
      nearest: this.nearestInteractable,
    });
  }

  project(wx, wy, wz) {
    const dx = wx - this.cam.x;
    const dy = wy - this.cam.y;
    const dz = wz - this.cam.z;
    const cosY = Math.cos(-this.cam.yaw);
    const sinY = Math.sin(-this.cam.yaw);
    const rx = dx * cosY - dz * sinY;
    const rz = dx * sinY + dz * cosY;
    const depth = -rz;
    if (depth < 0.25) return null;
    const fov = this.god?.active ? (this.god.fov || 690) : 690;
    return {
      sx: this.canvas.width * 0.5 + (rx / depth) * fov,
      sy: this.canvas.height * 0.52 - (dy / depth) * fov + this.cam.pitch * 260,
      depth,
      scale: fov / depth,
    };
  }

  stepOptimalEscapeNode() {
    if (!this.escapePuzzle) {
      this.bannerText = "Kein aktives Escape-Rätsel geladen – starte zuerst Tab 3 (A* Escape).";
      return null;
    }
    const gm = this.escapePuzzle.goalMask || 15;
    const nextItem = this.escapePuzzle.interactables.find((it) => {
      if (it.kind === "switch") {
        const notSet = (this.escapeMask & it.flagBit) === 0;
        const reqOk = ((this.escapeMask & (it.requiresMask || 0)) === (it.requiresMask || 0));
        return notSet && reqOk;
      }
      if (it.kind === "portal") {
        return (this.escapeMask & gm) === gm && !this.escaped;
      }
      return false;
    });
    if (!nextItem) {
      this.bannerText = "Alle A*-Runen bereits gelöst!";
      return null;
    }
    this.cam.x = nextItem.x;
    this.cam.z = nextItem.z + 1.8;
    this.nearestInteractable = nextItem;
    return this.tryInteract();
  }

  update(dt, heldKeys) {
    if (dt > 0.001) {
      this.fpsSmooth = this.fpsSmooth * 0.9 + (1 / dt) * 0.1;
    }
    const isNoclip = Boolean(this.god?.active && this.god?.noclip);
    const boost = isNoclip && heldKeys.has("shift") ? 2.15 : 1.0;
    const moveSpeed = isNoclip
      ? 8.0 * (this.god.speedMult || 2.6) * boost
      : this.autoFly
        ? 11.5
        : 7.8;
    const turnSpeed = 1.75;

    if (heldKeys.has("arrow_left")) this.cam.yaw += turnSpeed * dt;
    if (heldKeys.has("arrow_right")) this.cam.yaw -= turnSpeed * dt;

    let forward = this.autoFly && !this.escapePuzzle ? 1 : 0;
    let strafe = 0;
    if (heldKeys.has("key_w") || heldKeys.has("arrow_up")) forward = 1;
    if (heldKeys.has("key_s") || heldKeys.has("arrow_down")) forward = -1;
    if (heldKeys.has("key_a")) strafe -= 1;
    if (heldKeys.has("key_d")) strafe += 1;

    if (isNoclip) {
      if (heldKeys.has("space")) this.cam.y = Math.min(28, this.cam.y + moveSpeed * 0.65 * dt);
      if (heldKeys.has("key_q") || heldKeys.has("key_c")) {
        this.cam.y = Math.max(0.4, this.cam.y - moveSpeed * 0.65 * dt);
      }
      this.cam.vy = 0;
    } else if (heldKeys.has("space") && this.cam.y <= 1.76) {
      this.cam.vy = 4.8;
    }

    if (forward !== 0 || strafe !== 0) {
      const len = Math.hypot(forward, strafe);
      const nf = forward / len;
      const ns = strafe / len;
      const sinY = Math.sin(this.cam.yaw);
      const cosY = Math.cos(this.cam.yaw);
      this.cam.x += (-sinY * nf + cosY * ns) * moveSpeed * dt;
      this.cam.z += (-cosY * nf - sinY * ns) * moveSpeed * dt;

      if (isNoclip) {
        this.cam.x = Math.max(-32, Math.min(32, this.cam.x));
        this.cam.z = Math.max(-140, Math.min(24, this.cam.z));
      } else {
        this.cam.x = Math.max(-6.2, Math.min(6.2, this.cam.x));

        const maxLen = this.blueprint.corridorLength || 84;
        let minZ = -maxLen;
        if (this.escapePuzzle && !this.escaped) {
          const goalMask = this.escapePuzzle.goalMask || 15;
          let unlockedStages = 0;
          for (let b = 0; b < 8; b++) {
            if ((goalMask & (1 << b)) === 0) break;
            if ((this.escapeMask & (1 << b)) !== 0) unlockedStages++;
            else break;
          }
          const totalStages = Math.round(Math.log2(goalMask + 1));
          if (unlockedStages < totalStages) {
            minZ = Math.max(minZ, -(18 + unlockedStages * 15));
          }
        }

        if (this.cam.z < minZ) {
          if (!this.escapePuzzle && this.cam.z <= minZ + 0.5) {
            this.cam.z = 4;
            if (!this.autoFly) this.audio?.playChime("portal");
          } else {
            this.cam.z = minZ;
          }
        }
        this.cam.z = Math.min(8, this.cam.z);

        this.stepDistance += moveSpeed * dt;
        if (!this.autoFly && this.stepDistance >= 2.4 && this.cam.y <= 1.8) {
          this.stepDistance = 0;
          this.audio?.playFootstep("stone");
        }
      }
    }

    if (!isNoclip) {
      this.cam.y += this.cam.vy * dt;
      if (this.cam.y > 1.75) this.cam.vy -= 12.5 * dt;
      else {
        this.cam.y = 1.75;
        this.cam.vy = 0;
      }
    }

    this.beatPulse = Math.max(0, this.beatPulse - dt * 3.1);
    this.dropFlash = Math.max(0, this.dropFlash - dt * 2.1);

    this.nearestInteractable = null;
    if (this.escapePuzzle) {
      let bestDist = 5.4;
      for (const it of this.escapePuzzle.interactables) {
        const d = Math.hypot(it.x - this.cam.x, it.z - this.cam.z);
        if (d < bestDist) {
          bestDist = d;
          this.nearestInteractable = it;
        }
      }
      this._notifyEscape();
    }
  }

  render(timeSec) {
    if (this.paused) return;
    const ctx = this.ctx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    const spec = ARCHETYPE_SPECS[this.blueprint.archetype] || ARCHETYPE_SPECS.cathedral;
    const isNeo = Boolean(this.god?.active && this.god?.neoBlick);
    const skyRgb = isNeo ? [2, 9, 5] : hexToRgb(this.blueprint.skyColor, [9, 19, 38]);
    const accRgb = isNeo ? [0, 255, 136] : hexToRgb(this.blueprint.accentColor, [56, 189, 248]);
    const porRgb = isNeo ? [0, 229, 255] : hexToRgb(this.blueprint.portalColor, [52, 211, 153]);

    const horizonY = h * 0.52 + this.cam.pitch * 260;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, rgba(skyRgb, 1));
    grad.addColorStop(0.5, rgba(accRgb.map((v, i) => Math.round(v * 0.28 + skyRgb[i] * 0.72)), 1));
    grad.addColorStop(0.52, rgba([6, 10, 20], 1));
    grad.addColorStop(1, rgba([3, 5, 11], 1));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Live 16-Band FFT Horizon Equalizer when 180-BPM Motivation Track is synced!
    if (this.spectrumBars && this.spectrumBars.length === 16) {
      const barW = 28;
      const totalW = 16 * (barW + 6);
      const startX = (w - totalW) * 0.5;
      for (let i = 0; i < 16; i++) {
        const val = this.spectrumBars[i];
        const bh = Math.max(3, val * 145);
        ctx.fillStyle = rgba(i < 5 ? porRgb : accRgb, 0.28 + val * 0.55);
        ctx.fillRect(startX + i * (barW + 6), horizonY - bh, barW, bh);
      }
    }

    // Perspective Walkway Lanes
    for (const lx of [-spec.halfW, -2.5, 0, 2.5, spec.halfW]) {
      const pNear = this.project(lx, 0, this.cam.z - 0.6);
      const pFar = this.project(lx, 0, this.cam.z - 78);
      if (pNear && pFar) {
        ctx.strokeStyle = rgba(accRgb, Math.abs(lx) < 0.1 ? 0.45 : 0.22);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(pNear.sx, pNear.sy);
        ctx.lineTo(pFar.sx, pFar.sy);
        ctx.stroke();
      }
    }

    // 16-Archetype Architectural Ribs & Orrery Rings
    const spacing = this.blueprint.pillarSpacing || 7.0;
    const maxLen = this.blueprint.corridorLength || 84;
    const firstSlice = Math.floor(maxLen / spacing);

    for (let s = firstSlice; s >= 0; s--) {
      const wz = -s * spacing;
      const dist = Math.abs(wz - this.cam.z);
      if (dist > 80 || wz > this.cam.z - 0.3) continue;

      const fogAlpha = Math.max(0.06, 1 - (dist / 80) * (0.52 + (this.blueprint.fogDensity || 0.32)));
      const pulseBoost = 1 + this.beatPulse * 0.19 * Math.sin(s * 0.8 + timeSec * 6);
      const hw = spec.halfW * pulseBoost;
      const ah = spec.archH * pulseBoost;

      const bl = this.project(-hw, 0, wz);
      const br = this.project(hw, 0, wz);
      const tl = this.project(-hw, ah, wz);
      const tr = this.project(hw, ah, wz);
      const apex = this.project(0, ah + spec.roofPeak, wz);

      if (bl && br && tl && tr) {
        ctx.strokeStyle = rgba(accRgb, fogAlpha * 0.68);
        ctx.lineWidth = Math.max(1, 2.7 - dist * 0.025);
        ctx.beginPath();
        ctx.moveTo(bl.sx, bl.sy);
        if (spec.ribs === "diamond") {
          const midL = this.project(-hw * 1.25, ah * 0.5, wz);
          const midR = this.project(hw * 1.25, ah * 0.5, wz);
          if (midL && midR && apex) {
            ctx.lineTo(midL.sx, midL.sy);
            ctx.lineTo(apex.sx, apex.sy);
            ctx.lineTo(midR.sx, midR.sy);
          }
        } else if (spec.ribs === "bunker") {
          const inL = this.project(-hw * 0.72, ah, wz);
          const inR = this.project(hw * 0.72, ah, wz);
          ctx.lineTo(tl.sx, tl.sy);
          if (inL && inR) {
            ctx.lineTo(inL.sx, inL.sy + 8);
            ctx.lineTo(inR.sx, inR.sy + 8);
          }
          ctx.lineTo(tr.sx, tr.sy);
        } else {
          ctx.lineTo(tl.sx, tl.sy);
          if (apex && spec.roofPeak > 0.1) ctx.lineTo(apex.sx, apex.sy);
          ctx.lineTo(tr.sx, tr.sy);
        }
        ctx.lineTo(br.sx, br.sy);
        ctx.stroke();

        ctx.strokeStyle = rgba(porRgb, fogAlpha * 0.24);
        ctx.beginPath();
        ctx.moveTo(bl.sx, bl.sy);
        ctx.lineTo(br.sx, br.sy);
        ctx.stroke();
      }

      if (spec.rings && s % 2 === 0) {
        const center = this.project(0, 3.2, wz);
        if (center) {
          const radiusPx = center.scale * (2.6 + this.beatPulse * 0.65);
          const rot = timeSec * (s % 4 === 0 ? 1.25 : -1.25);
          ctx.save();
          ctx.translate(center.sx, center.sy);
          ctx.rotate(rot);
          ctx.strokeStyle = rgba(porRgb, fogAlpha * 0.58);
          ctx.lineWidth = Math.max(1, center.scale * 0.065);
          ctx.beginPath();
          ctx.ellipse(0, 0, radiusPx, radiusPx * 0.44, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // Sovereign Exit Portal
    const portalZ = this.escapePuzzle ? -(maxLen - 8) : -maxLen + 3;
    const pCenter = this.project(0, 2.4, portalZ);
    if (pCenter) {
      const gm = this.escapePuzzle?.goalMask || 15;
      const unlocked = !this.escapePuzzle || (this.escapeMask & gm) === gm;
      const rPx = pCenter.scale * (unlocked ? 2.8 + this.beatPulse * 0.5 : 1.7);
      const pGrad = ctx.createRadialGradient(pCenter.sx, pCenter.sy, rPx * 0.1, pCenter.sx, pCenter.sy, rPx);
      pGrad.addColorStop(0, unlocked ? "rgba(255,255,255,0.96)" : "rgba(148,163,184,0.35)");
      pGrad.addColorStop(0.45, rgba(unlocked ? porRgb : [100, 116, 139], unlocked ? 0.74 : 0.25));
      pGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(pCenter.sx, pCenter.sy, rPx, 0, Math.PI * 2);
      ctx.fill();
    }

    // Escape Room Interactive Props
    if (this.escapePuzzle) {
      for (const item of this.escapePuzzle.interactables) {
        if (item.kind === "portal") continue;
        const base = this.project(item.x, 0, item.z);
        const orb = this.project(item.x, 1.45 + Math.sin(timeSec * 3 + item.z) * 0.14, item.z);
        if (!base || !orb) continue;
        const active = item.flagBit && (this.escapeMask & item.flagBit) !== 0;
        const color = item.kind === "decoy" ? [244, 63, 94] : active ? [52, 211, 153] : [251, 191, 36];

        ctx.strokeStyle = rgba(color, 0.85);
        ctx.lineWidth = Math.max(1.5, base.scale * 0.08);
        ctx.beginPath();
        ctx.moveTo(base.sx, base.sy);
        ctx.lineTo(orb.sx, orb.sy);
        ctx.stroke();

        ctx.fillStyle = rgba(color, 0.92);
        ctx.beginPath();
        ctx.arc(orb.sx, orb.sy, Math.max(4, orb.scale * 0.26), 0, Math.PI * 2);
        ctx.fill();

        if (orb.depth < 18) {
          ctx.fillStyle = "#f8fafc";
          ctx.font = "600 13px Inter, Segoe UI, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(`${item.label}${active ? " [ON]" : ""}`, orb.sx, orb.sy - Math.max(10, orb.scale * 0.36));
          ctx.textAlign = "start";
        }
      }
    }

    // Weather Particles
    const pKind = this.blueprint.particles || "embers";
    for (const p of this.particles) {
      if (pKind === "rain") {
        p.y -= 0.24 * p.speed;
        if (p.y < 0) p.y = 9;
      } else if (pKind === "snow") {
        p.y -= 0.05 * p.speed;
        if (p.y < 0) p.y = 9;
      } else {
        p.y += Math.sin(timeSec * 1.8 + p.x) * 0.015;
      }
      let relZ = p.z;
      while (relZ > this.cam.z - 1) relZ -= 68;
      while (relZ < this.cam.z - 69) relZ += 68;
      const proj = this.project(p.x, p.y, relZ);
      if (!proj) continue;
      if (pKind === "rain") {
        ctx.strokeStyle = "rgba(186, 230, 253, 0.44)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(proj.sx, proj.sy);
        ctx.lineTo(proj.sx - 2, proj.sy + Math.min(22, proj.scale * 0.35));
        ctx.stroke();
      } else {
        ctx.fillStyle = pKind === "embers" ? "rgba(251, 146, 60, 0.76)" : "rgba(167, 243, 208, 0.74)";
        ctx.beginPath();
        ctx.arc(proj.sx, proj.sy, Math.max(1.3, Math.min(5.5, proj.scale * 0.065)), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    if (this.dropFlash > 0.01) {
      ctx.fillStyle = rgba(porRgb, this.dropFlash * 0.3);
      ctx.fillRect(0, 0, w, h);
    }

    // 360° Spatial Sound-Sanctuary Breath-Coherence Halo & Orbiting HRTF Sound Orbs
    if (this.sanctuaryFrame?.active) {
      const sf = this.sanctuaryFrame;
      ctx.save();
      for (const op of sf.orbPositions || []) {
        const proj = this.project(op.x, op.y, op.z);
        if (proj) {
          const r = Math.max(8, Math.min(42, proj.scale * 0.32));
          const og = ctx.createRadialGradient(proj.sx, proj.sy, r * 0.1, proj.sx, proj.sy, r);
          og.addColorStop(0, "rgba(255, 255, 255, 0.92)");
          og.addColorStop(0.45, "rgba(45, 212, 191, 0.62)");
          og.addColorStop(1, "rgba(45, 212, 191, 0)");
          ctx.fillStyle = og;
          ctx.beginPath();
          ctx.arc(proj.sx, proj.sy, r, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      const breathR = 44 + sf.progress * 58;
      const cx = w * 0.5;
      const cy = horizonY - 12;
      const halo = ctx.createRadialGradient(cx, cy, breathR * 0.25, cx, cy, breathR * 1.35);
      halo.addColorStop(0, "rgba(45, 212, 191, 0.26)");
      halo.addColorStop(0.65, "rgba(56, 189, 248, 0.12)");
      halo.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, breathR * 1.35, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(167, 243, 208, 0.78)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(cx, cy, breathR, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = "#ecfdf5";
      ctx.font = "600 14px Inter, Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`🌿 ${sf.phaseName}`, cx, cy + 5);
      ctx.textAlign = "start";
      ctx.restore();
    }

    // NEO-BLICK (#razz) Matrix Code-Rain & A* Escape X-Ray Overlay (Private God Mode only)
    if (isNeo) {
      ctx.save();
      ctx.font = "700 12px ui-monospace, SFMono-Regular, Consolas, monospace";
      for (const drop of this.matrixDrops) {
        drop.y -= 0.045 * drop.speed;
        if (drop.y < 0.2) drop.y = 9.2;
        let dz = drop.z;
        while (dz > this.cam.z - 1) dz -= 66;
        while (dz < this.cam.z - 67) dz += 66;
        const pt = this.project(drop.x, drop.y, dz);
        if (pt) {
          ctx.fillStyle = "rgba(0, 255, 136, 0.58)";
          ctx.fillText(drop.glyph, pt.sx, pt.sy);
        }
      }

      if (this.escapePuzzle) {
        const gm = this.escapePuzzle.goalMask || 15;
        for (const it of this.escapePuzzle.interactables) {
          const orb = this.project(it.x, it.kind === "portal" ? 2.4 : 1.6, it.z);
          if (!orb) continue;
          const distM = Math.hypot(it.x - this.cam.x, it.z - this.cam.z).toFixed(1);
          if (it.kind === "decoy") {
            ctx.strokeStyle = "rgba(244, 63, 94, 0.9)";
            ctx.strokeRect(orb.sx - 18, orb.sy - 18, 36, 36);
            ctx.fillStyle = "#fda4af";
            ctx.fillText(`[TRAP · ${distM}m]`, orb.sx - 44, orb.sy + 30);
          } else {
            const isNext =
              (it.kind === "switch" &&
                (this.escapeMask & it.flagBit) === 0 &&
                (this.escapeMask & (it.requiresMask || 0)) === (it.requiresMask || 0)) ||
              (it.kind === "portal" && (this.escapeMask & gm) === gm && !this.escaped);
            if (isNext) {
              ctx.strokeStyle = "rgba(0, 255, 136, 0.92)";
              ctx.lineWidth = 2.2;
              ctx.beginPath();
              ctx.moveTo(w * 0.5, h - 92);
              ctx.lineTo(orb.sx, orb.sy);
              ctx.stroke();
              ctx.strokeRect(orb.sx - 22, orb.sy - 22, 44, 44);
              ctx.fillStyle = "#6ee7b7";
              ctx.fillText(`⚡ NEXT A* NODE (${distM}m)`, orb.sx - 68, orb.sy - 28);
            }
          }
        }
      }

      ctx.fillStyle = "rgba(2, 16, 10, 0.86)";
      ctx.fillRect(w * 0.5 - 275, 46, 550, 26);
      ctx.strokeStyle = "rgba(0, 255, 136, 0.65)";
      ctx.strokeRect(w * 0.5 - 275, 46, 550, 26);
      ctx.fillStyle = "#6ee7b7";
      ctx.textAlign = "center";
      ctx.fillText(
        `👁 NEO-BLICK #RAZZ · POS(${this.cam.x.toFixed(1)}, ${this.cam.y.toFixed(1)}, ${this.cam.z.toFixed(1)}) · FOV:${this.god.fov} · ${Math.round(this.fpsSmooth)} FPS · ${this.god.noclip ? "NOCLIP 0G" : "WALK 1G"}`,
        w * 0.5,
        63
      );
      ctx.textAlign = "start";
      ctx.restore();
    }

    if (this.nearestInteractable) {
      ctx.fillStyle = "rgba(5, 10, 20, 0.86)";
      ctx.fillRect(w * 0.5 - 210, horizonY + 34, 420, 34);
      ctx.strokeStyle = "#34d399";
      ctx.strokeRect(w * 0.5 - 210, horizonY + 34, 420, 34);
      ctx.fillStyle = "#ecfdf5";
      ctx.font = "600 14px Inter, Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Press [E] / USE — ${this.nearestInteractable.label}`, w * 0.5, horizonY + 56);
      ctx.textAlign = "start";
    }

    ctx.fillStyle = "rgba(6, 10, 19, 0.78)";
    ctx.fillRect(28, h - 90, w - 56, 40);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "600 15px Inter, Segoe UI, sans-serif";
    ctx.fillText(String(this.bannerText || "").slice(0, 122), 42, h - 65);
  }

  captureReferenceJpegUnder40KB() {
    const off = document.createElement("canvas");
    off.width = 640;
    off.height = 360;
    off.getContext("2d").drawImage(this.canvas, 0, 0, 640, 360);
    let q = 0.76;
    let dataUrl = off.toDataURL("image/jpeg", q);
    while (dataUrl.length > 50_000 && q > 0.3) {
      q -= 0.1;
      dataUrl = off.toDataURL("image/jpeg", q);
    }
    const rawBase64 = dataUrl.split(",")[1];
    return {
      mime_type: "image/jpeg",
      data: rawBase64,
      rawBytes: Math.floor((rawBase64.length * 3) / 4),
    };
  }
}
