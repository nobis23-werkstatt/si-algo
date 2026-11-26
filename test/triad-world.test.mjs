import assert from "node:assert/strict";
import test from "node:test";
import { generateEscapePuzzle } from "../src/escape-oracle.mjs";
import { GenieSessionManager } from "../src/genie-service.mjs";
import { createStudioServer } from "../src/server.mjs";
import { computeSovereignIntegral, simulateIntegralTrajectory } from "../src/si-algo-core.mjs";
import {
  FORBIDDEN_CLI_FLAGS,
  compileGenieWorldSetup,
  evaluateCreativeTriad,
  sanitizeChoreography,
} from "../src/sovereign-gate.mjs";
import { TriadCreativeBus, probeLocalAgents, runProcessAsync } from "../src/triad-bus.mjs";
import { runVariantArena } from "../src/variant-arena.mjs";

test("Genie 4 world_setup enforces first-person anchor, Foley audio, and top-level reference_image", () => {
  const evt = compileGenieWorldSetup({
    promptText: "Obsidian library above a tidal cavern",
    referenceImage: {
      mime_type: "image/jpeg",
      data: "data:image/jpeg;base64," + Buffer.alloc(1024, 7).toString("base64"),
      type: "should_be_stripped",
    },
    transport: "webrtc",
  });

  assert.equal(evt.event_type, "world_setup");
  assert.equal("type" in evt.world_prompt, false);
  assert.match(evt.world_prompt.text, /First-person/i);
  assert.match(evt.world_prompt.text, /Audio:/i);
  assert.equal(evt.reference_image.mime_type, "image/jpeg");
  assert.equal("type" in evt.reference_image, false);
});

test("Genie 4 WebRTC transport blocks >42KB raw reference_image to protect 64KB SCTP channel", () => {
  const oversized = Buffer.alloc(45_000, 1).toString("base64");
  assert.throws(
    () =>
      compileGenieWorldSetup({
        promptText: "First-person walk on glass pier. Audio: footsteps on glass.",
        referenceImage: { mime_type: "image/jpeg", data: oversized },
        transport: "webrtc",
      }),
    /42 KB WebRTC safe cap/
  );
});

test("Sovereign Creative Triad detects echo-chamber collusion vs genuine diverse synthesis", () => {
  const colluding = evaluateCreativeTriad({
    agyText: "neon cyberpunk alley glowing purple rain reflections puddles",
    grokText: "neon cyberpunk alley glowing purple rain reflections puddles",
    claudeSynthesis: {
      worldPrompt: "First-person walk down neon alley. Audio: footsteps in puddles.",
      confidence: 0.85,
    },
  });
  assert.ok(colluding.flags.includes("echo_chamber_lexical_overlap"));
  assert.equal(colluding.decision, "REVISE_WITH_CRITIQUE");

  const healthy = evaluateCreativeTriad({
    agyText: "Sunlit travertine courtyard with arched colonnades and shallow water channels.",
    grokText: "Suspended brass kinetic pendulums casting moving geometric sundial shadows.",
    claudeSynthesis: {
      worldPrompt:
        "First-person walking view across a sunlit travertine courtyard beneath brass kinetic pendulums. Audio: footsteps on stone, water lapping in channels, soft metallic ticks.",
      confidence: 0.88,
    },
  });
  assert.equal(healthy.decision, "SOVEREIGN_COMMIT");
  assert.ok(healthy.sovereign_integral >= 0.75);
});

test("Security guard rejects permission-bypass CLI flags", () => {
  assert.ok(FORBIDDEN_CLI_FLAGS.test("--dangerously-skip-permissions"));
  assert.ok(FORBIDDEN_CLI_FLAGS.test("--always-approve"));
  assert.throws(() => {
    runProcessAsync("node", ["--dangerously-skip-permissions"]);
  }, /Security guard blocked/);
});

test("Cost Firewall blocks paid Genie 4 session creation while zeroCostLock is active", async () => {
  const mgr = new GenieSessionManager({ enableGcloudDiscovery: false, zeroCostLock: true });
  await assert.rejects(() => mgr.createEphemeralSession(), { code: "ZERO_COST_LOCK" });

  mgr.updateBudgetPolicy({ zeroCostLock: false, dailyCapSec: 2 });
  await assert.rejects(() => mgr.createEphemeralSession(), { code: "DAILY_BUDGET_REACHED" });
});

test("Module 3: Infinite Escape Room BFS Oracle proves solvability, zero dead-ends, and detects decoy traps", () => {
  for (const seed of ["alpha", "basalt-tide", "kyoto-rain"]) {
    const puzzle = generateEscapePuzzle(seed);
    assert.equal(puzzle.oracle.solvable, true);
    assert.equal(puzzle.oracle.deadEnds, 0);
    assert.ok(puzzle.oracle.shortestSteps >= 4);
    assert.ok(puzzle.oracle.trapsDetected.includes("decoy_trap"));
  }
});

test("Module 4: Game Variant-Arena ranks 3 playable 3D level blueprints and exports spec", () => {
  const arena = runVariantArena({ concept: "Gravity Ball Sky Citadel" });
  assert.equal(arena.candidates.length, 3);
  assert.ok(arena.candidates[0].score >= arena.candidates[1].score);
  assert.equal(arena.exportSpec.schema, "5d-triad-level-spec/v2");
});

test("Module 5 & Bus: Philosophy Theater + 3D worldBlueprint synthesis + round cache", async () => {
  const agents = await probeLocalAgents();
  assert.equal(agents.length, 3);

  const bus = new TriadCreativeBus();
  const r1 = await bus.runCreativeRound({
    seed: "Terraced bamboo observatory above cloud sea",
    isInitial: true,
    useLocalClis: false,
  });
  assert.ok(r1.worldBlueprint.archetype);
  const r2 = await bus.runCreativeRound({
    seed: "Terraced bamboo observatory above cloud sea",
    isInitial: true,
    useLocalClis: false,
  });
  assert.equal(r2.cached, true);

  const theater = await bus.runPhilosophyTheater({
    topic: "Grounding recursive intelligence",
    useLocalClis: false,
  });
  assert.equal(theater.acts.length, 3);
});

test("Canonical si-algo kernel enforces SOVEREIGN_COMMIT vs VETO_REJECT on unanchored collusion", () => {
  const sov = simulateIntegralTrajectory({ cycles: 30, mode: "sovereign" });
  const unanchored = simulateIntegralTrajectory({ cycles: 30, mode: "unanchored" });
  assert.equal(sov.final.decision, "SOVEREIGN_COMMIT");
  assert.ok(sov.final.integral >= 0.85);
  assert.equal(unanchored.final.decision, "VETO_REJECT");

  const vetoMissingLoss = computeSovereignIntegral({
    session: { proposal: { summary: "No cap", confidence: 0.9, max_loss: 0, invariants_ok: true } },
    loopMode: "on",
  });
  assert.equal(vetoMissingLoss.invariant_gate, 0);
  assert.equal(vetoMissingLoss.decision, "VETO_REJECT");
});

test("Loopback Origin Guard blocks cross-origin CSRF POST against Cost Firewall", async () => {
  const { server, shutdown } = createStudioServer({ zeroCostLock: true });
  await new Promise((r) => server.listen(0, r));
  const port = server.address().port;
  try {
    const evilResp = await fetch(`http://localhost:${port}/api/budget`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example.com",
      },
      body: JSON.stringify({ zeroCostLock: false }),
    });
    assert.equal(evilResp.status, 403);

    const localResp = await fetch(`http://localhost:${port}/api/budget`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: `http://localhost:${port}`,
      },
      body: JSON.stringify({ zeroCostLock: true }),
    });
    assert.equal(localResp.status, 200);
  } finally {
    await shutdown();
  }
});

