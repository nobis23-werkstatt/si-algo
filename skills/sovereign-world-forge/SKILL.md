---
name: sovereign-world-forge
description: "v3.0 Evolution Skill: Verifies A* vs BFS puzzle state spaces, binary 303 SMF MIDI generation, Zero-Cost Genie 4 Firewall, and temporal Brier calibration."
---

# Sovereign World Forge (`v3.0`)

Unites playable `0 €` 3D worlds, keyless `gcloud` Genie 4 bursts, A\* state-space verification, binary Ableton 303 `.mid` synthesis, and live `si-algo` Brier calibration.

<!-- INVARIANT START -->
## Invarianten

1. **Zero-Cost Firewall Default:** `zeroCostLock` startet immer auf `true` (`$0.00` garantiert, bis explizit ein zeitlich gekappter Burst entsperrt wird).
2. **Formale Lösbarkeits- & MIDI-Prüfung:** Jedes Escape-Rätsel beweist `deadEnds === 0` (`expandedAStar <= expandedBfs`); jede erzeugte `.mid`-Datei besteht `validateSmfMidi` (`valid === true`, gepaarte Note-Offs, exakte Takt-Ticks).
3. **Loopback- & CLI-Kapselung:** Keine Rechte-Bypässe (`--dangerously-skip-permissions`, `--always-approve`, `--yolo`); Cross-Origin-POSTs auf `localhost` werden mit HTTP `403` abgewiesen.
<!-- INVARIANT END -->

## Prüfbefehle

```bash
npm test
node skills/sovereign-world-forge/scripts/test.mjs
npm run si-algo -- simulate --mode sovereign --cycles 30
```
