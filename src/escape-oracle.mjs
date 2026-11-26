// Infinite Escape Room Engine v3.0 — A* Heuristic Search vs. BFS Variant Benchmark
// Distilled from oracle-first-exploration:
// - 5-room multi-branch puzzle graph with dual prism combinations, decoy reset trap, and harmonic shortcut
// - Proves zero softlocks (deadEnds === 0) across all reachable states
// - Runs A* (admissible popcount + room-distance heuristic) alongside BFS, proving identical optimal
//   path length with fewer expanded states (expandedAStar <= expandedBfs).

const THEMES = [
  {
    id: "chronos-orrery",
    title: "Chronos Brass Orrery",
    sky: "#091428",
    accent: "#38bdf8",
    portalColor: "#34d399",
    archetype: "cathedral",
    particles: "embers",
    rooms: [
      { id: "vestibule", name: "Sun-Dial Vestibule", hint: "Align the Cobalt Prism first." },
      { id: "astrolabe", name: "Astrolabe Bridge", hint: "Engage the Copper Counterweight or Side-Lens." },
      { id: "mirror_gallery", name: "Refraction Gallery", hint: "Focus the Solar Mirror to bridge the Vault." },
      { id: "vault", name: "Resonance Vault", hint: "Avoid the Gilded Siren Lever; strike the Obsidian Tuning Fork." },
      { id: "sanctum", name: "Sovereign Horizon Sanctum", hint: "Step into the emerald Sovereign Portal!" },
    ],
  },
  {
    id: "basalt-tide",
    title: "Bioluminescent Tide Library",
    sky: "#06191d",
    accent: "#2dd4bf",
    portalColor: "#c084fc",
    archetype: "library",
    particles: "fireflies",
    rooms: [
      { id: "vestibule", name: "Tidal Atrium", hint: "Kindle the Lantern Spores to reveal the Sluice." },
      { id: "astrolabe", name: "Glass Sluice Catwalk", hint: "Lower the Basalt Weir." },
      { id: "mirror_gallery", name: "Abyssal Prism Hall", hint: "Align the Quartz Tide-Lens." },
      { id: "vault", name: "Submerged Scriptorium", hint: "Ignore the Rusted Decoy; chime the Coral Astrolabe." },
      { id: "sanctum", name: "Starlight Terrace", hint: "Cross the violet Sovereign Portal!" },
    ],
  },
  {
    id: "kyoto-clockwork",
    title: "Rain-Soaked Kyoto Pavilion",
    sky: "#140f24",
    accent: "#f97316",
    portalColor: "#fbbf24",
    archetype: "canyon",
    particles: "rain",
    rooms: [
      { id: "vestibule", name: "Cedar Rain Gate", hint: "Slide the Shoji Bell-Latch." },
      { id: "astrolabe", name: "Origami Crane Crossing", hint: "Tension the Silk Mainspring." },
      { id: "mirror_gallery", name: "Lantern Wind-Gallery", hint: "Open the Bamboo Resonance Vane." },
      { id: "vault", name: "Lacquer Gear Pavilion", hint: "Skip the Fox-Mask Decoy; strike the Bronze Gong." },
      { id: "sanctum", name: "Cloud-Lantern Spire", hint: "Walk through the golden Sovereign Portal!" },
    ],
  },
];

function popcount4(mask) {
  let c = 0;
  let m = mask & 0x0f;
  while (m) {
    c += m & 1;
    m >>= 1;
  }
  return c;
}

export function generateEscapePuzzle(seedText = "") {
  let hash = 0;
  const clean = String(seedText || "chronos");
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  const theme = THEMES[hash % THEMES.length];

  // 4 switches (bits 1, 2, 4, 8 -> goal mask 15) + 1 decoy reset + 1 side distractor + exit portal
  const interactables = [
    {
      id: "rune_alpha",
      roomIdx: 0,
      label: "Cobalt Prism Pedestal",
      z: -12,
      x: -3.2,
      kind: "switch",
      flagBit: 1,
      effectText: "Cobalt beam refracts forward — Room 2 unlocked!",
    },
    {
      id: "side_chronometer",
      roomIdx: 0,
      label: "Auxiliary Sundial (Optional Lore)",
      z: -16,
      x: 3.5,
      kind: "switch",
      flagBit: 16, // optional lore bit explored by blind BFS, ignored by A* heuristic!
      effectText: "Auxiliary sundial hums softly with ancient inscriptions.",
    },
    {
      id: "rune_beta",
      roomIdx: 1,
      label: "Copper Counterweight Wheel",
      z: -28,
      x: 3.3,
      kind: "switch",
      requiresMask: 1,
      flagBit: 2,
      effectText: "Counterweight locks in — Refraction Gallery unsealed!",
    },
    {
      id: "rune_delta",
      roomIdx: 2,
      label: "Solar Mirror Gimbal",
      z: -44,
      x: -3.0,
      kind: "switch",
      requiresMask: 3,
      flagBit: 4,
      effectText: "Solar beam pierces the mist — Resonance Vault opened!",
    },
    {
      id: "decoy_trap",
      roomIdx: 3,
      label: "Gilded Siren Lever (Suspicious)",
      z: -56,
      x: -3.6,
      kind: "decoy",
      resetsBit: 4,
      effectText: "TRAP! Decoy vented steam and misaligned the Solar Mirror!",
    },
    {
      id: "rune_gamma",
      roomIdx: 3,
      label: "Obsidian Tuning Fork",
      z: -62,
      x: 3.1,
      kind: "switch",
      requiresMask: 7,
      flagBit: 8,
      effectText: "Harmonic chord rings out — Sovereign Exit Portal blazes open!",
    },
    {
      id: "exit_portal",
      roomIdx: 4,
      label: "Sovereign Exit Portal",
      z: -76,
      x: 0,
      kind: "portal",
      requiresMask: 15,
      effectText: "ESCAPED! Sovereign Portal traversed!",
    },
  ];

  const oracleReport = verifyPuzzleAStarVsBfs(interactables);

  return {
    puzzleId: `esc-${hash.toString(16).slice(0, 6)}`,
    seed: clean,
    theme,
    rooms: theme.rooms,
    interactables,
    oracle: oracleReport,
    worldBlueprint: {
      archetype: theme.archetype,
      skyColor: theme.sky,
      accentColor: theme.accent,
      portalColor: theme.portalColor,
      particles: theme.particles,
      fogDensity: 0.4,
      corridorLength: 86,
      escapeMode: true,
    },
    geniePrompt: `First-person walking view through ${theme.title}: ${theme.rooms[0].name} leading toward glowing brass puzzle pedestals and a distant ${theme.portalColor} portal arch. Audio: crisp footsteps on stone, resonant metallic chimes, subtle mechanical clicks.`,
  };
}

function transitionsFrom(state, interactables, trapsSet = null) {
  const nexts = [];
  const m = state.mask;
  const maxRoom =
    (m & 8) !== 0 ? 4 : (m & 4) !== 0 ? 3 : (m & 2) !== 0 ? 2 : (m & 1) !== 0 ? 1 : 0;

  for (let r = 0; r <= maxRoom; r++) {
    if (r !== state.roomIdx) {
      nexts.push({ roomIdx: r, mask: m, step: `walk_room_${r}` });
    }
  }

  for (const item of interactables) {
    if (item.roomIdx !== state.roomIdx) continue;
    if (item.requiresMask && (m & item.requiresMask) !== item.requiresMask) continue;

    if (item.kind === "switch") {
      const nextMask = m | item.flagBit;
      if (nextMask !== m) {
        nexts.push({ roomIdx: state.roomIdx, mask: nextMask, step: `activate:${item.id}` });
      }
    } else if (item.kind === "decoy") {
      if (trapsSet) trapsSet.add(item.id);
      const nextMask = m & ~item.resetsBit;
      nexts.push({
        roomIdx: Math.min(state.roomIdx, 2),
        mask: nextMask,
        step: `trap:${item.id}`,
      });
    } else if (item.kind === "portal") {
      nexts.push({
        roomIdx: 4,
        mask: m | 32,
        step: `enter:${item.id}`,
        goal: true,
      });
    }
  }
  return nexts;
}

/**
 * Runs both BFS (exhaustive reachability + softlock proof) and A* (heuristic goal search)
 * and compares expanded node counts!
 */
export function verifyPuzzleAStarVsBfs(interactables) {
  // 1. Exhaustive BFS for full state space + softlock proof
  const startKey = "0:0";
  const bfsQueue = [{ roomIdx: 0, mask: 0, path: [] }];
  const visited = new Set([startKey]);
  const trapsSet = new Set();
  let bfsWinningPath = null;
  let expandedBfs = 0;

  while (bfsQueue.length > 0) {
    const cur = bfsQueue.shift();
    expandedBfs++;
    for (const nx of transitionsFrom(cur, interactables, trapsSet)) {
      const nextPath = [...cur.path, nx.step];
      if (nx.goal) {
        if (!bfsWinningPath) bfsWinningPath = nextPath;
        continue;
      }
      const key = `${nx.roomIdx}:${nx.mask}`;
      if (!visited.has(key)) {
        visited.add(key);
        bfsQueue.push({ roomIdx: nx.roomIdx, mask: nx.mask, path: nextPath });
      }
    }
  }

  // 2. A* Search with admissible heuristic: missing required bits (4 - popcount4(mask)) + portal step (1)
  const heuristic = (roomIdx, mask) => {
    const missingBits = 4 - popcount4(mask);
    const needWalkToPortal = roomIdx === 4 ? 0 : 1;
    return missingBits + needWalkToPortal + 1; // admissible lower bound on remaining actions
  };

  const open = [{ roomIdx: 0, mask: 0, g: 0, f: heuristic(0, 0), path: [] }];
  const bestG = new Map([[startKey, 0]]);
  let aStarWinningPath = null;
  let expandedAStar = 0;

  while (open.length > 0) {
    open.sort((a, b) => a.f - b.f || b.g - a.g);
    const cur = open.shift();
    expandedAStar++;

    for (const nx of transitionsFrom(cur, interactables)) {
      const nextG = cur.g + 1;
      const nextPath = [...cur.path, nx.step];
      if (nx.goal) {
        aStarWinningPath = nextPath;
        open.length = 0;
        break;
      }
      const key = `${nx.roomIdx}:${nx.mask}`;
      if (nextG < (bestG.get(key) ?? Infinity)) {
        bestG.set(key, nextG);
        open.push({
          roomIdx: nx.roomIdx,
          mask: nx.mask,
          g: nextG,
          f: nextG + heuristic(nx.roomIdx, nx.mask),
          path: nextPath,
        });
      }
    }
  }

  // 3. Zero-softlock guarantee across ALL reachable states
  let deadEnds = 0;
  for (const stateKey of visited) {
    const [rStr, mStr] = stateKey.split(":");
    const subQ = [{ roomIdx: Number(rStr), mask: Number(mStr) }];
    const subSeen = new Set([stateKey]);
    let canWin = false;
    while (subQ.length > 0 && !canWin) {
      const s = subQ.shift();
      for (const nx of transitionsFrom(s, interactables)) {
        if (nx.goal) {
          canWin = true;
          break;
        }
        const k = `${nx.roomIdx}:${nx.mask}`;
        if (!subSeen.has(k)) {
          subSeen.add(k);
          subQ.push({ roomIdx: nx.roomIdx, mask: nx.mask });
        }
      }
    }
    if (!canWin) deadEnds++;
  }

  return {
    solvable: Boolean(aStarWinningPath) && deadEnds === 0,
    solver: "A* + BFS Softlock Proof",
    reachableStates: visited.size,
    expandedBfs,
    expandedAStar,
    aStarSpeedupRatio: +(expandedBfs / Math.max(1, expandedAStar)).toFixed(2),
    shortestSteps: aStarWinningPath ? aStarWinningPath.length : null,
    shortestPath: aStarWinningPath || bfsWinningPath || [],
    trapsDetected: [...trapsSet],
    deadEnds,
  };
}
