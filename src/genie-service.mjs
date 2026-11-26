// Backend Genie 4 (models/genie-4, v1beta) Ephemeral Session & Zero-Cost Firewall.
// - Defaults to strict `zeroCostLock = true` ($0.00 guaranteed until user unlocks a burst).
// - Enforces per-session burst cap (e.g. 12s Golden Take) + persistent daily second budget.
// - Auto-discovers keyless `gcloud` CLI auth in local server RAM when unlocked.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { GoogleGenAI } from "@google/genai";

export const GENIE_MODEL_ID = "models/genie-4";
export const GENIE_API_VERSION = "v1beta";
export const GENIE_MAX_DURATION_SEC = 120;
export const GENIE_ESTIMATED_USD_PER_SEC = 0.101;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function resolveGcloudBinary() {
  const localApp = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
  const candidates =
    process.platform === "win32"
      ? [
          path.join(localApp, "Google", "Cloud SDK", "google-cloud-sdk", "bin", "gcloud.cmd"),
          "C:\\Program Files (x86)\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd",
          "C:\\Program Files\\Google\\Cloud SDK\\google-cloud-sdk\\bin\\gcloud.cmd",
          path.join(os.homedir(), "google-cloud-sdk", "bin", "gcloud.cmd"),
        ]
      : [
          "/usr/bin/gcloud",
          "/usr/local/bin/gcloud",
          path.join(os.homedir(), "google-cloud-sdk", "bin", "gcloud"),
        ];

  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return process.platform === "win32" ? "gcloud.cmd" : "gcloud";
}

function runGcloud(gcloudBin, args, timeout = 12_000) {
  if (process.platform === "win32" && /\.(cmd|bat)$/i.test(gcloudBin)) {
    const quotedArgs = args.map((a) => (/[\s"&|<>^()]/.test(a) ? `"${a}"` : a)).join(" ");
    const cmdLine = `""${gcloudBin}" ${quotedArgs}"`;
    return execFileSync("cmd.exe", ["/d", "/s", "/c", cmdLine], {
      encoding: "utf8",
      timeout,
      windowsHide: true,
      windowsVerbatimArguments: true,
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
  }
  return execFileSync(gcloudBin, args, {
    encoding: "utf8",
    timeout,
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

export function discoverGcloudGeminiAuth() {
  try {
    const gcloudBin = resolveGcloudBinary();
    const activeAccount = runGcloud(gcloudBin, [
      "auth",
      "list",
      "--filter=status:ACTIVE",
      "--format=value(account)",
    ]);
    if (!activeAccount) return null;

    let configuredProject = runGcloud(gcloudBin, ["config", "get-value", "project"]);
    if (configuredProject === "(unset)") configuredProject = "";

    const projectsRaw = runGcloud(gcloudBin, [
      "projects",
      "list",
      "--filter=lifecycleState:ACTIVE",
      "--format=value(projectId)",
    ]);
    const allProjects = projectsRaw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

    const orderedProjects = [
      ...(configuredProject ? [configuredProject] : []),
      ...allProjects.filter((p) => p.startsWith("gen-lang-client-") && p !== configuredProject),
      ...allProjects.filter((p) => !p.startsWith("gen-lang-client-") && p !== configuredProject),
    ];

    for (const projectId of orderedProjects.slice(0, 5)) {
      try {
        const uidsRaw = runGcloud(gcloudBin, [
          "services",
          "api-keys",
          "list",
          `--project=${projectId}`,
          "--format=value(uid)",
        ]);
        const uid = uidsRaw.split(/\r?\n/).map((s) => s.trim()).find(Boolean);
        if (!uid) continue;

        const keyString = runGcloud(gcloudBin, [
          "services",
          "api-keys",
          "get-key-string",
          uid,
          `--project=${projectId}`,
          "--format=value(keyString)",
        ]);
        if (keyString) {
          return {
            credential: keyString,
            projectId,
            account: activeAccount.split(/\r?\n/)[0].trim(),
            source: "gcloud-cli",
          };
        }
      } catch {
        // Try next candidate project
      }
    }
  } catch {
    // gcloud unavailable or unauthenticated
  }
  return null;
}

export class GenieSessionManager {
  constructor({
    enableGcloudDiscovery = true,
    budgetPath = null,
    zeroCostLock = true,
    maxBurstSec = 12,
    dailyCapSec = 36,
  } = {}) {
    this.runtimeApiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || "";
    this.authMeta = this.runtimeApiKey
      ? { source: "environment", projectId: null, account: null }
      : null;
    this.enableGcloudDiscovery = enableGcloudDiscovery;
    this.gcloudChecked = false;
    this.activeSessions = new Map();

    // Cost Firewall State (defaults to strict $0.00 lock!)
    this.budgetPath = budgetPath;
    this.zeroCostLock = zeroCostLock;
    this.maxBurstSec = maxBurstSec;
    this.dailyCapSec = dailyCapSec;
    this.dailyUsage = this._loadDailyUsage();
  }

  _loadDailyUsage() {
    const today = todayKey();
    if (this.budgetPath && fs.existsSync(this.budgetPath)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.budgetPath, "utf8"));
        if (parsed.date === today && typeof parsed.usedSec === "number") {
          return parsed;
        }
      } catch {}
    }
    return { date: today, usedSec: 0, sessions: 0 };
  }

  _saveDailyUsage() {
    if (!this.budgetPath) return;
    try {
      fs.mkdirSync(path.dirname(this.budgetPath), { recursive: true });
      fs.writeFileSync(this.budgetPath, JSON.stringify(this.dailyUsage, null, 2), "utf8");
    } catch {}
  }

  _rolloverDayIfNeeded() {
    const today = todayKey();
    if (this.dailyUsage.date !== today) {
      this.dailyUsage = { date: today, usedSec: 0, sessions: 0 };
      this._saveDailyUsage();
    }
  }

  getBudgetStatus() {
    this._rolloverDayIfNeeded();
    const remainingSec = Math.max(0, +(this.dailyCapSec - this.dailyUsage.usedSec).toFixed(1));
    return {
      zeroCostLock: this.zeroCostLock,
      maxBurstSec: this.maxBurstSec,
      dailyCapSec: this.dailyCapSec,
      usedSecToday: +this.dailyUsage.usedSec.toFixed(1),
      remainingSecToday: remainingSec,
      estimatedSpentUsdToday: +(this.dailyUsage.usedSec * GENIE_ESTIMATED_USD_PER_SEC).toFixed(2),
      estimatedCapUsdToday: +(this.dailyCapSec * GENIE_ESTIMATED_USD_PER_SEC).toFixed(2),
      sessionsToday: this.dailyUsage.sessions,
    };
  }

  updateBudgetPolicy({ zeroCostLock, maxBurstSec, dailyCapSec, resetToday } = {}) {
    this._rolloverDayIfNeeded();
    if (typeof zeroCostLock === "boolean") this.zeroCostLock = zeroCostLock;
    if (typeof maxBurstSec === "number" && Number.isFinite(maxBurstSec)) {
      this.maxBurstSec = Math.max(5, Math.min(GENIE_MAX_DURATION_SEC, Math.round(maxBurstSec)));
    }
    if (typeof dailyCapSec === "number" && Number.isFinite(dailyCapSec)) {
      this.dailyCapSec = Math.max(0, Math.min(600, Math.round(dailyCapSec)));
    }
    if (resetToday === true) {
      this.dailyUsage = { date: todayKey(), usedSec: 0, sessions: 0 };
      this._saveDailyUsage();
    }
    return this.getBudgetStatus();
  }

  recordElapsedSeconds(interactionId, reportedSec = null) {
    this._rolloverDayIfNeeded();
    const tracked = this.activeSessions.get(interactionId);
    let deltaSec = 0;
    if (tracked && !tracked.accounted) {
      tracked.accounted = true;
      const wallSec = (Date.now() - tracked.createdAt) / 1000;
      deltaSec = Math.min(
        tracked.burstCapSec || this.maxBurstSec,
        typeof reportedSec === "number" && reportedSec > 0 ? reportedSec : wallSec
      );
      this.dailyUsage.usedSec = +(this.dailyUsage.usedSec + Math.max(1, deltaSec)).toFixed(2);
      this._saveDailyUsage();
    }
    return this.getBudgetStatus();
  }

  _ensureResolved() {
    if (this.runtimeApiKey || !this.enableGcloudDiscovery || this.gcloudChecked) return;
    this.gcloudChecked = true;
    const discovered = discoverGcloudGeminiAuth();
    if (discovered) {
      this.runtimeApiKey = discovered.credential;
      this.authMeta = {
        source: discovered.source,
        projectId: discovered.projectId,
        account: discovered.account,
      };
    }
  }

  refreshGcloudAuth() {
    this.gcloudChecked = false;
    if (!this.runtimeApiKey || this.authMeta?.source === "gcloud-cli") {
      this.runtimeApiKey = "";
      this.authMeta = null;
    }
    this._ensureResolved();
    return this.getKeyStatus();
  }

  setApiKey(key) {
    const clean = String(key || "").trim();
    this.runtimeApiKey = clean;
    this.authMeta = clean ? { source: "session-ram", projectId: null, account: null } : null;
  }

  hasApiKey() {
    this._ensureResolved();
    return Boolean(this.runtimeApiKey);
  }

  getKeyStatus() {
    this._ensureResolved();
    if (!this.runtimeApiKey) {
      return { configured: false, masked: null, source: "none", projectId: null, account: null };
    }
    if (this.authMeta?.source === "gcloud-cli") {
      return {
        configured: true,
        masked: this.authMeta.projectId,
        source: "gcloud-cli",
        projectId: this.authMeta.projectId,
        account: this.authMeta.account,
      };
    }
    const k = this.runtimeApiKey;
    const masked = k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : "****";
    return {
      configured: true,
      masked,
      source: this.authMeta?.source || "environment",
      projectId: null,
      account: null,
    };
  }

  _client() {
    this._ensureResolved();
    if (!this.runtimeApiKey) {
      const err = new Error(
        "Keine aktive Gemini-Authentifizierung gefunden. Bitte via `gcloud auth login` anmelden oder optional einen API-Key setzen."
      );
      err.code = "MISSING_API_KEY";
      throw err;
    }
    return new GoogleGenAI({
      apiKey: this.runtimeApiKey,
      apiVersion: GENIE_API_VERSION,
    });
  }

  async createEphemeralSession({ requestedBurstSec = null } = {}) {
    this._rolloverDayIfNeeded();

    if (this.zeroCostLock) {
      const err = new Error(
        "0-€-Kosten-Firewall ist aktiv! Das Studio läuft garantiert kostenlos im lokalen WebGL-3D-Modus. Schalte oben von '0€ Lock' auf '12s Golden Take', wenn du einen echten Genie-4-Stream starten möchtest."
      );
      err.code = "ZERO_COST_LOCK";
      throw err;
    }

    const remaining = this.dailyCapSec - this.dailyUsage.usedSec;
    if (remaining < 4) {
      const err = new Error(
        `Tages-Budgetlimit erreicht (${this.dailyUsage.usedSec.toFixed(1)}s / ${this.dailyCapSec}s). Erhöhe oder resette das Limit bewusst in der Kosten-Firewall.`
      );
      err.code = "DAILY_BUDGET_REACHED";
      throw err;
    }

    const burstCapSec = Math.max(
      5,
      Math.min(
        GENIE_MAX_DURATION_SEC - 2,
        Math.floor(remaining),
        Number(requestedBurstSec) || this.maxBurstSec
      )
    );

    const serverAi = this._client();
    const interaction = await serverAi.interactions.create(
      {
        model: GENIE_MODEL_ID,
        api_version: GENIE_API_VERSION,
      },
      { timeout: 30_000 }
    );

    try {
      const tokenResp = await serverAi.interactions.authTokens.create(
        interaction.id,
        { api_version: GENIE_API_VERSION },
        { timeout: 30_000 }
      );

      const authToken = tokenResp.auth_token || tokenResp.authToken;
      if (!authToken) {
        throw new Error("Upstream authTokens.create returned an empty auth_token.");
      }

      const createdAt = Date.now();
      // Hard server-side cutoff 2 seconds after burstCapSec so disconnected tabs never burn money
      const safetyTimer = setTimeout(() => {
        this.cancelSession(interaction.id).catch(() => {});
      }, (burstCapSec + 2) * 1000);
      safetyTimer.unref?.();

      this.dailyUsage.sessions += 1;
      this._saveDailyUsage();

      this.activeSessions.set(interaction.id, {
        interactionId: interaction.id,
        createdAt,
        burstCapSec,
        safetyTimer,
        accounted: false,
      });

      return {
        interactionId: interaction.id,
        authToken,
        model: GENIE_MODEL_ID,
        apiVersion: GENIE_API_VERSION,
        burstCapSec,
        maxDurationSec: GENIE_MAX_DURATION_SEC,
        estimatedUsdPerSec: GENIE_ESTIMATED_USD_PER_SEC,
        authSource: this.authMeta?.source || "api-key",
        budget: this.getBudgetStatus(),
      };
    } catch (err) {
      await serverAi.interactions
        .cancel(interaction.id, { api_version: GENIE_API_VERSION }, { timeout: 15_000 })
        .catch(() => {});
      throw err;
    }
  }

  async cancelSession(interactionId, reportedSec = null) {
    if (!interactionId) return { canceled: false, budget: this.getBudgetStatus() };
    this.recordElapsedSeconds(interactionId, reportedSec);
    const tracked = this.activeSessions.get(interactionId);
    if (tracked?.safetyTimer) clearTimeout(tracked.safetyTimer);
    this.activeSessions.delete(interactionId);

    if (!this.hasApiKey()) return { canceled: false, budget: this.getBudgetStatus() };
    try {
      const serverAi = this._client();
      await serverAi.interactions.cancel(
        interactionId,
        { api_version: GENIE_API_VERSION },
        { timeout: 15_000 }
      );
      return { canceled: true, interactionId, budget: this.getBudgetStatus() };
    } catch {
      return { canceled: false, interactionId, budget: this.getBudgetStatus() };
    }
  }

  async shutdownAll() {
    const ids = [...this.activeSessions.keys()];
    await Promise.allSettled(ids.map((id) => this.cancelSession(id)));
  }
}
