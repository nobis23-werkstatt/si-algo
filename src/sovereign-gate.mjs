// Sovereign Integral Creative Gate & Genie 4 Wire-Protocol Sanitizer.
// Combines epistemic triad anti-collusion scoring (si-algo) with strict
// Genie 4 (models/genie-4, v1beta) prompt & payload constraints.

export const FORBIDDEN_CLI_FLAGS =
  /(--dangerously-skip-permissions|--always-approve|--yolo|--no-verify|bypassPermissions|\brm\s+-rf\b)/i;

export const ALLOWED_USER_INPUTS = new Set([
  "key_w",
  "key_a",
  "key_s",
  "key_d",
  "arrow_up",
  "arrow_down",
  "arrow_left",
  "arrow_right",
  "key_e",
  "space",
]);

export const WEBRTC_MAX_EVENT_BYTES = 65_536;
export const WEBRTC_SAFE_IMAGE_RAW_BYTES = 42_000;

const clamp01 = (x) => Math.max(0, Math.min(1, x));

function significantTokens(text) {
  return new Set(
    String(text || "")
      .toLowerCase()
      .split(/[^a-z0-9äöüß]+/i)
      .filter((w) => w.length >= 4)
  );
}

export function jaccardOverlap(textA, textB) {
  const a = significantTokens(textA);
  const b = significantTokens(textB);
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const tok of a) if (b.has(tok)) inter++;
  const union = a.size + b.size - inter;
  return union > 0 ? +(inter / union).toFixed(4) : 0;
}

/**
 * Evaluates creative diversity, anti-collusion, and Genie 4 physical grounding
 * across AGY (Architect), Grok (Catalyst), and Claude (Integrator).
 */
export function evaluateCreativeTriad({ agyText = "", grokText = "", claudeSynthesis = {} }) {
  const flags = [];
  const agyGrokOverlap = jaccardOverlap(agyText, grokText);
  if (agyGrokOverlap >= 0.78) {
    flags.push("echo_chamber_lexical_overlap");
  }

  const worldPrompt = String(claudeSynthesis.worldPrompt || "").trim();
  const steerPrompt = String(claudeSynthesis.steerPrompt || worldPrompt).trim();

  if (!worldPrompt && !steerPrompt) {
    flags.push("empty_world_prompt");
  }

  const hasFirstPersonCue =
    /\b(first-person|walking|walk|footsteps|ahead|path|corridor|bridge|alley|courtyard)\b/i.test(
      worldPrompt
    );
  const hasFoleyAudioCue = /\baudio\s*:|\b(footsteps|rustling|lapping|hum|clicks|patter|creak|echo|clink|wind)\b/i.test(
    worldPrompt
  );
  const forbiddenMusicDrone = /\b(soundtrack|orchestral score|synthwave track|background music|dubstep)\b/i.test(
    worldPrompt
  );
  if (forbiddenMusicDrone) {
    flags.push("musical_soundtrack_penalty");
  }

  // Novelty balances complementary perspectives (sweet spot: 0.08..0.55 overlap)
  const diversityScore =
    agyText && grokText ? clamp01(1 - Math.max(0, agyGrokOverlap - 0.35) * 1.4) : 0.72;
  const groundingBonus = (hasFirstPersonCue ? 0.12 : 0) + (hasFoleyAudioCue ? 0.12 : 0);
  const penalty =
    (flags.includes("echo_chamber_lexical_overlap") ? 0.28 : 0) +
    (flags.includes("musical_soundtrack_penalty") ? 0.15 : 0) +
    (flags.includes("empty_world_prompt") ? 1 : 0);

  const baseConfidence =
    typeof claudeSynthesis.confidence === "number"
      ? clamp01(claudeSynthesis.confidence)
      : 0.78;

  const sovereignIntegral = +clamp01(
    0.55 * baseConfidence + 0.30 * diversityScore + groundingBonus - penalty
  ).toFixed(4);

  let decision = "SOVEREIGN_COMMIT";
  if (flags.includes("empty_world_prompt")) {
    decision = "VETO_REJECT";
  } else if (sovereignIntegral < 0.62 || flags.includes("echo_chamber_lexical_overlap")) {
    decision = "REVISE_WITH_CRITIQUE";
  }

  return {
    sovereign_integral: sovereignIntegral,
    decision,
    diversity_score: +diversityScore.toFixed(4),
    agy_grok_overlap: agyGrokOverlap,
    has_first_person_cue: hasFirstPersonCue,
    has_foley_audio_cue: hasFoleyAudioCue,
    flags,
  };
}

/**
 * Ensures a Genie 4 world_setup or mid-session steering prompt adheres to
 * first-person stability and concrete physical contact Foley audio guidelines.
 */
export function compileGenieWorldSetup({ promptText, referenceImage = null, transport = "webrtc" }) {
  let clean = String(promptText || "").replace(/\s+/g, " ").trim();
  if (!clean) {
    throw new Error("world_prompt text must be non-empty");
  }

  // Enforce first-person walking anchor if missing
  if (!/\b(first-person|walking|walk)\b/i.test(clean)) {
    clean = `First-person walking view through ${clean.charAt(0).toLowerCase()}${clean.slice(1)}`;
  }
  // Enforce physical contact Foley audio anchor if missing
  if (!/\baudio\s*:/i.test(clean)) {
    clean = `${clean.replace(/\.*$/, ".")} Audio: crisp footsteps on textured floor, subtle ambient air movement, tactile material resonances.`;
  }
  // Cap length to keep token latency minimal
  if (clean.length > 620) {
    clean = clean.slice(0, 617).trimEnd() + "...";
  }

  const event = {
    event_type: "world_setup",
    world_prompt: { text: clean },
  };

  if (referenceImage && referenceImage.data && referenceImage.mime_type) {
    // Strip any invalid "type" field and place at top level per Genie 4 v1beta wire protocol
    const rawBase64 = String(referenceImage.data).replace(/^data:[^;]+;base64,/, "");
    const approxRawBytes = Math.floor((rawBase64.length * 3) / 4);
    if (transport === "webrtc" && approxRawBytes > WEBRTC_SAFE_IMAGE_RAW_BYTES) {
      throw new Error(
        `reference_image (${approxRawBytes} bytes) exceeds 42 KB WebRTC safe cap; downscale to 16:9 JPEG < 42 KB or switch to websocket transport.`
      );
    }
    event.reference_image = {
      mime_type: String(referenceImage.mime_type),
      data: rawBase64,
    };
  }

  const byteLen = Buffer.byteLength(JSON.stringify(event), "utf8");
  if (transport === "webrtc" && byteLen >= WEBRTC_MAX_EVENT_BYTES) {
    throw new Error(
      `Serialized world_setup (${byteLen} bytes) exceeds 65,536-byte WebRTC RTCDataChannel limit.`
    );
  }

  return event;
}

/**
 * Sanitizes choreographed macro actions into valid Genie 4 user_action sequences.
 */
export function sanitizeChoreography(actions = []) {
  if (!Array.isArray(actions)) return [];
  const out = [];
  for (const item of actions.slice(0, 6)) {
    const input = String(item?.input || "").toLowerCase().trim();
    if (!ALLOWED_USER_INPUTS.has(input)) continue;
    const holdMs = Math.max(150, Math.min(3000, Number(item?.holdMs) || 900));
    out.push({ input, holdMs });
  }
  return out;
}
