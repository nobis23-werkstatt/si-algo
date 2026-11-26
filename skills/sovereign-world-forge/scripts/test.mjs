import assert from "node:assert/strict";
import test from "node:test";
import { generateEscapePuzzle } from "../../../src/escape-oracle.mjs";
import { generateAcidMidi } from "../../../src/midi-forge.mjs";

test("sovereign-world-forge skill invariant: A* beats or matches BFS and proves 0 dead-ends", () => {
  const p = generateEscapePuzzle("chrono-v3");
  assert.equal(p.oracle.solvable, true);
  assert.equal(p.oracle.deadEnds, 0);
  assert.ok(p.oracle.expandedAStar < p.oracle.expandedBfs);
});

test("sovereign-world-forge skill invariant: binary 303 MIDI passes strict SMF validation", () => {
  const midi = generateAcidMidi({ seed: "tekno-drop", bpm: 142, energy: 0.9, bars: 2 });
  assert.equal(midi.validation.valid, true);
  assert.equal(midi.validation.bars, 2);
  assert.ok(midi.noteCount >= 8);
});
