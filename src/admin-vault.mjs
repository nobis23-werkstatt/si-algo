// Sovereign Admin & Private God-Mode Cryptographic Vault (Zero Dependencies)
// - Stores private keys & salted scrypt hashes ONLY in gitignored local vaultFile (data/admin-vault.json).
// - Uses IEEE-P1363 ECDSA P-256 signatures so portable .n23-godkey.json files verify offline in
//   Browser WebCrypto (crypto.subtle.verify) on public GitHub Pages with ZERO secret in public code!
// - Enforces constant-time comparison (timingSafeEqual), per-IP brute-force rate limiting,
//   revocable RAM session tokens, and strict non-proxied loopback socket verification.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FORWARDED_HEADERS = [
  "x-forwarded-for",
  "forwarded",
  "x-real-ip",
  "cf-connecting-ip",
  "true-client-ip",
];

export function isStrictLoopbackRequest(req) {
  if (!req || !req.socket) return false;
  for (const h of FORWARDED_HEADERS) {
    if (req.headers && req.headers[h]) return false;
  }
  const addr = String(req.socket.remoteAddress || "");
  return addr === "127.0.0.1" || addr === "::1" || addr === "::ffff:127.0.0.1";
}

function sha256Buf(input) {
  return crypto.createHash("sha256").update(String(input), "utf8").digest();
}

export class AdminVault {
  constructor({
    vaultFile = null,
    allowLoopbackQuickUnlock = true,
    maxFailedAttempts = 5,
    lockoutWindowMs = 60_000,
    sessionTtlMs = 12 * 60 * 60 * 1000,
  } = {}) {
    this.vaultFile = vaultFile;
    this.allowLoopbackQuickUnlock = allowLoopbackQuickUnlock;
    this.maxFailedAttempts = maxFailedAttempts;
    this.lockoutWindowMs = lockoutWindowMs;
    this.sessionTtlMs = sessionTtlMs;

    this.activeSessions = new Map();
    this.failedByIp = new Map();
    this.state = this._loadOrCreate();
  }

  _loadOrCreate() {
    if (this.vaultFile && fs.existsSync(this.vaultFile)) {
      try {
        const parsed = JSON.parse(fs.readFileSync(this.vaultFile, "utf8"));
        if (parsed?.signingSecret && parsed?.ecdsaPrivateKeyPem && parsed?.ecdsaPublicKeySpkiB64) {
          return parsed;
        }
      } catch {
        // regenerate cleanly if corrupted
      }
    }

    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
    });
    const ecdsaPublicKeySpkiB64 = publicKey
      .export({ type: "spki", format: "der" })
      .toString("base64");
    const ecdsaPrivateKeyPem = privateKey.export({ type: "pkcs8", format: "pem" });
    const ownerKey = `N23-GOD-${crypto.randomBytes(12).toString("hex").toUpperCase()}`;
    const signingSecret = crypto.randomBytes(32).toString("hex");

    const fresh = {
      schema: "n23-admin-vault/v1",
      createdAt: new Date().toISOString(),
      signingSecret,
      localOwnerKey: ownerKey,
      ownerKeySha256Hex: sha256Buf(ownerKey).toString("hex"),
      passphraseSaltHex: null,
      passphraseScryptHex: null,
      ecdsaPublicKeySpkiB64,
      ecdsaPrivateKeyPem,
    };

    this._save(fresh);
    return fresh;
  }

  _save(nextState = this.state) {
    if (!this.vaultFile) return;
    try {
      fs.mkdirSync(path.dirname(this.vaultFile), { recursive: true });
      fs.writeFileSync(this.vaultFile, JSON.stringify(nextState, null, 2), "utf8");
    } catch {
      // ignore read-only test fs
    }
  }

  _checkRateLimit(ip = "unknown") {
    const now = Date.now();
    const rec = this.failedByIp.get(ip);
    if (!rec) return;
    const recent = rec.filter((ts) => now - ts < this.lockoutWindowMs);
    if (recent.length === 0) {
      this.failedByIp.delete(ip);
      return;
    }
    this.failedByIp.set(ip, recent);
    if (recent.length >= this.maxFailedAttempts) {
      const err = new Error("Zu viele fehlgeschlagene Admin-Anmeldeversuche. Bitte 60s warten.");
      err.code = "ADMIN_RATE_LIMITED";
      throw err;
    }
  }

  _recordFailure(ip = "unknown") {
    const list = this.failedByIp.get(ip) || [];
    list.push(Date.now());
    this.failedByIp.set(ip, list);
  }

  _mintSession(mode = "key") {
    const sid = crypto.randomBytes(18).toString("hex");
    const mac = crypto
      .createHmac("sha256", this.state.signingSecret)
      .update(sid)
      .digest("hex")
      .slice(0, 32);
    const token = `adm_${sid}.${mac}`;
    const expiresAt = Date.now() + this.sessionTtlMs;
    this.activeSessions.set(sid, {
      sid,
      mode,
      createdAt: new Date().toISOString(),
      expiresAt,
    });
    return {
      ok: true,
      adminToken: token,
      expiresAt: new Date(expiresAt).toISOString(),
      role: "sovereign_owner",
      mode,
    };
  }

  verifySessionToken(token) {
    if (!token || typeof token !== "string" || !token.startsWith("adm_")) return null;
    const [prefixSid, mac] = token.split(".");
    const sid = prefixSid.slice(4);
    if (!sid || !mac) return null;

    const expectedMac = crypto
      .createHmac("sha256", this.state.signingSecret)
      .update(sid)
      .digest("hex")
      .slice(0, 32);
    if (mac.length !== expectedMac.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expectedMac))) return null;

    const session = this.activeSessions.get(sid);
    if (!session) return null;
    if (Date.now() > session.expiresAt) {
      this.activeSessions.delete(sid);
      return null;
    }
    return session;
  }

  requireRequestAuth(req) {
    const headerTok =
      req.headers?.["x-admin-token"] ||
      String(req.headers?.authorization || "").replace(/^Bearer\s+/i, "");
    const session = this.verifySessionToken(String(headerTok || "").trim());
    if (!session) {
      const err = new Error("Admin-Authentifizierung erforderlich (Sovereign Vault gesperrt).");
      err.code = "ADMIN_AUTH_REQUIRED";
      throw err;
    }
    return session;
  }

  unlockWithSecret(secretInput, clientIp = "unknown") {
    this._checkRateLimit(clientIp);
    const candidate = String(secretInput || "").trim();
    if (!candidate) {
      this._recordFailure(clientIp);
      const err = new Error("Bitte gültigen Owner-Key oder privates Passwort eingeben.");
      err.code = "INVALID_ADMIN_SECRET";
      throw err;
    }

    // 1. Constant-time check against localOwnerKey SHA-256
    const candSha = sha256Buf(candidate);
    const expectedOwnerSha = Buffer.from(this.state.ownerKeySha256Hex, "hex");
    let matched =
      candSha.length === expectedOwnerSha.length &&
      crypto.timingSafeEqual(candSha, expectedOwnerSha);

    // 2. Constant-time check against custom scrypt passphrase (if configured)
    if (!matched && this.state.passphraseSaltHex && this.state.passphraseScryptHex) {
      const salt = Buffer.from(this.state.passphraseSaltHex, "hex");
      const expectedScrypt = Buffer.from(this.state.passphraseScryptHex, "hex");
      const candScrypt = crypto.scryptSync(candidate, salt, expectedScrypt.length);
      matched = crypto.timingSafeEqual(candScrypt, expectedScrypt);
    }

    if (!matched) {
      this._recordFailure(clientIp);
      const err = new Error("Ungültiger Owner-Key oder falsches Passwort.");
      err.code = "INVALID_ADMIN_SECRET";
      throw err;
    }

    this.failedByIp.delete(clientIp);
    return this._mintSession("secret");
  }

  unlockViaLoopback(req) {
    if (!this.allowLoopbackQuickUnlock || !isStrictLoopbackRequest(req)) {
      const err = new Error(
        "Loopback-Schnellfreigabe ist nur direkt auf dem lokalen Entwicklerrechner (127.0.0.1 / ::1 ohne Proxy) erlaubt."
      );
      err.code = "LOOPBACK_FORBIDDEN";
      throw err;
    }
    return this._mintSession("loopback_owner");
  }

  setCustomPassphrase(newPassphrase) {
    const clean = String(newPassphrase || "").trim();
    if (clean.length < 8) {
      const err = new Error("Privates Passwort muss mindestens 8 Zeichen lang sein.");
      err.code = "WEAK_PASSPHRASE";
      throw err;
    }
    const salt = crypto.randomBytes(16);
    const derived = crypto.scryptSync(clean, salt, 64);
    this.state.passphraseSaltHex = salt.toString("hex");
    this.state.passphraseScryptHex = derived.toString("hex");
    this._save();
    return { ok: true, hasCustomPassphrase: true };
  }

  lockSession(token) {
    if (!token || typeof token !== "string" || !token.startsWith("adm_")) return false;
    const sid = token.split(".")[0].slice(4);
    return this.activeSessions.delete(sid);
  }

  lockAllSessions() {
    const count = this.activeSessions.size;
    this.activeSessions.clear();
    return count;
  }

  /**
   * Mints a portable ECDSA P-256 signed `.n23-godkey.json` keyfile (IEEE-P1363 signature)
   * that unlocks private God Mode + Neo-Blick offline in Browser WebCrypto on GitHub Pages.
   */
  exportPortableGodKey({ label = "Paul Sovereign GodKey", validDays = 365 } = {}) {
    const now = Date.now();
    const payloadObj = {
      schema: "n23-godkey/v1",
      scope: "private_god_neo_blick",
      label: String(label).slice(0, 64),
      keyId: crypto.randomBytes(6).toString("hex"),
      issuedAt: new Date(now).toISOString(),
      expiresAt: new Date(now + validDays * 86_400_000).toISOString(),
    };
    const canonicalPayload = JSON.stringify(payloadObj);
    const sigBuf = crypto.sign("sha256", Buffer.from(canonicalPayload, "utf8"), {
      key: this.state.ecdsaPrivateKeyPem,
      dsaEncoding: "ieee-p1363",
    });

    return {
      schema: "n23-godkey-envelope/v1",
      payload: canonicalPayload,
      signatureB64: sigBuf.toString("base64"),
      publicKeySpkiB64: this.state.ecdsaPublicKeySpkiB64,
    };
  }

  /**
   * Node-side verification of a portable `.n23-godkey.json` envelope against a pinned SPKI public key.
   */
  static verifyPortableGodKey(envelope, pinnedPublicKeySpkiB64 = null) {
    try {
      if (!envelope || typeof envelope.payload !== "string" || !envelope.signatureB64) {
        return { valid: false, reason: "Malformed envelope" };
      }
      const spkiB64 = pinnedPublicKeySpkiB64 || envelope.publicKeySpkiB64;
      if (!spkiB64) return { valid: false, reason: "Missing public key" };

      const pubDer = Buffer.from(spkiB64, "base64");
      const sigBuf = Buffer.from(envelope.signatureB64, "base64");
      const ok = crypto.verify(
        "sha256",
        Buffer.from(envelope.payload, "utf8"),
        { key: pubDer, format: "der", type: "spki", dsaEncoding: "ieee-p1363" },
        sigBuf
      );
      if (!ok) return { valid: false, reason: "Invalid ECDSA P-256 signature" };

      const parsed = JSON.parse(envelope.payload);
      if (parsed.schema !== "n23-godkey/v1" || parsed.scope !== "private_god_neo_blick") {
        return { valid: false, reason: "Invalid scope" };
      }
      if (parsed.expiresAt && Date.now() > Date.parse(parsed.expiresAt)) {
        return { valid: false, reason: "GodKey expired" };
      }
      return { valid: true, claims: parsed };
    } catch (err) {
      return { valid: false, reason: err.message };
    }
  }

  getVaultMetadata() {
    return {
      hasCustomPassphrase: Boolean(this.state.passphraseScryptHex),
      publicKeySpkiB64: this.state.ecdsaPublicKeySpkiB64,
      ownerKeyPreview: `${this.state.localOwnerKey.slice(0, 11)}…${this.state.localOwnerKey.slice(-4)}`,
      activeSessions: this.activeSessions.size,
    };
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const vault = new AdminVault({ vaultFile: path.join(root, "data", "admin-vault.json") });
  if (process.argv.includes("--public-key")) {
    console.log(vault.state.ecdsaPublicKeySpkiB64);
  } else {
    console.log(JSON.stringify(vault.getVaultMetadata(), null, 2));
  }
}
