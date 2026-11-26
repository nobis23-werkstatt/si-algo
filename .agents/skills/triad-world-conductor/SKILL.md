---
name: triad-world-conductor
description: Orchestrate and debug the Genie 4 Live World co-directed by local AGY, Grok, and Claude CLIs with Sovereign Integral gating.
---

# Triad World Conductor

Use this skill when starting, testing, or extending the local **AGY × Grok × Claude -> Genie 4 (`models/genie-4`)** Live World studio in `si-algo`.

## Workflow

1. **Verify tests & CLI discovery**:
   ```bash
   npm test
   ```
2. **Run a headless Triad creative round from the terminal**:
   ```bash
   npm run triad -- "Bioluminescent glass observatory floating inside a rain-soaked clockwork canyon"
   ```
3. **Launch the Live World WebRTC Studio**:
   ```bash
   npm start
   ```
   Open `http://localhost:4321` to connect to `models/genie-4` over WebRTC (`24 fps` `1280x720` video + `48 kHz` stereo audio) or run in zero-cost Holo-Preview mode while `agy`, `grok`, and `claude` debate and steer the world live.
