#!/usr/bin/env node
// Headless CLI runner for the Local Triad Creative Bus (AGY x Grok x Claude -> Genie 4).
// Usage:
//   npm run triad -- "Lantern-lit glass bridge over a bioluminescent canyon" [--instant] [--json]

import path from "node:path";
import { TriadCreativeBus, probeLocalAgents } from "./triad-bus.mjs";

const argv = process.argv.slice(2);
const asJson = argv.includes("--json") && (argv.splice(argv.indexOf("--json"), 1), true);
const instant = argv.includes("--instant") && (argv.splice(argv.indexOf("--instant"), 1), true);
const seed = argv.join(" ").trim() || "Clockwork botanical conservatory suspended above sunlit clouds";

const agents = await probeLocalAgents();
const bus = new TriadCreativeBus({
  ledgerPath: path.resolve(process.cwd(), "data", "triad-ledger.jsonl"),
  cliTimeoutMs: 22_000,
});

if (!asJson) {
  console.log("=== Local Agent Mesh Status ===");
  for (const a of agents) {
    console.log(
      `  [${a.installed ? "READY" : "MISS "}] ${a.label.padEnd(20)} -> ${a.version || a.error} (${a.latencyMs}ms)`
    );
  }
  console.log(`\n=== Running Creative Triad (${instant ? "Turbo-Instant" : "Live Local CLIs"}) ===`);
}

const round = await bus.runCreativeRound({
  seed,
  isInitial: true,
  useLocalClis: !instant,
});

if (asJson) {
  console.log(JSON.stringify({ agents, round }, null, 2));
} else {
  console.log(`\n[AGY   | ${round.agents.agy.mode} | ${round.agents.agy.latencyMs}ms]\n  ${round.agents.agy.text}`);
  console.log(`\n[GROK  | ${round.agents.grok.mode} | ${round.agents.grok.latencyMs}ms]\n  ${round.agents.grok.text}`);
  console.log(`\n[CLAUDE| ${round.agents.claude.mode} | ${round.agents.claude.latencyMs}ms]\n  Rationale: ${round.agents.claude.rationale}`);
  console.log(
    `\n=== Sovereign Gate: ${round.gate.decision} (I_SI = ${round.gate.sovereign_integral}, overlap = ${round.gate.agy_grok_overlap}) ===`
  );
  console.log(`\n=== Genie 4 world_setup Payload (${round.totalLatencyMs}ms total) ===`);
  console.log(JSON.stringify(round.genieEvents.world_setup, null, 2));
}
