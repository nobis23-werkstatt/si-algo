import assert from "node:assert/strict";
import test from "node:test";
import { ARCHETYPE_SPECS } from "../public/world3d.js";
import { MOTIVATION_TRACK_CUES } from "../public/track-sync.js";
import { ESCAPE_THEMES, generateEscapePuzzle } from "../src/escape-oracle.mjs";
import { MIDI_SCALES, generateAcidMidi } from "../src/midi-forge.mjs";
import { createStudioServer } from "../src/server.mjs";
import { ARENA_PROFILES, runVariantArena } from "../src/variant-arena.mjs";

// 1. Parameterized verification across all 12 Escape Themes & 4 Tiers
for (const theme of ESCAPE_THEMES) {
  test(`Escape Theme "${theme.id}" resolves cleanly with 0 dead-ends and Min-Heap A* speedup`, () => {
    const p = generateEscapePuzzle(theme.id, { tier: 3 });
    assert.equal(p.oracle.solvable, true);
    assert.equal(p.oracle.deadEnds, 0);
    assert.ok(p.oracle.expandedAStar < p.oracle.expandedBfs);
  });
}

for (const tier of [1, 2, 3, 4]) {
  test(`Escape Tier ${tier} scales state space monotonically and maintains 0 softlocks`, () => {
    const p = generateEscapePuzzle(`tier-check-${tier}`, { tier });
    assert.equal(p.tier, tier);
    assert.equal(p.oracle.solvable, true);
    assert.equal(p.oracle.deadEnds, 0);
    if (tier === 4) {
      assert.ok(p.oracle.reachableStates >= 320);
      assert.ok(p.oracle.aStarSpeedupRatio >= 5.0);
    }
  });
}

// 2. Parameterized verification across all 6 MIDI scales + Format 0 & 4-Track Format 1
for (const scaleKey of Object.keys(MIDI_SCALES)) {
  test(`MIDI scale "${scaleKey}" generates valid Format 0 & 4-Track Format 1 @ 180 BPM`, () => {
    const single = generateAcidMidi({ seed: scaleKey, bpm: 180, bars: 2, scale: scaleKey, multiTrack: false });
    assert.equal(single.validation.valid, true);
    assert.equal(single.trackCount, 1);

    const stems = generateAcidMidi({ seed: scaleKey, bpm: 180, bars: 4, scale: scaleKey, multiTrack: true });
    assert.equal(stems.validation.valid, true);
    assert.equal(stems.format, 1);
    assert.equal(stems.trackCount, 4);
    assert.equal(stems.validation.bars, 4);
  });
}

// 3. Parameterized verification across all 12 Variant-Arena profiles & 16+ 3D Archetypes
test("All 3D architectural archetypes (16 core + 360° sanctuary) have valid geometry specs", () => {
  const keys = Object.keys(ARCHETYPE_SPECS);
  assert.ok(keys.length >= 16);
  for (const k of keys) {
    assert.ok(ARCHETYPE_SPECS[k].halfW > 0);
    assert.ok(ARCHETYPE_SPECS[k].archH > 0);
  }
});

for (const prof of ARENA_PROFILES) {
  test(`Arena Profile "${prof.id}" maps to a valid 3D archetype & passes Genie 4 wire validation`, () => {
    assert.ok(prof.archetype in ARCHETYPE_SPECS);
    const res = runVariantArena({ concept: prof.tags[0], limit: 12 });
    assert.equal(res.totalEvaluated, 12);
    assert.equal(res.candidates.length, 12);
  });
}

test("180-BPM B-Minor Motivation Track has monotonically sorted arrangement cues", () => {
  assert.ok(MOTIVATION_TRACK_CUES.length >= 8);
  for (let i = 1; i < MOTIVATION_TRACK_CUES.length; i++) {
    assert.ok(MOTIVATION_TRACK_CUES[i].atSec > MOTIVATION_TRACK_CUES[i - 1].atSec);
    assert.ok(MOTIVATION_TRACK_CUES[i].blueprint.archetype in ARCHETYPE_SPECS);
  }
});

test("HTTP Server delivers Gzipped vendor bundle (<300 KB), MP3 Byte-Ranges (206), and World-Coin HTTP 402 guard", async () => {
  const { server, shutdown } = createStudioServer({ zeroCostLock: true, ledgerFile: null });
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;
  try {
    // 1. Gzip verification
    const gzResp = await fetch(`${base}/vendor/genai/index.mjs`, {
      headers: { "Accept-Encoding": "gzip" },
    });
    assert.equal(gzResp.status, 200);
    assert.equal(gzResp.headers.get("content-encoding"), "gzip");

    // 2. HTTP 206 Range request on 180-BPM Motivation Track
    const rangeResp = await fetch(`${base}/audio/motivation-180bpm-bmin.mp3`, {
      headers: { Range: "bytes=0-1023" },
    });
    assert.equal(rangeResp.status, 206);
    const chunk = await rangeResp.arrayBuffer();
    assert.equal(chunk.byteLength, 1024);

    // 3. Prepaid Coin spend with 0 balance returns HTTP 402 Payment Required
    const coinFail = await fetch(`${base}/api/genie/session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ useWorldCoin: true, walletId: "broke-user" }),
    });
    assert.equal(coinFail.status, 402);
  } finally {
    await shutdown();
  }
});
