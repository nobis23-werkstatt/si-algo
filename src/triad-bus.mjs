// Local Multi-Agent Creative Bus: AGY x Grok x Claude -> 3D Blueprint + Genie 4 Engine.
// Uses ultra-lean, low-cost CLI flags (agy --effort low, claude --bare --model haiku,
// grok --reasoning-effort low) + structured 3D worldBlueprint synthesis + Theater Mode.

import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  FORBIDDEN_CLI_FLAGS,
  compileGenieWorldSetup,
  evaluateCreativeTriad,
  sanitizeChoreography,
} from "./sovereign-gate.mjs";

const HOME = os.homedir();
const LOCALAPPDATA = process.env.LOCALAPPDATA || path.join(HOME, "AppData", "Local");

const CANDIDATE_PATHS = {
  agy: [
    "agy",
    path.join(LOCALAPPDATA, "agy", "bin", process.platform === "win32" ? "agy.exe" : "agy"),
  ],
  grok: [
    "grok",
    path.join(HOME, ".grok", "bin", process.platform === "win32" ? "grok.exe" : "grok"),
  ],
  claude: [
    "claude",
    path.join(HOME, ".local", "bin", process.platform === "win32" ? "claude.exe" : "claude"),
  ],
};

function resolveBinary(agentName) {
  const candidates = CANDIDATE_PATHS[agentName] || [agentName];
  for (const c of candidates) {
    if (c.includes(path.sep) && fs.existsSync(c)) {
      return c;
    }
  }
  return candidates[0];
}

function assertSafeArgs(args) {
  const joined = args.join(" ");
  if (FORBIDDEN_CLI_FLAGS.test(joined)) {
    throw new Error(`Security guard blocked forbidden CLI flag in: ${joined}`);
  }
}

export function runProcessAsync(bin, args, { timeoutMs = 16_000, cwd = process.cwd() } = {}) {
  assertSafeArgs(args);
  return new Promise((resolve) => {
    const started = performance.now();
    let stdout = "";
    let stderr = "";
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        ...result,
        latencyMs: Math.round(performance.now() - started),
      });
    };

    let child;
    try {
      child = spawn(bin, args, {
        cwd,
        windowsHide: true,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, NO_COLOR: "1", CI: "1" },
      });
    } catch (err) {
      return finish({ ok: false, output: "", error: err.message });
    }

    const timer = setTimeout(() => {
      try {
        child.kill("SIGTERM");
      } catch {}
      finish({ ok: false, output: stdout.trim(), error: `Timed out after ${timeoutMs}ms` });
    }, timeoutMs);

    child.stdout.on("data", (chunk) => {
      if (stdout.length < 32_000) stdout += chunk.toString("utf8");
    });
    child.stderr.on("data", (chunk) => {
      if (stderr.length < 16_000) stderr += chunk.toString("utf8");
    });
    child.on("error", (err) => {
      finish({ ok: false, output: "", error: err.message });
    });
    child.on("close", (code) => {
      const out = stdout.trim();
      if (code === 0 && out) {
        finish({ ok: true, output: out, error: "" });
      } else {
        finish({
          ok: false,
          output: out,
          error: (stderr || out || `Exited with code ${code}`).trim().slice(0, 300),
        });
      }
    });
  });
}

export async function probeLocalAgents() {
  const specs = [
    { id: "agy", label: "AGY (Architect)", bin: resolveBinary("agy"), args: ["--version"] },
    { id: "grok", label: "Grok (Catalyst)", bin: resolveBinary("grok"), args: ["--version"] },
    { id: "claude", label: "Claude (Integrator)", bin: resolveBinary("claude"), args: ["--version"] },
  ];

  return Promise.all(
    specs.map(async (s) => {
      const res = await runProcessAsync(s.bin, s.args, { timeoutMs: 4000 });
      return {
        id: s.id,
        label: s.label,
        binary: s.bin,
        installed: res.ok,
        version: res.ok ? res.output.split(/\r?\n/)[0].trim() : null,
        latencyMs: res.latencyMs,
        error: res.ok ? null : res.error,
      };
    })
  );
}

/**
 * Derives a deterministic 0-€ 3D WebGL world blueprint from any text prompt
 * so the playable 3D viewport morphs instantaneously on every round!
 */
export function deriveBlueprintFromSeed(text = "") {
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
  const pal = palettes[archetype];

  return {
    archetype,
    skyColor: pal.skyColor,
    accentColor: pal.accentColor,
    portalColor: pal.portalColor,
    particles,
    fogDensity: particles === "rain" ? 0.44 : 0.33,
    ringCount: 8,
    pillarSpacing: 7.5,
    corridorLength: 80,
  };
}

function fallbackArchitect(seed, worldHistory) {
  const turn = worldHistory.length + 1;
  return `First-person walking path along a sunlit ${seed} with clear sightlines, tactile architectural landmarks at 10m intervals, warm rim lighting, and grounded parallax. Audio: crisp footsteps on stone and timber, gentle breeze through arches, subtle mechanical clicks (wave ${turn}).`;
}

const GROK_TWISTS = [
  "kinetic brass Orrery bridges unfolding overhead as amber mist drifts across reflective puddles",
  "bioluminescent glass conduits pulsing in sync with distant rain pattering on copper eaves",
  "a sudden sunbeam cutting through prismatic skylights while origami wind-vanes spin softly",
  "floating basalt stepping-stones locking into place with crisp magnetic clinks ahead",
];

function fallbackCatalyst(seed, worldHistory) {
  const twist = GROK_TWISTS[worldHistory.length % GROK_TWISTS.length];
  return `Inject lateral contrast into "${seed}": add ${twist}, avoiding static corridors or cliché neon fog.`;
}

function extractJsonObject(raw) {
  const text = String(raw || "").trim();
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenceMatch ? fenceMatch[1].trim() : text;
  const first = candidate.indexOf("{");
  const last = candidate.lastIndexOf("}");
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(candidate.slice(first, last + 1));
    } catch {}
  }
  return null;
}

function fallbackIntegrator({ seed, agyIdea, grokIdea, isInitial }) {
  const cleanAgy = agyIdea.replace(/\s+/g, " ").slice(0, 200);
  const cleanGrok = grokIdea
    .replace(/^Inject lateral contrast[^:]*:\s*/i, "")
    .replace(/\s+/g, " ")
    .slice(0, 175);

  const worldPrompt = `First-person walking view through ${seed}: ${cleanGrok}. Spatial layout grounded with clear walkable path ahead (${cleanAgy.slice(0, 100)}). Audio: footsteps on wet stone and brushed metal, light rain pattering on glass eaves, crisp mechanical relay clicks.`;
  const steerPrompt = isInitial
    ? worldPrompt
    : `Ahead along the path, ${cleanGrok.replace(/\.*$/, "")}. Audio: footsteps shifting onto resonant walkway panels and crisp ambient chimes.`;

  return {
    worldPrompt,
    steerPrompt,
    rationale: "Fused AGY spatial kinematics + Foley grounding with Grok kinetic twist inside Genie 4's coherence window.",
    confidence: 0.87,
    worldBlueprint: deriveBlueprintFromSeed(`${seed} ${cleanGrok}`),
    choreography: [
      { input: "key_w", holdMs: 1500 },
      { input: "arrow_right", holdMs: 320 },
      { input: "key_w", holdMs: 1300 },
    ],
  };
}

export class TriadCreativeBus {
  constructor({ ledgerPath = null, cliTimeoutMs = 16_000 } = {}) {
    this.cliTimeoutMs = cliTimeoutMs;
    this.ledgerPath = ledgerPath;
    this.cache = new Map();
    this.worldHistory = [];
    this.listeners = new Set();
  }

  onEvent(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type, payload) {
    const evt = { type, ts: new Date().toISOString(), ...payload };
    for (const fn of this.listeners) {
      try {
        fn(evt);
      } catch {}
    }
  }

  async invokeAgy(seed, contextSummary) {
    const bin = resolveBinary("agy");
    const prompt = [
      "You are AGY (World Architect) in a 3-agent triad with Grok and Claude steering a playable 3D & Genie 4 world.",
      "Propose ONLY 2 concise sentences: (1) concrete first-person walking architecture & lighting, (2) concrete physical contact Foley audio (footsteps, water, wind, tactile clicks — NO music).",
      contextSummary ? `Current world state: ${contextSummary}` : "",
      `Creative direction: ${seed}`,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await runProcessAsync(
      bin,
      ["-p", "--disable-slash-commands", "--effort", "low", "--mode", "plan", prompt],
      { timeoutMs: this.cliTimeoutMs }
    );
    if (res.ok) {
      return { agent: "agy", mode: "local-cli (low-effort)", text: res.output, latencyMs: res.latencyMs };
    }
    return {
      agent: "agy",
      mode: "local-synthesizer",
      text: fallbackArchitect(seed, this.worldHistory),
      latencyMs: res.latencyMs,
      note: res.error,
    };
  }

  async invokeGrok(seed, contextSummary) {
    const bin = resolveBinary("grok");
    const sys =
      "You are Grok (Lateral Catalyst & Syzygos) in a fast creative triad with AGY and Claude. Output 2 punchy sentences introducing a surprising visual/kinetic mutation and challenging any cliché.";
    const prompt = [
      contextSummary ? `Current world state: ${contextSummary}` : "",
      `Creative seed: ${seed}`,
    ]
      .filter(Boolean)
      .join("\n");

    const res = await runProcessAsync(
      bin,
      [
        "-p",
        "--no-memory",
        "--no-subagents",
        "--no-plan",
        "--disable-web-search",
        "--reasoning-effort",
        "low",
        "--tools",
        "",
        "--system-prompt-override",
        sys,
        prompt,
      ],
      { timeoutMs: this.cliTimeoutMs }
    );
    if (res.ok) {
      return { agent: "grok", mode: "local-cli (low-effort)", text: res.output, latencyMs: res.latencyMs };
    }
    return {
      agent: "grok",
      mode: "local-synthesizer",
      text: fallbackCatalyst(seed, this.worldHistory),
      latencyMs: res.latencyMs,
      note: res.error,
    };
  }

  async invokeClaude({ seed, agyText, grokText, isInitial, contextSummary }) {
    const bin = resolveBinary("claude");
    const sys = [
      "You are Claude (Coherence Director & Sovereign Integrator) uniting AGY and Grok for a playable 3D & Genie 4 world.",
      "Respond with ONLY valid JSON matching:",
      '{"worldPrompt":"First-person walking ... Audio: ...","steerPrompt":"Mid-session mutation < 260 chars","rationale":"1 short sentence","confidence":0.87,"archetype":"cathedral|library|canyon|spire","particles":"fireflies|rain|embers|snow","skyColor":"#091326","accentColor":"#38bdf8","portalColor":"#34d399","choreography":[{"input":"key_w","holdMs":1400}]}',
      "Never include musical soundtracks; use physical Foley audio.",
    ].join(" ");

    const prompt = JSON.stringify({
      seed,
      isInitial,
      currentWorld: contextSummary || null,
      agyProposal: agyText,
      grokCatalyst: grokText,
    });

    const res = await runProcessAsync(
      bin,
      [
        "-p",
        "--bare",
        "--no-session-persistence",
        "--model",
        "haiku",
        "--tools",
        "",
        "--system-prompt",
        sys,
        prompt,
      ],
      { timeoutMs: this.cliTimeoutMs }
    );

    if (res.ok) {
      const parsed = extractJsonObject(res.output);
      if (parsed && (parsed.worldPrompt || parsed.steerPrompt)) {
        const defaultBp = deriveBlueprintFromSeed(`${seed} ${parsed.worldPrompt || ""}`);
        return {
          agent: "claude",
          mode: "local-cli (haiku-bare)",
          synthesis: {
            worldPrompt: parsed.worldPrompt || parsed.steerPrompt,
            steerPrompt: parsed.steerPrompt || parsed.worldPrompt,
            rationale: parsed.rationale || "Synthesized live across AGY + Grok.",
            confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0.86,
            worldBlueprint: {
              ...defaultBp,
              ...(parsed.archetype ? { archetype: parsed.archetype } : {}),
              ...(parsed.particles ? { particles: parsed.particles } : {}),
              ...(parsed.skyColor ? { skyColor: parsed.skyColor } : {}),
              ...(parsed.accentColor ? { accentColor: parsed.accentColor } : {}),
              ...(parsed.portalColor ? { portalColor: parsed.portalColor } : {}),
            },
            choreography: sanitizeChoreography(parsed.choreography),
          },
          raw: res.output,
          latencyMs: res.latencyMs,
        };
      }
    }

    const fb = fallbackIntegrator({ seed, agyIdea: agyText, grokIdea: grokText, isInitial });
    return {
      agent: "claude",
      mode: "local-synthesizer",
      synthesis: fb,
      latencyMs: res.latencyMs,
      note: res.error || "Used structured fallback parser",
    };
  }

  async runCreativeRound({
    seed,
    isInitial = true,
    useLocalClis = true,
    referenceImage = null,
    transport = "webrtc",
  }) {
    const cleanSeed =
      String(seed || "").trim() || "Sunlit solarpunk atelier suspended over a misty waterfall gorge";
    const contextSummary = isInitial ? "" : this.worldHistory.at(-1)?.steerPrompt || "";
    const cacheKey = crypto
      .createHash("sha256")
      .update(JSON.stringify({ cleanSeed, isInitial, useLocalClis, contextSummary }))
      .digest("hex")
      .slice(0, 16);

    if (this.cache.has(cacheKey) && !referenceImage) {
      const cached = this.cache.get(cacheKey);
      this.emit("triad.cached", { cacheKey, roundId: cached.roundId });
      return { ...cached, cached: true };
    }

    const roundId = `r-${Date.now().toString(36)}`;
    const t0 = performance.now();
    this.emit("triad.start", { roundId, seed: cleanSeed, isInitial, useLocalClis });

    let agyRes, grokRes;
    if (useLocalClis) {
      [agyRes, grokRes] = await Promise.all([
        this.invokeAgy(cleanSeed, contextSummary).then((r) => {
          this.emit("agent.message", { roundId, ...r });
          return r;
        }),
        this.invokeGrok(cleanSeed, contextSummary).then((r) => {
          this.emit("agent.message", { roundId, ...r });
          return r;
        }),
      ]);
    } else {
      agyRes = {
        agent: "agy",
        mode: "turbo-instant",
        text: fallbackArchitect(cleanSeed, this.worldHistory),
        latencyMs: 1,
      };
      grokRes = {
        agent: "grok",
        mode: "turbo-instant",
        text: fallbackCatalyst(cleanSeed, this.worldHistory),
        latencyMs: 1,
      };
      this.emit("agent.message", { roundId, ...agyRes });
      this.emit("agent.message", { roundId, ...grokRes });
    }

    const claudeRes = useLocalClis
      ? await this.invokeClaude({
          seed: cleanSeed,
          agyText: agyRes.text,
          grokText: grokRes.text,
          isInitial,
          contextSummary,
        })
      : {
          agent: "claude",
          mode: "turbo-instant",
          synthesis: fallbackIntegrator({
            seed: cleanSeed,
            agyIdea: agyRes.text,
            grokIdea: grokRes.text,
            isInitial,
          }),
          latencyMs: 1,
        };

    this.emit("agent.message", {
      roundId,
      agent: "claude",
      mode: claudeRes.mode,
      text: `${claudeRes.synthesis.steerPrompt}\n\n[Rationale: ${claudeRes.synthesis.rationale}]`,
      latencyMs: claudeRes.latencyMs,
      note: claudeRes.note,
    });

    const gate = evaluateCreativeTriad({
      agyText: agyRes.text,
      grokText: grokRes.text,
      claudeSynthesis: claudeRes.synthesis,
    });

    const worldSetupEvent = compileGenieWorldSetup({
      promptText: claudeRes.synthesis.worldPrompt,
      referenceImage,
      transport,
    });

    const steerEvent = {
      event_type: "input",
      content: [{ type: "text", text: claudeRes.synthesis.steerPrompt.slice(0, 340) }],
    };

    const totalLatencyMs = Math.round(performance.now() - t0);
    const record = {
      roundId,
      ts: new Date().toISOString(),
      seed: cleanSeed,
      isInitial,
      totalLatencyMs,
      agents: {
        agy: agyRes,
        grok: grokRes,
        claude: {
          mode: claudeRes.mode,
          latencyMs: claudeRes.latencyMs,
          rationale: claudeRes.synthesis.rationale,
          note: claudeRes.note || null,
        },
      },
      gate,
      worldBlueprint:
        claudeRes.synthesis.worldBlueprint || deriveBlueprintFromSeed(claudeRes.synthesis.worldPrompt),
      worldPrompt: worldSetupEvent.world_prompt.text,
      steerPrompt: claudeRes.synthesis.steerPrompt.slice(0, 340),
      choreography: sanitizeChoreography(claudeRes.synthesis.choreography),
      genieEvents: {
        world_setup: worldSetupEvent,
        input: steerEvent,
      },
    };

    this.worldHistory.push({
      roundId,
      seed: cleanSeed,
      steerPrompt: record.steerPrompt,
      integral: gate.sovereign_integral,
      decision: gate.decision,
    });
    if (this.worldHistory.length > 24) this.worldHistory.shift();

    if (!referenceImage) {
      this.cache.set(cacheKey, record);
      if (this.cache.size > 32) {
        const oldest = this.cache.keys().next().value;
        this.cache.delete(oldest);
      }
    }

    if (this.ledgerPath) {
      try {
        fs.mkdirSync(path.dirname(this.ledgerPath), { recursive: true });
        fs.appendFileSync(this.ledgerPath, JSON.stringify(record) + "\n", "utf8");
      } catch {}
    }

    this.emit("triad.complete", record);
    return record;
  }

  /**
   * Module 5: 5D Philosophy & Architecture Theater — turns any thesis/question
   * into a 3-Act spatial metamorphosis (Thesis Monument -> Antithesis Storm -> Sovereign Synthesis Portal).
   */
  async runPhilosophyTheater({ topic, useLocalClis = false }) {
    const cleanTopic =
      String(topic || "").trim() ||
      "Can recursive self-improving agents remain aligned without external physical grounding?";

    const round = await this.runCreativeRound({
      seed: `Architectural Debate Monument representing: ${cleanTopic}`,
      isInitial: true,
      useLocalClis,
    });

    const acts = [
      {
        act: 1,
        speaker: "agy",
        title: "Act I · Thesis Structure (AGY)",
        line: round.agents.agy.text,
        blueprint: {
          ...round.worldBlueprint,
          archetype: "cathedral",
          skyColor: "#09162b",
          accentColor: "#38bdf8",
          particles: "mist",
          fogDensity: 0.26,
        },
        cameraCue: { input: "key_w", holdMs: 1600 },
      },
      {
        act: 2,
        speaker: "grok",
        title: "Act II · Syzygos Antithesis Storm (Grok)",
        line: round.agents.grok.text,
        blueprint: {
          ...round.worldBlueprint,
          archetype: "spire",
          skyColor: "#1d0c24",
          accentColor: "#f97316",
          particles: "embers",
          fogDensity: 0.46,
        },
        cameraCue: { input: "arrow_left", holdMs: 420 },
      },
      {
        act: 3,
        speaker: "claude",
        title: `Act III · Sovereign Synthesis (${round.gate.decision})`,
        line: `${round.steerPrompt} — [I_SI = ${round.gate.sovereign_integral}]`,
        blueprint: {
          ...round.worldBlueprint,
          portalColor: round.gate.decision === "SOVEREIGN_COMMIT" ? "#34d399" : "#fbbf24",
          particles: "fireflies",
          fogDensity: 0.3,
        },
        cameraCue: { input: "key_w", holdMs: 2000 },
      },
    ];

    this.emit("theater.ready", { topic: cleanTopic, gate: round.gate, acts });
    return {
      topic: cleanTopic,
      gate: round.gate,
      acts,
      genieWorldSetup: round.genieEvents.world_setup,
    };
  }
}
