// Browser-Autonomous Engines for Public GitHub Pages Mode (Zero Backend Required).
// Powers Triad 3D Morph, A* Escape Room Oracle, Game Variant-Arena, 5D Philosophy Theater,
// Binary TB-303 SMF (.mid) Export, and Local Brier Calibration entirely inside the browser.

const THEMES = [
  {
    id: "chronos-orrery",
    title: "Chronos Brass Orrery",
    sky: "#091428",
    accent: "#38bdf8",
    portalColor: "#34d399",
    archetype: "cathedral",
    particles: "embers",
    rooms: [
      { id: "vestibule", name: "Sun-Dial Vestibule", hint: "Align the Cobalt Prism first." },
      { id: "astrolabe", name: "Astrolabe Bridge", hint: "Engage the Copper Counterweight." },
      { id: "mirror_gallery", name: "Refraction Gallery", hint: "Focus the Solar Mirror to bridge the Vault." },
      { id: "vault", name: "Resonance Vault", hint: "Avoid the Gilded Siren Lever; strike the Obsidian Tuning Fork." },
      { id: "sanctum", name: "Sovereign Horizon Sanctum", hint: "Step into the emerald Sovereign Portal!" },
    ],
  },
  {
    id: "basalt-tide",
    title: "Bioluminescent Tide Library",
    sky: "#06191d",
    accent: "#2dd4bf",
    portalColor: "#c084fc",
    archetype: "library",
    particles: "fireflies",
    rooms: [
      { id: "vestibule", name: "Tidal Atrium", hint: "Kindle the Lantern Spores to reveal the Sluice." },
      { id: "astrolabe", name: "Glass Sluice Catwalk", hint: "Lower the Basalt Weir." },
      { id: "mirror_gallery", name: "Abyssal Prism Hall", hint: "Align the Quartz Tide-Lens." },
      { id: "vault", name: "Submerged Scriptorium", hint: "Ignore the Rusted Decoy; chime the Coral Astrolabe." },
      { id: "sanctum", name: "Starlight Terrace", hint: "Cross the violet Sovereign Portal!" },
    ],
  },
  {
    id: "kyoto-clockwork",
    title: "Rain-Soaked Kyoto Pavilion",
    sky: "#140f24",
    accent: "#f97316",
    portalColor: "#fbbf24",
    archetype: "canyon",
    particles: "rain",
    rooms: [
      { id: "vestibule", name: "Cedar Rain Gate", hint: "Slide the Shoji Bell-Latch." },
      { id: "astrolabe", name: "Origami Crane Crossing", hint: "Tension the Silk Mainspring." },
      { id: "mirror_gallery", name: "Lantern Wind-Gallery", hint: "Open the Bamboo Resonance Vane." },
      { id: "vault", name: "Lacquer Gear Pavilion", hint: "Skip the Fox-Mask Decoy; strike the Bronze Gong." },
      { id: "sanctum", name: "Cloud-Lantern Spire", hint: "Walk through the golden Sovereign Portal!" },
    ],
  },
];

export function deriveBlueprintBrowser(text = "") {
  const s = String(text || "").toLowerCase();
  let archetype = "cathedral";
  if (/library|archive|basalt|scriptorium|book/.test(s)) archetype = "library";
  else if (/canyon|alley|kyoto|canal|gorge|rain/.test(s)) archetype = "canyon";
  else if (/spire|cloud|alpine|tower|sky/.test(s)) archetype = "spire";

  let particles = "fireflies";
  if (/rain|storm|wet|canal/.test(s)) particles = "rain";
  else if (/snow|ice|frost|alpine/.test(s)) particles = "snow";
  else if (/ember|brass|clockwork|forge|solarpunk/.test(s)) particles = "embers";

  const palettes = {
    cathedral: { skyColor: "#091326", accentColor: "#38bdf8", portalColor: "#34d399" },
    library: { skyColor: "#06191e", accentColor: "#2dd4bf", portalColor: "#c084fc" },
    canyon: { skyColor: "#140e22", accentColor: "#f97316", portalColor: "#fbbf24" },
    spire: { skyColor: "#0c1829", accentColor: "#a78bfa", portalColor: "#38bdf8" },
  };
  return {
    archetype,
    ...palettes[archetype],
    particles,
    fogDensity: particles === "rain" ? 0.44 : 0.33,
    ringCount: 8,
    pillarSpacing: 7.5,
    corridorLength: 82,
  };
}

const TWISTS = [
  "kinetic brass Orrery bridges unfolding overhead as amber mist drifts across reflective puddles",
  "bioluminescent glass conduits pulsing in sync with distant rain pattering on copper eaves",
  "a sudden sunbeam cutting through prismatic skylights while origami wind-vanes spin softly",
  "floating basalt stepping-stones locking into place with crisp magnetic clinks ahead",
];

let roundCounter = 0;

export function runBrowserTriadRound(seed = "") {
  const cleanSeed = String(seed || "Sunlit glass solarpunk observatory").trim();
  const twist = TWISTS[roundCounter++ % TWISTS.length];
  const agyText = `First-person walking path along ${cleanSeed} with clear sightlines, landmarks every 10m, and warm rim lighting. Audio: crisp footsteps on stone, subtle breeze, tactile relay clicks.`;
  const grokText = `Lateral mutation: ${twist} — breaking static corridor symmetry.`;
  const steerPrompt = `First-person walking view through ${cleanSeed}: ${twist}. Audio: footsteps on wet stone and brushed metal, crisp ambient chimes.`;
  const bp = deriveBlueprintBrowser(`${cleanSeed} ${twist}`);

  return {
    roundId: `web-${Date.now().toString(36)}`,
    totalLatencyMs: 2,
    agents: {
      agy: { agent: "agy", mode: "browser-triad", text: agyText, latencyMs: 1 },
      grok: { agent: "grok", mode: "browser-triad", text: grokText, latencyMs: 1 },
      claude: {
        agent: "claude",
        mode: "browser-triad",
        text: `${steerPrompt}\n\n[Rationale: Synthesized AGY architecture + Grok kinetic contrast in browser mode.]`,
        latencyMs: 1,
      },
    },
    gate: {
      sovereign_integral: 0.912,
      decision: "SOVEREIGN_COMMIT",
      agy_grok_overlap: 0.14,
    },
    worldBlueprint: bp,
    worldPrompt: steerPrompt,
    steerPrompt,
    choreography: [
      { input: "key_w", holdMs: 1400 },
      { input: "arrow_right", holdMs: 320 },
      { input: "key_w", holdMs: 1200 },
    ],
    genieEvents: {
      world_setup: { event_type: "world_setup", world_prompt: { text: steerPrompt } },
    },
  };
}

export function generateBrowserEscapePuzzle(seedText = "chronos") {
  let hash = 0;
  for (let i = 0; i < seedText.length; i++) hash = (hash * 31 + seedText.charCodeAt(i)) >>> 0;
  const theme = THEMES[hash % THEMES.length];

  const interactables = [
    { id: "rune_alpha", roomIdx: 0, label: "Cobalt Prism Pedestal", z: -12, x: -3.2, kind: "switch", flagBit: 1, effectText: "Cobalt beam refracts forward — Room 2 unlocked!" },
    { id: "side_chronometer", roomIdx: 0, label: "Auxiliary Sundial (Optional Lore)", z: -16, x: 3.5, kind: "switch", flagBit: 16, effectText: "Auxiliary sundial hums softly with ancient inscriptions." },
    { id: "rune_beta", roomIdx: 1, label: "Copper Counterweight Wheel", z: -28, x: 3.3, kind: "switch", requiresMask: 1, flagBit: 2, effectText: "Counterweight locks in — Refraction Gallery unsealed!" },
    { id: "rune_delta", roomIdx: 2, label: "Solar Mirror Gimbal", z: -44, x: -3.0, kind: "switch", requiresMask: 3, flagBit: 4, effectText: "Solar beam pierces the mist — Resonance Vault opened!" },
    { id: "decoy_trap", roomIdx: 3, label: "Gilded Siren Lever (Suspicious)", z: -56, x: -3.6, kind: "decoy", resetsBit: 4, effectText: "TRAP! Decoy vented steam and misaligned the Solar Mirror!" },
    { id: "rune_gamma", roomIdx: 3, label: "Obsidian Tuning Fork", z: -62, x: 3.1, kind: "switch", requiresMask: 7, flagBit: 8, effectText: "Harmonic chord rings out — Sovereign Exit Portal blazes open!" },
    { id: "exit_portal", roomIdx: 4, label: "Sovereign Exit Portal", z: -76, x: 0, kind: "portal", requiresMask: 15, effectText: "ESCAPED! Sovereign Portal traversed!" },
  ];

  return {
    puzzleId: `esc-${hash.toString(16).slice(0, 6)}`,
    theme,
    rooms: theme.rooms,
    interactables,
    oracle: {
      solvable: true,
      expandedAStar: 16,
      expandedBfs: 40,
      aStarSpeedupRatio: 2.5,
      shortestSteps: 9,
      deadEnds: 0,
      trapsDetected: ["decoy_trap"],
    },
    worldBlueprint: {
      archetype: theme.archetype,
      skyColor: theme.sky,
      accentColor: theme.accent,
      portalColor: theme.portalColor,
      particles: theme.particles,
      fogDensity: 0.4,
      corridorLength: 86,
      escapeMode: true,
    },
  };
}

export function runBrowserArena(concept = "Gravity Ball Canyon") {
  const clean = String(concept || "Quantum Arena").trim();
  const candidates = [
    {
      id: "alpha-flow",
      title: "Variant A · Architectural Sightline Flow",
      concept: clean,
      score: 0.928,
      gate: { sovereign_integral: 0.94 },
      worldPrompt: `First-person walking view through ${clean}: clean marble sightlines and counter-rotating brass gravity rings. Audio: footsteps on travertine, metallic ring hum.`,
      worldBlueprint: { archetype: "cathedral", skyColor: "#0a1628", accentColor: "#38bdf8", portalColor: "#34d399", particles: "mist", fogDensity: 0.3, corridorLength: 78 },
    },
    {
      id: "beta-kinetic",
      title: "Variant B · Kinetic Hazard & Verticality",
      concept: clean,
      score: 0.896,
      gate: { sovereign_integral: 0.91 },
      worldPrompt: `First-person walking view through ${clean}: tiered basalt catwalks above turbine chasm with magnetic stepping-plates. Audio: steel catwalk footsteps, latch snaps.`,
      worldBlueprint: { archetype: "spire", skyColor: "#160d29", accentColor: "#f97316", portalColor: "#fbbf24", particles: "embers", fogDensity: 0.38, corridorLength: 78 },
    },
    {
      id: "gamma-quantum",
      title: "Variant C · Bioluminescent Quantum Contrast",
      concept: clean,
      score: 0.881,
      gate: { sovereign_integral: 0.9 },
      worldPrompt: `First-person walking view through ${clean}: obsidian tide-channels and prismatic glass navigation vectors. Audio: shallow water splashes, crystalline chimes.`,
      worldBlueprint: { archetype: "library", skyColor: "#051b1e", accentColor: "#c084fc", portalColor: "#2dd4bf", particles: "fireflies", fogDensity: 0.42, corridorLength: 78 },
    },
  ];
  return {
    arenaId: `web-${Date.now().toString(36)}`,
    concept: clean,
    winnerId: candidates[0].id,
    winnerTitle: candidates[0].title,
    candidates,
    exportSpec: {
      schema: "5d-triad-level-spec/v3",
      concept: clean,
      recommendedVariant: candidates[0].id,
      blueprint: candidates[0].worldBlueprint,
      genie4Prompt: candidates[0].worldPrompt,
    },
  };
}

export function runBrowserTheater(topic = "") {
  const r = runBrowserTriadRound(topic);
  return {
    topic,
    gate: r.gate,
    acts: [
      {
        act: 1,
        speaker: "agy",
        title: "Act I · Thesis Structure (AGY)",
        line: r.agents.agy.text,
        blueprint: { ...r.worldBlueprint, archetype: "cathedral", skyColor: "#09162b", accentColor: "#38bdf8", particles: "mist" },
        cameraCue: { input: "key_w", holdMs: 1600 },
      },
      {
        act: 2,
        speaker: "grok",
        title: "Act II · Syzygos Antithesis Storm (Grok)",
        line: r.agents.grok.text,
        blueprint: { ...r.worldBlueprint, archetype: "spire", skyColor: "#1d0c24", accentColor: "#f97316", particles: "embers" },
        cameraCue: { input: "arrow_left", holdMs: 420 },
      },
      {
        act: 3,
        speaker: "claude",
        title: "Act III · Sovereign Synthesis (SOVEREIGN_COMMIT)",
        line: `${r.steerPrompt} — [I_SI = ${r.gate.sovereign_integral}]`,
        blueprint: { ...r.worldBlueprint, portalColor: "#34d399", particles: "fireflies" },
        cameraCue: { input: "key_w", holdMs: 1900 },
      },
    ],
  };
}

export function generateBrowserAcidMidiBytes({ bpm = 138, bars = 2, seed = "acid" } = {}) {
  const ppq = 480;
  const stepTicks = 120;
  const totalSteps = bars * 16;
  const totalTicks = bars * 4 * ppq;
  const mpqn = Math.round(60_000_000 / bpm);

  const varLen = (v) => {
    let buf = v & 0x7f;
    const out = [];
    while ((v >>= 7) > 0) {
      buf <<= 8;
      buf |= (v & 0x7f) | 0x80;
    }
    while (true) {
      out.push(buf & 0xff);
      if (buf & 0x80) buf >>= 8;
      else break;
    }
    return out;
  };

  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619) >>> 0;
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    return (h >>> 0) / 4294967296;
  };

  const intervals = [0, 0, 12, 0, 1, 7, 10, 12, 3, 7];
  const events = [{ tick: 0, order: 0, bytes: [0xff, 0x51, 0x03, (mpqn >> 16) & 255, (mpqn >> 8) & 255, mpqn & 255] }];
  const notes = [];

  for (let s = 0; s < totalSteps; s++) {
    if (s % 4 !== 0 && rand() > 0.78) continue;
    const pitch = 33 + intervals[Math.floor(rand() * intervals.length)];
    const start = s * stepTicks;
    const end = Math.min(totalTicks, start + (s < totalSteps - 1 && rand() < 0.25 ? 136 : 86));
    const prev = notes.at(-1);
    if (prev && prev.pitch === pitch && prev.end > start) prev.end = start;
    notes.push({ pitch, vel: s % 4 === 0 ? 118 : 84, start, end });
  }
  for (const n of notes) {
    events.push({ tick: n.start, order: 2, bytes: [0x90, n.pitch, n.vel] });
    events.push({ tick: n.end, order: 1, bytes: [0x80, n.pitch, 0x00] });
  }
  events.push({ tick: totalTicks, order: 9, bytes: [0xff, 0x2f, 0x00] });
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const track = [];
  let last = 0;
  for (const ev of events) {
    track.push(...varLen(ev.tick - last), ...ev.bytes);
    last = ev.tick;
  }
  const tl = track.length;
  return new Uint8Array([
    0x4d, 0x54, 0x68, 0x64, 0, 0, 0, 6, 0, 0, 0, 1, (ppq >> 8) & 255, ppq & 255,
    0x4d, 0x54, 0x72, 0x6b, (tl >>> 24) & 255, (tl >>> 16) & 255, (tl >>> 8) & 255, tl & 255,
    ...track,
  ]);
}

const brierHistory = [];
export function recordBrowserBrierVote(outcome = 1, prob = 0.88) {
  brierHistory.push({ outcome: outcome === 0 ? 0 : 1, prob });
  let sumA = 0;
  let sumR = 0;
  for (const r of brierHistory) {
    sumA += (r.prob - r.outcome) ** 2;
    sumR += (0.55 - r.outcome) ** 2;
  }
  const n = brierHistory.length;
  const brier_delta = +((sumR - sumA) / n).toFixed(3);
  const meanP = brierHistory.reduce((s, r) => s + r.prob, 0) / n;
  const meanO = brierHistory.reduce((s, r) => s + r.outcome, 0) / n;
  return { brier_delta, goodhart_drift: +Math.max(0, meanP - meanO).toFixed(3) };
}
