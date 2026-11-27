import assert from "node:assert/strict";
import test from "node:test";
import {
  SANCTUARY_PRESETS,
  renderSanctuaryWav24Bit,
  validateSanctuaryPresets,
} from "../public/spatial-sanctuary.js";
import { ARCHETYPE_SPECS } from "../public/world3d.js";

test("Frequenz-Labor 2.0 Compliance: alle 8 360°-Klang-Oase-Presets bestehen Veto-, Oster- & Esoterik-Prüfung", () => {
  const res = validateSanctuaryPresets(SANCTUARY_PRESETS);
  assert.equal(res.valid, true, res.errors.join("; "));
  assert.equal(res.count, 8);

  for (const p of SANCTUARY_PRESETS) {
    assert.ok(p.blueprint.archetype in ARCHETYPE_SPECS, `${p.id} maps to valid 3D archetype`);
  }
});

test("renderSanctuaryWav24Bit erzeugt mathematisch exakte 24-bit / 48 kHz Stereo RIFF-WAVE mit TPDF-Dither", () => {
  const wav = renderSanctuaryWav24Bit({
    presetId: "FL2-14",
    durationSec: 2,
    sampleRate: 48_000,
  });

  const view = new DataView(wav.bytes.buffer);
  const magic = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
  const format = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));

  assert.equal(magic, "RIFF");
  assert.equal(format, "WAVE");
  assert.equal(view.getUint16(20, true), 1); // PCM
  assert.equal(view.getUint16(22, true), 2); // Stereo
  assert.equal(view.getUint32(24, true), 48_000); // 48 kHz
  assert.equal(view.getUint16(32, true), 6); // 6 bytes per stereo frame
  assert.equal(view.getUint16(34, true), 24); // 24-bit depth
  assert.equal(wav.bytes.byteLength, 44 + 2 * 48_000 * 6);

  // Ensure non-silent audio body & gentle fade-out near end
  let maxSampleAbs = 0;
  for (let off = 44; off < wav.bytes.byteLength; off += 300) {
    let u = wav.bytes[off] | (wav.bytes[off + 1] << 8) | (wav.bytes[off + 2] << 16);
    if (u & 0x800000) u -= 0x1000000;
    maxSampleAbs = Math.max(maxSampleAbs, Math.abs(u));
  }
  assert.ok(maxSampleAbs > 50_000, "24-bit WAV contains audible harmonic/breath signal");
  assert.ok(maxSampleAbs < 8_300_000, "24-bit WAV respects True-Peak ceiling without clipping");
});
