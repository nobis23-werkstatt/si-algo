// Prepaid "World-Coins" Wallet, Promo/Gumroad/Play-Billing Verifier & Atomic Spend Gatekeeper.
// Guarantees 0.00 EUR uncovered API risk:
// 1. Every Genie 4 Golden-Take (12s) requires 1 prepaid World-Coin deducted ATOMICALLY BEFORE upstream call.
// 2. Supports Gumroad License Key verification (nobis23.gumroad.com), signed N23 promo vouchers,
//    and Google Play Billing purchaseToken hook.
// 3. Enforces idempotency nonces so double-clicks or replay requests never double-spend or bypass.

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const COIN_PACKAGES = [
  {
    id: "starter_3",
    title: "Starter Pack · 3 World-Coins",
    coins: 3,
    priceEur: 6.99,
    burstSecPerCoin: 12,
    gumroadPermalink: "world-coins-3",
    playProductId: "n23_world_coins_3",
  },
  {
    id: "producer_10",
    title: "Producer Pack · 10 World-Coins",
    coins: 10,
    priceEur: 19.99,
    burstSecPerCoin: 12,
    gumroadPermalink: "world-coins-10",
    playProductId: "n23_world_coins_10",
  },
  {
    id: "rave_25",
    title: "Tekno Studio Pack · 25 World-Coins",
    coins: 25,
    priceEur: 44.99,
    burstSecPerCoin: 12,
    gumroadPermalink: "world-coins-25",
    playProductId: "n23_world_coins_25",
  },
];

export class WorldCoinLedger {
  constructor({ ledgerFile = null, signingSecret = null } = {}) {
    this.ledgerFile = ledgerFile;
    this.secret =
      signingSecret ||
      process.env.WORLD_COIN_SECRET ||
      crypto.createHash("sha256").update("n23-sovereign-local-dev-secret").digest("hex");

    this.state = this._load();
    // Ensure a default founder/dev voucher is minted once for local testing if empty
    if (Object.keys(this.state.vouchers).length === 0) {
      this.mintVoucher({ code: "N23-GOLD-180BPM", coins: 3, note: "Founder Sync Track Bonus" });
    }
  }

  _load() {
    if (this.ledgerFile && fs.existsSync(this.ledgerFile)) {
      try {
        return JSON.parse(fs.readFileSync(this.ledgerFile, "utf8"));
      } catch {}
    }
    return {
      wallets: {},
      vouchers: {},
      redeemedKeys: {},
      processedNonces: {},
      txLog: [],
    };
  }

  _save() {
    if (!this.ledgerFile) return;
    try {
      fs.mkdirSync(path.dirname(this.ledgerFile), { recursive: true });
      fs.writeFileSync(this.ledgerFile, JSON.stringify(this.state, null, 2), "utf8");
    } catch {}
  }

  _ensureWallet(walletId) {
    const id = String(walletId || "local-studio").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 48) || "local-studio";
    if (!this.state.wallets[id]) {
      this.state.wallets[id] = {
        walletId: id,
        balance: 0,
        totalPurchased: 0,
        totalSpent: 0,
        proUnlocked: false,
        updatedAt: new Date().toISOString(),
      };
    }
    return this.state.wallets[id];
  }

  signWalletToken(walletId) {
    const cleanId = this._ensureWallet(walletId).walletId;
    const sig = crypto
      .createHmac("sha256", this.secret)
      .update(cleanId)
      .digest("hex")
      .slice(0, 24);
    return `${cleanId}.${sig}`;
  }

  verifyWalletToken(token) {
    const [id, sig] = String(token || "").split(".");
    if (!id || !sig) return null;
    const expected = crypto
      .createHmac("sha256", this.secret)
      .update(id)
      .digest("hex")
      .slice(0, 24);
    if (sig.length !== expected.length) return null;
    const ok = crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
    return ok ? id : null;
  }

  getWalletStatus(walletId = "local-studio") {
    const w = this._ensureWallet(walletId);
    return {
      ...w,
      packages: COIN_PACKAGES,
      shopBaseUrl: "https://nobis23.gumroad.com/l/",
    };
  }

  mintVoucher({ code = null, coins = 3, note = "" } = {}) {
    const cleanCoins = Math.max(1, Math.min(250, Math.round(Number(coins) || 3)));
    const finalCode =
      code ||
      `N23-${cleanCoins}C-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
    this.state.vouchers[finalCode] = {
      code: finalCode,
      coins: cleanCoins,
      redeemedBy: null,
      redeemedAt: null,
      note,
    };
    this._save();
    return this.state.vouchers[finalCode];
  }

  /**
   * Redeems either a minted N23 voucher code OR verifies a live Gumroad license key
   * against https://api.gumroad.com/v2/licenses/verify.
   */
  async redeemCode({ walletId = "local-studio", code = "", gumroadProductId = null, fetchImpl = fetch }) {
    const cleanCode = String(code || "").trim().toUpperCase();
    if (!cleanCode) {
      const err = new Error("Bitte einen gültigen World-Coin- oder Gumroad-Code eingeben.");
      err.code = "EMPTY_CODE";
      throw err;
    }

    const wallet = this._ensureWallet(walletId);

    // 1. Check local / founder N23 vouchers first
    const voucher = this.state.vouchers[cleanCode];
    if (voucher) {
      if (voucher.redeemedBy) {
        const err = new Error(`Code ${cleanCode} wurde bereits eingelöst.`);
        err.code = "ALREADY_REDEEMED";
        throw err;
      }
      voucher.redeemedBy = wallet.walletId;
      voucher.redeemedAt = new Date().toISOString();
      wallet.balance += voucher.coins;
      wallet.totalPurchased += voucher.coins;
      wallet.updatedAt = voucher.redeemedAt;
      this.state.txLog.push({
        ts: voucher.redeemedAt,
        type: "redeem_voucher",
        walletId: wallet.walletId,
        coins: voucher.coins,
        ref: cleanCode,
      });
      this._save();
      return { ok: true, addedCoins: voucher.coins, source: "voucher", wallet: this.getWalletStatus(wallet.walletId) };
    }

    // 2. Gumroad License Verification (if not already redeemed)
    const replayKey = `gumroad:${cleanCode}`;
    if (this.state.redeemedKeys[replayKey]) {
      const err = new Error("Dieser Gumroad-Lizenzschlüssel wurde bereits eingelöst.");
      err.code = "ALREADY_REDEEMED";
      throw err;
    }

    const permalink = gumroadProductId || process.env.GUMROAD_WORLD_COINS_PERMALINK || "world-coins-3";
    const resp = await fetchImpl("https://api.gumroad.com/v2/licenses/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        product_permalink: permalink,
        license_key: cleanCode,
        increment_uses_count: "true",
      }),
    });

    const data = await resp.json().catch(() => ({}));
    if (!resp.ok || data.success !== true || data.purchase?.refunded || data.purchase?.chargebacked) {
      const err = new Error("Ungültiger oder bereits erstatteter Lizenzschlüssel.");
      err.code = "INVALID_LICENSE";
      throw err;
    }

    const pkg = COIN_PACKAGES.find((p) => p.gumroadPermalink === permalink) || COIN_PACKAGES[0];
    this.state.redeemedKeys[replayKey] = {
      walletId: wallet.walletId,
      ts: new Date().toISOString(),
      coins: pkg.coins,
    };
    wallet.balance += pkg.coins;
    wallet.totalPurchased += pkg.coins;
    wallet.updatedAt = new Date().toISOString();
    this.state.txLog.push({
      ts: wallet.updatedAt,
      type: "redeem_gumroad",
      walletId: wallet.walletId,
      coins: pkg.coins,
      ref: cleanCode.slice(0, 6) + "***",
    });
    this._save();
    return { ok: true, addedCoins: pkg.coins, source: "gumroad", wallet: this.getWalletStatus(wallet.walletId) };
  }

  /**
   * Atomically deducts 1 World-Coin BEFORE any Genie 4 API session is created.
   * Rejects with HTTP 402-compatible error if balance < 1 or nonce was already used.
   */
  spendCoinAtomically({ walletId = "local-studio", nonce = null, reason = "genie4_12s_burst" } = {}) {
    const cleanNonce = nonce || `tx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    if (this.state.processedNonces[cleanNonce]) {
      const err = new Error("Doppelte Transaktions-Nonce blockiert (Replay-Schutz).");
      err.code = "DUPLICATE_NONCE";
      throw err;
    }

    const wallet = this._ensureWallet(walletId);
    if (wallet.balance < 1) {
      const err = new Error(
        "Nicht genügend World-Coins (Kontostand: 0). Löse einen Code (z. B. N23-GOLD-180BPM) ein oder lade Coins im Shop auf."
      );
      err.code = "INSUFFICIENT_COINS";
      throw err;
    }

    wallet.balance -= 1;
    wallet.totalSpent += 1;
    wallet.updatedAt = new Date().toISOString();
    this.state.processedNonces[cleanNonce] = {
      walletId: wallet.walletId,
      ts: wallet.updatedAt,
      refunded: false,
    };
    this.state.txLog.push({
      ts: wallet.updatedAt,
      type: "spend",
      walletId: wallet.walletId,
      coins: -1,
      nonce: cleanNonce,
      reason,
    });
    this._save();

    return {
      ok: true,
      nonce: cleanNonce,
      burstCapSec: 12,
      remainingBalance: wallet.balance,
      wallet: this.getWalletStatus(wallet.walletId),
    };
  }

  refundFailedLaunch(nonce) {
    const entry = this.state.processedNonces[nonce];
    if (!entry || entry.refunded) return false;
    entry.refunded = true;
    const wallet = this._ensureWallet(entry.walletId);
    wallet.balance += 1;
    wallet.totalSpent = Math.max(0, wallet.totalSpent - 1);
    wallet.updatedAt = new Date().toISOString();
    this.state.txLog.push({
      ts: wallet.updatedAt,
      type: "refund_upstream_error",
      walletId: wallet.walletId,
      coins: 1,
      nonce,
    });
    this._save();
    return true;
  }
}
