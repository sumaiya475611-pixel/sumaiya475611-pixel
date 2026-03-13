// ============================================================
// js/events.js  —  Click / touch interaction handlers
//   • Raycaster for balloon pop + cake sparkle clicks
//   • Wish popup open / close
//   • Music toggle button
//   • Resize is handled inside scene.js
// ============================================================

import * as THREE from 'three';
import { playSound, toggleMute, isMuted } from './audio.js';
import { spawnSparkle, triggerConfettiCannon } from './particles.js';
import { getCakeTopPosition } from './scene.js';

// ── Internal state ────────────────────────────────────────────
let _camera   = null;
let _scene    = null;
let _renderer = null;

const _raycaster = new THREE.Raycaster();
const _pointer   = new THREE.Vector2();

// Callbacks set by main.js
let _onBalloonPop = null; // (mesh) → called when a balloon is hit

// ── Init ───────────────────────────────────────────────────────
export function initEvents({ camera, scene, renderer, onBalloonPop }) {
  _camera       = camera;
  _scene        = scene;
  _renderer     = renderer;
  _onBalloonPop = onBalloonPop;

  // Click / tap → sparkle + raycaster
  renderer.domElement.addEventListener('click',     _onClick);
  renderer.domElement.addEventListener('touchend',  _onTouch, { passive: true });

  // Wish popup buttons
  document.getElementById('btn-wish')?.addEventListener('click', _openWish);
  document.getElementById('btn-close-wish')?.addEventListener('click', _closeWish);

  // Music toggle
  document.getElementById('btn-music')?.addEventListener('click', _onMusicToggle);

  // Close wish on backdrop click
  document.getElementById('wish-popup')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) _closeWish();
  });

  // Close wish on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') _closeWish();
  });
}

// ── Click handler ──────────────────────────────────────────────
function _onClick(e) {
  _handlePointer(e.clientX, e.clientY);
}

function _onTouch(e) {
  if (!e.changedTouches.length) return;
  const t = e.changedTouches[0];
  _handlePointer(t.clientX, t.clientY);
}

function _handlePointer(clientX, clientY) {
  // Normalised device coords
  _pointer.x =  (clientX / window.innerWidth)  * 2 - 1;
  _pointer.y = -(clientY / window.innerHeight) * 2 + 1;

  _raycaster.setFromCamera(_pointer, _camera);

  // Find all intersections
  const hits = _raycaster.intersectObjects(_scene.children, true);

  if (hits.length > 0) {
    const hit   = hits[0];
    const point = hit.point;

    // Spawn sparkle at hit point
    spawnSparkle(point.x, point.y, point.z);
    playSound('sparkle');

    // Walk up to find userData (balloon / gift / cake)
    let obj = hit.object;
    while (obj) {
      if (obj.userData.isBalloon) {
        _popBalloon(obj, point);
        return;
      }
      if (obj.userData.isGift) {
        _openGift(obj, point);
        return;
      }
      if (obj.userData.isCake) {
        const cakeTop = getCakeTopPosition();
        triggerConfettiCannon(cakeTop.x, cakeTop.y, cakeTop.z);
        playSound('confetti');
        return;
      }
      obj = obj.parent;
    }
  } else {
    // Clicked empty space — gentle sparkle at projected depth
    const dir   = new THREE.Vector3();
    _raycaster.ray.at(8, dir);
    spawnSparkle(dir.x, dir.y, dir.z);
    playSound('sparkle');
  }
}

// ── Balloon pop — inflate then burst ──────────────────────────
function _popBalloon(mesh, point) {
  const group = mesh.parent;
  if (!group || group.userData.popped) return;
  group.userData.popped = true;

  const origScale = group.userData.origScale || 1;

  playSound('pop');
  // Burst of sparkles at pop point
  spawnSparkle(point.x, point.y, point.z);
  spawnSparkle(point.x + 0.25, point.y + 0.25, point.z);
  spawnSparkle(point.x - 0.25, point.y - 0.15, point.z + 0.1);

  if (_onBalloonPop) _onBalloonPop(mesh);

  if (window.gsap) {
    // Phase 1: quickly inflate to 1.6× original scale
    gsap.to(group.scale, {
      x: origScale * 1.6, y: origScale * 1.6, z: origScale * 1.6,
      duration: 0.12,
      ease: 'power1.out',
      onComplete: () => {
        // Phase 2: snap to zero (pop!)
        gsap.to(group.scale, {
          x: 0, y: 0, z: 0,
          duration: 0.1,
          ease: 'power3.in',
          onComplete: () => {
            group.visible = false;
            group.userData.popped = false;
            // Respawn after 3 s
            setTimeout(() => {
              group.scale.setScalar(origScale);
              group.visible = true;
            }, 3000);
          },
        });
      },
    });
  } else {
    group.visible = false;
    group.userData.popped = false;
    setTimeout(() => { group.scale.setScalar(origScale); group.visible = true; }, 3000);
  }
}

// ── Gift box open — lid flies off + confetti shower ────────────
function _openGift(giftGroup, point) {
  if (giftGroup.userData.opened) return;
  giftGroup.userData.opened = true;

  const lid   = giftGroup.userData.lid;
  const baseY = giftGroup.userData.baseY ?? giftGroup.position.y;
  const s     = giftGroup.scale.x;

  // Sound + sparkles
  playSound('confetti');
  spawnSparkle(point.x, point.y, point.z);
  spawnSparkle(point.x, point.y + 0.4, point.z);

  // Confetti cannon bursting out of the box top
  triggerConfettiCannon(
    giftGroup.position.x,
    giftGroup.position.y + s,
    giftGroup.position.z,
  );

  if (window.gsap) {
    // Box jumps up slightly
    gsap.to(giftGroup.position, {
      y: baseY + 0.35,
      duration: 0.12, ease: 'power2.out',
      yoyo: true, repeat: 1,
    });

    if (lid) {
      // Lid pops up…
      gsap.to(lid.position, { y: 1.8,  duration: 0.28, ease: 'back.out(2)' });
      gsap.to(lid.rotation, { x: 0.5, z: 0.6, duration: 0.28, ease: 'power2.out' });
      // …then tumbles away
      gsap.to(lid.position, { y: -4,  duration: 0.55, delay: 0.28, ease: 'power2.in' });
      gsap.to(lid.rotation, { x: 2.0, z: 1.8, duration: 0.55, delay: 0.28, ease: 'power2.in' });
    }
  }

  // Reset after 5 s so box can be opened again
  setTimeout(() => {
    giftGroup.userData.opened = false;
    if (lid) { lid.position.set(0, 0.61, 0); lid.rotation.set(0, 0, 0); }
  }, 5000);
}

// ── Wish popup ─────────────────────────────────────────────────
function _openWish() {
  const popup = document.getElementById('wish-popup');
  if (!popup) return;

  triggerConfettiCannon(0, 2, 0);
  playSound('confetti');

  popup.classList.add('visible');

  if (window.gsap) {
    gsap.fromTo(popup,
      { opacity: 0, scale: 0.6 },
      { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.7)' }
    );
  }
}

function _closeWish() {
  const popup = document.getElementById('wish-popup');
  if (!popup) return;

  if (window.gsap) {
    gsap.to(popup, {
      opacity: 0,
      scale:   0.7,
      duration: 0.25,
      ease:    'power2.in',
      onComplete: () => popup.classList.remove('visible'),
    });
  } else {
    popup.classList.remove('visible');
  }
}

// ── Music toggle ───────────────────────────────────────────────
function _onMusicToggle() {
  const muted = toggleMute();
  const btn   = document.getElementById('btn-music');
  if (btn) btn.textContent = muted ? '🔇' : '🎵';
}

// ── Mark meshes for raycasting ─────────────────────────────────
// Call from scene.js balloon / cake builders:
//   mesh.userData.isBalloon = true;
//   mesh.userData.isCake    = true;
// (These are already set by scene.js via the exported helpers below.)

export function markAsBalloon(mesh) {
  mesh.traverse(child => { child.userData.isBalloon = true; });
}

export function markAsCake(mesh) {
  mesh.traverse(child => { child.userData.isCake = true; });
}
