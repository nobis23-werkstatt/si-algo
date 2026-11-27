// 360° Spatial Sound-Sanctuary & Evidence-Grounded Psychoacoustic Engine (Frequenz-Labor 2.0 Core)
// - 4-Layer Architecture:
//   1) Binaural (130-400 Hz Oster window, strict L/R separation, <=30 Hz) & Soft-AM Raised-Cosine (<=0.38 depth)
//   2) Stereo-decorrelated Pink/Brown Noise (Xoshiro128** + Kellet/Leaky Integrator) + 360° HRTF Soft-Wind Orbit
//   3) 360° Spatial Just-Intonation Harmonic Dome (1:1, 3:2, 2:1, opt. 5:4 — zero 12-TET beating roughness!)
//   4) Evidence-A Breath-Coherence Pacing (0.1 Hz 4s/6s, 5s/5s, 2+1/6s Cyclic Sighing, 4-4-4-4 Box)
// - Master Ear-Safety Bus: 19 Hz DC-Blocker HPF -> 22 kHz Anti-Ultrasonic LPF -> Soft-Knee Limiter -> Safe-Mute
// - Deterministic Float64 24-bit / 48 kHz Stereo RIFF-WAV Offline Renderer with TPDF Dithering!
// - General Wellness / Non-Medical Routine Tool (EU MDR compliant; zero esoteric frequencies).

export const FORBIDDEN_ESOTERIC_HZ = [136.1, 174, 285, 396, 417, 432, 528, 639, 741, 852, 963, 7.83];

export const COMPLIANCE_BLACKLIST = [
  "adhs",
  "heilt",
  "therapiert",
  "diagnostiziert",
  "depression",
  "angststörung",
  "angststoerung",
  "panikattack",
  "insomnie",
  "schlafstörung",
  "schlafstoerung",
  "tinnitus-therapie",
  "alzheimer",
  "demenz",
  "vorhofflimmern",
  "klinisch bewiesen",
  "heilfrequenz",
  "solfeggio",
  "dna-aktivierung",
  "chakra",
  "schumann",
];

export const SANCTUARY_PRESETS = [
  {
    id: "FL2-14",
    name: "Vagale Ausatem-Dominanz (4s / 6s · 360° Kuppel)",
    category: "relaxation",
    evidence: "A",
    headphonesRequired: false,
    carrierHz: 180,
    beatHz: 0,
    amDepth: 0,
    droneRatios: [1, 1.5, 2], // 1:1, 3:2, 2:1 Just Intonation
    noiseKind: "brown",
    breathPattern: { label: "4s Ein · 6s Aus (0,1 Hz)", inhale: 4, holdIn: 0, exhale: 6, holdOut: 0 },
    targetGain: 0.22,
    autoSleepFade: false,
    summary: "Verlängerte Ausatmung (0,1 Hz Atem-Kohärenz) im warmen 360°-HRTF-Klangraum aus Reiner Quinte (180/270/360 Hz) und sanft kreisendem Naturwind.",
    caveat: "Evidenz A für langsame 0,1-Hz-Atemführung zur Unterstützung von Entspannungsritualen und Alltagsstress-Ausgleich (Laborde et al. 2022; Lehrer 2020).",
    sources: ["Laborde et al. (2022), Neurosci Biobehav Rev", "Lehrer et al. (2020), Appl Psychophysiol Biofeedback"],
    blueprint: { archetype: "resonance_sanctuary", skyColor: "#06191f", accentColor: "#2dd4bf", portalColor: "#fbbf24", particles: "spores", fogDensity: 0.24 },
  },
  {
    id: "FL2-13",
    name: "Cyclic Sighing Akut-Reset (Doppel-Einatmen / 6s Aus)",
    category: "relaxation",
    evidence: "A",
    headphonesRequired: false,
    carrierHz: 200,
    beatHz: 0,
    amDepth: 0,
    droneRatios: [1, 1.25, 1.5, 2], // 1:1, 5:4, 3:2, 2:1 pure triad
    noiseKind: "pink",
    breathPattern: { label: "2s+1s Doppel-Ein · 6s Aus", inhale: 2, secondInhale: 1, holdIn: 0, exhale: 6, holdOut: 0 },
    targetGain: 0.22,
    autoSleepFade: false,
    summary: "Strukturierter physiologischer Seufzer (2s Ein + 1s Nachziehen + 6s langes Ausatmen) umhüllt von reiner Dur-Obertonharmonik (5:4 & 3:2).",
    caveat: "Evidenz A: 5 Minuten tägliches Cyclic Sighing unterstützte in RCTs Stimmung und ruhige Atemregulation stärker als reine Achtsamkeit (Balban et al. 2023).",
    sources: ["Balban et al. (2023), Cell Reports Medicine", "Fincham et al. (2023), Scientific Reports"],
    blueprint: { archetype: "solarpunk_observatory", skyColor: "#071d18", accentColor: "#34d399", portalColor: "#38bdf8", particles: "spores", fogDensity: 0.22 },
  },
  {
    id: "FL2-12",
    name: "HRV Baroreflex-Resonanz (5s / 5s Symmetrie)",
    category: "relaxation",
    evidence: "A",
    headphonesRequired: false,
    carrierHz: 192,
    beatHz: 0,
    amDepth: 0,
    droneRatios: [1, 1.5, 2],
    noiseKind: "brown",
    breathPattern: { label: "5s Ein · 5s Aus (6 BPM)", inhale: 5, holdIn: 0, exhale: 5, holdOut: 0 },
    targetGain: 0.21,
    autoSleepFade: false,
    summary: "Klassische 0,1-Hz-Gleichklang-Atmung (6 Atemzüge/Min) mit räumlich rotierender 360°-Klangschale in schwebungsfreier Reiner Stimmung.",
    caveat: "Evidenz A für 0,1-Hz-Resonanzatmung (Goessl et al. 2017; Lehrer & Gevirtz 2014). Unverbindliche Wellness-Begleitung.",
    sources: ["Goessl et al. (2017), Psychol Med", "Lehrer & Gevirtz (2014), Front Psychol"],
    blueprint: { archetype: "resonance_sanctuary", skyColor: "#081627", accentColor: "#38bdf8", portalColor: "#34d399", particles: "spores", fogDensity: 0.25 },
  },
  {
    id: "FL2-08",
    name: "Klarer Fokus-Reset (6 BPM + Pink-Maskierung)",
    category: "focus",
    evidence: "A",
    headphonesRequired: false,
    carrierHz: 220,
    beatHz: 0,
    amDepth: 0,
    droneRatios: [1, 1.5, 2],
    noiseKind: "pink",
    breathPattern: { label: "5s Ein · 5s Aus (Fokus-Ruhe)", inhale: 5, holdIn: 0, exhale: 5, holdOut: 0 },
    targetGain: 0.23,
    autoSleepFade: false,
    summary: "Verbindet ruhige 6-BPM-Atemführung mit sanftem, stereo-dekorreliertem Pink Noise zur angenehmen Umgebungslärm-Maskierung vor konzentrierter Arbeit.",
    caveat: "Evidenz A für den 0,1-Hz-Atemkern; Rausch-Maskierung wirkt individuell unterschiedlich (Nigg et al. 2024).",
    sources: ["Lehrer et al. (2020), Appl Psychophysiol Biofeedback", "Nigg et al. (2024), JAACAP"],
    blueprint: { archetype: "library", skyColor: "#0a1929", accentColor: "#60a5fa", portalColor: "#2dd4bf", particles: "spores", fogDensity: 0.2 },
  },
  {
    id: "FL2-16",
    name: "360° Alpha-Ruhekuppel (4s/6s + 10 Hz Binaural)",
    category: "relaxation",
    evidence: "B",
    headphonesRequired: true,
    carrierHz: 200, // 195 Hz L / 205 Hz R (strictly inside Oster 130-400 Hz window)
    beatHz: 10,
    amDepth: 0,
    droneRatios: [1, 1.5],
    noiseKind: "pink",
    breathPattern: { label: "4s Ein · 6s Aus + 10 Hz Binaural", inhale: 4, holdIn: 0, exhale: 6, holdOut: 0 },
    targetGain: 0.2,
    autoSleepFade: false,
    summary: "Kombiniert 4s/6s-Atemführung mit einem sanften 10-Hz-Binaural-Tonpaar (195 Hz links / 205 Hz rechts) und 360°-Raumklang.",
    caveat: "Evidenz B (konservativer Hybrid): Atemkern Evidenz A, binaurale 10-Hz-Zusatzwirkung explorativ/gemischt (Garcia-Argibay 2019; Ingendoh 2023). Kopfhörer empfohlen.",
    sources: ["Garcia-Argibay et al. (2019), Psychol Res", "Ingendoh et al. (2023), PLOS ONE"],
    blueprint: { archetype: "canyon", skyColor: "#091826", accentColor: "#818cf8", portalColor: "#34d399", particles: "spores", fogDensity: 0.26 },
  },
  {
    id: "FL2-01",
    name: "Wacher Fokus-Impuls (40 Hz Soft-AM Raised-Cosine)",
    category: "focus",
    evidence: "B",
    headphonesRequired: false,
    carrierHz: 360,
    beatHz: 40,
    amDepth: 0.30, // Veto 3 safe: 30% <= 50% cap, pure Raised-Cosine window
    droneRatios: [1, 1.5],
    noiseKind: "pink",
    breathPattern: { label: "Freier Atem · Fokus-Routine", inhale: 4, holdIn: 0, exhale: 4, holdOut: 0 },
    targetGain: 0.19,
    autoSleepFade: false,
    epilepsyCaution: true,
    summary: "Weiche 40-Hz-Raised-Cosine-Modulation (30 % Tiefe) auf 360-Hz-Träger eingebettet in warmes 360°-Pink-Noise – ohne harte Rechteck-Klicks.",
    caveat: "Evidenz B für die elektrophysiologische 40-Hz-ASSR-Antwort; direkter Alltags-Fokusnutzen ist explorativ. Bei Anfallsneigung/Hyperakusis nicht nutzen.",
    sources: ["Galambos et al. (1981), PNAS", "Schwarz & Taylor (2005), Clin Neurophysiol"],
    blueprint: { archetype: "quantum_lattice", skyColor: "#0a1328", accentColor: "#38bdf8", portalColor: "#a78bfa", particles: "spores", fogDensity: 0.22 },
  },
  {
    id: "FL2-23",
    name: "Abend-Downshift & Sanfter Ausklang (Auto-Fade-Out)",
    category: "sleep",
    evidence: "A",
    headphonesRequired: false,
    carrierHz: 150,
    beatHz: 0,
    amDepth: 0,
    droneRatios: [1, 1.5], // Sleep rule: strictly NO 5:4 third!
    noiseKind: "brown",
    breathPattern: { label: "4s Ein · 6s Aus → Stille", inhale: 4, holdIn: 0, exhale: 6, holdOut: 0 },
    targetGain: 0.15,
    autoSleepFade: true,
    summary: "Reizarme Abend-Routine ohne große Terz (nur Grundton 150 Hz & Quinte 225 Hz, LPF < 600 Hz) mit automatischem Ausblenden in vollkommene Stille.",
    caveat: "Evidenz A für ruhige Abend-Atemroutine vor dem Schlafengehen (Laborde 2022). Blendet automatisch auf Stille aus (kein Dauerrauschen in der Nacht).",
    sources: ["Laborde et al. (2022), Neurosci Biobehav Rev", "Riedy et al. (2021), Sleep Med Rev"],
    blueprint: { archetype: "sub_abyss", skyColor: "#040b16", accentColor: "#2dd4bf", portalColor: "#38bdf8", particles: "snow", fogDensity: 0.36 },
  },
  {
    id: "FL2-29",
    name: "Sanftes Abend-Theta (4,5 Hz Binaural + Auto-Fade)",
    category: "sleep",
    evidence: "C",
    headphonesRequired: true,
    carrierHz: 160, // 157.75 Hz L / 162.25 Hz R
    beatHz: 4.5,
    amDepth: 0,
    droneRatios: [1, 2], // Pure octave only, no third
    noiseKind: "brown",
    breathPattern: { label: "4s Ein · 7s Aus → Stille", inhale: 4, holdIn: 0, exhale: 7, holdOut: 0 },
    targetGain: 0.14,
    autoSleepFade: true,
    summary: "Sehr leiser, tiefer Abend-Klangkokon (157,75 Hz / 162,25 Hz Binaural + dunkles Brown Noise) mit verpflichtendem sanftem Auto-Fade-Out.",
    caveat: "Explorativ (Evidenz C): Wissenschaftliche Belege schwach/uneinheitlich – Wirkung individuell und stark kontextabhängig. Reines Entspannungs-Audio ohne medizinisches Versprechen.",
    sources: ["Ingendoh et al. (2023), PLOS ONE", "Oster (1973), Sci Am"],
    blueprint: { archetype: "ice_citadel", skyColor: "#030914", accentColor: "#38bdf8", portalColor: "#2dd4bf", particles: "snow", fogDensity: 0.38 },
  },
];

/**
 * Validates all presets against Paul's Frequenz-Labor 2.0 compliance, Oster psychoacoustics,
 * Veto 1-5 invariants, and Zero-Esoterik rules.
 */
export function validateSanctuaryPresets(presets = SANCTUARY_PRESETS) {
  const errors = [];
  for (const p of presets) {
    const tag = `[${p.id}]`;
    if (!["A", "B", "C"].includes(p.evidence)) errors.push(`${tag} invalid evidence ${p.evidence}`);
    if (p.evidence === "C" && !p.caveat.includes("Explorativ (Evidenz C)")) {
      errors.push(`${tag} missing mandatory Exploratory C banner`);
    }
    const textBlob = `${p.name} ${p.summary} ${p.caveat}`.toLowerCase();
    for (const term of COMPLIANCE_BLACKLIST) {
      if (textBlob.includes(term)) errors.push(`${tag} contains blacklisted term "${term}"`);
    }
    const freqs = [p.carrierHz, p.beatHz, ...(p.droneRatios || []).map((r) => p.carrierHz * r)];
    for (const f of freqs) {
      if (!f) continue;
      for (const bad of FORBIDDEN_ESOTERIC_HZ) {
        if (Math.abs(f - bad) < 0.05) errors.push(`${tag} forbidden esoteric frequency ${f} Hz`);
      }
    }
    if (p.carrierHz < 130 || p.carrierHz > 400) {
      errors.push(`${tag} carrier ${p.carrierHz} Hz outside Oster 130-400 Hz range`);
    }
    if (p.headphonesRequired && p.beatHz > 30) {
      errors.push(`${tag} binaural beat ${p.beatHz} Hz exceeds 30 Hz limit`);
    }
    if (p.amDepth > 0.5) {
      errors.push(`${tag} AM depth ${p.amDepth} exceeds Veto 3 cap (0.50)`);
    }
    if (p.category === "sleep") {
      if (!p.autoSleepFade) errors.push(`${tag} sleep preset must enforce autoSleepFade`);
      if ((p.droneRatios || []).some((r) => Math.abs(r - 1.25) < 0.01)) {
        errors.push(`${tag} sleep preset must omit 5:4 third`);
      }
    }
  }
  return { valid: errors.length === 0, count: presets.length, errors };
}

/**
 * Deterministic 32-bit PRNG (Mulberry32 / Xoshiro-style) for stereo-decorrelated noise & TPDF dither.
 */
function makePrng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic Float64 24-bit / 48 kHz Stereo RIFF-WAV Offline Renderer with:
 * - Float64 phase accumulators (zero Float32 phase drift)
 * - Stereo-decorrelated Pink/Brown noise + slow 360° spatial panning
 * - Just Intonation harmonics + Breath envelope + 19 Hz DC blocker + TPDF 24-bit Dither
 */
export function renderSanctuaryWav24Bit({
  presetId = "FL2-14",
  durationSec = 20,
  sampleRate = 48_000,
} = {}) {
  const preset = SANCTUARY_PRESETS.find((p) => p.id === presetId) || SANCTUARY_PRESETS[0];
  const cleanSec = Math.max(2, Math.min(300, Number(durationSec) || 20));
  const totalFrames = Math.floor(cleanSec * sampleRate);
  const dataBytes = totalFrames * 2 * 3; // Stereo * 3 bytes (Int24 LE)
  const buf = new ArrayBuffer(44 + dataBytes);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);

  const writeAscii = (off, str) => {
    for (let i = 0; i < str.length; i++) view.setUint8(off + i, str.charCodeAt(i));
  };
  writeAscii(0, "RIFF");
  view.setUint32(4, 36 + dataBytes, true);
  writeAscii(8, "WAVE");
  writeAscii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 2, true); // Stereo
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 6, true); // ByteRate = fs * 2ch * 3B
  view.setUint16(32, 6, true); // BlockAlign = 6
  view.setUint16(34, 24, true); // 24-bit!
  writeAscii(36, "data");
  view.setUint32(40, dataBytes, true);

  const rngL = makePrng(0x20261127);
  const rngR = makePrng(0x20261127 ^ 0x9e3779b9);
  const rngDither = makePrng(0x51a19093);

  const TWO_PI = Math.PI * 2;
  const fCarrier = preset.carrierHz;
  const isBinaural = preset.headphonesRequired && preset.beatHz > 0 && preset.beatHz <= 30;
  const fLeft = isBinaural ? fCarrier - preset.beatHz * 0.5 : fCarrier;
  const fRight = isBinaural ? fCarrier + preset.beatHz * 0.5 : fCarrier;

  let phiL = 0;
  let phiR = 0;
  let phiMod = 0;
  const dronePhases = preset.droneRatios.map(() => 0);

  // Sample-rate-invariant Brown leaky integrator & Pink Kellet states
  const brownAlpha = Math.exp((-TWO_PI * 18) / sampleRate);
  let brownL = 0, brownR = 0;
  let b0L = 0, b1L = 0, b2L = 0;
  let b0R = 0, b1R = 0, b2R = 0;

  // 19 Hz 1st-order DC-blocker state
  const dcR = 1 - (TWO_PI * 19) / sampleRate;
  let dcPrevInL = 0, dcPrevOutL = 0;
  let dcPrevInR = 0, dcPrevOutR = 0;

  const bp = preset.breathPattern;
  const cycleSec = (bp.inhale || 4) + (bp.secondInhale || 0) + (bp.holdIn || 0) + (bp.exhale || 6) + (bp.holdOut || 0);

  let offset = 44;
  for (let i = 0; i < totalFrames; i++) {
    const t = i / sampleRate;

    // Smooth fade-in (1.5s) & mandatory gentle fade-out (last 2.5s or 25% on sleep presets)
    const fadeIn = Math.min(1, t / 1.5);
    const fadeWindow = preset.autoSleepFade ? Math.max(2.5, cleanSec * 0.35) : Math.min(2.5, cleanSec * 0.2);
    const rem = cleanSec - t;
    const fadeOut = rem < fadeWindow ? 0.5 * (1 - Math.cos(Math.PI * Math.max(0, rem / fadeWindow))) : 1;
    const masterEnv = fadeIn * fadeOut * preset.targetGain;

    // Breath coherence wave [0..1]
    const ct = t % cycleSec;
    const inTotal = (bp.inhale || 4) + (bp.secondInhale || 0);
    let breathEnv = 0.5;
    if (ct < inTotal) {
      breathEnv = 0.35 + 0.65 * (0.5 - 0.5 * Math.cos((Math.PI * ct) / inTotal));
    } else {
      const exT = Math.min(1, (ct - inTotal) / Math.max(0.5, bp.exhale || 6));
      breathEnv = 0.35 + 0.65 * (0.5 + 0.5 * Math.cos(Math.PI * exT));
    }

    // Layer 1: Binaural or Raised-Cosine Soft-AM
    phiL = (phiL + (TWO_PI * fLeft) / sampleRate) % TWO_PI;
    phiR = (phiR + (TWO_PI * fRight) / sampleRate) % TWO_PI;
    let amGain = 1.0;
    if (!isBinaural && preset.amDepth > 0 && preset.beatHz > 0) {
      phiMod = (phiMod + (TWO_PI * preset.beatHz) / sampleRate) % TWO_PI;
      const raisedCos = 0.5 * (1 - Math.cos(phiMod));
      amGain = 1 - preset.amDepth + preset.amDepth * raisedCos;
    }
    const entL = Math.sin(phiL) * amGain * 0.28;
    const entR = Math.sin(phiR) * amGain * 0.28;

    // Layer 2: Stereo-decorrelated Noise + slow 360° Azimuth Panning (0.08 Hz around listener)
    const wL = rngL() * 2 - 1;
    const wR = rngR() * 2 - 1;
    let nL, nR;
    if (preset.noiseKind === "brown") {
      brownL = brownAlpha * brownL + (1 - brownAlpha) * wL * 3.2;
      brownR = brownAlpha * brownR + (1 - brownAlpha) * wR * 3.2;
      nL = brownL;
      nR = brownR;
    } else {
      b0L = 0.99765 * b0L + wL * 0.099046;
      b1L = 0.96300 * b1L + wL * 0.2965164;
      b2L = 0.57000 * b2L + wL * 1.0526913;
      nL = (b0L + b1L + b2L + wL * 0.1848) * 0.16;

      b0R = 0.99765 * b0R + wR * 0.099046;
      b1R = 0.96300 * b1R + wR * 0.2965164;
      b2R = 0.57000 * b2R + wR * 1.0526913;
      nR = (b0R + b1R + b2R + wR * 0.1848) * 0.16;
    }
    const orbitAngle = TWO_PI * 0.085 * t;
    const panL = 0.65 + 0.35 * Math.cos(orbitAngle);
    const panR = 0.65 + 0.35 * Math.sin(orbitAngle);

    // Layer 3: Just Intonation 360° Harmonic Dome (1/n^2 overtone rolloff)
    let droneL = 0;
    let droneR = 0;
    for (let h = 0; h < preset.droneRatios.length; h++) {
      const ratio = preset.droneRatios[h];
      dronePhases[h] = (dronePhases[h] + (TWO_PI * fCarrier * ratio) / sampleRate) % TWO_PI;
      const amp = 0.24 / ((h + 1) * (h + 1));
      const sig = Math.sin(dronePhases[h]) * amp;
      const spatialSpread = (h % 2 === 0 ? 1 : -1) * 0.22 * Math.sin(orbitAngle * 0.5 + h);
      droneL += sig * (0.5 + spatialSpread);
      droneR += sig * (0.5 - spatialSpread);
    }

    let rawL = (entL + droneL + nL * panL * (0.45 + 0.55 * breathEnv)) * masterEnv;
    let rawR = (entR + droneR + nR * panR * (0.45 + 0.55 * breathEnv)) * masterEnv;

    // 19 Hz DC Blocker
    const outL = rawL - dcPrevInL + dcR * dcPrevOutL;
    dcPrevInL = rawL;
    dcPrevOutL = outL;

    const outR = rawR - dcPrevInR + dcR * dcPrevOutR;
    dcPrevInR = rawR;
    dcPrevOutR = outR;

    // Soft-Clip True-Peak Ceiling (-1.5 dBTP ~= 0.841) + TPDF 24-bit Dither (+/- 1 LSB)
    const softL = Math.tanh(outL * 1.05) * 0.84;
    const softR = Math.tanh(outR * 1.05) * 0.84;

    const ditherL = (rngDither() - rngDither()) / 8388608;
    const ditherR = (rngDither() - rngDither()) / 8388608;

    const s24L = Math.max(-8388607, Math.min(8388607, Math.round((softL + ditherL) * 8388607)));
    const s24R = Math.max(-8388607, Math.min(8388607, Math.round((softR + ditherR) * 8388607)));

    // Pack Little-Endian Int24
    const uL = s24L < 0 ? s24L + 16777216 : s24L;
    bytes[offset++] = uL & 0xff;
    bytes[offset++] = (uL >> 8) & 0xff;
    bytes[offset++] = (uL >> 16) & 0xff;

    const uR = s24R < 0 ? s24R + 16777216 : s24R;
    bytes[offset++] = uR & 0xff;
    bytes[offset++] = (uR >> 8) & 0xff;
    bytes[offset++] = (uR >> 16) & 0xff;
  }

  return {
    bytes,
    sampleRate,
    bitDepth: 24,
    channels: 2,
    durationSec: cleanSec,
    preset,
  };
}

/**
 * Live WebAudio 360° HRTF Spatial Sound-Sanctuary Engine for Browser Playback.
 * Wraps the listener in a 3D HRTF sound dome + live Breath-Coherence Ring!
 */
export class SpatialSanctuaryEngine {
  constructor({ onBreathFrame = null, onAutoStop = null } = {}) {
    this.ctx = null;
    this.running = false;
    this.activePreset = SANCTUARY_PRESETS[0];
    this.orbitSpeed = 0.09; // gentle 360° rotation in Hz
    this.masterVolume = 0.72;
    this.sleepTimerSec = 0; // 0 = continuous, >0 = gentle sleep fade-out
    this.startedAtSec = 0;
    this.nodes = [];
    this.panners = [];
    this.windPanner = null;
    this.breathFilter = null;
    this.breathGain = null;
    this.masterGain = null;
    this.rafId = null;
    this.onBreathFrame = onBreathFrame;
    this.onAutoStop = onAutoStop;
  }

  _ensureContext() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === "suspended") {
      this.ctx.resume().catch(() => {});
    }
  }

  _createDecorrelatedNoiseBuffer(kind = "brown", seconds = 6) {
    const sr = this.ctx.sampleRate;
    const len = sr * seconds;
    const buffer = this.ctx.createBuffer(2, len, sr);
    const rngL = makePrng(0x180b909);
    const rngR = makePrng(0x180b909 ^ 0x9e3779b9);
    const chL = buffer.getChannelData(0);
    const chR = buffer.getChannelData(1);

    const alpha = Math.exp((-2 * Math.PI * 18) / sr);
    let brL = 0, brR = 0;
    let b0L = 0, b1L = 0, b2L = 0;
    let b0R = 0, b1R = 0, b2R = 0;

    for (let i = 0; i < len; i++) {
      const wL = rngL() * 2 - 1;
      const wR = rngR() * 2 - 1;
      // Seamless 0.25s crossfade window at loop edges to eliminate loop clicks
      const edgeFade =
        i < sr * 0.15
          ? i / (sr * 0.15)
          : i > len - sr * 0.15
            ? (len - i) / (sr * 0.15)
            : 1;

      if (kind === "brown") {
        brL = alpha * brL + (1 - alpha) * wL * 3.0;
        brR = alpha * brR + (1 - alpha) * wR * 3.0;
        chL[i] = brL * edgeFade;
        chR[i] = brR * edgeFade;
      } else {
        b0L = 0.99765 * b0L + wL * 0.099046;
        b1L = 0.96300 * b1L + wL * 0.2965164;
        b2L = 0.57000 * b2L + wL * 1.0526913;
        chL[i] = (b0L + b1L + b2L + wL * 0.1848) * 0.15 * edgeFade;

        b0R = 0.99765 * b0R + wR * 0.099046;
        b1R = 0.96300 * b1R + wR * 0.2965164;
        b2R = 0.57000 * b2R + wR * 1.0526913;
        chR[i] = (b0R + b1R + b2R + wR * 0.1848) * 0.15 * edgeFade;
      }
    }
    return buffer;
  }

  start(presetId = this.activePreset.id) {
    this.stop(true);
    this._ensureContext();
    const preset = SANCTUARY_PRESETS.find((p) => p.id === presetId) || SANCTUARY_PRESETS[0];
    this.activePreset = preset;

    const now = this.ctx.currentTime;
    this.startedAtSec = now;

    // Master Ear-Safety Chain: 19 Hz DC-Blocker -> 22 kHz Anti-Ultrasonic LPF -> Soft-Knee Limiter
    const dcBlocker = this.ctx.createBiquadFilter();
    dcBlocker.type = "highpass";
    dcBlocker.frequency.value = 19;
    dcBlocker.Q.value = 0.7071;

    const antiUltra = this.ctx.createBiquadFilter();
    antiUltra.type = "lowpass";
    antiUltra.frequency.value = preset.category === "sleep" ? 620 : 20_000;
    antiUltra.Q.value = 0.7071;

    const limiter = this.ctx.createDynamicsCompressor();
    limiter.threshold.value = -6;
    limiter.knee.value = 6;
    limiter.ratio.value = 12;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.15;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(0.0001, now);
    this.masterGain.gain.setTargetAtTime(preset.targetGain * this.masterVolume, now, 0.45);

    dcBlocker.connect(antiUltra).connect(limiter).connect(this.masterGain).connect(this.ctx.destination);
    this.nodes.push(dcBlocker, antiUltra, limiter, this.masterGain);

    // Layer 1: Binaural L/R Pair OR Soft-AM Raised-Cosine
    if (preset.headphonesRequired && preset.beatHz > 0 && preset.beatHz <= 30) {
      const merger = this.ctx.createChannelMerger(2);
      const oscL = this.ctx.createOscillator();
      const oscR = this.ctx.createOscillator();
      const gBin = this.ctx.createGain();
      oscL.type = "sine";
      oscR.type = "sine";
      oscL.frequency.value = preset.carrierHz - preset.beatHz * 0.5;
      oscR.frequency.value = preset.carrierHz + preset.beatHz * 0.5;
      gBin.gain.value = 0.22;
      oscL.connect(merger, 0, 0);
      oscR.connect(merger, 0, 1);
      merger.connect(gBin).connect(dcBlocker);
      oscL.start(now);
      oscR.start(now);
      this.nodes.push(oscL, oscR, merger, gBin);
    } else if (preset.amDepth > 0 && preset.beatHz > 0) {
      const carrier = this.ctx.createOscillator();
      const modOsc = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      const amNode = this.ctx.createGain();
      carrier.type = "sine";
      carrier.frequency.value = preset.carrierHz;
      modOsc.type = "sine"; // pure sinusoidal / raised-cosine smooth AM (zero square harmonics!)
      modOsc.frequency.value = preset.beatHz;
      modGain.gain.value = preset.amDepth * 0.5;
      amNode.gain.value = 1 - preset.amDepth * 0.5;
      modOsc.connect(modGain).connect(amNode.gain);

      const trim = this.ctx.createGain();
      trim.gain.value = 0.2;
      carrier.connect(amNode).connect(trim).connect(dcBlocker);
      carrier.start(now);
      modOsc.start(now);
      this.nodes.push(carrier, modOsc, modGain, amNode, trim);
    }

    // Layer 2: Stereo-Decorrelated Noise + 360° HRTF Soft-Wind Orbit around the listener!
    const noiseSrc = this.ctx.createBufferSource();
    noiseSrc.buffer = this._createDecorrelatedNoiseBuffer(preset.noiseKind, 6);
    noiseSrc.loop = true;

    this.breathFilter = this.ctx.createBiquadFilter();
    this.breathFilter.type = "bandpass";
    this.breathFilter.frequency.value = 420;
    this.breathFilter.Q.value = 0.85;

    this.breathGain = this.ctx.createGain();
    this.breathGain.gain.value = 0.48;

    this.windPanner = this.ctx.createPanner();
    this.windPanner.panningModel = "HRTF";
    this.windPanner.distanceModel = "inverse";
    this.windPanner.refDistance = 2.0;

    noiseSrc.connect(this.breathFilter).connect(this.breathGain).connect(this.windPanner).connect(dcBlocker);
    noiseSrc.start(now);
    this.nodes.push(noiseSrc, this.breathFilter, this.breathGain, this.windPanner);

    // Layer 3: 360° Spatial Just-Intonation Harmonic Dome (3+ HRTF orbs orbiting gently in 3D!)
    this.panners = [];
    preset.droneRatios.forEach((ratio, idx) => {
      const osc = this.ctx.createOscillator();
      const lpf = this.ctx.createBiquadFilter();
      const g = this.ctx.createGain();
      const panner = this.ctx.createPanner();

      osc.type = idx === 0 ? "sine" : "triangle";
      osc.frequency.value = preset.carrierHz * ratio;

      lpf.type = "lowpass";
      lpf.frequency.value = preset.category === "sleep" ? 520 : 760;

      g.gain.value = 0.22 / ((idx + 1) * (idx + 1));

      panner.panningModel = "HRTF";
      panner.distanceModel = "inverse";
      panner.refDistance = 2.4;

      osc.connect(lpf).connect(g).connect(panner).connect(dcBlocker);
      osc.start(now);
      this.panners.push({ panner, baseAngle: (idx * Math.PI * 2) / preset.droneRatios.length });
      this.nodes.push(osc, lpf, g, panner);
    });

    this.running = true;
    this._tickSpatialAndBreath();
    return preset;
  }

  setVolume(norm01) {
    this.masterVolume = Math.max(0.02, Math.min(1, Number(norm01) || 0.72));
    if (this.running && this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        this.activePreset.targetGain * this.masterVolume,
        this.ctx.currentTime,
        0.04
      );
    }
  }

  setOrbitSpeed(hz) {
    this.orbitSpeed = Math.max(0, Math.min(0.4, Number(hz) || 0.09));
  }

  updateListenerFromCamera(cam) {
    if (!this.running || !this.ctx || !cam) return;
    const l = this.ctx.listener;
    const fx = -Math.sin(cam.yaw || 0);
    const fz = -Math.cos(cam.yaw || 0);
    if (l.positionX) {
      const t = this.ctx.currentTime;
      l.positionX.setTargetAtTime(cam.x || 0, t, 0.03);
      l.positionY.setTargetAtTime(cam.y || 1.75, t, 0.03);
      l.positionZ.setTargetAtTime(cam.z || 4, t, 0.03);
      l.forwardX.setTargetAtTime(fx, t, 0.03);
      l.forwardY.setTargetAtTime(0, t, 0.03);
      l.forwardZ.setTargetAtTime(fz, t, 0.03);
    } else if (typeof l.setPosition === "function") {
      l.setPosition(cam.x || 0, cam.y || 1.75, cam.z || 4);
      l.setOrientation(fx, 0, fz, 0, 1, 0);
    }
  }

  _tickSpatialAndBreath() {
    if (!this.running || !this.ctx) return;
    const now = this.ctx.currentTime;
    const elapsed = now - this.startedAtSec;

    // Optional Sleep Auto-Fade-Out Ratchet (unidirectional down-ramp -> Safe-Mute!)
    if (this.sleepTimerSec > 0 && elapsed >= this.sleepTimerSec) {
      this.stop(false);
      if (this.onAutoStop) this.onAutoStop();
      return;
    }
    if (this.sleepTimerSec > 0 && this.sleepTimerSec - elapsed <= 20 && this.masterGain) {
      const frac = Math.max(0.0001, (this.sleepTimerSec - elapsed) / 20);
      this.masterGain.gain.setTargetAtTime(
        this.activePreset.targetGain * this.masterVolume * frac,
        now,
        0.15
      );
    }

    // 1. Breath Phase Machine (Inhale / Optional Double-Inhale Sigh / Exhale)
    const bp = this.activePreset.breathPattern;
    const secondIn = bp.secondInhale || 0;
    const inTotal = (bp.inhale || 4) + secondIn;
    const holdIn = bp.holdIn || 0;
    const exhale = bp.exhale || 6;
    const holdOut = bp.holdOut || 0;
    const cycle = inTotal + holdIn + exhale + holdOut;
    const ct = elapsed % cycle;

    let phaseName = "EINATMEN";
    let progress = 0; // 0..1 expansion radius
    if (ct < bp.inhale) {
      phaseName = secondIn > 0 ? "1 · TIEF EINATMEN" : "EINATMEN";
      progress = 0.5 - 0.5 * Math.cos((Math.PI * ct) / bp.inhale) * (secondIn > 0 ? 0.82 : 1);
    } else if (secondIn > 0 && ct < inTotal) {
      phaseName = "2 · KURZ NACHZIEHEN";
      const st = (ct - bp.inhale) / secondIn;
      progress = 0.82 + 0.18 * st;
    } else if (ct < inTotal + holdIn) {
      phaseName = "HALTEN (RUHE)";
      progress = 1.0;
    } else if (ct < inTotal + holdIn + exhale) {
      phaseName = "LANGSAM AUSATMEN";
      const et = (ct - inTotal - holdIn) / exhale;
      progress = 0.5 + 0.5 * Math.cos(Math.PI * et);
    } else {
      phaseName = "PAUSE";
      progress = 0.0;
    }

    if (this.breathFilter && this.breathGain) {
      this.breathFilter.frequency.setTargetAtTime(250 + progress * 460, now, 0.06);
      this.breathGain.gain.setTargetAtTime(0.28 + progress * 0.42, now, 0.06);
    }

    // 2. 360° HRTF Orbit around the listener's current camera position!
    const lPos = this.ctx.listener;
    const cx = lPos.positionX ? lPos.positionX.value : 0;
    const cy = lPos.positionY ? lPos.positionY.value : 1.75;
    const cz = lPos.positionZ ? lPos.positionZ.value : 4;
    const theta = elapsed * Math.PI * 2 * this.orbitSpeed;

    if (this.windPanner) {
      const wx = cx + Math.cos(theta) * 3.1;
      const wy = cy + Math.sin(theta * 2) * 0.45;
      const wz = cz + Math.sin(theta) * 3.1;
      if (this.windPanner.positionX) {
        this.windPanner.positionX.setTargetAtTime(wx, now, 0.05);
        this.windPanner.positionY.setTargetAtTime(wy, now, 0.05);
        this.windPanner.positionZ.setTargetAtTime(wz, now, 0.05);
      } else {
        this.windPanner.setPosition(wx, wy, wz);
      }
    }

    const orbPositions = [];
    for (const item of this.panners) {
      const ang = theta * 0.7 + item.baseAngle;
      const radius = 3.4 + progress * 0.9;
      const ox = cx + Math.cos(ang) * radius;
      const oy = cy + 0.35 + Math.sin(ang * 1.5) * 0.4;
      const oz = cz + Math.sin(ang) * radius;
      if (item.panner.positionX) {
        item.panner.positionX.setTargetAtTime(ox, now, 0.05);
        item.panner.positionY.setTargetAtTime(oy, now, 0.05);
        item.panner.positionZ.setTargetAtTime(oz, now, 0.05);
      } else {
        item.panner.setPosition(ox, oy, oz);
      }
      orbPositions.push({ x: ox, y: oy, z: oz });
    }

    if (this.onBreathFrame) {
      this.onBreathFrame({
        active: true,
        preset: this.activePreset,
        phaseName,
        progress,
        elapsedSec: elapsed,
        orbPositions,
      });
    }

    this.rafId = requestAnimationFrame(() => this._tickSpatialAndBreath());
  }

  stop(immediate = false) {
    this.running = false;
    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    const oldNodes = this.nodes.splice(0);
    this.panners = [];
    if (this.masterGain && this.ctx && !immediate) {
      const now = this.ctx.currentTime;
      try {
        this.masterGain.gain.cancelScheduledValues(now);
        this.masterGain.gain.setTargetAtTime(0.00001, now, 0.08);
      } catch {}
      setTimeout(() => {
        for (const n of oldNodes) {
          try { if (typeof n.stop === "function") n.stop(); n.disconnect(); } catch {}
        }
      }, 320);
    } else {
      for (const n of oldNodes) {
        try { if (typeof n.stop === "function") n.stop(); n.disconnect(); } catch {}
      }
    }
    this.masterGain = null;
    if (this.onBreathFrame) this.onBreathFrame({ active: false });
  }
}
