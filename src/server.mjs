// HTTP + SSE Server for 5D Triad Forge v2.0 Suite:
// - Module 0: Cost Firewall ($0.00 Lock Default, 12s Golden Take Burst, Daily Cap)
// - Module 1: 0-€ Playable 3D Blueprints + Genie 4 Ephemeral Auth
// - Module 2: Audio-Visual World-Jockey Webhook (/api/jockey/pulse for Ableton/MIDI scripts)
// - Module 3: Infinite Escape Room with BFS Solvability Oracle (/api/escape/generate)
// - Module 4: Game-Prototyping Variant-Arena (/api/arena/run)
// - Module 5: 5D Philosophy Theater & Auto-Micro-Trailer (/api/theater/debate)

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateEscapePuzzle } from "./escape-oracle.mjs";
import { GenieSessionManager } from "./genie-service.mjs";
import { generateAcidMidi } from "./midi-forge.mjs";
import {
  computeSovereignIntegral,
  computeTemporalCalibration,
  simulateIntegralTrajectory,
} from "./si-algo-core.mjs";
import { TriadCreativeBus, probeLocalAgents } from "./triad-bus.mjs";
import { runVariantArena } from "./variant-arena.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const NODE_MODULES_DIR = path.join(ROOT, "node_modules");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
};

const P_RETRY_BROWSER_ESM = `
export class AbortError extends Error {
  constructor(message) {
    super(typeof message === "string" ? message : message?.message || "Aborted");
    this.name = "AbortError";
    if (message instanceof Error) this.originalError = message;
  }
}
export default async function pRetry(input, options = {}) {
  const retries = options.retries ?? 3;
  const factor = options.factor ?? 2;
  const minTimeout = options.minTimeout ?? 1000;
  const maxTimeout = options.maxTimeout ?? 15000;
  let attempt = 0;
  while (true) {
    attempt++;
    try {
      return await input(attempt);
    } catch (err) {
      if (err instanceof AbortError || err?.name === "AbortError" || attempt > retries) {
        throw err?.originalError || err;
      }
      if (options.onFailedAttempt) {
        await options.onFailedAttempt(Object.assign(err, { attemptNumber: attempt, retriesLeft: retries - attempt + 1 }));
      }
      const delay = Math.min(maxTimeout, minTimeout * Math.pow(factor, attempt - 1));
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
export { pRetry };
`;

function readJsonBody(req, maxBytes = 768_000) {
  return new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString("utf8");
      if (raw.length > maxBytes) {
        req.destroy();
        reject(new Error("Payload too large"));
      }
    });
    req.on("end", () => {
      if (!raw.trim()) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error("Invalid JSON body"));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, data) {
  const payload = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(payload);
}

export function createStudioServer({ zeroCostLock = true } = {}) {
  const genie = new GenieSessionManager({
    budgetPath: path.join(ROOT, "data", "budget-ledger.json"),
    zeroCostLock,
    maxBurstSec: 12,
    dailyCapSec: 36,
  });

  const bus = new TriadCreativeBus({
    ledgerPath: path.join(ROOT, "data", "triad-ledger.jsonl"),
    cliTimeoutMs: 16_000,
  });

  const sseClients = new Set();
  let cachedAgents = null;

  const broadcastSse = (evt) => {
    const frame = `data: ${JSON.stringify(evt)}\n\n`;
    for (const client of sseClients) {
      try {
        client.write(frame);
      } catch {
        sseClients.delete(client);
      }
    }
  };

  bus.onEvent(broadcastSse);

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const pathname = url.pathname;

    // Loopback Origin CSRF Guard on state-mutating POST endpoints (Syzygos Fix #3)
    if (req.method === "POST") {
      const origin = req.headers.origin;
      if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        return sendJson(res, 403, {
          error: `Blocked cross-origin POST from ${origin} to protect local Cost Firewall & CLIs.`,
          code: "FORBIDDEN_ORIGIN",
        });
      }
    }

    try {
      // 1. SSE Event Stream
      if (req.method === "GET" && pathname === "/api/events") {
        res.writeHead(200, {
          "Content-Type": "text/event-stream; charset=utf-8",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        });
        res.write(`data: ${JSON.stringify({ type: "connected", ts: new Date().toISOString() })}\n\n`);
        sseClients.add(res);
        req.on("close", () => sseClients.delete(res));
        return;
      }

      // 2. Status, Agents, Auth & Cost Firewall State
      if (req.method === "GET" && pathname === "/api/status") {
        if (!cachedAgents || url.searchParams.get("refresh") === "1") {
          cachedAgents = await probeLocalAgents();
          if (url.searchParams.get("refresh") === "1") {
            genie.refreshGcloudAuth();
          }
        }
        return sendJson(res, 200, {
          ok: true,
          genieKey: genie.getKeyStatus(),
          budget: genie.getBudgetStatus(),
          agents: cachedAgents,
          history: bus.worldHistory.slice(-10),
        });
      }

      // 3. Cost Firewall Policy Endpoint
      if (req.method === "POST" && pathname === "/api/budget") {
        const body = await readJsonBody(req);
        const budget = genie.updateBudgetPolicy(body);
        broadcastSse({ type: "budget.updated", budget });
        return sendJson(res, 200, { ok: true, budget });
      }

      // 4. Optional API Key Override in Local Server RAM
      if (req.method === "POST" && pathname === "/api/config/key") {
        const body = await readJsonBody(req);
        genie.setApiKey(body.apiKey || "");
        return sendJson(res, 200, { ok: true, genieKey: genie.getKeyStatus() });
      }

      // 5. Mint Ephemeral Genie 4 Session (guarded by Zero-Cost Firewall & Daily Cap)
      if (req.method === "POST" && pathname === "/api/genie/session") {
        const body = await readJsonBody(req);
        const sessionInfo = await genie.createEphemeralSession({
          requestedBurstSec: body.requestedBurstSec,
        });
        broadcastSse({ type: "budget.updated", budget: sessionInfo.budget });
        return sendJson(res, 200, sessionInfo);
      }

      // 6. Explicit Session Cancel / Accounting Update
      if (req.method === "POST" && pathname === "/api/genie/cancel") {
        const body = await readJsonBody(req);
        const result = await genie.cancelSession(body.interactionId, body.elapsedSec);
        broadcastSse({ type: "budget.updated", budget: result.budget });
        return sendJson(res, 200, result);
      }

      // 7. Module 1: AGY x Grok x Claude Creative Round
      if (req.method === "POST" && pathname === "/api/triad/round") {
        const body = await readJsonBody(req);
        const record = await bus.runCreativeRound({
          seed: body.seed,
          isInitial: body.isInitial !== false,
          useLocalClis: body.useLocalClis !== false,
          referenceImage: body.referenceImage || null,
          transport: body.transport || "webrtc",
        });
        return sendJson(res, 200, record);
      }

      // 8. Module 2: Ableton / DAW / MIDI World-Jockey Pulse Bridge & Binary .mid Export
      if (req.method === "POST" && pathname === "/api/jockey/pulse") {
        const body = await readJsonBody(req);
        const pulse = {
          type: "jockey.pulse",
          bpm: Math.max(60, Math.min(220, Number(body.bpm) || 138)),
          energy: Math.max(0, Math.min(1, Number(body.energy ?? 0.78))),
          cutoff: Math.max(0, Math.min(1, Number(body.cutoff ?? 0.65))),
          drop: Boolean(body.drop),
          promptMutation: body.prompt ? String(body.prompt).slice(0, 220) : null,
          ts: new Date().toISOString(),
        };
        broadcastSse(pulse);
        return sendJson(res, 200, { ok: true, pulse });
      }

      if (req.method === "POST" && pathname === "/api/jockey/midi") {
        const body = await readJsonBody(req);
        const midi = generateAcidMidi({
          seed: body.seed || "5d-triad-acid",
          bpm: Number(body.bpm) || 138,
          energy: Number(body.energy ?? 0.78),
          bars: Number(body.bars) || 2,
        });
        broadcastSse({
          type: "agent.message",
          agent: "grok",
          mode: "303-midi-forge",
          latencyMs: 1,
          text: `Generated ${midi.bars}-bar 303 Acid clip @ ${midi.bpm} BPM (${midi.noteCount} notes, ${midi.slideCount} slides, ${midi.accentCount} accents · SMF valid=${midi.validation.valid}).`,
        });
        return sendJson(res, 200, {
          ok: midi.validation.valid,
          bpm: midi.bpm,
          bars: midi.bars,
          noteCount: midi.noteCount,
          slideCount: midi.slideCount,
          accentCount: midi.accentCount,
          validation: midi.validation,
          base64: midi.base64,
        });
      }

      // 9. Module 3: Infinite Escape Room Generator + BFS Proof
      if (req.method === "POST" && pathname === "/api/escape/generate") {
        const body = await readJsonBody(req);
        const puzzle = generateEscapePuzzle(body.seed || `escape-${Date.now()}`);
        broadcastSse({
          type: "agent.message",
          agent: "agy",
          mode: "bfs-oracle",
          latencyMs: 1,
          text: `Escape Room "${puzzle.theme.title}" verified solvable in ${puzzle.oracle.shortestSteps} steps (${puzzle.oracle.reachableStates} states, ${puzzle.oracle.deadEnds} dead-ends, decoy trap: ${puzzle.oracle.trapsDetected.join(",")}).`,
        });
        return sendJson(res, 200, puzzle);
      }

      // 10. Module 4: Game-Prototyping Variant-Arena
      if (req.method === "POST" && pathname === "/api/arena/run") {
        const body = await readJsonBody(req);
        const arena = runVariantArena({ concept: body.concept });
        broadcastSse({
          type: "agent.message",
          agent: "claude",
          mode: "variant-arena",
          latencyMs: Math.round(arena.totalEvalMs),
          text: `Arena Champion for "${arena.concept}": ${arena.winnerTitle} (score=${arena.candidates[0].score}).`,
        });
        return sendJson(res, 200, arena);
      }

      // 11. Module 5: 5D Philosophy & Architecture Debate Theater
      if (req.method === "POST" && pathname === "/api/theater/debate") {
        const body = await readJsonBody(req);
        const theater = await bus.runPhilosophyTheater({
          topic: body.topic,
          useLocalClis: Boolean(body.useLocalClis),
        });
        return sendJson(res, 200, theater);
      }

      // 11b. Canonical Sovereign Integral (si-algo) Audit, Live Brier Feedback & Simulation Endpoint
      if (req.method === "POST" && pathname === "/api/si-algo/feedback") {
        const body = await readJsonBody(req);
        const fbPath = path.join(ROOT, "data", "brier-feedback.jsonl");
        const entry = {
          ts: new Date().toISOString(),
          prob: Math.max(0.05, Math.min(0.99, Number(body.prob) || 0.85)),
          ref_prob: 0.55,
          outcome: body.outcome === 0 ? 0 : 1,
          roundId: body.roundId || null,
        };
        fs.mkdirSync(path.dirname(fbPath), { recursive: true });
        fs.appendFileSync(fbPath, JSON.stringify(entry) + "\n", "utf8");
        const history = fs
          .readFileSync(fbPath, "utf8")
          .split(/\r?\n/)
          .filter(Boolean)
          .map((l) => JSON.parse(l));
        const calibration = computeTemporalCalibration(history);
        broadcastSse({ type: "brier.updated", calibration });
        return sendJson(res, 200, { ok: true, calibration });
      }

      if (req.method === "POST" && pathname === "/api/si-algo/evaluate") {
        const body = await readJsonBody(req);
        if (body.simulate) {
          return sendJson(
            res,
            200,
            simulateIntegralTrajectory({
              cycles: Number(body.cycles) || 30,
              mode: body.mode || "sovereign",
            })
          );
        }
        const resIntegral = computeSovereignIntegral({
          session: body.session || {},
          history: Array.isArray(body.history) ? body.history : [],
          loopMode: body.loopMode || "on",
          minSettled: Number(body.minSettled) || 10,
        });
        return sendJson(res, 200, resIntegral);
      }

      // 12. ESM Vendor Shim + @google/genai Browser Bundle
      if (req.method === "GET" && pathname === "/vendor/p-retry.mjs") {
        res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
        res.end(P_RETRY_BROWSER_ESM);
        return;
      }

      if (req.method === "GET" && pathname.startsWith("/vendor/genai/")) {
        const rel = pathname.slice("/vendor/genai/".length);
        const target = path.resolve(NODE_MODULES_DIR, "@google", "genai", "dist", "web", rel);
        const allowedRoot = path.resolve(NODE_MODULES_DIR, "@google", "genai", "dist", "web");
        if (!target.startsWith(allowedRoot) || !fs.existsSync(target)) {
          return sendJson(res, 404, { error: "Not found" });
        }
        res.writeHead(200, { "Content-Type": "text/javascript; charset=utf-8" });
        fs.createReadStream(target).pipe(res);
        return;
      }

      // 13. Static Assets in public/
      const fileRel = pathname === "/" ? "index.html" : pathname.slice(1);
      const filePath = path.resolve(PUBLIC_DIR, fileRel);
      if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        return sendJson(res, 404, { error: "Not found" });
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, {
        "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      const status =
        err.code === "MISSING_API_KEY" ||
        err.code === "ZERO_COST_LOCK" ||
        err.code === "DAILY_BUDGET_REACHED"
          ? 400
          : 500;
      sendJson(res, status, { error: err.message || "Internal server error", code: err.code || "ERR" });
    }
  });

  const shutdown = async () => {
    await genie.shutdownAll();
    server.close();
  };

  return { server, genie, bus, shutdown };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 4321;
  const { server, shutdown } = createStudioServer({ zeroCostLock: true });
  server.listen(port, () => {
    console.log(`\n[5D Triad Forge v2.0] Complete Suite ready ($0.00 Lock Active by default):`);
    console.log(`  -> http://localhost:${port}\n`);
  });
  process.on("SIGINT", async () => {
    await shutdown();
    process.exit(0);
  });
  process.on("SIGTERM", async () => {
    await shutdown();
    process.exit(0);
  });
}
