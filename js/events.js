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

    // Walk up to find userData (balloon meshes have userData.isBalloon)
    let obj = hit.object;
    while (obj) {
      if (obj.userData.isBalloon) {
        _popBalloon(obj, point);
        return;
      }
      if (obj.userData.isCake) {
        // Extra burst on cake click
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

// ── Balloon pop ────────────────────────────────────────────────
function _popBalloon(mesh, point) {
  playSound('pop');
  spawnSparkle(point.x, point.y, point.z);

  if (_onBalloonPop) _onBalloonPop(mesh);

  // Animate balloon shrinking then hide it, re-show after 3 s
  const parent = mesh.parent || mesh;
  if (window.gsap) {
    gsap.to(parent.scale, {
      x: 0, y: 0, z: 0,
      duration: 0.3,
      ease: 'back.in(2)',
      onComplete: () => {
        parent.visible = false;
        // Respawn
        setTimeout(() => {
          parent.scale.set(1, 1, 1);
          parent.visible = true;
        }, 3000);
      },
    });
  } else {
    parent.visible = false;
    setTimeout(() => { parent.visible = true; }, 3000);
  }
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
