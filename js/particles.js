// ============================================================
// js/particles.js  —  Particle systems for the birthday scene
//   • Ambient confetti — 1800 pieces always falling
//   • Confetti cannon  — burst fired on "Make a Wish"
//   • Click sparkles   — small burst at any clicked world point
//   • Magic dust       — 300 slow-drifting glowing dots
// All geometry is THREE.BufferGeometry + THREE.Points (fast).
// ============================================================

import * as THREE from 'three';
import { THEME }  from '../lib/theme.js';

// ── Shared helpers ────────────────────────────────────────────
const _rnd  = (min, max) => Math.random() * (max - min) + min;
const _rndI = (arr)      => arr[Math.floor(Math.random() * arr.length)];

// Convert a CSS '#rrggbb' string → THREE.Color
function _cssToColor(hex) {
  return new THREE.Color(hex);
}

// Pre-build a Float32Array palette from the theme colour list
function _buildPalette(cssArr) {
  return cssArr.map(c => _cssToColor(c));
}

// ── AMBIENT CONFETTI ──────────────────────────────────────────
const CONF_COUNT   = 1800;
const CONF_SPREAD  = 28;   // ±x range
const CONF_TOP     = 20;   // spawn y
const CONF_BOTTOM  = -14;  // reset y

let _confettiGeo   = null;
let _confettiMesh  = null;
let _confVel       = null; // Float32Array [vx,vy,vz] per particle
let _confAngVel    = null; // Float32Array [wx,wy,wz] per particle

export function createConfettiSystem(scene) {
  const palette = _buildPalette(THEME.confettiColors);
  const positions = new Float32Array(CONF_COUNT * 3);
  const colors    = new Float32Array(CONF_COUNT * 3);
  _confVel    = new Float32Array(CONF_COUNT * 3);
  _confAngVel = new Float32Array(CONF_COUNT * 3);

  for (let i = 0; i < CONF_COUNT; i++) {
    const i3 = i * 3;
    positions[i3]     = _rnd(-CONF_SPREAD, CONF_SPREAD);
    positions[i3 + 1] = _rnd(CONF_BOTTOM, CONF_TOP);
    positions[i3 + 2] = _rnd(-12, 4);

    _confVel[i3]     = _rnd(-0.02, 0.02);  // drift x
    _confVel[i3 + 1] = _rnd(-0.06, -0.02); // fall y
    _confVel[i3 + 2] = _rnd(-0.01, 0.01);  // drift z

    const col = _rndI(palette);
    colors[i3]     = col.r;
    colors[i3 + 1] = col.g;
    colors[i3 + 2] = col.b;
  }

  _confettiGeo = new THREE.BufferGeometry();
  _confettiGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  _confettiGeo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

  const mat = new THREE.PointsMaterial({
    size:         0.28,
    vertexColors: true,
    transparent:  true,
    opacity:      0.92,
    depthWrite:   false,
    sizeAttenuation: true,
  });

  _confettiMesh = new THREE.Points(_confettiGeo, mat);
  _confettiMesh.renderOrder = 1;
  scene.add(_confettiMesh);
}

// Call every frame from the render loop
export function updateConfetti(/* time */) {
  if (!_confettiGeo) return;
  const pos = _confettiGeo.attributes.position.array;

  for (let i = 0; i < CONF_COUNT; i++) {
    const i3 = i * 3;
    pos[i3]     += _confVel[i3];
    pos[i3 + 1] += _confVel[i3 + 1];
    pos[i3 + 2] += _confVel[i3 + 2];

    // Add gentle sway (sinusoidal x drift)
    pos[i3] += Math.sin(pos[i3 + 1] * 0.5 + i) * 0.004;

    // Reset to top when below floor
    if (pos[i3 + 1] < CONF_BOTTOM) {
      pos[i3]     = _rnd(-CONF_SPREAD, CONF_SPREAD);
      pos[i3 + 1] = CONF_TOP;
      pos[i3 + 2] = _rnd(-12, 4);
    }
  }
  _confettiGeo.attributes.position.needsUpdate = true;
}

// ── CONFETTI CANNON (Make a Wish burst) ───────────────────────
const CANNON_COUNT = 300;
let _cannonGeo     = null;
let _cannonMesh    = null;
let _cannonVel     = null;
let _cannonLife    = null; // remaining life per particle (0 = dead)
let _cannonActive  = false;

export function createConfettiCannon(scene) {
  const palette   = _buildPalette(THEME.confettiColors);
  const positions = new Float32Array(CANNON_COUNT * 3);
  const colors    = new Float32Array(CANNON_COUNT * 3);
  _cannonVel  = new Float32Array(CANNON_COUNT * 3);
  _cannonLife = new Float32Array(CANNON_COUNT);

  // Start all dead (y far below)
  for (let i = 0; i < CANNON_COUNT; i++) {
    positions[i * 3 + 1] = -999;
  }

  _cannonGeo = new THREE.BufferGeometry();
  _cannonGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  _cannonGeo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

  const mat = new THREE.PointsMaterial({
    size:         0.4,
    vertexColors: true,
    transparent:  true,
    opacity:      0.95,
    depthWrite:   false,
    sizeAttenuation: true,
  });

  _cannonMesh = new THREE.Points(_cannonGeo, mat);
  _cannonMesh.renderOrder = 2;
  scene.add(_cannonMesh);

  // Pre-fill colours (shuffled)
  const colArr = _cannonGeo.attributes.color.array;
  for (let i = 0; i < CANNON_COUNT; i++) {
    const col = _rndI(palette);
    colArr[i * 3]     = col.r;
    colArr[i * 3 + 1] = col.g;
    colArr[i * 3 + 2] = col.b;
  }
  _cannonGeo.attributes.color.needsUpdate = true;
}

// Trigger the cannon burst from a world origin point
export function triggerConfettiCannon(originX = 0, originY = 0, originZ = 0) {
  if (!_cannonGeo) return;
  const pos = _cannonGeo.attributes.position.array;

  for (let i = 0; i < CANNON_COUNT; i++) {
    const i3 = i * 3;
    pos[i3]     = originX + _rnd(-0.5, 0.5);
    pos[i3 + 1] = originY + _rnd(-0.2, 0.2);
    pos[i3 + 2] = originZ + _rnd(-0.5, 0.5);

    _cannonVel[i3]     = _rnd(-0.18, 0.18);
    _cannonVel[i3 + 1] = _rnd(0.12, 0.42);  // shoot upward
    _cannonVel[i3 + 2] = _rnd(-0.12, 0.12);

    _cannonLife[i] = _rnd(60, 120); // frames
  }
  _cannonGeo.attributes.position.needsUpdate = true;
  _cannonActive = true;
}

// Call every frame
export function updateConfettiCannon() {
  if (!_cannonGeo || !_cannonActive) return;
  const pos = _cannonGeo.attributes.position.array;
  let anyAlive = false;

  for (let i = 0; i < CANNON_COUNT; i++) {
    if (_cannonLife[i] <= 0) continue;
    anyAlive = true;
    const i3 = i * 3;
    _cannonLife[i]--;

    pos[i3]     += _cannonVel[i3];
    pos[i3 + 1] += _cannonVel[i3 + 1];
    pos[i3 + 2] += _cannonVel[i3 + 2];

    _cannonVel[i3 + 1] -= 0.006; // gravity

    if (_cannonLife[i] <= 0) {
      pos[i3 + 1] = -999; // hide
    }
  }
  _cannonGeo.attributes.position.needsUpdate = true;
  if (!anyAlive) _cannonActive = false;
}

// ── CLICK SPARKLES ─────────────────────────────────────────────
// Pool of small sparkle bursts; each burst lasts ~40 frames
const SPARKLE_MAX    = 12;   // max simultaneous bursts
const SPARKLE_PER    = 60;   // particles per burst
const SPARKLE_TOTAL  = SPARKLE_MAX * SPARKLE_PER;

const _sparkleColors = [
  new THREE.Color(THEME.gold),
  new THREE.Color(THEME.primaryPink),
  new THREE.Color('#ffffff'),
  new THREE.Color('#ffe0f0'),
];

let _sparkleGeo  = null;
let _sparkleMesh = null;
let _sparkleVel  = null;  // Float32Array SPARKLE_TOTAL * 3
let _sparkleLife = null;  // Float32Array SPARKLE_TOTAL  (frames remaining)
let _sparkleMax  = null;  // Float32Array SPARKLE_TOTAL  (initial life for opacity calc)

export function createSparkleSystem(scene) {
  const positions = new Float32Array(SPARKLE_TOTAL * 3);
  const colors    = new Float32Array(SPARKLE_TOTAL * 3);
  _sparkleVel  = new Float32Array(SPARKLE_TOTAL * 3);
  _sparkleLife = new Float32Array(SPARKLE_TOTAL);
  _sparkleMax  = new Float32Array(SPARKLE_TOTAL);

  // Start all hidden
  for (let i = 0; i < SPARKLE_TOTAL; i++) {
    positions[i * 3 + 1] = -999;
    const col = _rndI(_sparkleColors);
    colors[i * 3]     = col.r;
    colors[i * 3 + 1] = col.g;
    colors[i * 3 + 2] = col.b;
  }

  _sparkleGeo = new THREE.BufferGeometry();
  _sparkleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  _sparkleGeo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

  const mat = new THREE.PointsMaterial({
    size:         0.22,
    vertexColors: true,
    transparent:  true,
    opacity:      1.0,
    depthWrite:   false,
    sizeAttenuation: true,
  });

  _sparkleMesh = new THREE.Points(_sparkleGeo, mat);
  _sparkleMesh.renderOrder = 3;
  scene.add(_sparkleMesh);
}

// Spawn a sparkle burst at world position x,y,z
let _sparkleSlot = 0; // round-robin slot allocator
export function spawnSparkle(x, y, z) {
  if (!_sparkleGeo) return;
  const pos = _sparkleGeo.attributes.position.array;
  const col = _sparkleGeo.attributes.color.array;

  const base = _sparkleSlot * SPARKLE_PER;
  _sparkleSlot = (_sparkleSlot + 1) % SPARKLE_MAX;

  for (let j = 0; j < SPARKLE_PER; j++) {
    const idx = (base + j);
    const i3  = idx * 3;
    pos[i3]     = x + _rnd(-0.3, 0.3);
    pos[i3 + 1] = y + _rnd(-0.3, 0.3);
    pos[i3 + 2] = z + _rnd(-0.3, 0.3);

    const speed = _rnd(0.04, 0.18);
    const theta = _rnd(0, Math.PI * 2);
    const phi   = _rnd(0, Math.PI);
    _sparkleVel[i3]     = Math.sin(phi) * Math.cos(theta) * speed;
    _sparkleVel[i3 + 1] = Math.sin(phi) * Math.sin(theta) * speed;
    _sparkleVel[i3 + 2] = Math.cos(phi) * speed;

    _sparkleLife[idx] = 40;
    _sparkleMax[idx]  = 40;

    const c = _rndI(_sparkleColors);
    col[i3]     = c.r;
    col[i3 + 1] = c.g;
    col[i3 + 2] = c.b;
  }
  _sparkleGeo.attributes.position.needsUpdate = true;
  _sparkleGeo.attributes.color.needsUpdate    = true;
}

// Call every frame
export function updateSparkles() {
  if (!_sparkleGeo) return;
  const pos = _sparkleGeo.attributes.position.array;
  let anyUpdated = false;

  for (let i = 0; i < SPARKLE_TOTAL; i++) {
    if (_sparkleLife[i] <= 0) continue;
    anyUpdated = true;
    const i3 = i * 3;
    _sparkleLife[i]--;

    pos[i3]     += _sparkleVel[i3];
    pos[i3 + 1] += _sparkleVel[i3 + 1];
    pos[i3 + 2] += _sparkleVel[i3 + 2];

    // Fade out (slow down too)
    _sparkleVel[i3]     *= 0.92;
    _sparkleVel[i3 + 1] *= 0.92;
    _sparkleVel[i3 + 2] *= 0.92;

    if (_sparkleLife[i] <= 0) pos[i3 + 1] = -999;
  }
  if (anyUpdated) _sparkleGeo.attributes.position.needsUpdate = true;
}

// ── MAGIC DUST (ambient floating glow) ────────────────────────
const DUST_COUNT = 300;
let _dustGeo  = null;
let _dustMesh = null;
let _dustBase = null; // base positions for wave animation

export function createAmbientDust(scene) {
  const positions = new Float32Array(DUST_COUNT * 3);
  const colors    = new Float32Array(DUST_COUNT * 3);
  _dustBase       = new Float32Array(DUST_COUNT * 3);

  const dustColors = [
    new THREE.Color(THEME.gold),
    new THREE.Color(THEME.primaryPink),
    new THREE.Color('#e8d0ff'),
    new THREE.Color('#ffffff'),
  ];

  for (let i = 0; i < DUST_COUNT; i++) {
    const i3 = i * 3;
    const x = _rnd(-22, 22);
    const y = _rnd(-10, 14);
    const z = _rnd(-14, 2);
    positions[i3]     = x;
    positions[i3 + 1] = y;
    positions[i3 + 2] = z;
    _dustBase[i3]     = x;
    _dustBase[i3 + 1] = y;
    _dustBase[i3 + 2] = z;

    const col = _rndI(dustColors);
    colors[i3]     = col.r;
    colors[i3 + 1] = col.g;
    colors[i3 + 2] = col.b;
  }

  _dustGeo = new THREE.BufferGeometry();
  _dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  _dustGeo.setAttribute('color',    new THREE.BufferAttribute(colors,    3));

  const mat = new THREE.PointsMaterial({
    size:         0.12,
    vertexColors: true,
    transparent:  true,
    opacity:      0.55,
    depthWrite:   false,
    sizeAttenuation: true,
  });

  _dustMesh = new THREE.Points(_dustGeo, mat);
  _dustMesh.renderOrder = 0;
  scene.add(_dustMesh);
}

// Call every frame with elapsed time (seconds)
export function updateAmbientDust(time) {
  if (!_dustGeo) return;
  const pos = _dustGeo.attributes.position.array;

  for (let i = 0; i < DUST_COUNT; i++) {
    const i3 = i * 3;
    const t  = time * 0.4 + i * 0.37;
    pos[i3]     = _dustBase[i3]     + Math.sin(t * 0.7)  * 0.6;
    pos[i3 + 1] = _dustBase[i3 + 1] + Math.sin(t * 0.5 + i) * 0.5
                                     + Math.cos(t * 0.3)  * 0.3;
    pos[i3 + 2] = _dustBase[i3 + 2] + Math.cos(t * 0.6)  * 0.4;
  }
  _dustGeo.attributes.position.needsUpdate = true;
}
