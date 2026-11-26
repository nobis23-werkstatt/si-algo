// Real-Time WebAudio FFT & Arrangement Cue Synchronizer for Paul's 180.00 BPM B-Minor Track!
// Analyzes Sub-Kick (40-110 Hz), Bodyravv Offbeat Bass (115-260 Hz), 303 Acid Screamer (320-2800 Hz),
// and 909 Hats (5-14 kHz) at 60 fps, while firing exact arrangement morphs across all 5:04 minutes!

export const MOTIVATION_TRACK_CUES = [
  {
    atSec: 0,
    id: "intro_drive",
    label: "00:00 · Intro: NEU Kick + Bodyravv Sub (180 BPM B-Min)",
    blueprint: { archetype: "tekno_bunker_909", skyColor: "#080612", accentColor: "#38bdf8", portalColor: "#34d399", particles: "mist", fogDensity: 0.34 },
  },
  {
    atSec: 42.5,
    id: "drop_909_hats",
    label: "00:43 · DROP I: 909 Core Kit + Industrial Sweep",
    drop: true,
    blueprint: { archetype: "gravity_colosseum", skyColor: "#14081c", accentColor: "#ff6a1a", portalColor: "#38bdf8", particles: "embers", fogDensity: 0.28 },
  },
  {
    atSec: 84.5,
    id: "percussion_storm",
    label: "01:25 · Rolling 16th Percussion & Tom Drive",
    drop: true,
    blueprint: { archetype: "obsidian_vault", skyColor: "#12091f", accentColor: "#f43f5e", portalColor: "#fbbf24", particles: "embers", fogDensity: 0.31 },
  },
  {
    atSec: 106.8,
    id: "acid_303_awakens",
    label: "01:47 · 303 Acid Ladder Opens (B-Minor)",
    drop: true,
    blueprint: { archetype: "acid_reactor_bmin", skyColor: "#061a12", accentColor: "#32d7c8", portalColor: "#a8e05f", particles: "fireflies", fogDensity: 0.26 },
  },
  {
    atSec: 123.0,
    id: "acid_high_screamer",
    label: "02:03 · High-Octave 303 Screamer Escalation!",
    drop: true,
    blueprint: { archetype: "quantum_lattice", skyColor: "#0c122e", accentColor: "#c084fc", portalColor: "#ffd60a", particles: "embers", fogDensity: 0.22 },
  },
  {
    atSec: 171.5,
    id: "hall_breakdown",
    label: "02:52 · Breakdown: Reverberant B-Minor Metallic Stabs",
    drop: false,
    blueprint: { archetype: "ice_citadel", skyColor: "#050d1a", accentColor: "#7dd3fc", portalColor: "#bf5af2", particles: "snow", fogDensity: 0.45 },
  },
  {
    atSec: 212.8,
    id: "main_peak_drop",
    label: "03:33 · MAIN PEAK DROP: Full 180-BPM Tekno Wall!",
    drop: true,
    blueprint: { archetype: "orbital_ring", skyColor: "#1a0714", accentColor: "#ff453a", portalColor: "#32d7c8", particles: "embers", fogDensity: 0.24 },
  },
  {
    atSec: 255.0,
    id: "industrial_climax",
    label: "04:15 · Industrial Ride & Acid Climax!",
    drop: true,
    blueprint: { archetype: "sovereign_citadel", skyColor: "#120a28", accentColor: "#ffd60a", portalColor: "#ff453a", particles: "embers", fogDensity: 0.22 },
  },
  {
    atSec: 277.5,
    id: "outro_filter",
    label: "04:38 · Outro: Sub-Pulse Decay",
    drop: false,
    blueprint: { archetype: "tekno_bunker_909", skyColor: "#070913", accentColor: "#38bdf8", portalColor: "#c084fc", particles: "fireflies", fogDensity: 0.36 },
  },
];

export class MotivationTrackSync {
  constructor(audioEl, { onCueChange, onFrameSpectrum } = {}) {
    this.audioEl = audioEl;
    this.onCueChange = onCueChange;
    this.onFrameSpectrum = onFrameSpectrum;
    this.ctx = null;
    this.analyser = null;
    this.freqData = null;
    this.sourceNode = null;
    this.lastCueId = null;
    this.prevKickEnergy = 0;
    this.rafId = null;
  }

  _ensureGraph() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    this.ctx = new AudioCtx();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 1024;
    this.analyser.smoothingTimeConstant = 0.72;
    this.freqData = new Uint8Array(this.analyser.frequencyBinCount);

    this.sourceNode = this.ctx.createMediaElementSource(this.audioEl);
    this.sourceNode.connect(this.analyser);
    this.analyser.connect(this.ctx.destination);
  }

  async togglePlay() {
    this._ensureGraph();
    if (this.audioEl.paused) {
      await this.audioEl.play();
      this._startLoop();
      return true;
    } else {
      this.audioEl.pause();
      this._stopLoop();
      return false;
    }
  }

  _bandAverage(minHz, maxHz) {
    if (!this.analyser || !this.freqData || !this.ctx) return 0;
    const nyquist = this.ctx.sampleRate / 2;
    const binCount = this.freqData.length;
    const i0 = Math.max(0, Math.floor((minHz / nyquist) * binCount));
    const i1 = Math.min(binCount - 1, Math.ceil((maxHz / nyquist) * binCount));
    if (i1 < i0) return 0;
    let sum = 0;
    for (let i = i0; i <= i1; i++) sum += this.freqData[i];
    return sum / ((i1 - i0 + 1) * 255);
  }

  _startLoop() {
    if (this.rafId) return;
    const step = () => {
      if (this.audioEl.paused) {
        this.rafId = null;
        return;
      }
      if (this.analyser && this.freqData) {
        this.analyser.getByteFrequencyData(this.freqData);
        const kick = this._bandAverage(42, 112);
        const bass = this._bandAverage(115, 260);
        const acid = this._bandAverage(320, 2800);
        const hats = this._bandAverage(5000, 13500);

        const kickTransient = kick - this.prevKickEnergy > 0.11 && kick > 0.52;
        this.prevKickEnergy = kick;

        // Arrangement cue lookup
        const curSec = this.audioEl.currentTime;
        let activeCue = MOTIVATION_TRACK_CUES[0];
        for (const c of MOTIVATION_TRACK_CUES) {
          if (curSec >= c.atSec) activeCue = c;
          else break;
        }
        if (activeCue && activeCue.id !== this.lastCueId) {
          this.lastCueId = activeCue.id;
          if (this.onCueChange) this.onCueChange(activeCue, curSec);
        }

        // Compact 16-bar spectrum array for 3D horizon visualizer
        const bars = [];
        for (let b = 0; b < 16; b++) {
          const lo = 40 * Math.pow(1.42, b);
          const hi = lo * 1.42;
          bars.push(+this._bandAverage(lo, Math.min(16000, hi)).toFixed(3));
        }

        if (this.onFrameSpectrum) {
          this.onFrameSpectrum({ kick, bass, acid, hats, kickTransient, bars, curSec });
        }
      }
      this.rafId = requestAnimationFrame(step);
    };
    this.rafId = requestAnimationFrame(step);
  }

  _stopLoop() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }
}
