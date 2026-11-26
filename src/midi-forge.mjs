// Zero-Dependency Binary Standard MIDI File (SMF Format 0 & Multi-Track Format 1) Generator & Validator
// Scaled x4 for /scale-it -4 & synced to Paul's 180.00 BPM B-Minor Ableton Motivation Track:
// - 6 musical scales (defaulting to `b_minor` root B1 = MIDI 35 @ 180 BPM!)
// - Supports Format 0 (single-track 303 Acid) AND Format 1 (4-track full Ableton Tekno Stem Kit:
//   Track 1 = Tempo + 909 Core Kit, Track 2 = Bodyravv Offbeat/Rolling Bass,
//   Track 3 = 303 Acid Screamer w/ Slides & Accents, Track 4 = Breakdown Metallic Stabs)

const PPQ = 480;
const TICKS_PER_16TH = PPQ / 4; // 120 ticks

export const MAX_SMF_TRACKS = 4;

export const MIDI_SCALES = {
  b_minor: { root: 35, intervals: [0, 0, 12, 0, 2, 3, 7, 10, 12, 14, 15, 7] }, // B1 Natural Minor (Track Match!)
  a_phrygian: { root: 33, intervals: [0, 0, 12, 0, 1, 7, 10, 12, 0, 3, 1, 7] },
  d_minor: { root: 38, intervals: [0, 0, 12, 0, 3, 5, 7, 10, 12, 15, 7, 10] },
  f_sharp_locrian: { root: 30, intervals: [0, 1, 3, 6, 8, 10, 12, 6, 1, 12] },
  c_dorian: { root: 36, intervals: [0, 2, 3, 7, 9, 10, 12, 7, 3, 12] },
  e_acid_pentatonic: { root: 40, intervals: [0, 3, 5, 7, 10, 12, 15, 12, 7, 3] },
};

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

const u16be = (n) => [(n >> 8) & 0xff, n & 0xff];
const u32be = (n) => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

function encodeTrackChunk(events, totalBarTicks, trackName = null) {
  const list = [...events];
  if (trackName) {
    const nameBytes = Buffer.from(trackName, "ascii");
    list.push({ tick: 0, order: 0, bytes: [0xff, 0x03, nameBytes.length, ...nameBytes] });
  }
  list.push({ tick: totalBarTicks, order: 9, bytes: [0xff, 0x2f, 0x00] });
  list.sort((a, b) => a.tick - b.tick || a.order - b.order);

  const trackBytes = [];
  let lastTick = 0;
  for (const ev of list) {
    const delta = Math.max(0, ev.tick - lastTick);
    lastTick = ev.tick;
    trackBytes.push(...writeVarLen(delta), ...ev.bytes);
  }
  return [0x4d, 0x54, 0x72, 0x6b, ...u32be(trackBytes.length), ...trackBytes];
}

export function generateAcidMidi({
  seed = "motivation-180bpm-bmin",
  bpm = 180,
  energy = 0.85,
  bars = 4,
  scale = "b_minor",
  multiTrack = false,
} = {}) {
  const cleanBpm = Math.max(70, Math.min(220, Math.round(Number(bpm) || 180)));
  const cleanBars = Math.max(1, Math.min(16, Math.round(Number(bars) || 4)));
  const scaleSpec = MIDI_SCALES[scale] || MIDI_SCALES.b_minor;
  const rootNote = scaleSpec.root;
  const intervals = scaleSpec.intervals;

  const totalSteps = cleanBars * 16;
  const totalBarTicks = cleanBars * 4 * PPQ;
  const mpqn = Math.round(60_000_000 / cleanBpm);

  let hash = 2166136261;
  const s = String(seed || "acid");
  for (let i = 0; i < s.length; i++) {
    hash = Math.imul(hash ^ s.charCodeAt(i), 16777619) >>> 0;
  }
  const nextRand = () => {
    hash ^= hash << 13;
    hash ^= hash >>> 17;
    hash ^= hash << 5;
    return (hash >>> 0) / 4294967296;
  };

  // Acid Lead Notes (Channel 0)
  const density = 0.58 + Math.max(0, Math.min(1, energy)) * 0.3;
  const stepNotes = [];
  for (let step = 0; step < totalSteps; step++) {
    const isDownbeat = step % 4 === 0;
    if (!isDownbeat && nextRand() > density) continue;

    const interval = intervals[Math.floor(nextRand() * intervals.length)];
    const highOctaveLift = step >= totalSteps / 2 && nextRand() < 0.35 ? 12 : 0;
    const pitch = Math.max(24, Math.min(96, rootNote + interval + highOctaveLift));
    const isAccent = isDownbeat || nextRand() < 0.3;
    const wantSlide = step < totalSteps - 1 && nextRand() < 0.26;
    const startTick = step * TICKS_PER_16TH;
    const gateTicks = wantSlide ? TICKS_PER_16TH + 18 : Math.round(TICKS_PER_16TH * 0.72);
    const endTick = Math.min(totalBarTicks, startTick + gateTicks);

    const prev = stepNotes.at(-1);
    if (prev && prev.pitch === pitch && prev.endTick > startTick) {
      prev.endTick = startTick;
    }
    stepNotes.push({
      pitch,
      velocity: isAccent ? 120 : 84,
      startTick,
      endTick,
      slide: wantSlide,
      accent: isAccent,
    });
  }

  const acidEvents = [];
  for (const n of stepNotes) {
    acidEvents.push({ tick: n.startTick, order: 2, bytes: [0x90, n.pitch, n.velocity] });
    acidEvents.push({ tick: n.endTick, order: 1, bytes: [0x80, n.pitch, 0x00] });
  }

  if (!multiTrack) {
    const singleEvents = [
      { tick: 0, order: 0, bytes: [0xff, 0x51, 0x03, (mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff] },
      ...acidEvents,
    ];
    const header = [0x4d, 0x54, 0x68, 0x64, ...u32be(6), ...u16be(0), ...u16be(1), ...u16be(PPQ)];
    const buffer = Buffer.from([...header, ...encodeTrackChunk(singleEvents, totalBarTicks, "303 Acid Lead")]);
    const validation = validateSmfMidi(buffer, { expectedBars: cleanBars });
    return {
      buffer,
      base64: buffer.toString("base64"),
      format: 0,
      trackCount: 1,
      scale,
      bpm: cleanBpm,
      bars: cleanBars,
      noteCount: stepNotes.length,
      slideCount: stepNotes.filter((n) => n.slide).length,
      accentCount: stepNotes.filter((n) => n.accent).length,
      validation,
    };
  }

  // Multi-Track SMF Format 1 (4 Tracks matching Paul's Ableton 180 BPM B-Minor Arrangement!)
  // Track 1: Tempo + 909 Core Kit (Kick 36 on 4/4, Open Hat 46 on offbeats, Clap 39 on 2 & 4)
  const drumEvents = [
    { tick: 0, order: 0, bytes: [0xff, 0x51, 0x03, (mpqn >> 16) & 0xff, (mpqn >> 8) & 0xff, mpqn & 0xff] },
  ];
  for (let step = 0; step < totalSteps; step++) {
    const t = step * TICKS_PER_16TH;
    if (step % 4 === 0) {
      drumEvents.push({ tick: t, order: 2, bytes: [0x99, 36, 124] });
      drumEvents.push({ tick: t + 90, order: 1, bytes: [0x89, 36, 0] });
    }
    if (step % 4 === 2) {
      drumEvents.push({ tick: t, order: 2, bytes: [0x99, 46, 102] });
      drumEvents.push({ tick: t + 80, order: 1, bytes: [0x89, 46, 0] });
    }
    if (step % 8 === 4) {
      drumEvents.push({ tick: t, order: 2, bytes: [0x99, 39, 112] });
      drumEvents.push({ tick: t + 75, order: 1, bytes: [0x89, 39, 0] });
    }
  }

  // Track 2: Bass Bodyravv (Rolling 16th offbeat B1/B2 sub-bass on Channel 1)
  const bassEvents = [];
  for (let step = 0; step < totalSteps; step++) {
    if (step % 4 === 0) continue; // sidechained under kick!
    const t = step * TICKS_PER_16TH;
    const p = step % 4 === 2 ? rootNote + 12 : rootNote;
    bassEvents.push({ tick: t, order: 2, bytes: [0x91, p, step % 4 === 2 ? 114 : 96] });
    bassEvents.push({ tick: t + 92, order: 1, bytes: [0x81, p, 0] });
  }

  // Track 4: Metallic B-Minor Stabs (Minor triad hits on bar starts, Channel 2)
  const stabEvents = [];
  for (let bar = 0; bar < cleanBars; bar++) {
    const t = bar * 4 * PPQ;
    for (const semi of [12, 15, 19]) {
      const p = rootNote + semi;
      stabEvents.push({ tick: t, order: 2, bytes: [0x92, p, 104] });
      stabEvents.push({ tick: t + 240, order: 1, bytes: [0x82, p, 0] });
    }
  }

  const header1 = [0x4d, 0x54, 0x68, 0x64, ...u32be(6), ...u16be(1), ...u16be(4), ...u16be(PPQ)];
  const fullBuf = Buffer.from([
    ...header1,
    ...encodeTrackChunk(drumEvents, totalBarTicks, "1-909-Core-Kit"),
    ...encodeTrackChunk(bassEvents, totalBarTicks, "2-Bass-Bodyravv"),
    ...encodeTrackChunk(acidEvents, totalBarTicks, "3-303-Acid-Lead"),
    ...encodeTrackChunk(stabEvents, totalBarTicks, "4-Metallic-Stabs"),
  ]);

  const validation = validateSmfMidi(fullBuf, { expectedBars: cleanBars });
  return {
    buffer: fullBuf,
    base64: fullBuf.toString("base64"),
    format: 1,
    trackCount: 4,
    scale,
    bpm: cleanBpm,
    bars: cleanBars,
    noteCount: validation.noteOns,
    slideCount: stepNotes.filter((n) => n.slide).length,
    accentCount: stepNotes.filter((n) => n.accent).length,
    validation,
  };
}

export function validateSmfMidi(buf, { expectedBars = null } = {}) {
  const issues = [];
  if (!Buffer.isBuffer(buf) || buf.length < 22) {
    return { valid: false, issues: ["Buffer too short for SMF"] };
  }
  if (buf.toString("ascii", 0, 4) !== "MThd") issues.push("Missing MThd header");
  const format = buf.readUInt16BE(8);
  const numTracks = buf.readUInt16BE(10);
  const ppq = buf.readUInt16BE(12);

  let pos = 14;
  let totalNoteOns = 0;
  let totalNoteOffs = 0;
  let maxTrackTicks = 0;

  for (let t = 0; t < numTracks; t++) {
    if (pos + 8 > buf.length || buf.toString("ascii", pos, pos + 4) !== "MTrk") {
      issues.push(`Track ${t} missing MTrk header`);
      break;
    }
    const trackLen = buf.readUInt32BE(pos + 4);
    pos += 8;
    const trackEnd = pos + trackLen;
    if (trackEnd > buf.length) {
      issues.push(`Track ${t} exceeds buffer`);
      break;
    }

    let ticks = 0;
    const activeNotes = new Map();
    const readVar = () => {
      let val = 0;
      while (pos < trackEnd) {
        const b = buf[pos++];
        val = (val << 7) | (b & 0x7f);
        if ((b & 0x80) === 0) break;
      }
      return val;
    };

    while (pos < trackEnd) {
      ticks += readVar();
      const status = buf[pos++];
      if (status === 0xff) {
        const metaType = buf[pos++];
        const len = readVar();
        pos += len;
        if (metaType === 0x2f) break;
      } else if ((status & 0xf0) === 0x90) {
        const ch = status & 0x0f;
        const pitch = buf[pos++];
        const vel = buf[pos++];
        if (pitch < 24 || pitch > 96) issues.push(`Out-of-range pitch ${pitch}`);
        const key = `${ch}:${pitch}`;
        if (vel > 0) {
          totalNoteOns++;
          activeNotes.set(key, (activeNotes.get(key) || 0) + 1);
        } else {
          totalNoteOffs++;
          activeNotes.set(key, (activeNotes.get(key) || 0) - 1);
        }
      } else if ((status & 0xf0) === 0x80) {
        const ch = status & 0x0f;
        const pitch = buf[pos++];
        pos++;
        totalNoteOffs++;
        const key = `${ch}:${pitch}`;
        const nextCount = (activeNotes.get(key) || 0) - 1;
        if (nextCount < 0) issues.push(`Orphan Note-Off on ${key}`);
        else if (nextCount === 0) activeNotes.delete(key);
        else activeNotes.set(key, nextCount);
      } else {
        issues.push(`Unsupported status byte 0x${status.toString(16)}`);
        break;
      }
    }

    if (activeNotes.size > 0) issues.push(`Track ${t} hanging notes: ${activeNotes.size}`);
    if (ticks > maxTrackTicks) maxTrackTicks = ticks;
    pos = trackEnd;
  }

  if (totalNoteOns !== totalNoteOffs) {
    issues.push(`Unbalanced Note-On (${totalNoteOns}) vs Note-Off (${totalNoteOffs})`);
  }
  if (expectedBars !== null && maxTrackTicks !== expectedBars * 4 * ppq) {
    issues.push(`Bar tick mismatch: got ${maxTrackTicks}, expected ${expectedBars * 4 * ppq}`);
  }

  return {
    valid: issues.length === 0,
    format,
    numTracks,
    ppq,
    totalTicks: maxTrackTicks,
    bars: +(maxTrackTicks / (4 * ppq)).toFixed(2),
    noteOns: totalNoteOns,
    issues,
  };
}
