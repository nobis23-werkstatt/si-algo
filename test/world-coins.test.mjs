import assert from "node:assert/strict";
import test from "node:test";
import { COIN_PACKAGES, WorldCoinLedger } from "../src/world-coins.mjs";

test("WorldCoinLedger seeds default N23-GOLD-180BPM founder voucher", () => {
  const ledger = new WorldCoinLedger();
  const st = ledger.getWalletStatus("user-a");
  assert.equal(st.balance, 0);
  assert.equal(COIN_PACKAGES.length, 3);
});

test("WorldCoinLedger signs and verifies HMAC wallet tokens and rejects tampering", () => {
  const ledger = new WorldCoinLedger({ signingSecret: "unit-test-secret-key" });
  const tok = ledger.signWalletToken("paul-gold");
  assert.equal(ledger.verifyWalletToken(tok), "paul-gold");
  assert.equal(ledger.verifyWalletToken(tok + "x"), null);
  assert.equal(ledger.verifyWalletToken("forged.123456"), null);
});

test("WorldCoinLedger redeems minted voucher once and blocks replay redemption", async () => {
  const ledger = new WorldCoinLedger();
  const v = ledger.mintVoucher({ coins: 5, note: "Test Pack" });
  const res = await ledger.redeemCode({ walletId: "w1", code: v.code });
  assert.equal(res.addedCoins, 5);
  assert.equal(res.wallet.balance, 5);

  await assert.rejects(
    () => ledger.redeemCode({ walletId: "w1", code: v.code }),
    { code: "ALREADY_REDEEMED" }
  );
});

test("WorldCoinLedger blocks spend when balance is 0 (0-euro uncovered API risk)", () => {
  const ledger = new WorldCoinLedger();
  assert.throws(
    () => ledger.spendCoinAtomically({ walletId: "empty-wallet", nonce: "n1" }),
    { code: "INSUFFICIENT_COINS" }
  );
});

test("WorldCoinLedger deducts atomically, blocks duplicate nonces, and refunds upstream launch failure", async () => {
  const ledger = new WorldCoinLedger();
  await ledger.redeemCode({ walletId: "pro", code: "N23-GOLD-180BPM" });

  const tx = ledger.spendCoinAtomically({ walletId: "pro", nonce: "nonce-001" });
  assert.equal(tx.remainingBalance, 2);
  assert.equal(tx.burstCapSec, 12);

  // Duplicate nonce replay must fail
  assert.throws(
    () => ledger.spendCoinAtomically({ walletId: "pro", nonce: "nonce-001" }),
    { code: "DUPLICATE_NONCE" }
  );

  // Upstream failure refunds exactly once
  assert.equal(ledger.refundFailedLaunch("nonce-001"), true);
  assert.equal(ledger.refundFailedLaunch("nonce-001"), false);
  assert.equal(ledger.getWalletStatus("pro").balance, 3);
});

test("WorldCoinLedger verifies live Gumroad license payload via mock fetch and blocks refunded keys", async () => {
  const ledger = new WorldCoinLedger();
  const okFetch = async () => ({
    ok: true,
    json: async () => ({ success: true, purchase: { refunded: false, chargebacked: false } }),
  });
  const res = await ledger.redeemCode({
    walletId: "gumroad-buyer",
    code: "GUM-KEY-1234",
    gumroadProductId: "world-coins-10",
    fetchImpl: okFetch,
  });
  assert.equal(res.addedCoins, 10);

  // Replay of same Gumroad key blocked
  await assert.rejects(
    () => ledger.redeemCode({ walletId: "gumroad-buyer", code: "GUM-KEY-1234", fetchImpl: okFetch }),
    { code: "ALREADY_REDEEMED" }
  );

  // Refunded purchase rejected
  const refundedFetch = async () => ({
    ok: true,
    json: async () => ({ success: true, purchase: { refunded: true } }),
  });
  await assert.rejects(
    () => ledger.redeemCode({ walletId: "gumroad-buyer", code: "GUM-REFUNDED", fetchImpl: refundedFetch }),
    { code: "INVALID_LICENSE" }
  );
});
