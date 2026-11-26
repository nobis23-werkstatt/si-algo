# Genie 4 × Local Triad World (`si-algo`)

## Project Purpose
Real-time interactive `16:9` `24 fps` world studio powered by **Genie 4 (`models/genie-4`)** over the Live Interactions API (`v1beta`) and co-directed by locally installed **AGY (`agy`)**, **Grok (`grok`)**, and **Claude (`claude`)** CLIs through a Sovereign Integral (`si-algo`) creative bus.

## Core Guardrails
1. **Genie 4 API Discipline (`v1beta`)**:
   - Always use model `"models/genie-4"` and `apiVersion: "v1beta"` (`api_version: "v1beta"`).
   - Never expose `GEMINI_API_KEY` to browser code; mint ephemeral `auth_tokens/...` on the backend via `serverAi.interactions.authTokens.create(interaction.id, { api_version: "v1beta" })` and pass `authToken` as `apiKey` on the browser `GoogleGenAI` client.
   - Connect in browser with `{ transport: "webrtc", api_version: "v1beta" }` and `session.transport.setVideoElement(videoEl)` (or `{ transport: "websocket" }` fallback).
   - Keep `reference_image` at the top level of `world_setup` (sibling of `world_prompt`, no `"type"` field) and strictly `< 42 KB` JPEG raw bytes (`< 64 KB` JSON over WebRTC `RTCDataChannel`).
   - Always terminate sessions with `await session.complete()` (never `detach()` alone) to stop `$0.101/sec` video+audio billing immediately.
2. **Zero-Bloat Local Agent Execution (`efficient++`)**:
   - Strip unneeded skills, hooks, and plugins when spawning local CLIs:
     - `claude -p --bare --no-session-persistence --tools ""`
     - `grok -p --no-memory --no-subagents --no-plan --disable-web-search --tools ""`
     - `agy -p --disable-slash-commands --mode plan`
   - Never pass permission-bypass flags (`--dangerously-skip-permissions`, `--always-approve`, `--yolo`, `bypassPermissions`).
3. **Sovereign Creative Triad**:
   - **AGY** architects spatial geometry, first-person walking kinematics, and concrete physical Foley audio.
   - **Grok** injects lateral creative mutations, contrast, and anti-cliché challenges.
   - **Claude** synthesizes both streams, verifies spatial/visual coherence within Genie 4's 120s window, and emits the gated `world_setup` or mid-session `input` steering prompt + choreographed `user_action` movement cues.
