// Sovereign Private God Mode & Admin Vault Controller
// - Completely invisible to normal public visitors until triggered via:
//     1) Keyboard shortcut: Ctrl+Shift+G or Alt+G
//     2) URL hash: #razz, #god, or #admin
//     3) Triple-click on the top-left .brand-orb
// - Zero plaintext secrets in public GitHub code:
//     * Local backend: verifies via AdminVault (strict non-proxied loopback OR ownerKey/scrypt passphrase)
//     * Static GitHub Pages: verifies portable .n23-godkey.json via WebCrypto ECDSA P-256 signature!

export const OWNER_PUBLIC_KEY_SPKI_B64 =
  "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEVw0c0heDEX9kkz8VrOBqHQZccN1dQ8NagByQUVv3MCoPygd7be/rQp8uIfYDi6q0lRJlefU/0YePZse0RSOr5g==";

const STORAGE_ADMIN_TOKEN = "n23_sovereign_admin_token";
const STORAGE_GODKEY_ENV = "n23_sovereign_godkey_envelope";

function b64ToBytes(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

export async function verifyPortableGodKeyWebCrypto(
  envelope,
  pinnedSpkiB64 = OWNER_PUBLIC_KEY_SPKI_B64
) {
  try {
    if (!envelope || typeof envelope.payload !== "string" || !envelope.signatureB64) {
      return { valid: false, reason: "Ungültiges GodKey-Format." };
    }
    const pubKey = await crypto.subtle.importKey(
      "spki",
      b64ToBytes(pinnedSpkiB64),
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );
    const dataBytes = new TextEncoder().encode(envelope.payload);
    const sigBytes = b64ToBytes(envelope.signatureB64);
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      pubKey,
      sigBytes,
      dataBytes
    );
    if (!ok) return { valid: false, reason: "ECDSA P-256 Signatur ungültig." };

    const claims = JSON.parse(envelope.payload);
    if (claims.schema !== "n23-godkey/v1" || claims.scope !== "private_god_neo_blick") {
      return { valid: false, reason: "Ungültiger Schlüssel-Scope." };
    }
    if (claims.expiresAt && Date.now() > Date.parse(claims.expiresAt)) {
      return { valid: false, reason: "GodKey ist abgelaufen." };
    }
    return { valid: true, claims };
  } catch (err) {
    return { valid: false, reason: err.message || "WebCrypto Fehler" };
  }
}

export function initSovereignVaultUI({
  world3d,
  audio,
  isStaticPagesModeRef,
  appendFeed,
  offerDownload,
  onCoinsUpdated,
  onBudgetUpdated,
}) {
  const $ = (id) => document.getElementById(id);
  const modal = $("vaultModal");
  const badge = $("godStatusBadge");
  const tabGod = $("tabGodMode");
  const tabAdmin = $("tabAdminVault");
  const btnLoopbackUnlock = $("btnVaultLoopback");
  const secretInput = $("vaultSecretInput");
  const godkeyFileInput = $("vaultGodkeyFile");
  const statusMsg = $("vaultModalStatus");

  let adminToken = sessionStorage.getItem(STORAGE_ADMIN_TOKEN) || "";
  let unlockedGod = false;
  let unlockedAdmin = false;
  let activePinnedSpki = OWNER_PUBLIC_KEY_SPKI_B64;

  const adminHeaders = () => ({
    "Content-Type": "application/json",
    "X-Admin-Token": adminToken,
  });

  function applyUnlockedUI({ autoNeoBlick = false } = {}) {
    world3d.god.active = unlockedGod;
    if (autoNeoBlick && unlockedGod) {
      world3d.god.neoBlick = true;
      const chkNeo = $("chkNeoBlick");
      if (chkNeo) chkNeo.checked = true;
    }

    if (unlockedGod) {
      badge.classList.remove("hidden");
      badge.textContent = unlockedAdmin ? "👑 GOD · ADMIN" : "👁️ GOD MODE";
      tabGod?.classList.remove("hidden");
      if (unlockedAdmin) tabAdmin?.classList.remove("hidden");
      else tabAdmin?.classList.add("hidden");
    } else {
      world3d.god.noclip = false;
      world3d.god.neoBlick = false;
      badge.classList.add("hidden");
      tabGod?.classList.add("hidden");
      tabAdmin?.classList.add("hidden");
      // Switch back to Tab 2 if a private pane was active
      if (tabGod?.classList.contains("active") || tabAdmin?.classList.contains("active")) {
        document.querySelector('[data-pane="pane-jockey"]')?.click();
      }
    }
  }

  async function refreshAdminOverview() {
    if (!unlockedAdmin || isStaticPagesModeRef()) return;
    const res = await fetch("./api/admin/overview", { headers: adminHeaders() });
    if (!res.ok) return;
    const data = await res.json();

    const metaEl = $("adminVaultMeta");
    if (metaEl && data.vault) {
      metaEl.textContent = `Owner-Key (${data.vault.ownerKeyPreview}) · Eigenes Passwort: ${data.vault.hasCustomPassphrase ? "AKTIV (scrypt)" : "noch nicht gesetzt"} · Aktive Sessions: ${data.vault.activeSessions}`;
    }

    const vBox = $("adminVoucherList");
    if (vBox && data.ledger) {
      vBox.innerHTML = "";
      for (const v of data.ledger.vouchers) {
        const row = document.createElement("div");
        row.className = "admin-row";
        const stateTxt = v.redeemedBy ? `eingelöst (${v.redeemedBy})` : "offen";
        row.innerHTML = `<code>${v.code}</code> <span>${v.coins} Coins · ${stateTxt}</span>`;
        if (!v.redeemedBy) {
          const copyB = document.createElement("button");
          copyB.type = "button";
          copyB.textContent = "Copy";
          copyB.onclick = () => navigator.clipboard?.writeText(v.code);

          const revB = document.createElement("button");
          revB.type = "button";
          revB.className = "btn-danger";
          revB.textContent = "Sperren";
          revB.onclick = async () => {
            await fetch("./api/admin/revoke-voucher", {
              method: "POST",
              headers: adminHeaders(),
              body: JSON.stringify({ code: v.code }),
            });
            await refreshAdminOverview();
          };
          const act = document.createElement("div");
          act.style.display = "flex";
          act.style.gap = "5px";
          act.append(copyB, revB);
          row.appendChild(act);
        }
        vBox.appendChild(row);
      }
    }

    const txBox = $("adminTxList");
    if (txBox && data.ledger) {
      txBox.textContent =
        data.ledger.recentTx
          .slice(0, 12)
          .map((t) => `${t.ts.slice(11, 19)} · ${t.type} · ${t.walletId} (${t.coins > 0 ? "+" : ""}${t.coins})`)
          .join("\n") || "Noch keine Transaktionen.";
    }
  }

  async function openModal({ autoNeo = false } = {}) {
    if (unlockedGod) {
      if (autoNeo) {
        world3d.god.neoBlick = true;
        if ($("chkNeoBlick")) $("chkNeoBlick").checked = true;
      }
      tabGod?.click();
      return;
    }
    statusMsg.textContent = isStaticPagesModeRef()
      ? "Statischer GitHub-Pages-Modus: Lade dein signiertes .n23-godkey.json hoch (0 € Offline-ECDSA-Prüfung)."
      : "Sovereign Vault bereit: Nutze Localhost-Schnellfreigabe, Owner-Key (data/admin-vault.json) oder dein Passwort.";

    if (!isStaticPagesModeRef()) {
      try {
        const st = await fetch("./api/admin/status", { headers: adminHeaders() }).then((r) => r.json());
        if (st.publicKeySpkiB64) activePinnedSpki = st.publicKeySpkiB64;
        btnLoopbackUnlock.style.display = st.loopbackEligible ? "inline-flex" : "none";
      } catch {
        btnLoopbackUnlock.style.display = "none";
      }
    } else {
      btnLoopbackUnlock.style.display = "none";
    }
    modal.classList.remove("hidden");
  }

  function closeModal() {
    modal.classList.add("hidden");
  }

  // --- Restore persisted session / portable GodKey cleanly ---
  (async () => {
    const hash = window.location.hash.toLowerCase();
    const wantsRazz = hash === "#razz" || hash === "#neo-blick";
    const wantsModal = wantsRazz || hash === "#god" || hash === "#admin";

    // 1. Check active backend Admin session first
    try {
      const resp = await fetch("./api/admin/status", { headers: adminHeaders() });
      if (resp.ok) {
        const st = await resp.json();
        if (st.publicKeySpkiB64) activePinnedSpki = st.publicKeySpkiB64;
        if (st.unlocked) {
          unlockedAdmin = true;
          unlockedGod = true;
          applyUnlockedUI({ autoNeoBlick: wantsRazz });
          await refreshAdminOverview();
          return;
        }
      }
    } catch {
      // Static GitHub Pages fallback
    }

    // 2. Check saved portable .n23-godkey.json in localStorage
    const savedEnvRaw = localStorage.getItem(STORAGE_GODKEY_ENV);
    if (savedEnvRaw) {
      try {
        const env = JSON.parse(savedEnvRaw);
        const ver = await verifyPortableGodKeyWebCrypto(env, activePinnedSpki);
        if (ver.valid) {
          unlockedGod = true;
          applyUnlockedUI({ autoNeoBlick: wantsRazz });
          return;
        }
      } catch {}
    }

    if (wantsModal) {
      await openModal({ autoNeo: wantsRazz });
    }
  })();

  window.addEventListener("hashchange", () => {
    const h = window.location.hash.toLowerCase();
    if (h === "#razz" || h === "#god" || h === "#admin" || h === "#neo-blick") {
      void openModal({ autoNeo: h === "#razz" || h === "#neo-blick" });
    }
  });

  // Stealth Shortcut: Ctrl+Shift+G or Alt+G
  window.addEventListener("keydown", (e) => {
    if ((e.ctrlKey && e.shiftKey && e.code === "KeyG") || (e.altKey && e.code === "KeyG")) {
      e.preventDefault();
      void openModal({ autoNeo: true });
    } else if (e.code === "Escape" && !modal.classList.contains("hidden")) {
      closeModal();
    }
  });

  // Stealth Triple-Click on Brand Orb
  let orbClicks = [];
  const orb = document.querySelector(".brand-orb");
  if (orb) {
    orb.style.cursor = "pointer";
    orb.title = "5D Triad Forge · Sovereign Core";
    orb.addEventListener("click", () => {
      const now = Date.now();
      orbClicks = orbClicks.filter((t) => now - t < 900);
      orbClicks.push(now);
      if (orbClicks.length >= 3) {
        orbClicks = [];
        void openModal({ autoNeo: false });
      }
    });
  }

  $("btnCloseVaultModal")?.addEventListener("click", closeModal);
  badge?.addEventListener("click", () => tabGod?.click());

  // 1. Localhost 1-Click Owner Unlock
  btnLoopbackUnlock?.addEventListener("click", async () => {
    const res = await fetch("./api/admin/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ loopback: true }),
    });
    const data = await res.json();
    if (!res.ok) {
      statusMsg.textContent = data.error || "Loopback Unlock abgelehnt.";
      return;
    }
    adminToken = data.adminToken;
    sessionStorage.setItem(STORAGE_ADMIN_TOKEN, adminToken);
    unlockedAdmin = true;
    unlockedGod = true;
    const isRazz = window.location.hash.toLowerCase() === "#razz";
    applyUnlockedUI({ autoNeoBlick: isRazz });
    closeModal();
    tabGod?.click();
    await refreshAdminOverview();
    appendFeed({
      agent: "agy",
      mode: "sovereign-vault",
      latencyMs: 1,
      text: "👑 Sovereign Admin & Private God Mode auf Localhost entsperrt.",
    });
  });

  // 2. Owner-Key / Custom Passphrase Unlock
  $("btnVaultSecretUnlock")?.addEventListener("click", async () => {
    const secret = secretInput.value.trim();
    if (!secret) return;
    const res = await fetch("./api/admin/unlock", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret }),
    });
    const data = await res.json();
    if (!res.ok) {
      statusMsg.textContent = data.error || "Entsperren fehlgeschlagen.";
      return;
    }
    secretInput.value = "";
    adminToken = data.adminToken;
    sessionStorage.setItem(STORAGE_ADMIN_TOKEN, adminToken);
    unlockedAdmin = true;
    unlockedGod = true;
    applyUnlockedUI({ autoNeoBlick: window.location.hash.toLowerCase() === "#razz" });
    closeModal();
    tabGod?.click();
    await refreshAdminOverview();
  });

  // 3. Portable .n23-godkey.json Upload (Works offline on GitHub Pages!)
  godkeyFileInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const env = JSON.parse(text);
      const ver = await verifyPortableGodKeyWebCrypto(env, activePinnedSpki);
      if (!ver.valid) {
        statusMsg.textContent = `❌ Signatur abgelehnt: ${ver.reason}`;
        return;
      }
      localStorage.setItem(STORAGE_GODKEY_ENV, JSON.stringify(env));
      unlockedGod = true;
      applyUnlockedUI({ autoNeoBlick: true });
      closeModal();
      tabGod?.click();
      appendFeed({
        agent: "claude",
        mode: "ecdsa-p256",
        latencyMs: 1,
        text: `👁️ Portable GodKey verifiziert (${ver.claims.label}) — Private God Mode + Neo-Blick aktiv!`,
      });
    } catch {
      statusMsg.textContent = "Datei konnte nicht als .n23-godkey.json gelesen werden.";
    }
  });

  // --- Private God Mode Controls (Tab 6) ---
  $("chkGodNoclip")?.addEventListener("change", (e) => {
    world3d.god.noclip = e.target.checked;
    world3d.bannerText = e.target.checked
      ? "🕊️ GOD NOCLIP 0G AKTIV: Fliege durch alle Wände/Decken [WASD + SPACE hoch + Q/C runter + SHIFT Boost]"
      : "Standard-Bodenphysik (1G) wieder aktiv.";
  });

  $("chkNeoBlick")?.addEventListener("change", (e) => {
    world3d.god.neoBlick = e.target.checked;
    world3d.bannerText = e.target.checked
      ? "👁️ NEO-BLICK #RAZZ AKTIV: Matrix-Vektorsicht + A*-Orakel-Pfadröntgen eingeschaltet."
      : "Standard-Shader wieder aktiv.";
  });

  $("rngGodSpeed")?.addEventListener("input", (e) => {
    world3d.god.speedMult = Number(e.target.value);
    $("lblGodSpeed").textContent = `${Number(e.target.value).toFixed(1)}×`;
  });

  $("rngGodFov")?.addEventListener("input", (e) => {
    world3d.god.fov = Number(e.target.value);
    $("lblGodFov").textContent = String(e.target.value);
  });

  $("rngGodBpm")?.addEventListener("input", (e) => {
    const bpm = Number(e.target.value);
    $("lblGodBpm").textContent = String(bpm);
    audio.setJockeyParams({ bpm });
  });

  $("btnGodSolveStep")?.addEventListener("click", () => {
    world3d.stepOptimalEscapeNode();
  });

  $("btnGodLock")?.addEventListener("click", async () => {
    if (adminToken && !isStaticPagesModeRef()) {
      await fetch("./api/admin/lock", {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ all: false }),
      }).catch(() => {});
    }
    adminToken = "";
    unlockedAdmin = false;
    unlockedGod = false;
    sessionStorage.removeItem(STORAGE_ADMIN_TOKEN);
    localStorage.removeItem(STORAGE_GODKEY_ENV);
    if (window.location.hash) history.replaceState(null, "", window.location.pathname + window.location.search);
    applyUnlockedUI();
    appendFeed({ agent: "agy", mode: "vault-locked", latencyMs: 0, text: "🔒 Sovereign Vault & God Mode gesperrt." });
  });

  // --- Admin Vault Controls (Tab 7) ---
  $("btnAdminMint")?.addEventListener("click", async () => {
    const coins = Number($("adminMintCoins").value) || 5;
    const code = $("adminMintCode").value.trim() || null;
    const note = $("adminMintNote").value.trim() || "Owner Mint";
    const res = await fetch("./api/admin/mint-voucher", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ coins, code, note }),
    });
    const data = await res.json();
    if (!res.ok) return appendFeed({ agent: "genie", mode: "admin-err", text: data.error });
    $("adminMintCode").value = "";
    await refreshAdminOverview();
    appendFeed({
      agent: "genie",
      mode: "admin-mint",
      text: `🪙 Neuer Voucher geprägt: ${data.voucher.code} (${data.voucher.coins} World-Coins).`,
    });
  });

  $("btnAdminGrantSelf")?.addEventListener("click", async () => {
    const res = await fetch("./api/admin/grant-coins", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ walletId: "local-studio", coins: 25 }),
    });
    const data = await res.json();
    if (res.ok && data.wallet) {
      onCoinsUpdated(data.wallet.balance);
      await refreshAdminOverview();
    }
  });

  $("btnAdminResetBudget")?.addEventListener("click", async () => {
    const res = await fetch("./api/admin/reset-budget", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (res.ok && data.budget) {
      onBudgetUpdated(data.budget);
      await refreshAdminOverview();
    }
  });

  $("btnAdminSetPass")?.addEventListener("click", async () => {
    const pw = $("adminNewPassInput").value.trim();
    const res = await fetch("./api/admin/passphrase", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ passphrase: pw }),
    });
    const data = await res.json();
    if (!res.ok) return appendFeed({ agent: "agy", mode: "admin-err", text: data.error });
    $("adminNewPassInput").value = "";
    await refreshAdminOverview();
    appendFeed({ agent: "agy", mode: "scrypt-vault", text: "🔐 Eigenes privates Admin-Passwort gespeichert (scrypt)." });
  });

  $("btnAdminExportGodkey")?.addEventListener("click", async () => {
    const res = await fetch("./api/admin/export-godkey", {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ label: "Paul Mobile & Pages GodKey", validDays: 365 }),
    });
    const data = await res.json();
    if (!res.ok) return;
    const blob = new Blob([JSON.stringify(data.keyEnvelope, null, 2)], { type: "application/json" });
    offerDownload(blob, "paul.n23-godkey.json", "Portable GodKey (.n23-godkey.json)");
    appendFeed({
      agent: "claude",
      mode: "ecdsa-p256",
      text: "⬇ Portable .n23-godkey.json signiert — schaltet deinen privaten God Mode auch auf GitHub Pages / Handy frei!",
    });
  });

  tabAdmin?.addEventListener("click", () => void refreshAdminOverview());
}
