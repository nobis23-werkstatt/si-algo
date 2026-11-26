// Zero-Cost ($0.00/s) Playable 3D Perspective World Engine + Procedural Foley & Acid-303 Synth.
// Renders architectural archetypes (cathedral, library, canyon, spire), kinetic Orrery rings,
// weather particles, beat-reactive World-Jockey geometry, and interactive Escape Room props (WASD + E + Space).

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

export class ProceduralAudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.acidRunning = false;
    this.acidTimer = null;
    this.stepIdx = 0;
    this.bpm = 138;
    this.cutoff = 0.62;
    this.energy = 0.75;
  }

  _init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    // Safe -12 dBFS limiter gain (ear protection rule!)
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
  }

  playFootstep(surface = "stone") {
    if (!this.enabled) return;
    this._init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = surface === "metal" ? "triangle" : "sine";
    osc.frequency.setValueAtTime(surface === "metal" ? 195 : 115, now);
    osc.frequency.exponentialRampToValueAtTime(42, now + 0.055);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    osc.connect(gain).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.065);
  }

  playChime(kind = "unlock") {
    if (!this.enabled) return;
    this._init();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const freqs =
      kind === "trap"
        ? [180, 135]
        : kind === "portal"
          ? [440, 554.37, 659.25, 880]
          : [523.25, 659.25, 783.99];
    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = kind === "trap" ? "sawtooth" : "triangle";
      osc.frequency.setValueAtTime(f, now + idx * 0.06);
      g.gain.setValueAtTime(0.16, now + idx * 0.06);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.32);
      osc.connect(g).connect(this.master);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.34);
    });
  }

  setJockeyParams({ bpm, cutoff, energy }) {
    if (typeof bpm === "number") this.bpm = Math.max(70, Math.min(200, bpm));
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

    // Classic minor/Phrygian 303 pattern in Hz (A1/A2/Bb2/E2/G2)
    const notes = [55, 55, 110, 55, 58.27, 82.41, 55, 98.0];
    const accents = [1, 0, 1, 0, 0, 1, 0, 1];

    const tick = () => {
      if (!this.acidRunning || !this.ctx) return;
      const stepDurSec = 60 / this.bpm / 4; // 16th notes
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
      filter.Q.value = 6 + this.energy * 10;
      const baseCut = 140 + this.cutoff * 2200 + (isAccent ? 900 : 0);
      filter.frequency.setValueAtTime(baseCut, now);
      filter.frequency.exponentialRampToValueAtTime(95, now + stepDurSec * 0.88);

      const amp = (0.14 + this.energy * 0.16) * (isAccent ? 1.25 : 0.85);
      g.gain.setValueAtTime(amp, now);
      g.gain.exponentialRampToValueAtTime(0.002, now + stepDurSec * 0.92);

      osc.connect(filter).connect(g).connect(this.master);
      osc.start(now);
      osc.stop(now + stepDurSec * 0.95);

      if (this.stepIdx % 4 === 0 && onBeatCallback) {
        onBeatCallback(this.stepIdx / 4);
      }
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

    // First-person camera state
    this.cam = { x: 0, y: 1.75, z: 4, yaw: 0, pitch: 0, vy: 0 };
    this.stepDistance = 0;

    // World Blueprint
    this.blueprint = {
      archetype: "cathedral",
      skyColor: "#091326",
      accentColor: "#38bdf8",
      portalColor: "#34d399",
      particles: "embers",
      fogDensity: 0.33,
      ringCount: 8,
      pillarSpacing: 7.5,
      corridorLength: 80,
    };

    // Beat / World-Jockey modulation
    this.beatPulse = 0;
    this.dropFlash = 0;
    this.jockeyEnergy = 0.65;
    this.jockeyCutoff = 0.6;

    // Escape Room state
    this.escapePuzzle = null;
    this.escapeMask = 0;
    this.escaped = false;
    this.bannerText = "0€ Playable 3D Twin · Walk with WASD / Arrows · Jump: Space · Interact: E";
    this.nearestInteractable = null;

    this.particles = Array.from({ length: 95 }, () => ({
      x: (Math.random() - 0.5) * 22,
      y: Math.random() * 9,
      z: -Math.random() * 80,
      speed: 0.4 + Math.random() * 1.2,
    }));
  }

  applyBlueprint(bp = {}, caption = null) {
    this.blueprint = { ...this.blueprint, ...bp };
    if (caption) this.bannerText = caption;
  }

  loadEscapePuzzle(puzzle, onStatusChange) {
    this.escapePuzzle = puzzle;
    this.escapeMask = 0;
    this.escaped = false;
    this.onEscapeChange = onStatusChange;
    this.cam = { x: 0, y: 1.75, z: 2, yaw: 0, pitch: 0, vy: 0 };
    this.applyBlueprint(
      puzzle.worldBlueprint,
      `Escape Room: ${puzzle.theme.title} — ${puzzle.rooms[0].hint}`
    );
    this._notifyEscape();
  }

  clearEscapePuzzle() {
    this.escapePuzzle = null;
    this.escapeMask = 0;
    this.escaped = false;
  }

  triggerBeat(energy = 0.8, isDrop = false) {
    this.beatPulse = Math.min(1.4, 0.55 + energy * 0.7);
    if (isDrop) this.dropFlash = 1.0;
  }

  resetCamera() {
    this.cam = { x: 0, y: 1.75, z: 4, yaw: 0, pitch: 0, vy: 0 };
  }

  tryInteract() {
    if (!this.escapePuzzle || !this.nearestInteractable) {
      this.bannerText = "Moved closer to an interactive pedestal or portal, then press [E].";
      return null;
    }
    const item = this.nearestInteractable;
    if (item.requiresMask && (this.escapeMask & item.requiresMask) !== item.requiresMask) {
      this.audio?.playChime("trap");
      this.bannerText = `Locked! "${item.label}" requires an earlier prism/counterweight first.`;
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
      this.escapeMask |= 32;
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
      Math.max(0, Math.floor((-this.cam.z + 4) / 17))
    );
    this.onEscapeChange({
      room: this.escapePuzzle.rooms[roomIdx],
      roomIdx,
      mask: this.escapeMask,
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

    // Camera looks down -Z
    const depth = -rz;
    if (depth < 0.25) return null;

    const fov = 690;
    const sx = this.canvas.width * 0.5 + (rx / depth) * fov;
    const sy = this.canvas.height * 0.52 - (dy / depth) * fov + this.cam.pitch * 260;
    return { sx, sy, depth, scale: fov / depth };
  }

  update(dt, heldKeys) {
    const moveSpeed = 7.4;
    const turnSpeed = 1.75;

    if (heldKeys.has("arrow_left")) this.cam.yaw += turnSpeed * dt;
    if (heldKeys.has("arrow_right")) this.cam.yaw -= turnSpeed * dt;

    let forward = 0;
    let strafe = 0;
    if (heldKeys.has("key_w") || heldKeys.has("arrow_up")) forward += 1;
    if (heldKeys.has("key_s") || heldKeys.has("arrow_down")) forward -= 1;
    if (heldKeys.has("key_a")) strafe -= 1;
    if (heldKeys.has("key_d")) strafe += 1;

    if (heldKeys.has("space") && this.cam.y <= 1.76) {
      this.cam.vy = 4.6;
    }

    // Apply movement along camera yaw (-Z is yaw=0)
    if (forward !== 0 || strafe !== 0) {
      const len = Math.hypot(forward, strafe);
      const nf = forward / len;
      const ns = strafe / len;
      const sinY = Math.sin(this.cam.yaw);
      const cosY = Math.cos(this.cam.yaw);
      this.cam.x += (-sinY * nf + cosY * ns) * moveSpeed * dt;
      this.cam.z += (-cosY * nf - sinY * ns) * moveSpeed * dt;
      this.cam.x = Math.max(-6.2, Math.min(6.2, this.cam.x));

      // Escape room gate barrier if locked (4 required switches: bits 1, 2, 4, 8)
      let minZ = -(this.blueprint.corridorLength || 86);
      if (this.escapePuzzle && !this.escaped) {
        if ((this.escapeMask & 1) === 0) minZ = Math.max(minZ, -20);
        else if ((this.escapeMask & 2) === 0) minZ = Math.max(minZ, -36);
        else if ((this.escapeMask & 4) === 0) minZ = Math.max(minZ, -50);
        else if ((this.escapeMask & 8) === 0) minZ = Math.max(minZ, -68);
      }
      if (this.cam.z < minZ) {
        if (!this.escapePuzzle && this.cam.z <= minZ + 0.5) {
          // Endless loop portal wrap!
          this.cam.z = 4;
          this.dropFlash = 0.6;
          this.audio?.playChime("portal");
        } else {
          this.cam.z = minZ;
        }
      }
      this.cam.z = Math.min(8, this.cam.z);

      this.stepDistance += moveSpeed * dt;
      if (this.stepDistance >= 2.35 && this.cam.y <= 1.8) {
        this.stepDistance = 0;
        this.audio?.playFootstep(this.blueprint.archetype === "spire" ? "metal" : "stone");
      }
    }

    // Gravity
    this.cam.y += this.cam.vy * dt;
    if (this.cam.y > 1.75) {
      this.cam.vy -= 12.5 * dt;
    } else {
      this.cam.y = 1.75;
      this.cam.vy = 0;
    }

    this.beatPulse = Math.max(0, this.beatPulse - dt * 2.8);
    this.dropFlash = Math.max(0, this.dropFlash - dt * 1.9);

    // Nearest interactable check
    this.nearestInteractable = null;
    if (this.escapePuzzle) {
      let bestDist = 5.2;
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

    const skyRgb = hexToRgb(this.blueprint.skyColor, [9, 19, 38]);
    const accRgb = hexToRgb(this.blueprint.accentColor, [56, 189, 248]);
    const porRgb = hexToRgb(this.blueprint.portalColor, [52, 211, 153]);

    // 1. Sky & Reflective Floor Gradient
    const horizonY = h * 0.52 + this.cam.pitch * 260;
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, rgba(skyRgb, 1));
    grad.addColorStop(0.5, rgba(accRgb.map((v, i) => Math.round(v * 0.25 + skyRgb[i] * 0.75)), 1));
    grad.addColorStop(0.52, rgba([6, 10, 20], 1));
    grad.addColorStop(1, rgba([3, 5, 11], 1));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);

    // Subtle walkway perspective lanes
    const lanes = [-5.5, -2.6, 0, 2.6, 5.5];
    ctx.lineWidth = 1.4;
    for (const lx of lanes) {
      const pNear = this.project(lx, 0, this.cam.z - 0.6);
      const pFar = this.project(lx, 0, this.cam.z - 75);
      if (pNear && pFar) {
        ctx.strokeStyle = rgba(accRgb, Math.abs(lx) < 0.1 ? 0.42 : 0.2);
        ctx.beginPath();
        ctx.moveTo(pNear.sx, pNear.sy);
        ctx.lineTo(pFar.sx, pFar.sy);
        ctx.stroke();
      }
    }

    // 2. Architectural Pillars / Arches / Kinetic Orrery Rings (Painter's algorithm back-to-front)
    const spacing = this.blueprint.pillarSpacing || 7.5;
    const maxLen = this.blueprint.corridorLength || 80;
    const firstSlice = Math.floor(maxLen / spacing);

    for (let s = firstSlice; s >= 0; s--) {
      const wz = -s * spacing;
      const dist = Math.abs(wz - this.cam.z);
      if (dist > 78 || wz > this.cam.z - 0.3) continue;

      const fogAlpha = Math.max(0.06, 1 - (dist / 78) * (0.55 + (this.blueprint.fogDensity || 0.33)));
      const pulseBoost = 1 + this.beatPulse * 0.18 * Math.sin(s + timeSec * 4);
      const halfW = (this.blueprint.archetype === "canyon" ? 6.4 : 5.2) * pulseBoost;
      const archH = (this.blueprint.archetype === "spire" ? 6.8 : 5.4) * pulseBoost;

      const bl = this.project(-halfW, 0, wz);
      const br = this.project(halfW, 0, wz);
      const tl = this.project(-halfW, archH, wz);
      const tr = this.project(halfW, archH, wz);
      const apex = this.project(0, archH + 1.8, wz);

      if (bl && br && tl && tr) {
        ctx.strokeStyle = rgba(accRgb, fogAlpha * 0.65);
        ctx.lineWidth = Math.max(1, 2.6 - dist * 0.025);
        ctx.beginPath();
        ctx.moveTo(bl.sx, bl.sy);
        ctx.lineTo(tl.sx, tl.sy);
        if (apex && this.blueprint.archetype !== "library") {
          ctx.lineTo(apex.sx, apex.sy);
        }
        ctx.lineTo(tr.sx, tr.sy);
        ctx.lineTo(br.sx, br.sy);
        ctx.stroke();

        // Floor crossbeam
        ctx.strokeStyle = rgba(porRgb, fogAlpha * 0.22);
        ctx.beginPath();
        ctx.moveTo(bl.sx, bl.sy);
        ctx.lineTo(br.sx, br.sy);
        ctx.stroke();
      }

      // Rotating Kinetic Orrery Ring every 2nd bay
      if (s % 2 === 0) {
        const center = this.project(0, 3.2, wz);
        if (center) {
          const radiusPx = center.scale * (2.6 + this.beatPulse * 0.55);
          const rot = timeSec * (s % 4 === 0 ? 0.9 : -0.9);
          ctx.save();
          ctx.translate(center.sx, center.sy);
          ctx.rotate(rot);
          ctx.strokeStyle = rgba(porRgb, fogAlpha * 0.55);
          ctx.lineWidth = Math.max(1, center.scale * 0.06);
          ctx.beginPath();
          ctx.ellipse(0, 0, radiusPx, radiusPx * 0.42, 0, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }

    // 3. Distant / Exit Sovereign Portal
    const portalZ = this.escapePuzzle ? -76 : -maxLen + 3;
    const pCenter = this.project(0, 2.4, portalZ);
    if (pCenter) {
      const unlocked = !this.escapePuzzle || (this.escapeMask & 15) === 15;
      const rPx = pCenter.scale * (unlocked ? 2.7 + Math.sin(timeSec * 4) * 0.2 : 1.7);
      const pGrad = ctx.createRadialGradient(
        pCenter.sx,
        pCenter.sy,
        rPx * 0.1,
        pCenter.sx,
        pCenter.sy,
        rPx
      );
      pGrad.addColorStop(0, unlocked ? "rgba(255,255,255,0.95)" : "rgba(148,163,184,0.35)");
      pGrad.addColorStop(0.45, rgba(unlocked ? porRgb : [100, 116, 139], unlocked ? 0.72 : 0.25));
      pGrad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = pGrad;
      ctx.beginPath();
      ctx.arc(pCenter.sx, pCenter.sy, rPx, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Escape Room Interactive Pedestals & Barriers
    if (this.escapePuzzle) {
      for (const item of this.escapePuzzle.interactables) {
        if (item.kind === "portal") continue;
        const base = this.project(item.x, 0, item.z);
        const orb = this.project(item.x, 1.45 + Math.sin(timeSec * 3 + item.z) * 0.14, item.z);
        if (!base || !orb) continue;

        const active = item.flagBit && (this.escapeMask & item.flagBit) !== 0;
        const color =
          item.kind === "decoy"
            ? [244, 63, 94]
            : active
              ? [52, 211, 153]
              : [251, 191, 36];

        ctx.strokeStyle = rgba(color, 0.85);
        ctx.lineWidth = Math.max(1.5, base.scale * 0.08);
        ctx.beginPath();
        ctx.moveTo(base.sx, base.sy);
        ctx.lineTo(orb.sx, orb.sy);
        ctx.stroke();

        ctx.fillStyle = rgba(color, 0.9);
        ctx.beginPath();
        ctx.arc(orb.sx, orb.sy, Math.max(4, orb.scale * 0.26), 0, Math.PI * 2);
        ctx.fill();

        if (orb.depth < 18) {
          ctx.fillStyle = "#f8fafc";
          ctx.font = "600 13px Inter, Segoe UI, sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            `${item.label}${active ? " [ON]" : ""}`,
            orb.sx,
            orb.sy - Math.max(10, orb.scale * 0.36)
          );
          ctx.textAlign = "start";
        }
      }
    }

    // 5. Weather / Atmospheric 3D Particles
    const pKind = this.blueprint.particles || "embers";
    for (const p of this.particles) {
      if (pKind === "rain") {
        p.y -= 0.22 * p.speed;
        if (p.y < 0) p.y = 9;
      } else if (pKind === "snow") {
        p.y -= 0.05 * p.speed;
        p.x += Math.sin(timeSec + p.z) * 0.01;
        if (p.y < 0) p.y = 9;
      } else {
        p.y += Math.sin(timeSec * 1.5 + p.x) * 0.012;
      }
      // Keep particles wrapped near player Z
      let relZ = p.z;
      while (relZ > this.cam.z - 1) relZ -= 65;
      while (relZ < this.cam.z - 66) relZ += 65;

      const proj = this.project(p.x, p.y, relZ);
      if (!proj) continue;
      if (pKind === "rain") {
        ctx.strokeStyle = "rgba(186, 230, 253, 0.42)";
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(proj.sx, proj.sy);
        ctx.lineTo(proj.sx - 2, proj.sy + Math.min(22, proj.scale * 0.35));
        ctx.stroke();
      } else {
        ctx.fillStyle =
          pKind === "embers" ? "rgba(251, 146, 60, 0.72)" : "rgba(167, 243, 208, 0.72)";
        ctx.beginPath();
        ctx.arc(proj.sx, proj.sy, Math.max(1.3, Math.min(5, proj.scale * 0.06)), 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 6. Drop Flash & Interaction Reticle
    if (this.dropFlash > 0.01) {
      ctx.fillStyle = rgba(porRgb, this.dropFlash * 0.28);
      ctx.fillRect(0, 0, w, h);
    }

    if (this.nearestInteractable) {
      ctx.fillStyle = "rgba(5, 10, 20, 0.85)";
      ctx.fillRect(w * 0.5 - 210, horizonY + 34, 420, 34);
      ctx.strokeStyle = "#34d399";
      ctx.strokeRect(w * 0.5 - 210, horizonY + 34, 420, 34);
      ctx.fillStyle = "#ecfdf5";
      ctx.font = "600 14px Inter, Segoe UI, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Press [E] — ${this.nearestInteractable.label}`, w * 0.5, horizonY + 56);
      ctx.textAlign = "start";
    }

    // Bottom Subtitle Banner
    ctx.fillStyle = "rgba(6, 10, 19, 0.78)";
    ctx.fillRect(28, h - 92, w - 56, 42);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "600 16px Inter, Segoe UI, sans-serif";
    ctx.fillText(String(this.bannerText || "").slice(0, 118), 44, h - 65);
  }

  /**
   * Captures the current 0-€ 3D camera frame as a < 40 KB 16:9 JPEG (640x360)
   * so Genie 4 starts from the EXACT composition and color palette of your 3D world!
   */
  captureReferenceJpegUnder40KB() {
    const off = document.createElement("canvas");
    off.width = 640;
    off.height = 360;
    const octx = off.getContext("2d");
    octx.drawImage(this.canvas, 0, 0, off.width, off.height);

    let quality = 0.76;
    let dataUrl = off.toDataURL("image/jpeg", quality);
    while (dataUrl.length > 50_000 && quality > 0.3) {
      quality -= 0.1;
      dataUrl = off.toDataURL("image/jpeg", quality);
    }
    const rawBase64 = dataUrl.split(",")[1];
    return {
      mime_type: "image/jpeg",
      data: rawBase64,
      rawBytes: Math.floor((rawBase64.length * 3) / 4),
    };
  }
}
