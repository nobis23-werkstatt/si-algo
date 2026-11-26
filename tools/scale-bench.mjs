#!/usr/bin/env node
// Deterministic 5-Axis Benchmark & Measurement Script for /scale-it -4
// Measures Scope (Umfang), Capacity (Tragfähigkeit), Efficiency (Effizienz),
// Safety (Absicherung), and Structure (Struktur) with cross-checked counters.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

async function runMeasurement() {
  const escapeMod = await import("../src/escape-oracle.mjs");
  const arenaMod = await import("../src/variant-arena.mjs");
  const midiMod = await import("../src/midi-forge.mjs");
  const serverText = fs.readFileSync(path.join(ROOT, "src", "server.mjs"), "utf8");
  const world3dText = fs.readFileSync(path.join(ROOT, "public", "world3d.js"), "utf8");

  // 1. Umfang (Scope)
  const apiEndpoints = (serverText.match(/pathname\s*===\s*["']\/api\//g) || []).length +
    (serverText.match(/pathname\.startsWith\(["']\/vendor\//g) || []).length;

  const archetypesCount = escapeMod.WORLD_ARCHETYPES_COUNT ||
    (world3dText.match(/archetype\s*===\s*["'][a-z0-9_-]+["']/g)
      ? new Set(world3dText.match(/archetype\s*===\s*["']([a-z0-9_-]+)["']/g)).size
      : 4);

  const escapeThemesCount = escapeMod.ESCAPE_THEMES ? escapeMod.ESCAPE_THEMES.length : 3;
  const arenaProfilesCount = arenaMod.ARENA_PROFILES ? arenaMod.ARENA_PROFILES.length : 3;
  const midiScalesCount = midiMod.MIDI_SCALES ? Object.keys(midiMod.MIDI_SCALES).length : 1;
  const midiMaxTracks = midiMod.MAX_SMF_TRACKS || 1;

  // 2. Tragfähigkeit & Effizienz (Capacity & Efficiency)
  // Benchmark 100 puzzle solves + measure max reachable states
  const tPuzzle0 = performance.now();
  let maxReachableStates = 0;
  let lastOracle = null;
  for (let i = 0; i < 60; i++) {
    const p = escapeMod.generateEscapePuzzle(`bench-${i}`, { tier: escapeMod.MAX_PUZZLE_TIER || 1 });
    lastOracle = p.oracle;
    if (p.oracle.reachableStates > maxReachableStates) {
      maxReachableStates = p.oracle.reachableStates;
    }
  }
  const puzzleAvgMs = +((performance.now() - tPuzzle0) / 60).toFixed(3);
  const puzzleOpsPerSec = Math.round(1000 / Math.max(0.01, puzzleAvgMs));

  // Vendor bundle wire payload size (raw vs gzipped if server supports gzip)
  const genaiBundlePath = path.join(ROOT, "node_modules", "@google", "genai", "dist", "web", "index.mjs");
  const rawVendorBytes = fs.existsSync(genaiBundlePath) ? fs.statSync(genaiBundlePath).size : 0;
  const serverSupportsGzip = /createGzip|gzipSync/.test(serverText);
  const effectiveVendorWireBytes =
    serverSupportsGzip && rawVendorBytes > 0
      ? zlib.gzipSync(fs.readFileSync(genaiBundlePath)).length
      : rawVendorBytes;

  // 3. Absicherung (Tests count via actual node --test execution)
  let passedTests = 0;
  try {
    const testOut = execFileSync(process.execPath, ["--test", ...findTestFiles(ROOT)], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const passMatch = testOut.match(/pass\s+(\d+)/i);
    passedTests = passMatch ? Number(passMatch[1]) : (testOut.match(/✔/g) || []).length;
  } catch (err) {
    const out = String(err.stdout || "") + String(err.stderr || "");
    const passMatch = out.match(/pass\s+(\d+)/i);
    passedTests = passMatch ? Number(passMatch[1]) : 0;
  }

  // 4. Struktur (Largest non-test code file lines)
  let largestFile = "";
  let largestLines = 0;
  let codeFiles = 0;
  for (const f of walkCodeFiles(ROOT)) {
    const rel = path.relative(ROOT, f).replace(/\\/g, "/");
    if (/(^|\/)(test|tests)\b|\.test\.mjs$/i.test(rel)) continue;
    codeFiles++;
    const lines = fs.readFileSync(f, "utf8").split("\n").length;
    if (lines > largestLines) {
      largestLines = lines;
      largestFile = rel;
    }
  }

  return {
    ts: new Date().toISOString(),
    scope: {
      api_endpoints: apiEndpoints,
      world_archetypes: archetypesCount,
      escape_themes: escapeThemesCount,
      arena_profiles: arenaProfilesCount,
      midi_scales: midiScalesCount,
      midi_tracks: midiMaxTracks,
    },
    capacity: {
      max_puzzle_states: maxReachableStates,
      puzzle_ops_per_sec: puzzleOpsPerSec,
      astar_speedup_ratio: lastOracle?.aStarSpeedupRatio || 1,
    },
    efficiency: {
      puzzle_solve_avg_ms: puzzleAvgMs,
      vendor_wire_kb: +(effectiveVendorWireBytes / 1024).toFixed(1),
    },
    safety: {
      passing_tests: passedTests,
      test_files: findTestFiles(ROOT).length,
    },
    structure: {
      code_files: codeFiles,
      largest_file: largestFile,
      largest_file_lines: largestLines,
    },
  };
}

function walkCodeFiles(dir) {
  const out = [];
  const skip = new Set([".git", "node_modules", "dist", "_site", "data"]);
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (skip.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walkCodeFiles(full));
    else if (/\.(mjs|js)$/.test(e.name)) out.push(full);
  }
  return out;
}

function findTestFiles(dir) {
  return walkCodeFiles(dir).filter((f) => {
    const rel = path.relative(ROOT, f).replace(/\\/g, "/");
    return /(^|\/)(test|tests)\/|test\.mjs$/i.test(rel);
  });
}

const snap = await runMeasurement();
const argv = process.argv.slice(2);
const outIdx = argv.indexOf("--out");
if (outIdx >= 0 && argv[outIdx + 1]) {
  fs.mkdirSync(path.dirname(argv[outIdx + 1]), { recursive: true });
  fs.writeFileSync(argv[outIdx + 1], JSON.stringify(snap, null, 2), "utf8");
}
const cmpIdx = argv.indexOf("--compare");
if (cmpIdx >= 0 && argv[cmpIdx + 1] && fs.existsSync(argv[cmpIdx + 1])) {
  const before = JSON.parse(fs.readFileSync(argv[cmpIdx + 1], "utf8"));
  console.log("=== SCALE-IT -4 COMPARISON ===");
  for (const section of ["scope", "capacity", "efficiency", "safety", "structure"]) {
    console.log(`\n[${section.toUpperCase()}]`);
    for (const [k, v] of Object.entries(snap[section])) {
      const b = before[section]?.[k];
      const factor =
        typeof v === "number" && typeof b === "number" && b > 0
          ? ` (x${(v / b).toFixed(2)})`
          : "";
      console.log(`  ${k.padEnd(24)}: ${String(b).padEnd(12)} -> ${v}${factor}`);
    }
  }
} else {
  console.log(JSON.stringify(snap, null, 2));
}
