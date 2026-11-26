# 5D Triad Forge v4.0 Ultra — Genie 4 × Local Triad World (`si-algo`)

Interactive `16:9` real-time world studio combining a **zero-cost playable 60 fps 3D Twin (16 Archetypes)** with **Google Genie 4 (`models/genie-4`, 24 fps WebRTC `v1beta`)**, **180-BPM B-Minor Tekno FFT Sync**, **Binary Min-Heap A* Escape Oracle**, **4-Track Acid-303 SMF MIDI Forge**, and **Prepaid World-Coins** — co-directed by local **`agy`**, **`grok`**, and **`claude`** CLIs through the **Sovereign Integral (`si-algo`)** gate.

- **Live Browser Studio (`0,00 €` API Cost Lock):** <https://nobis23-werkstatt.github.io/si-algo/>
- **Sibling Multi-CLI Orchestra (`multie`):** [`nobis23-werkstatt/multie`](https://github.com/nobis23-werkstatt/multie) (<https://nobis23-werkstatt.github.io/multie/>)
- **NOBIS23 Werkstatt:** <https://nobis23-werkstatt.netlify.app/#forge>

## Architecture (`efficient++`)

1. **Parallel Blitz Local Agent Bus (`src/triad-bus.mjs`)**
   - **`agy` (Architect)** & **`grok` (Lateral Catalyst)** run **concurrently** (`Promise.all`) in stripped non-interactive mode (zero hooks, zero plugins, zero tool bloat):
     - `agy -p --disable-slash-commands --mode plan`
     - `grok -p --no-memory --no-subagents --no-plan --disable-web-search --tools ""`
   - **`claude` (Coherence Director)** synthesizes both streams via `claude -p --bare --no-session-persistence --tools ""` (`--bare` skips all hooks and plugin overhead) into a physically grounded **Genie 4** `world_setup` / mid-session `input` steering prompt plus choreographed `user_action` movement cues.
   - Includes SHA-256 prompt-round caching and instant deterministic creative fallback so the world loop **never stalls**.
2. **Sovereign Integral Gate (`src/sovereign-gate.mjs`)**
   - Prevents echo-chamber collusion between agents (`jaccardOverlap`), enforces first-person walking camera + concrete physical contact Foley audio (no musical soundtracks), and enforces Genie 4's `< 42 KB` raw JPEG (`< 64 KB` SCTP `RTCDataChannel`) WebRTC cap for `reference_image`.
3. **Ephemeral Token & Billing Safety (`src/genie-service.mjs` + `public/app.js`)**
   - Mints `models/genie-4` interactions and short-lived `auth_tokens/...` on the Node backend so `GEMINI_API_KEY` never reaches the browser.
   - Connects in browser with `{ transport: "webrtc", api_version: "v1beta" }` and `session.transport.setVideoElement(videoEl)` (`1280x720` `24 fps` video + `48 kHz` stereo audio), with `{ transport: "websocket" }` fallback and a zero-cost **Holo-Canvas Preview** mode for rehearsing prompts before starting `$0.101/s` paid video streaming.
   - Always calls `await session.complete()` on stop, 118s safety auto-cutoff (before the 120s hard limit), and `navigator.sendBeacon("/api/genie/cancel")` on tab close.

## Quickstart

```bash
# 1. Run the automated test suite (wire protocol, Sovereign Gate, CLI discovery)
npm test

# 2. Run a headless AGY x Grok x Claude creative round in the terminal
npm run triad -- "Lantern-lit glass observatory inside a rain-soaked clockwork canyon"

# 3. Launch the Live World WebRTC Studio (default http://localhost:4321)
npm start
```
