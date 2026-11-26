// Zero-Dependency Binary Standard MIDI File (SMF Format 0) Generator & Validator
// Distilled from ableton-midi-coproducer for World-Jockey v3.0:
// - Generates 1-to-4 bar TB-303 Acid basslines synchronized to world BPM, cutoff/energy & seed
// - Supports authentic 303 legato overlaps (slide) and velocity accents (118 vs 82)
// - Validates generated binary .mid bytes (header, track length, paired Note-On/Note-Offs, pitch range 24..96, exact bar ticks)

const PPQ = 480; // Ticks per quarter note
const TICKS_PER_16TH = PPQ / 4; // 120 ticks

function writeVarLen(value) {
  let buffer = value & 0x7f;
  const bytes = [];
  while ((value >>= 7) > 0) {
    buffer <<= 8;
    buffer |= (value & 0x7f) | 0x80;
  }
  while (true) {
    bytes.push(buffer & 0xff);
    if (buffer & 0x80) buffer >>= 8;
    else break;
  }
  return bytes;
}

function u16be(n) {
  return [(n >> 8) & 0xff, n & 0xff];
}

function u32be(n) {
  return [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
}

// Phrygian / Acid minor scale intervals (semitones from root A1 = MIDI 33 or C2 = MIDI 36)
const ACID_INTERVALS = [0, 0, 12, 0, 1, 7, 10, 12, 0, 3, 1, 7];

export function generateAcidMidi({
  seed = "solarpunk-acid",
  bpm = 138,
  energy = 0.78,
  bars = 2,
  rootNote = 33, // A1
} = {}) {
  const cleanBpm = Math.max(70, Math.min(200, Math.round(Number(bpm) || 138)));
  const cleanBars = Math.max(1, Math.min(8, Math.round(Number(bars) || 2)));
  const totalSteps = cleanBars * 16;
  const totalBarTicks = cleanBars * 4 * PPQ;

  let hash = 2166136261;
  const s = String(seed || "acid");
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  const nextRand = () => {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    return (hash >>> 0) / 4294967296;
  };

  // Build scheduled absolute tick events: { tick, order, bytes }
  const scheduled = [];

  // Tempo meta event at tick 0: FF 51 03 tt tt tt (microseconds per quarter note)
  const mpqn = Math.round(60_000_000 / cleanBpm);
  scheduled.push({
    tick: 0,
    order: 0,
    bytes: [0xff, 0x51, 0x03, (mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff],
  });

  const density = 0.55 + Math.max(0, Math.min(1, energy)) * 0.32;
  const stepNotes = [];

  for (let step = 0; step < totalSteps; step++) {
    const isDownbeat = step % 4 === 0;
    if (!isDownbeat && nextRand() > density) continue;

    const interval = ACID_INTERVALS[Math.floor(nextRand() * ACID_INTERVALS.length)];
    const pitch = Math.max(24, Math.min(96, rootNote + interval));
    const isAccent = isDownbeat || nextRand() < 0.28;
    // Slide (legato overlap into next 16th) only if not the final step and next pitch differs
    const wantSlide = step < totalSteps - 1 && nextRand() < 0.26;
    const startTick = step * TICKS_PER_16TH;
    const gateTicks = wantSlide ? TICKS_PER_16TH + 18 : Math.round(TICKS_PER_16TH * 0.72);
    const endTick = Math.min(totalBarTicks, startTick + gateTicks);
    const velocity = isAccent ? 118 : 82;

    // Avoid overlapping identical pitch (would confuse mono note-off pairing)
    const prev = stepNotes.at(-1);
    if (prev && prev.pitch === pitch && prev.endTick > startTick) {
      prev.endTick = startTick;
    }

    stepNotes.push({ pitch, velocity, startTick, endTick, slide: wantSlide, accent: isAccent });
  }

  for (const n of stepNotes) {
    scheduled.push({
      tick: n.startTick,
      order: 2,
      bytes: [0x90, n.pitch, n.velocity],
    });
    scheduled.push({
      tick: n.endTick,
      order: 1, // Note-Off sorted before new Note-On at identical tick unless sliding different pitch
      bytes: [0x80, n.pitch, 0x00],
    });
  }

  // End-of-Track meta event strictly at exact bar boundary (totalBarTicks)
  scheduled.push({
    tick: totalBarTicks,
    order: 9,
    bytes: [0xff, 0x2f, 0x00],
  });

  scheduled.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const trackBytes = [];
  let lastTick = 0;
  for (const ev of scheduled) {
    const delta = Math.max(0, ev.tick - lastTick);
    lastTick = ev.tick;
    trackBytes.push(...writeVarLen(delta), ...ev.bytes);
  }

  const headerChunk = [
    0x4d, 0x54, 0x68, 0x64, // "MThd"
    ...u32be(6),
    ...u16be(0), // Format 0
    ...u16be(1), // 1 Track
    ...u16be(PPQ),
  ];

  const trackChunk = [
    0x4d, 0x54, 0x72, 0x6b, // "MTrk"
    ...u32be(trackBytes.length),
    ...trackBytes,
  ];

  const buffer = Buffer.from([...headerChunk, ...trackChunk]);
  const validation = validateSmfMidi(buffer, { expectedBars: cleanBars });

  return {
    buffer,
    base64: buffer.toString("base64"),
    bpm: cleanBpm,
    bars: cleanBars,
    noteCount: stepNotes.length,
    slideCount: stepNotes.filter((n) => n.slide).length,
    accentCount: stepNotes.filter((n) => n.accent).length,
    validation,
  };
}

/**
 * Deterministic binary SMF validator: verifies MThd/MTrk headers, balanced Note-On/Offs,
 * safe pitch range (24..96), and exact bar tick length.
 */
export function validateSmfMidi(buf, { expectedBars = null } = {}) {
  const issues = [];
  if (!Buffer.isBuffer(buf) || buf.length < 22) {
    return { valid: false, issues: ["Buffer too short for SMF"] };
  }
  if (buf.toString("ascii", 0, 4) !== "MThd") issues.push("Missing MThd header");
  const ppq = buf.readUInt16BE(12);
  if (buf.toString("ascii", 14, 18) !== "MTrk") issues.push("Missing MTrk header");
  const trackLen = buf.readUInt32BE(18);
  if (22 + trackLen !== buf.length) issues.push("MTrk byte length mismatch");

  let pos = 22;
  let totalTicks = 0;
  const activeNotes = new Map();
  let noteOns = 0;
  let noteOffs = 0;

  const readVar = () => {
    let val = 0;
    while (pos < buf.length) {
      const b = buf[pos++];
      val = (val << 7) | (b & 0x7f);
      if ((b & 0x80) === 0) break;
    }
    return val;
  };

  while (pos < buf.length) {
    totalTicks += readVar();
    const status = buf[pos++];
    if (status === 0xff) {
      const metaType = buf[pos++];
      const len = readVar();
      pos += len;
      if (metaType === 0x2f) break;
    } else if ((status & 0xf0) === 0x90) {
      const pitch = buf[pos++];
      const vel = buf[pos++];
      if (pitch < 24 || pitch > 96) issues.push(`Out-of-range pitch: ${pitch}`);
      if (vel > 0) {
        noteOns++;
        activeNotes.set(pitch, (activeNotes.get(pitch) || 0) + 1);
      } else {
        noteOffs++;
        activeNotes.set(pitch, (activeNotes.get(pitch) || 0) - 1);
      }
    } else if ((status & 0xf0) === 0x80) {
      const pitch = buf[pos++];
      pos++; // velocity
      noteOffs++;
      const nextCount = (activeNotes.get(pitch) || 0) - 1;
      if (nextCount < 0) issues.push(`Orphan Note-Off on pitch ${pitch}`);
      else if (nextCount === 0) activeNotes.delete(pitch);
      else activeNotes.set(pitch, nextCount);
    } else {
      issues.push(`Unsupported status byte 0x${status.toString(16)}`);
      break;
    }
  }

  if (activeNotes.size > 0) issues.push(`Hanging notes at end of track: ${activeNotes.size}`);
  if (noteOns !== noteOffs) issues.push(`Unbalanced Note-On (${noteOns}) vs Note-Off (${noteOffs})`);
  if (expectedBars !== null && totalTicks !== expectedBars * 4 * ppq) {
    issues.push(`Bar tick mismatch: got ${totalTicks}, expected ${expectedBars * 4 * ppq}`);
  }

  return {
    valid: issues.length === 0,
    ppq,
    totalTicks,
    bars: +(totalTicks / (4 * ppq)).toFixed(2),
    noteOns,
    issues,
  };
}
