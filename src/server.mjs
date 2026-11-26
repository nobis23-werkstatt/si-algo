// HTTP + SSE + Gzip Server for 5D Triad Forge v4.0 ("Sovereign Ultra" — /scale-it -4):
// - Gzip compression on JS/ESM/CSS/HTML (>4.8x wire payload reduction on @google/genai!)
// - Prepaid World-Coins API (/api/coins/status, /api/coins/redeem, /api/coins/mint, /api/coins/spend)
// - Multi-Track 180-BPM B-Minor SMF Format 1 MIDI export (/api/jockey/midi)
// - 4-Tier Min-Heap A* Escape Oracle (/api/escape/generate) & 12-Profile Variant-Arena (/api/arena/run)

import crypto from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import zlib from "node:zlib";
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
import { WorldCoinLedger } from "./world-coins.mjs";

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
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp3": "audio/mpeg",
};

const COMPRESSIBLE_EXT = new Set([".html", ".css", ".js", ".mjs", ".json", ".svg", ".webmanifest"]);
const gzipCache = new Map();

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

function serveStaticWithGzipAndRange(req, res, filePath, contentType) {
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;

  if (req.headers["if-none-match"] === etag) {
    res.writeHead(304);
    res.end();
    return;
  }

  // Support HTTP Byte-Range for smooth MP3 seeking on the 180-BPM track!
  if (ext === ".mp3" && req.headers.range) {
    const match = String(req.headers.range).match(/bytes=(\d*)-(\d*)/);
    if (match) {
      const start = match[1] ? parseInt(match[1], 10) : 0;
      const end = match[2] ? parseInt(match[2], 10) : stat.size - 1;
      if (start >= 0 && end < stat.size && start <= end) {
        res.writeHead(206, {
          "Content-Type": contentType,
          "Content-Range": `bytes ${start}-${end}/${stat.size}`,
          "Accept-Ranges": "bytes",
          "Content-Length": end - start + 1,
        });
        fs.createReadStream(filePath, { start, end }).pipe(res);
        return;
      }
    }
  }

  const acceptsGzip = /\bgzip\b/i.test(String(req.headers["accept-encoding"] || ""));
  if (acceptsGzip && COMPRESSIBLE_EXT.has(ext) && stat.size > 512) {
    const cacheKey = `${filePath}:${etag}`;
    let gz = gzipCache.get(cacheKey);
    if (!gz) {
      gz = zlib.gzipSync(fs.readFileSync(filePath), { level: 6 });
      if (gzipCache.size > 48) gzipCache.clear();
      gzipCache.set(cacheKey, gz);
    }
    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Encoding": "gzip",
      "Content-Length": gz.length,
      ETag: etag,
      Vary: "Accept-Encoding",
      "Cache-Control": "no-cache",
    });
    res.end(gz);
    return;
  }

  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "Accept-Ranges": "bytes",
    ETag: etag,
    "Cache-Control": "no-cache",
  });
  fs.createReadStream(filePath).pipe(res);
}

export function createStudioServer({ zeroCostLock = true, ledgerFile = null } = {}) {
  const genie = new GenieSessionManager({
    budgetPath: path.join(ROOT, "data", "budget-ledger.json"),
    zeroCostLock,
    maxBurstSec: 12,
    dailyCapSec: 48,
  });

  const coins = new WorldCoinLedger({
    ledgerFile: ledgerFile ?? path.join(ROOT, "data", "world-coins.json"),
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

    // Loopback Origin CSRF Guard on all state-mutating POST endpoints
    if (req.method === "POST") {
      const origin = req.headers.origin;
      if (origin && !/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
        return sendJson(res, 403, {
          error: `Blocked cross-origin POST from ${origin} to protect local Cost Firewall & Wallet.`,
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

      // 2. Status, Agents, Auth, Cost Firewall & World-Coins Wallet
      if (req.method === "GET" && pathname === "/api/status") {
        if (!cachedAgents || url.searchParams.get("refresh") === "1") {
          cachedAgents = await probeLocalAgents();
          if (url.searchParams.get("refresh") === "1") {
            genie.refreshGcloudAuth();
          }
        }
        const walletId = url.searchParams.get("walletId") || "local-studio";
        return sendJson(res, 200, {
          ok: true,
          version: "4.0.0",
          genieKey: genie.getKeyStatus(),
          budget: genie.getBudgetStatus(),
          wallet: coins.getWalletStatus(walletId),
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

      // 4. Prepaid World-Coins Endpoints (Status, Redeem Gumroad/Voucher, Mint Dev Voucher, Atomic Spend)
      if (req.method === "GET" && pathname === "/api/coins/status") {
        const walletId = url.searchParams.get("walletId") || "local-studio";
        return sendJson(res, 200, { ok: true, wallet: coins.getWalletStatus(walletId) });
      }

      if (req.method === "POST" && pathname === "/api/coins/redeem") {
        const body = await readJsonBody(req);
        const resRedeem = await coins.redeemCode({
          walletId: body.walletId || "local-studio",
          code: body.code,
          gumroadProductId: body.gumroadProductId || null,
        });
        broadcastSse({ type: "wallet.updated", wallet: resRedeem.wallet });
        return sendJson(res, 200, resRedeem);
      }

      if (req.method === "POST" && pathname === "/api/coins/mint") {
        const body = await readJsonBody(req);
        const voucher = coins.mintVoucher({
          code: body.code || null,
          coins: Number(body.coins) || 3,
          note: body.note || "Local Founder Mint",
        });
        return sendJson(res, 200, { ok: true, voucher });
      }

      // 5. Optional API Key Override in Local Server RAM
      if (req.method === "POST" && pathname === "/api/config/key") {
        const body = await readJsonBody(req);
        genie.setApiKey(body.apiKey || "");
        return sendJson(res, 200, { ok: true, genieKey: genie.getKeyStatus() });
      }

      // 6. Mint Ephemeral Genie 4 Session (supports BOTH Budget Mode AND Prepaid World-Coin Atomic Spend!)
      if (req.method === "POST" && pathname === "/api/genie/session") {
        const body = await readJsonBody(req);
        let coinTx = null;

        if (body.useWorldCoin === true) {
          coinTx = coins.spendCoinAtomically({
            walletId: body.walletId || "local-studio",
            nonce: body.nonce || crypto.randomUUID(),
          });
          broadcastSse({ type: "wallet.updated", wallet: coinTx.wallet });
          // Temporarily unlock for this single prepaid 12s coin take!
          const prevLock = genie.zeroCostLock;
          genie.zeroCostLock = false;
          try {
            const sessionInfo = await genie.createEphemeralSession({ requestedBurstSec: 12 });
            genie.zeroCostLock = prevLock;
            broadcastSse({ type: "budget.updated", budget: sessionInfo.budget });
            return sendJson(res, 200, { ...sessionInfo, coinTx });
          } catch (err) {
            genie.zeroCostLock = prevLock;
            coins.refundFailedLaunch(coinTx.nonce);
            broadcastSse({ type: "wallet.updated", wallet: coins.getWalletStatus(body.walletId) });
            throw err;
          }
        }

        const sessionInfo = await genie.createEphemeralSession({
          requestedBurstSec: body.requestedBurstSec,
        });
        broadcastSse({ type: "budget.updated", budget: sessionInfo.budget });
        return sendJson(res, 200, sessionInfo);
      }

      // 7. Explicit Session Cancel
      if (req.method === "POST" && pathname === "/api/genie/cancel") {
        const body = await readJsonBody(req);
        const result = await genie.cancelSession(body.interactionId, body.elapsedSec);
        broadcastSse({ type: "budget.updated", budget: result.budget });
        return sendJson(res, 200, result);
      }

      // 8. Module 1: AGY x Grok x Claude Creative Round
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

      // 9. Module 2: World-Jockey Pulse Bridge & Multi-Track 180-BPM B-Minor MIDI Forge
      if (req.method === "POST" && pathname === "/api/jockey/pulse") {
        const body = await readJsonBody(req);
        const pulse = {
          type: "jockey.pulse",
          bpm: Math.max(60, Math.min(220, Number(body.bpm) || 180)),
          energy: Math.max(0, Math.min(1, Number(body.energy ?? 0.85))),
          cutoff: Math.max(0, Math.min(1, Number(body.cutoff ?? 0.72))),
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
          seed: body.seed || "motivation-180bpm-bmin",
          bpm: Number(body.bpm) || 180,
          energy: Number(body.energy ?? 0.85),
          bars: Number(body.bars) || 4,
          scale: body.scale || "b_minor",
          multiTrack: Boolean(body.multiTrack),
        });
        broadcastSse({
          type: "agent.message",
          agent: "grok",
          mode: "303-midi-forge",
          latencyMs: 1,
          text: `Generated ${midi.bars}-bar SMF Format ${midi.format} (${midi.trackCount} tracks, ${midi.scale} @ ${midi.bpm} BPM · ${midi.noteCount} notes, ${midi.slideCount} slides · valid=${midi.validation.valid}).`,
        });
        return sendJson(res, 200, {
          ok: midi.validation.valid,
          format: midi.format,
          trackCount: midi.trackCount,
          scale: midi.scale,
          bpm: midi.bpm,
          bars: midi.bars,
          noteCount: midi.noteCount,
          slideCount: midi.slideCount,
          accentCount: midi.accentCount,
          validation: midi.validation,
          base64: midi.base64,
        });
      }

      // 10. Module 3: 4-Tier Min-Heap A* Escape Room Generator
      if (req.method === "POST" && pathname === "/api/escape/generate") {
        const body = await readJsonBody(req);
        const puzzle = generateEscapePuzzle(body.seed || `escape-${Date.now()}`, {
          tier: Number(body.tier) || 2,
        });
        broadcastSse({
          type: "agent.message",
          agent: "agy",
          mode: "minheap-astar",
          latencyMs: 1,
          text: `[Tier ${puzzle.tier}] "${puzzle.theme.title}" solved in ${puzzle.oracle.shortestSteps} steps (${puzzle.oracle.expandedAStar} A* vs ${puzzle.oracle.expandedBfs} BFS = ${puzzle.oracle.aStarSpeedupRatio}x speedup · ${puzzle.oracle.reachableStates} states, 0 dead-ends).`,
        });
        return sendJson(res, 200, puzzle);
      }

      // 11. Module 4: 12-Profile Game Variant-Arena
      if (req.method === "POST" && pathname === "/api/arena/run") {
        const body = await readJsonBody(req);
        const arena = runVariantArena({
          concept: body.concept,
          limit: Number(body.limit) || 4,
        });
        broadcastSse({
          type: "agent.message",
          agent: "claude",
          mode: "variant-arena",
          latencyMs: Math.round(arena.totalEvalMs),
          text: `Evaluated ${arena.totalEvaluated} archetypes for "${arena.concept}" -> Winner: ${arena.winnerTitle} (score=${arena.candidates[0].score}).`,
        });
        return sendJson(res, 200, arena);
      }

      // 12. Module 5: 5D Philosophy Debate & Canonical si-algo Endpoints
      if (req.method === "POST" && pathname === "/api/theater/debate") {
        const body = await readJsonBody(req);
        const theater = await bus.runPhilosophyTheater({
          topic: body.topic,
          useLocalClis: Boolean(body.useLocalClis),
        });
        return sendJson(res, 200, theater);
      }

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
        return sendJson(
          res,
          200,
          computeSovereignIntegral({
            session: body.session || {},
            history: Array.isArray(body.history) ? body.history : [],
            loopMode: body.loopMode || "on",
            minSettled: Number(body.minSettled) || 10,
          })
        );
      }

      // 13. Vendor Shims (Gzip enabled!)
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
        return serveStaticWithGzipAndRange(req, res, target, "text/javascript; charset=utf-8");
      }

      // 14. Static Assets in public/ (Gzip + Byte-Range MP3 streaming)
      const fileRel = pathname === "/" ? "index.html" : pathname.slice(1);
      const filePath = path.resolve(PUBLIC_DIR, fileRel);
      if (!filePath.startsWith(PUBLIC_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        return sendJson(res, 404, { error: "Not found" });
      }
      const ext = path.extname(filePath).toLowerCase();
      return serveStaticWithGzipAndRange(
        req,
        res,
        filePath,
        MIME_TYPES[ext] || "application/octet-stream"
      );
    } catch (err) {
      const status =
        err.code === "INSUFFICIENT_COINS"
          ? 402
          : err.code === "MISSING_API_KEY" ||
              err.code === "ZERO_COST_LOCK" ||
              err.code === "DAILY_BUDGET_REACHED" ||
              err.code === "ALREADY_REDEEMED" ||
              err.code === "INVALID_LICENSE" ||
              err.code === "DUPLICATE_NONCE"
            ? 400
            : 500;
      sendJson(res, status, { error: err.message || "Internal server error", code: err.code || "ERR" });
    }
  });

  const shutdown = async () => {
    await genie.shutdownAll();
    server.close();
  };

  return { server, genie, coins, bus, shutdown };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 4321;
  const { server, shutdown } = createStudioServer({ zeroCostLock: true });
  server.listen(port, () => {
    console.log(`\n[5D Triad Forge v4.0 Ultra] 16-Archetype 3D + 180-BPM Sync + World-Coins ready:`);
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
