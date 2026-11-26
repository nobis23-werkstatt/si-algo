// Mobile & Tablet Dual-Thumb Touch Controller for Android APK & Mobile Web.
// Left virtual analog thumbstick drives WASD movement; right touch-pad drives camera yaw/pitch
// plus dedicated tactile buttons for JUMP (Space), USE [E], and 180-BPM DROP!

export function setupTouchControls({ viewportEl, heldKeys, world3d, onDrop, onActivity }) {
  const overlay = document.createElement("div");
  overlay.className = "touch-overlay hidden";
  overlay.innerHTML = `
    <div class="touch-stick-zone" id="touchMoveZone">
      <div class="touch-stick-base">
        <div class="touch-stick-nub" id="touchMoveNub"></div>
      </div>
    </div>
    <div class="touch-look-zone" id="touchLookZone" title="Swipe to look around"></div>
    <div class="touch-actions">
      <button type="button" class="touch-btn" id="tBtnJump">JUMP</button>
      <button type="button" class="touch-btn" id="tBtnUse">USE [E]</button>
      <button type="button" class="touch-btn drop" id="tBtnDrop">DROP!</button>
    </div>
  `;
  viewportEl.appendChild(overlay);

  const nub = overlay.querySelector("#touchMoveNub");
  const moveZone = overlay.querySelector("#touchMoveZone");
  const lookZone = overlay.querySelector("#touchLookZone");

  const haptic = (ms = 18) => {
    try {
      navigator.vibrate?.(ms);
    } catch {}
  };

  const clearMoveKeys = () => {
    for (const k of ["key_w", "key_a", "key_s", "key_d"]) heldKeys.delete(k);
    nub.style.transform = "translate(0px, 0px)";
  };

  let moveOrigin = null;
  moveZone.addEventListener("pointerdown", (e) => {
    moveZone.setPointerCapture(e.pointerId);
    moveOrigin = { x: e.clientX, y: e.clientY, id: e.pointerId };
    onActivity?.();
  });

  moveZone.addEventListener("pointermove", (e) => {
    if (!moveOrigin || e.pointerId !== moveOrigin.id) return;
    const dx = Math.max(-42, Math.min(42, e.clientX - moveOrigin.x));
    const dy = Math.max(-42, Math.min(42, e.clientY - moveOrigin.y));
    nub.style.transform = `translate(${dx}px, ${dy}px)`;

    if (dy < -14) heldKeys.add("key_w"); else heldKeys.delete("key_w");
    if (dy > 14) heldKeys.add("key_s"); else heldKeys.delete("key_s");
    if (dx < -14) heldKeys.add("key_a"); else heldKeys.delete("key_a");
    if (dx > 14) heldKeys.add("key_d"); else heldKeys.delete("key_d");
    onActivity?.();
  });

  const endMove = (e) => {
    if (moveOrigin && e.pointerId === moveOrigin.id) {
      moveOrigin = null;
      clearMoveKeys();
    }
  };
  moveZone.addEventListener("pointerup", endMove);
  moveZone.addEventListener("pointercancel", endMove);

  let lookPrev = null;
  lookZone.addEventListener("pointerdown", (e) => {
    lookZone.setPointerCapture(e.pointerId);
    lookPrev = { x: e.clientX, y: e.clientY, id: e.pointerId };
    onActivity?.();
  });

  lookZone.addEventListener("pointermove", (e) => {
    if (!lookPrev || e.pointerId !== lookPrev.id) return;
    const dx = e.clientX - lookPrev.x;
    const dy = e.clientY - lookPrev.y;
    lookPrev = { x: e.clientX, y: e.clientY, id: e.pointerId };
    world3d.cam.yaw -= dx * 0.0065;
    world3d.cam.pitch = Math.max(-0.35, Math.min(0.35, world3d.cam.pitch - dy * 0.003));
    onActivity?.();
  });

  const endLook = (e) => {
    if (lookPrev && e.pointerId === lookPrev.id) lookPrev = null;
  };
  lookZone.addEventListener("pointerup", endLook);
  lookZone.addEventListener("pointercancel", endLook);

  overlay.querySelector("#tBtnJump").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    haptic(15);
    heldKeys.add("space");
    onActivity?.();
    setTimeout(() => heldKeys.delete("space"), 180);
  });

  overlay.querySelector("#tBtnUse").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    haptic(25);
    world3d.tryInteract();
    onActivity?.();
  });

  overlay.querySelector("#tBtnDrop").addEventListener("pointerdown", (e) => {
    e.preventDefault();
    haptic(45);
    onDrop?.();
    onActivity?.();
  });

  // Auto-enable on touch devices
  const isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (isTouchDevice) {
    overlay.classList.remove("hidden");
  }

  return {
    setVisible(visible) {
      overlay.classList.toggle("hidden", !visible);
      if (!visible) clearMoveKeys();
    },
    isVisible() {
      return !overlay.classList.contains("hidden");
    },
  };
}
