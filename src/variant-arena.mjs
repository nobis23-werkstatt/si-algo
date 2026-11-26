// Game-Prototyping Variant-Arena (inspired by variant-arena + si-algo).
// Generates 3 competing playable 3D level blueprints + Genie 4 world prompts
// for any game concept (e.g. Gravity Ball, Quantum World, Cyber-Arena), scores
// each candidate deterministically, and crowns the fastest/highest-clarity winner.

import { compileGenieWorldSetup, evaluateCreativeTriad } from "./sovereign-gate.mjs";

const ARENA_PROFILES = [
  {
    id: "alpha-flow",
    title: "Variant A · Architectural Sightline Flow",
    archetype: "cathedral",
    skyColor: "#0a1628",
    accentColor: "#38bdf8",
    portalColor: "#34d399",
    particles: "mist",
    fogDensity: 0.3,
    ringCount: 7,
    pillarSpacing: 8,
    agyFocus: "Clean sightlines every 12m, elevated marble momentum ramps, crisp sunlit rim-lighting for instant player readability.",
    grokTwist: "Counter-rotating brass gravity rings framing the central walkway with zero visual clutter.",
    foley: "crisp footsteps on polished travertine, rhythmic metallic ring hum, wind rushing past colonnades",
  },
  {
    id: "beta-kinetic",
    title: "Variant B · Kinetic Hazard & Verticality",
    archetype: "spire",
    skyColor: "#160d29",
    accentColor: "#f97316",
    portalColor: "#fbbf24",
    particles: "embers",
    fogDensity: 0.38,
    ringCount: 11,
    pillarSpacing: 6,
    agyFocus: "Tiered basalt catwalks suspended above a kinetic turbine chasm with high-contrast hazard beacons.",
    grokTwist: "Magnetic stepping-plates locking into place ahead of the player as copper pendulums swing overhead.",
    foley: "boots clanking on grated steel catwalks, magnetic latch snaps, deep canyon updrafts",
  },
  {
    id: "gamma-quantum",
    title: "Variant C · Bioluminescent Quantum Contrast",
    archetype: "library",
    skyColor: "#051b1e",
    accentColor: "#c084fc",
    portalColor: "#2dd4bf",
    particles: "fireflies",
    fogDensity: 0.44,
    ringCount: 9,
    pillarSpacing: 7,
    agyFocus: "Reflective obsidian tide-channels flanking a crystalline bridge with clear landmark towers.",
    grokTwist: "Prismatic glass monoliths splitting sunbeams into floor-projected navigation vectors.",
    foley: "footsteps splashing lightly over shallow glass channels, crystalline chimes, water lapping against basalt",
  },
];

export function runVariantArena({ concept = "Gravity Ball Championship Canyon" } = {}) {
  const cleanConcept = String(concept || "Quantum Arena").trim();
  const started = performance.now();

  const candidates = ARENA_PROFILES.map((prof) => {
    const t0 = performance.now();
    const worldPrompt = `First-person walking view through ${cleanConcept} (${prof.title}): ${prof.agyFocus} ${prof.grokTwist} Audio: ${prof.foley}.`;
    const gate = evaluateCreativeTriad({
      agyText: prof.agyFocus,
      grokText: prof.grokTwist,
      claudeSynthesis: { worldPrompt, confidence: 0.89 },
    });
    const setupEvent = compileGenieWorldSetup({ promptText: worldPrompt, transport: "webrtc" });

    // Readability & gameplay fitness bonus (lower fog + stronger diversity)
    const readabilityScore = +(1 - prof.fogDensity * 0.45).toFixed(4);
    const totalScore = +(0.65 * gate.sovereign_integral + 0.35 * readabilityScore).toFixed(4);

    return {
      id: prof.id,
      title: prof.title,
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
        corridorLength: 76,
      },
      evalMs: +(performance.now() - t0).toFixed(2),
    };
  });

  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];

  return {
    arenaId: `arena-${Date.now().toString(36)}`,
    concept: cleanConcept,
    winnerId: winner.id,
    winnerTitle: winner.title,
    totalEvalMs: +(performance.now() - started).toFixed(2),
    candidates,
    exportSpec: {
      schema: "5d-triad-level-spec/v2",
      concept: cleanConcept,
      recommendedVariant: winner.id,
      blueprint: winner.worldBlueprint,
      genie4Prompt: winner.worldPrompt,
      controls: ["WASD", "Arrows", "Space (Jump)", "E (Interact)"],
    },
  };
}
