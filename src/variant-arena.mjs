// Game-Prototyping Variant-Arena v4.0 — Scaled x4 to 12 Specialized Playable Archetypes
// Includes dedicated profiles for Paul's flagship universes (Gravity Ball, Quantum World,
// Ultimate Zombie Siege, 180-BPM Tekno Tunnel, Portal Gun Sprint, etc.).

import { compileGenieWorldSetup, evaluateCreativeTriad } from "./sovereign-gate.mjs";

export const ARENA_PROFILES = [
  { id: "alpha-flow", tags: ["gravity", "marble", "flow"], title: "01 · Gravity Ball Sightline Colosseum", archetype: "gravity_colosseum", skyColor: "#0a1628", accentColor: "#38bdf8", portalColor: "#34d399", particles: "mist", fogDensity: 0.28, ringCount: 10, pillarSpacing: 8, agyFocus: "Banked travertine momentum tracks with crisp 15m sightlines and sunlit rim edges.", grokTwist: "Counter-rotating brass gyro-hoops accelerating ball trajectories along the nave.", foley: "smooth rolling stone resonance, metallic gyro hum, crisp wind rush" },
  { id: "beta-quantum", tags: ["quantum", "sci-fi", "puzzle"], title: "02 · Quantum World Phase Lattice", archetype: "quantum_lattice", skyColor: "#051b1e", accentColor: "#c084fc", portalColor: "#2dd4bf", particles: "fireflies", fogDensity: 0.34, ringCount: 12, pillarSpacing: 7, agyFocus: "Crystalline phase bridges suspended over reflective obsidian quantum wells.", grokTwist: "Prismatic beam splitters projecting walkable light-bridges ahead.", foley: "footsteps on tempered glass, harmonic crystal hum, gentle water ripples" },
  { id: "gamma-siege", tags: ["zombie", "survival", "arena"], title: "03 · Barricade Siege Foundry", archetype: "obsidian_vault", skyColor: "#1a0b12", accentColor: "#f43f5e", portalColor: "#fbbf24", particles: "embers", fogDensity: 0.41, ringCount: 6, pillarSpacing: 6.5, agyFocus: "Fortified iron foundry catwalks with choke-point floodlights and clear tactical lanes.", grokTwist: "Steam-driven blast doors cycling open to reveal high-ground vantage towers.", foley: "boots on steel grating, distant steam valves hissing, heavy chain clanks" },
  { id: "delta-tekno-180", tags: ["tekno", "acid", "180bpm", "music"], title: "04 · 180-BPM B-Minor Tekno Bunker", archetype: "tekno_bunker_909", skyColor: "#090614", accentColor: "#ff6a1a", portalColor: "#38bdf8", particles: "embers", fogDensity: 0.32, ringCount: 14, pillarSpacing: 6, agyFocus: "Brutalist concrete acoustic ribs pulsing with strobe-lit waveguides down a long rave tunnel.", grokTwist: "Giant 909 copper resonators flexing in sync with sub-bass pressure waves.", foley: "footsteps on raw concrete, metallic bulkhead resonance, crisp air vents" },
  { id: "epsilon-portal", tags: ["portal", "sprint", "speed"], title: "05 · Portal Sprint Sky-Causeway", archetype: "orbital_ring", skyColor: "#0c1829", accentColor: "#34d399", portalColor: "#a78bfa", particles: "mist", fogDensity: 0.25, ringCount: 9, pillarSpacing: 8.5, agyFocus: "High-altitude white ceramic causeway linking floating portal frames above cloud decks.", grokTwist: "Emerald spatial rifts folding distant islands directly into the walkway.", foley: "crisp footsteps on ceramic tile, high-altitude breeze, glass chime clicks" },
  { id: "zeta-kyoto", tags: ["kyoto", "rain", "stealth"], title: "06 · Rain-Soaked Kyoto Clockwork Alley", archetype: "canyon", skyColor: "#140e22", accentColor: "#f97316", portalColor: "#fbbf24", particles: "rain", fogDensity: 0.42, ringCount: 7, pillarSpacing: 7, agyFocus: "Cedar eaves and wet flagstones reflecting warm paper lanterns along a narrow gorge.", grokTwist: "Kinetic wooden waterwheels unfolding bamboo drawbridges across rain channels.", foley: "footsteps on wet stone, rain pattering on cedar roofs, wooden gear clicks" },
  { id: "eta-solarpunk", tags: ["solarpunk", "nature", "atelier"], title: "07 · Solarpunk Botanical Conservatory", archetype: "solarpunk_observatory", skyColor: "#0b221e", accentColor: "#4ade80", portalColor: "#fde047", particles: "fireflies", fogDensity: 0.29, ringCount: 8, pillarSpacing: 8, agyFocus: "Arched copper-and-glass greenhouse catwalks above terraced waterfall gardens.", grokTwist: "Heliotropic brass sun-mirrors tilting overhead to cast golden caustics.", foley: "footsteps on timber decking, waterfall spray, rustling leaves" },
  { id: "theta-impasto", tags: ["art", "canal", "oil"], title: "08 · Impasto Oil-Painting Canal", archetype: "cyber_canal", skyColor: "#111936", accentColor: "#fbbf24", portalColor: "#38bdf8", particles: "mist", fogDensity: 0.33, ringCount: 8, pillarSpacing: 7.5, agyFocus: "Thick textured brushstroke cobblestones beside a shimmering cobalt canal.", grokTwist: "Swirling starry-night astrolabe arches rotating gently over stone bridges.", foley: "footsteps on cobblestone, water lapping against canal masonry, light breeze" },
  { id: "iota-cryo", tags: ["ice", "alpine", "spire"], title: "09 · Cryo-Glacier Resonance Spire", archetype: "ice_citadel", skyColor: "#081a2e", accentColor: "#7dd3fc", portalColor: "#e879f9", particles: "snow", fogDensity: 0.35, ringCount: 10, pillarSpacing: 7.5, agyFocus: "Translucent glacial ice colonnades refracting low arctic sunlight across snow bridges.", grokTwist: "Suspended bronze wind-harps chiming as spindrift swirls down the nave.", foley: "crunching footsteps on packed snow, glacial ice creaks, wind-harp chimes" },
  { id: "kappa-acid-lab", tags: ["acid", "303", "synth"], title: "10 · 303 Silver-Box Synth Cathedral", archetype: "acid_reactor_bmin", skyColor: "#071710", accentColor: "#32d7c8", portalColor: "#ff9f0a", particles: "fireflies", fogDensity: 0.3, ringCount: 12, pillarSpacing: 6.5, agyFocus: "Brushed-aluminum walkway flanked by towering rotary potentiometers and LED VU towers.", grokTwist: "Liquid mercury filter-ladders rippling along glass floor conduits.", foley: "footsteps on anodized aluminum, tactile mechanical switch clicks, relay snaps" },
  { id: "lambda-desert", tags: ["desert", "monolith", "ancient"], title: "11 · Sandstone Sundial Monoliths", archetype: "desert_monolith", skyColor: "#24150b", accentColor: "#fb923c", portalColor: "#38bdf8", particles: "embers", fogDensity: 0.31, ringCount: 7, pillarSpacing: 8.5, agyFocus: "Carved red-sandstone canyon causeway aligned with giant celestial shadow slots.", grokTwist: "Levitating turquoise obelisks aligning into a harmonic sun-portal.", foley: "footsteps on dry sandstone grit, desert wind through carved slots, stone hum" },
  { id: "mu-abyss", tags: ["underwater", "abyss", "library"], title: "12 · Pelagic Glass Trench Archive", archetype: "sub_abyss", skyColor: "#03121c", accentColor: "#22d3ee", portalColor: "#c084fc", particles: "fireflies", fogDensity: 0.39, ringCount: 9, pillarSpacing: 7, agyFocus: "Pressurized dome walkway through a bioluminescent deep-sea basalt trench.", grokTwist: "Schools of glowing clockwork manta-gliders banking past the glass ribs.", foley: "footsteps on steel deck plates, muffled deep-water hull creaks, sonar pings" },
];

export function runVariantArena({ concept = "Gravity Ball 180-BPM Championship", limit = 3 } = {}) {
  const cleanConcept = String(concept || "Quantum Arena").trim();
  const lower = cleanConcept.toLowerCase();
  const started = performance.now();

  const evaluated = ARENA_PROFILES.map((prof) => {
    const t0 = performance.now();
    const tagBonus = prof.tags.some((tag) => lower.includes(tag)) ? 0.06 : 0;
    const worldPrompt = `First-person walking view through ${cleanConcept} (${prof.title}): ${prof.agyFocus} ${prof.grokTwist} Audio: ${prof.foley}.`;
    const gate = evaluateCreativeTriad({
      agyText: prof.agyFocus,
      grokText: prof.grokTwist,
      claudeSynthesis: { worldPrompt, confidence: 0.89 },
    });
    const setupEvent = compileGenieWorldSetup({ promptText: worldPrompt, transport: "webrtc" });
    const readabilityScore = +(1 - prof.fogDensity * 0.45).toFixed(4);
    const totalScore = +Math.min(
      1,
      0.62 * gate.sovereign_integral + 0.32 * readabilityScore + tagBonus
    ).toFixed(4);

    return {
      id: prof.id,
      title: prof.title,
      tags: prof.tags,
      concept: cleanConcept,
      score: totalScore,
      readabilityScore,
      gate,
      worldPrompt: setupEvent.world_prompt.text,
      genieWorldSetup: setupEvent,
      worldBlueprint: {
        archetype: prof.archetype,
        skyColor: prof.skyColor,
        accentColor: prof.accentColor,
        portalColor: prof.portalColor,
        particles: prof.particles,
        fogDensity: prof.fogDensity,
        ringCount: prof.ringCount,
        pillarSpacing: prof.pillarSpacing,
        corridorLength: 82,
      },
      evalMs: +(performance.now() - t0).toFixed(2),
    };
  });

  evaluated.sort((a, b) => b.score - a.score);
  const cleanLimit = Math.max(3, Math.min(ARENA_PROFILES.length, Number(limit) || 4));
  const candidates = evaluated.slice(0, cleanLimit);
  const winner = candidates[0];

  return {
    arenaId: `arena-${Date.now().toString(36)}`,
    concept: cleanConcept,
    totalEvaluated: evaluated.length,
    winnerId: winner.id,
    winnerTitle: winner.title,
    totalEvalMs: +(performance.now() - started).toFixed(2),
    candidates,
    exportSpec: {
      schema: "5d-triad-level-spec/v2",
      schemaRevision: "4.0.0",
      concept: cleanConcept,
      totalCatalogEvaluated: evaluated.length,
      recommendedVariant: winner.id,
      blueprint: winner.worldBlueprint,
      genie4Prompt: winner.worldPrompt,
      controls: ["WASD", "Arrows", "Touch Dual-Stick", "Space (Jump)", "E (Interact)"],
    },
  };
}
