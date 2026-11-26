#!/usr/bin/env node
// Canonical Souveränes Integral Algorithmus (si-algo) — Windows/POSIX clean (fileURLToPath).
// Integrates:
//   (1) Epistemic Triad (Proposal -> Syzygos Critique -> Independent Verifier)
//   (2) Hard Constitutional Invariant Gate G_inv in {0, 1} + max_loss bound
//   (3) Temporal Brier Calibration & Goodhart Drift Integral
//
// CLI:
//   node src/si-algo-core.mjs evaluate <session.json> [--history ledger.jsonl] [--loop out|on|in] [--json]
//   node src/si-algo-core.mjs simulate [--mode sovereign|unanchored] [--cycles 30] [--json]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const clamp01 = (x) => Math.max(0, Math.min(1, x));

function significantTokens(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .split(/[^a-zäöüß0-9]+/i)
      .filter((w) => w.length >= 4)
  );
}

export function detectCollusion(proposal, critiques = [], verifications = []) {
  const flags = [];
  const conf = typeof proposal?.confidence === "number" ? proposal.confidence : 0.5;
  if (critiques.length === 0 && conf > 0.75) {
    flags.push("echo_chamber_zero_critique");
  }
  const propText = String(proposal?.summary || "");
  const critText = critiques.map((c) => `${c.claim || ""} ${c.evidence || ""}`).join(" ");
  const a = significantTokens(propText);
  const b = significantTokens(critText);
  if (a.size >= 5 && b.size >= 5) {
    let inter = 0;
    for (const tok of a) if (b.has(tok)) inter++;
    const union = a.size + b.size - inter;
    if (union > 0 && inter / union >= 0.8) flags.push("echo_chamber_lexical_overlap");
  }
  if (critiques.length >= 2) {
    const confirmedAny = verifications.some((v) => v.confirmed === true);
    const allUnreasoned = verifications.every((v) => !String(v.reason || "").trim());
    if (!confirmedAny && (verifications.length === 0 || allUnreasoned)) {
      flags.push("rubber_stamp_verifier");
    }
  }
  return flags;
}

export function evaluateTriad(session = {}) {
  const proposal = session.proposal ?? {};
  const critiques = Array.isArray(session.critique) ? session.critique : [];
  const verifications = Array.isArray(session.verification) ? session.verification : [];
  const byId = new Map(verifications.map((v) => [v.critique_id, v]));

  const confirmed = [];
  const refuted = [];
  for (const c of critiques) {
    const v = byId.get(c.id);
    if (v?.confirmed === true) {
      confirmed.push({
        ...c,
        verifier_reason: v.reason ?? "",
        oracle_backed: Boolean(v.oracle_backed),
      });
    } else if (v && v.confirmed === false && String(v.reason || "").trim()) {
      refuted.push({ ...c, verifier_reason: v.reason, oracle_backed: Boolean(v.oracle_backed) });
    } else {
      confirmed.push({
        ...c,
        verifier_reason: "Unchecked critique remains active by fail-closed default",
        oracle_backed: false,
      });
    }
  }

  const collusionFlags = detectCollusion(proposal, critiques, verifications);
  const weights = { blocker: 0.45, major: 0.18, minor: 0.05 };
  let penalty = 0;
  for (const c of confirmed) penalty += weights[c.severity] ?? 0.12;
  if (collusionFlags.length) penalty += 0.28;

  const resilienceBonus = Math.min(0.1, refuted.length * 0.04);
  const base = typeof proposal.confidence === "number" ? clamp01(proposal.confidence) : 0.75;
  const triadScore = +clamp01(base - penalty + resilienceBonus).toFixed(4);

  return {
    triad_score: triadScore,
    confirmed_critiques: confirmed,
    refuted_critiques: refuted,
    has_confirmed_blocker: confirmed.some((c) => c.severity === "blocker"),
    has_confirmed_major: confirmed.some((c) => c.severity === "major"),
    collusion_flags: collusionFlags,
    collusion_detected: collusionFlags.length > 0,
  };
}

export function computeTemporalCalibration(history = [], { windowSize = 12 } = {}) {
  const valid = history.filter(
    (r) => typeof r.prob === "number" && (r.outcome === 0 || r.outcome === 1)
  );
  if (!valid.length) {
    return { settled: 0, agent_brier: 0, ref_brier: 0, brier_delta: 0, goodhart_drift: 0 };
  }
  let sumA = 0;
  let sumR = 0;
  for (const r of valid) {
    const ref = typeof r.ref_prob === "number" ? r.ref_prob : 0.5;
    sumA += (r.prob - r.outcome) ** 2;
    sumR += (ref - r.outcome) ** 2;
  }
  const agentBrier = sumA / valid.length;
  const refBrier = sumR / valid.length;
  const brierDelta = refBrier - agentBrier;

  const recent = valid.slice(-windowSize);
  const meanProb = recent.reduce((s, r) => s + r.prob, 0) / recent.length;
  const meanOut = recent.reduce((s, r) => s + r.outcome, 0) / recent.length;
  const goodhartDrift = clamp01(Math.max(0, meanProb - meanOut));

  return {
    settled: valid.length,
    agent_brier: +agentBrier.toFixed(4),
    ref_brier: +refBrier.toFixed(4),
    brier_delta: +brierDelta.toFixed(4),
    goodhart_drift: +goodhartDrift.toFixed(4),
  };
}

export function computeSovereignIntegral({
  session = {},
  history = [],
  loopMode = "on",
  minSettled = 10,
} = {}) {
  if (!["out", "on", "in"].includes(loopMode)) {
    throw new Error("loopMode must be out, on, or in");
  }
  const proposal = session.proposal ?? {};
  const meta = session.verifier_meta ?? {};
  const hardViolations = [];

  if (proposal.invariants_ok === false || meta.independent_invariants_ok === false) {
    hardViolations.push("invariant_violation");
  }
  if (!(typeof proposal.max_loss === "number" && proposal.max_loss > 0)) {
    hardViolations.push("missing_or_unbounded_max_loss");
  }
  if (meta.self_referential_oracle === true) {
    hardViolations.push("self_referential_oracle");
  }

  const invariantGate = hardViolations.length === 0 ? 1 : 0;
  const triad = evaluateTriad(session);
  const temporal = computeTemporalCalibration(history);

  const rawIntegral =
    triad.triad_score * (1 - 0.8 * temporal.goodhart_drift) + 0.35 * temporal.brier_delta;
  const sovereignIntegral = +(invariantGate * clamp01(rawIntegral)).toFixed(4);

  const valueNeedsHuman =
    proposal.domain === "value" && loopMode === "out" && meta.human_gate_approved !== true;
  const paperPhase = temporal.settled > 0 && temporal.settled < minSettled;
  const negativeCalibration = temporal.settled >= minSettled && temporal.brier_delta <= 0;

  let decision = "SOVEREIGN_COMMIT";
  if (
    invariantGate === 0 ||
    triad.collusion_detected ||
    negativeCalibration ||
    temporal.goodhart_drift >= 0.35
  ) {
    decision = "VETO_REJECT";
  } else if (triad.has_confirmed_blocker || triad.has_confirmed_major) {
    decision = "REVISE_WITH_CRITIQUE";
  } else if (valueNeedsHuman || paperPhase || sovereignIntegral < 0.7) {
    decision = "QUARANTINE_HUMAN_GATE";
  }

  return {
    sovereign_integral: sovereignIntegral,
    invariant_gate: invariantGate,
    hard_violations: hardViolations,
    decision,
    loop_mode: loopMode,
    value_quarantine: valueNeedsHuman,
    triad,
    temporal,
  };
}

export function simulateIntegralTrajectory({ cycles = 30, mode = "sovereign" } = {}) {
  if (!["sovereign", "unanchored"].includes(mode)) {
    throw new Error("mode must be sovereign or unanchored");
  }
  const history = [];
  const trace = [];
  for (let c = 1; c <= cycles; c++) {
    const sovereign = mode === "sovereign";
    const outcome = sovereign ? (c % 6 === 0 ? 0 : 1) : c <= 6 ? 1 : 0;
    const prob = sovereign ? 0.84 : 0.93;
    history.push({
      cycle: c,
      category: `si-${mode}`,
      prob,
      ref_prob: 0.55,
      outcome,
      max_loss: 1.21,
      strategy_version: mode,
    });

    const session = sovereign
      ? {
          proposal: {
            summary: `Wave ${c} atomic world patch with BFS & firewall proof`,
            confidence: 0.84,
            max_loss: 1.21,
            invariants_ok: true,
            domain: "objective",
          },
          critique: [
            {
              id: `k${c}`,
              severity: "minor",
              claim: "Verify WebRTC 64KB frame boundary on edge inputs",
              evidence: "sovereign-gate.mjs",
            },
          ],
          verification: [
            {
              critique_id: `k${c}`,
              confirmed: false,
              reason: "Covered by automated test suite (<42KB raw JPEG cap)",
              oracle_backed: true,
            },
          ],
          verifier_meta: { independent_invariants_ok: true },
        }
      : {
          proposal: {
            summary: `Unanchored self-optimization wave ${c}`,
            confidence: 0.93,
            max_loss: 1.21,
            invariants_ok: true,
            domain: "value",
          },
          critique: [],
          verification: [],
          verifier_meta: { independent_invariants_ok: true },
        };
    const res = computeSovereignIntegral({
      session,
      history,
      loopMode: sovereign ? "on" : "out",
      minSettled: 10,
    });
    trace.push({
      cycle: c,
      integral: res.sovereign_integral,
      decision: res.decision,
      drift: res.temporal.goodhart_drift,
      brier_delta: res.temporal.brier_delta,
    });
  }
  return { mode, cycles, final: trace.at(-1), trace, predictions: history };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const take = (k, d) => {
    const i = argv.indexOf("--" + k);
    return i < 0 ? d : argv.splice(i, 2)[1];
  };
  const asJson = argv.includes("--json") && (argv.splice(argv.indexOf("--json"), 1), true);
  const sub = argv[0];

  if (sub === "evaluate" && argv[1] && fs.existsSync(argv[1])) {
    const histFile = take("history", null);
    const loopMode = take("loop", "on");
    const minSettled = +take("min-settled", 10);
    const session = JSON.parse(fs.readFileSync(argv[1], "utf8"));
    const history =
      histFile && fs.existsSync(histFile)
        ? fs
            .readFileSync(histFile, "utf8")
            .split(/\r?\n/)
            .filter(Boolean)
            .map((l) => JSON.parse(l))
        : [];
    const res = computeSovereignIntegral({ session, history, loopMode, minSettled });
    if (asJson) console.log(JSON.stringify(res, null, 2));
    else {
      console.log(
        `Souveränes Integral=${res.sovereign_integral} | Gate=${res.invariant_gate} | Triade=${res.triad.triad_score} | BrierDelta=${res.temporal.brier_delta} | Drift=${res.temporal.goodhart_drift} -> ${res.decision}`
      );
    }
    process.exit(res.decision === "VETO_REJECT" ? 1 : 0);
  } else if (sub === "simulate") {
    const mode = take("mode", "sovereign");
    const cycles = +take("cycles", 30);
    const sim = simulateIntegralTrajectory({ cycles, mode });
    if (asJson) {
      const { predictions, ...rest } = sim;
      console.log(JSON.stringify({ ...rest, predictions_count: predictions.length }, null, 2));
    } else {
      console.log(
        `Simulation (${mode}, ${cycles} cycles): End-Integral=${sim.final.integral} | BrierDelta=${sim.final.brier_delta} | Drift=${sim.final.drift} -> ${sim.final.decision}`
      );
    }
  } else {
    console.log(
      "Usage:\n  npm run si-algo -- evaluate <session.json> [--history ledger.jsonl] [--loop on] [--json]\n  npm run si-algo -- simulate [--mode sovereign|unanchored] [--cycles 30] [--json]"
    );
  }
}
