import assert from "node:assert/strict";
import test from "node:test";
import { verifyPortableGodKeyWebCrypto } from "../public/god-mode.js";
import { AdminVault, isStrictLoopbackRequest } from "../src/admin-vault.mjs";
import { createStudioServer } from "../src/server.mjs";

test("AdminVault unlocks with localOwnerKey, supports custom scrypt passphrase, and revokes sessions", () => {
  const vault = new AdminVault({ vaultFile: null, maxFailedAttempts: 4 });
  const ownerKey = vault.state.localOwnerKey;

  const s1 = vault.unlockWithSecret(ownerKey, "10.0.0.1");
  assert.equal(s1.ok, true);
  assert.ok(vault.verifySessionToken(s1.adminToken));

  // Set custom scrypt passphrase & unlock with it
  vault.setCustomPassphrase("Nobis23-Sovereign-909!");
  const s2 = vault.unlockWithSecret("Nobis23-Sovereign-909!", "10.0.0.2");
  assert.equal(s2.ok, true);
  assert.ok(vault.verifySessionToken(s2.adminToken));

  // Instant RAM revocation
  vault.lockSession(s1.adminToken);
  assert.equal(vault.verifySessionToken(s1.adminToken), null);
  assert.ok(vault.verifySessionToken(s2.adminToken));
});

test("AdminVault brute-force rate limiter blocks IP after maxFailedAttempts", () => {
  const vault = new AdminVault({ vaultFile: null, maxFailedAttempts: 3, lockoutWindowMs: 60_000 });
  for (let i = 0; i < 3; i++) {
    assert.throws(() => vault.unlockWithSecret("wrong-secret", "192.0.2.55"), {
      code: "INVALID_ADMIN_SECRET",
    });
  }
  assert.throws(() => vault.unlockWithSecret(vault.state.localOwnerKey, "192.0.2.55"), {
    code: "ADMIN_RATE_LIMITED",
  });
});

test("isStrictLoopbackRequest rejects proxied X-Forwarded-For headers and non-loopback IPs", () => {
  assert.equal(isStrictLoopbackRequest({ socket: { remoteAddress: "127.0.0.1" }, headers: {} }), true);
  assert.equal(isStrictLoopbackRequest({ socket: { remoteAddress: "::1" }, headers: {} }), true);
  assert.equal(
    isStrictLoopbackRequest({
      socket: { remoteAddress: "127.0.0.1" },
      headers: { "x-forwarded-for": "203.0.113.9" },
    }),
    false
  );
  assert.equal(isStrictLoopbackRequest({ socket: { remoteAddress: "192.168.1.44" }, headers: {} }), false);
});

test("Portable .n23-godkey.json signs with IEEE-P1363 ECDSA P-256 and verifies in Browser WebCrypto", async () => {
  const vault = new AdminVault({ vaultFile: null });
  const env = vault.exportPortableGodKey({ label: "Unit Test GodKey", validDays: 30 });

  // 1. Node crypto verifier
  const nodeVer = AdminVault.verifyPortableGodKey(env, vault.state.ecdsaPublicKeySpkiB64);
  assert.equal(nodeVer.valid, true);

  // 2. Genuine WebCrypto subtle.verify (exact code used on GitHub Pages!)
  const webVer = await verifyPortableGodKeyWebCrypto(env, vault.state.ecdsaPublicKeySpkiB64);
  assert.equal(webVer.valid, true);
  assert.equal(webVer.claims.label, "Unit Test GodKey");

  // 3. Tampered payload must fail both verifiers
  const tampered = { ...env, payload: env.payload.replace("Unit Test GodKey", "Hacked") };
  assert.equal(AdminVault.verifyPortableGodKey(tampered, vault.state.ecdsaPublicKeySpkiB64).valid, false);
  assert.equal((await verifyPortableGodKeyWebCrypto(tampered, vault.state.ecdsaPublicKeySpkiB64)).valid, false);

  // 4. Different vault public key must reject foreign signature
  const otherVault = new AdminVault({ vaultFile: null });
  assert.equal(
    (await verifyPortableGodKeyWebCrypto(env, otherVault.state.ecdsaPublicKeySpkiB64)).valid,
    false
  );
});

test("HTTP Server blocks /api/coins/mint & /api/admin/* without token (401) and allows authorized owner actions", async () => {
  const { server, adminVault, shutdown } = createStudioServer({
    zeroCostLock: true,
    ledgerFile: null,
    vaultFile: null,
  });
  await new Promise((r) => server.listen(0, r));
  const base = `http://localhost:${server.address().port}`;

  try {
    // 1. Unauthenticated /api/coins/mint -> 401
    const unauthMint = await fetch(`${base}/api/coins/mint`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ coins: 50 }),
    });
    assert.equal(unauthMint.status, 401);

    // 2. Unauthenticated /api/admin/overview -> 401
    const unauthOverview = await fetch(`${base}/api/admin/overview`);
    assert.equal(unauthOverview.status, 401);

    // 3. Unlock with ownerKey -> 200 + adminToken
    const unlockResp = await fetch(`${base}/api/admin/unlock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: adminVault.state.localOwnerKey }),
    });
    assert.equal(unlockResp.status, 200);
    const { adminToken } = await unlockResp.json();
    assert.ok(adminToken.startsWith("adm_"));

    // 4. Mint voucher & grant coins with X-Admin-Token -> 200
    const mintResp = await fetch(`${base}/api/admin/mint-voucher`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
      body: JSON.stringify({ code: "N23-TEST-GOD7", coins: 7 }),
    });
    assert.equal(mintResp.status, 200);
    const mintData = await mintResp.json();
    assert.equal(mintData.voucher.coins, 7);

    // 5. Revoke voucher -> 200
    const revResp = await fetch(`${base}/api/admin/revoke-voucher`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
      body: JSON.stringify({ code: "N23-TEST-GOD7" }),
    });
    assert.equal(revResp.status, 200);

    // 6. Lock session -> subsequent admin call returns 401 immediately
    await fetch(`${base}/api/admin/lock`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Admin-Token": adminToken },
      body: JSON.stringify({}),
    });
    const afterLock = await fetch(`${base}/api/admin/overview`, {
      headers: { "X-Admin-Token": adminToken },
    });
    assert.equal(afterLock.status, 401);
  } finally {
    await shutdown();
  }
});
