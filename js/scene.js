// ============================================================
// js/scene.js  —  Three.js 3D birthday scene
//   Builds and animates:
//     • Renderer + camera + lights
//     • Birthday cake (tiers + candles + flames)
//     • Floating balloons (procedural)
//     • Spinning star field
//     • Golden crown above cake
//     • Floating gift boxes
// All colours come from lib/theme.js
// ============================================================

import * as THREE from 'three';
import { THEME }  from '../lib/theme.js';

// ── Module state ──────────────────────────────────────────────
let _renderer = null;
let _scene    = null;
let _camera   = null;

// Animated objects
const _balloons  = [];  // { mesh, pivotY, speed, radius, phase }
const _flames    = [];  // { mesh, baseScale }
const _stars     = [];  // { mesh }  (background sparkle stars)
const _gifts     = [];  // { group, speed, phase }
let   _crown     = null;
let   _cake      = null; // top-level cake group

// ── Init ───────────────────────────────────────────────────────
export function initScene(canvas) {
  // Renderer
  _renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
  _renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  _renderer.setSize(window.innerWidth, window.innerHeight);
  _renderer.setClearColor(THEME.bgColor, 1);
  _renderer.shadowMap.enabled = true;
  _renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

  // Scene
  _scene = new THREE.Scene();
  _scene.fog = new THREE.FogExp2(THEME.bgColor, 0.018);

  // Camera
  _camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
  _camera.position.set(0, 3, 14);
  _camera.lookAt(0, 1, 0);

  // Lights
  _buildLights();

  // 3D objects
  _buildStarField();
  _buildCake();
  _buildBalloons();
  _buildCrown();
  _buildGifts();

  // Resize handler
  window.addEventListener('resize', _onResize);

  return { renderer: _renderer, scene: _scene, camera: _camera };
}

// ── Lights ─────────────────────────────────────────────────────
function _buildLights() {
  const ambient = new THREE.AmbientLight(THEME.ambientColor, 0.5);
  _scene.add(ambient);

  // Key light — pink from upper-left
  const key = new THREE.DirectionalLight(THEME.light1Color, 1.0);
  key.position.set(-6, 10, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 0.5;
  key.shadow.camera.far  = 40;
  key.shadow.camera.left = key.shadow.camera.bottom = -12;
  key.shadow.camera.right = key.shadow.camera.top  =  12;
  _scene.add(key);

  // Fill light — gold from right
  const fill = new THREE.DirectionalLight(THEME.light2Color, 0.6);
  fill.position.set(8, 5, 5);
  _scene.add(fill);

  // Candle glow — warm point light above cake
  const candleGlow = new THREE.PointLight(0xFFCC66, 2.5, 10);
  candleGlow.position.set(0, 4.5, 0);
  _scene.add(candleGlow);

  // Soft back rim
  const rim = new THREE.DirectionalLight(0x8866ff, 0.35);
  rim.position.set(0, 8, -10);
  _scene.add(rim);
}

// ── Star field (background) ────────────────────────────────────
function _buildStarField() {
  // Big distant sparkle stars using sprites
  const starTex = _makeStarTexture();

  const starColors = [0xffffff, 0xFFD700, 0xFF69B4, 0xE6D5FF, 0x87CEEB];

  for (let i = 0; i < 180; i++) {
    const mat = new THREE.SpriteMaterial({
      map:         starTex,
      color:       starColors[i % starColors.length],
      transparent: true,
      opacity:     Math.random() * 0.6 + 0.3,
      depthWrite:  false,
    });
    const sprite = new THREE.Sprite(mat);
    const s      = Math.random() * 0.35 + 0.08;
    sprite.scale.set(s, s, 1);
    sprite.position.set(
      (Math.random() - 0.5) * 60,
      (Math.random() - 0.5) * 36,
      -20 - Math.random() * 30,
    );
    _scene.add(sprite);
    _stars.push({ sprite, baseOpacity: mat.opacity });
  }
}

// Canvas-generated soft glow texture
function _makeStarTexture() {
  const size = 64;
  const cv   = document.createElement('canvas');
  cv.width   = size;
  cv.height  = size;
  const ctx  = cv.getContext('2d');
  const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
  grad.addColorStop(0,   'rgba(255,255,255,1)');
  grad.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  grad.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  return tex;
}

// ── Birthday Cake ──────────────────────────────────────────────
function _buildCake() {
  _cake = new THREE.Group();
  _scene.add(_cake);

  // Tiers: [radiusTop, radiusBot, height, y, color]
  const tiers = [
    { r: 2.2, h: 1.0, y: 0.5,  color: 0xFF69B4  }, // bottom — pink
    { r: 1.6, h: 0.9, y: 1.65, color: 0xFFD700  }, // middle — gold
    { r: 1.0, h: 0.8, y: 2.65, color: 0xE6D5FF  }, // top    — lavender
  ];

  tiers.forEach(({ r, h, y, color }) => {
    // Cake body
    const geo  = new THREE.CylinderGeometry(r, r + 0.08, h, 32);
    const mat  = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.0,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = y;
    mesh.castShadow    = true;
    mesh.receiveShadow = true;
    _cake.add(mesh);

    // Frosting rim (torus on top edge)
    const frostGeo = new THREE.TorusGeometry(r, 0.12, 8, 32);
    const frostMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
    const frost    = new THREE.Mesh(frostGeo, frostMat);
    frost.rotation.x = Math.PI / 2;
    frost.position.y = y + h / 2;
    _cake.add(frost);

    // Drip blobs (small spheres hanging off the rim)
    const dripCount = Math.floor(r * 8);
    for (let d = 0; d < dripCount; d++) {
      const angle = (d / dripCount) * Math.PI * 2;
      const dGeo  = new THREE.SphereGeometry(0.11, 8, 8);
      const dMesh = new THREE.Mesh(dGeo, frostMat);
      dMesh.position.set(
        Math.cos(angle) * r,
        y + h / 2 - 0.1,
        Math.sin(angle) * r,
      );
      _cake.add(dMesh);
    }
  });

  // Top plate
  const plateGeo = new THREE.CylinderGeometry(1.1, 1.1, 0.06, 32);
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3, metalness: 0.3 });
  const plate    = new THREE.Mesh(plateGeo, plateMat);
  plate.position.y = 3.1;
  _cake.add(plate);

  // Candles (3 — one per year)
  const candlePositions = [
    { x: -0.38, z:  0.0  },
    { x:  0.38, z:  0.0  },
    { x:  0.0,  z: -0.38 },
  ];
  const candleColors = [0xFF69B4, 0x87CEEB, 0xFFD700];

  candlePositions.forEach(({ x, z }, i) => {
    // Candle stick
    const cGeo  = new THREE.CylinderGeometry(0.07, 0.07, 0.55, 12);
    const cMat  = new THREE.MeshStandardMaterial({ color: candleColors[i], roughness: 0.4 });
    const cMesh = new THREE.Mesh(cGeo, cMat);
    cMesh.position.set(x, 3.41, z);
    _cake.add(cMesh);

    // Wick
    const wGeo  = new THREE.CylinderGeometry(0.012, 0.012, 0.12, 6);
    const wMat  = new THREE.MeshStandardMaterial({ color: 0x222222 });
    const wMesh = new THREE.Mesh(wGeo, wMat);
    wMesh.position.set(x, 3.73, z);
    _cake.add(wMesh);

    // Flame
    const fGeo  = new THREE.SphereGeometry(0.09, 8, 8);
    fGeo.scale(1, 1.6, 1);
    const fMat  = new THREE.MeshStandardMaterial({
      color:     0xFF8800,
      emissive:  new THREE.Color(0xFF6600),
      emissiveIntensity: 3.0,
      transparent: true,
      opacity:   0.92,
    });
    const fMesh = new THREE.Mesh(fGeo, fMat);
    fMesh.position.set(x, 3.85, z);
    _cake.add(fMesh);
    _flames.push({ mesh: fMesh, baseY: 3.85, px: x, pz: z, phase: i * 1.2 });
  });

  // Decorative sprinkles (random tiny boxes on tiers)
  const sprinkleColors = [0xFF69B4, 0xFFD700, 0x87CEEB, 0x98FF98, 0xFF6B6B];
  for (let s = 0; s < 40; s++) {
    const tier = Math.floor(Math.random() * 3);
    const r    = [2.1, 1.5, 0.95][tier];
    const yPos = [0.5, 1.65, 2.65][tier] + (Math.random() * 0.2 - 0.1);
    const ang  = Math.random() * Math.PI * 2;
    const sGeo = new THREE.BoxGeometry(0.08, 0.04, 0.04);
    const sMat = new THREE.MeshStandardMaterial({ color: sprinkleColors[s % sprinkleColors.length] });
    const sM   = new THREE.Mesh(sGeo, sMat);
    sM.position.set(Math.cos(ang) * r * 0.85, yPos, Math.sin(ang) * r * 0.85);
    sM.rotation.y = ang;
    _cake.add(sM);
  }

  _cake.position.set(0, -1.5, 0);
}

// ── Balloons ───────────────────────────────────────────────────
function _buildBalloons() {
  const count = THEME.balloonColors.length;

  for (let i = 0; i < count; i++) {
    const group = new THREE.Group();

    // Balloon body — oblate sphere (scale y up)
    const bGeo = new THREE.SphereGeometry(0.55, 20, 16);
    const bMat = new THREE.MeshStandardMaterial({
      color:    THEME.balloonColors[i],
      roughness: 0.2,
      metalness: 0.1,
    });
    const bMesh = new THREE.Mesh(bGeo, bMat);
    bMesh.scale.y = 1.25;
    bMesh.castShadow = true;
    group.add(bMesh);

    // Shine highlight
    const sGeo  = new THREE.SphereGeometry(0.14, 8, 8);
    const sMat  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.0, metalness: 0.0, transparent: true, opacity: 0.55 });
    const sMesh = new THREE.Mesh(sGeo, sMat);
    sMesh.position.set(-0.18, 0.28, 0.38);
    group.add(sMesh);

    // Knot at bottom
    const kGeo  = new THREE.SphereGeometry(0.08, 8, 8);
    const kMesh = new THREE.Mesh(kGeo, bMat);
    kMesh.position.y = -0.72;
    group.add(kMesh);

    // String
    const pts = [
      new THREE.Vector3(0, -0.78, 0),
      new THREE.Vector3(0.06, -1.2, 0),
      new THREE.Vector3(-0.04, -1.6, 0),
    ];
    const curve   = new THREE.CatmullRomCurve3(pts);
    const strGeo  = new THREE.TubeGeometry(curve, 8, 0.008, 4, false);
    const strMat  = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 });
    const strMesh = new THREE.Mesh(strGeo, strMat);
    group.add(strMesh);

    // Position balloons in left / right arcs — keep cake front clear
    const halfCount = Math.floor(count / 2);
    const isRight   = i < halfCount;
    const halfIdx   = isRight ? i : i - halfCount;
    const arcFrac   = halfCount > 1 ? halfIdx / (halfCount - 1) : 0.5;
    const angle     = isRight
      ? (-0.7 + arcFrac * 1.4)             // right arc: −40° … +40°
      : (Math.PI - 0.7 + arcFrac * 1.4);  // left  arc: 140° … 220°
    const radius = 4.2 + Math.sin(i * 1.3) * 0.8;
    const yBase  = 2.5 + Math.cos(i * 0.9) * 1.5;

    group.position.set(
      Math.cos(angle) * radius,
      yBase,
      Math.sin(angle) * radius * 0.28 - 1.2, // small z — all behind cake centre
    );
    const s = 0.85 + Math.random() * 0.3;
    group.scale.setScalar(s);
    group.userData.origScale = s;
    // Mark all descendants so the raycaster can detect balloon clicks
    group.traverse(child => { child.userData.isBalloon = true; });

    _scene.add(group);
    _balloons.push({
      group,
      angle,
      radius,
      yBase,
      speed:  0.18 + Math.random() * 0.22,
      floatAmplitude: 0.35 + Math.random() * 0.25,
      floatPhase: Math.random() * Math.PI * 2,
      swayAmplitude: 0.12 + Math.random() * 0.1,
    });
  }
}

// ── Crown ──────────────────────────────────────────────────────
function _buildCrown() {
  _crown = new THREE.Group();

  const goldMat = new THREE.MeshStandardMaterial({
    color:     0xFFD700,
    roughness: 0.15,
    metalness: 0.85,
  });

  // Crown base ring (torus)
  const ringGeo  = new THREE.TorusGeometry(0.62, 0.1, 8, 40);
  const ring     = new THREE.Mesh(ringGeo, goldMat);
  ring.rotation.x = Math.PI / 2;
  _crown.add(ring);

  // Crown points (5 spikes)
  const spikeCount  = 5;
  const spikeColor  = [0xFFD700, 0xFF69B4, 0xFFD700, 0x87CEEB, 0xFFD700];
  for (let s = 0; s < spikeCount; s++) {
    const angle = (s / spikeCount) * Math.PI * 2;
    const sGeo  = new THREE.ConeGeometry(0.13, 0.55 + (s % 2) * 0.22, 6);
    const sMat  = new THREE.MeshStandardMaterial({
      color:     spikeColor[s],
      roughness: 0.15,
      metalness: 0.85,
    });
    const spike = new THREE.Mesh(sGeo, sMat);
    spike.position.set(Math.cos(angle) * 0.62, 0.28 + (s % 2) * 0.11, Math.sin(angle) * 0.62);
    _crown.add(spike);

    // Gemstone on each spike
    const gemColors = [0xFF69B4, 0x87CEEB, 0x98FF98, 0xFF6B6B, 0x9370DB];
    const gGeo  = new THREE.OctahedronGeometry(0.1);
    const gMat  = new THREE.MeshStandardMaterial({
      color:     gemColors[s],
      roughness: 0.0,
      metalness: 0.5,
      emissive:  new THREE.Color(gemColors[s]),
      emissiveIntensity: 0.5,
    });
    const gem = new THREE.Mesh(gGeo, gMat);
    gem.position.set(Math.cos(angle) * 0.62, 0.58 + (s % 2) * 0.1, Math.sin(angle) * 0.62);
    _crown.add(gem);
  }

  _crown.position.set(0, 4.2, 0);
  _crown.scale.setScalar(1.1);
  _scene.add(_crown);
}

// ── Gift boxes ─────────────────────────────────────────────────
function _buildGifts() {
  const giftData = [
    { x: -5.5, y: -1.5, z:  1.0, color: 0xFF69B4, ribbonColor: 0xFFD700, scale: 1.0 },
    { x:  5.2, y: -1.5, z:  0.5, color: 0x9370DB, ribbonColor: 0xFF69B4, scale: 0.85 },
    { x: -4.2, y: -1.5, z: -1.2, color: 0x87CEEB, ribbonColor: 0xFF6B6B, scale: 0.70 },
  ];

  giftData.forEach(({ x, y, z, color, ribbonColor, scale }, i) => {
    const group = new THREE.Group();

    // Box
    const bGeo = new THREE.BoxGeometry(1, 1, 1);
    const bMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const box  = new THREE.Mesh(bGeo, bMat);
    box.castShadow = true;
    group.add(box);

    // Lid (slightly bigger, on top)
    const lGeo = new THREE.BoxGeometry(1.08, 0.22, 1.08);
    const lMat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
    const lid  = new THREE.Mesh(lGeo, lMat);
    lid.position.y = 0.61;
    lid.userData.isGiftLid = true;   // exclude lid from raycasting group-up walk
    group.add(lid);

    // Ribbon stripes (two flat boxes)
    const rMat = new THREE.MeshStandardMaterial({ color: ribbonColor, roughness: 0.3 });
    [-1, 1].forEach(axis => {
      const rGeo = new THREE.BoxGeometry(
        axis === -1 ? 0.12 : 1.02,
        1.05,
        axis === -1 ? 1.02 : 0.12,
      );
      const r = new THREE.Mesh(rGeo, rMat);
      group.add(r);
    });

    // Bow (two small tori)
    const bowMat = new THREE.MeshStandardMaterial({ color: ribbonColor, roughness: 0.2, metalness: 0.3 });
    [0, Math.PI / 2].forEach(rot => {
      const bwGeo = new THREE.TorusGeometry(0.18, 0.055, 6, 16);
      const bw    = new THREE.Mesh(bwGeo, bowMat);
      bw.position.y = 0.75;
      bw.rotation.y = rot;
      bw.rotation.x = Math.PI / 2;
      group.add(bw);
    });

    group.position.set(x, y, z);
    group.scale.setScalar(scale);
    // Store lid for open animation; mark group for raycasting
    group.userData.isGift    = true;
    group.userData.lid       = lid;
    group.userData.baseY     = y;
    _scene.add(group);
    _gifts.push({ group, speed: 0.4 + i * 0.15, phase: i * 2.1 });
  });
}

// ── Public accessors ───────────────────────────────────────────
export function getScene()    { return _scene;    }
export function getCamera()   { return _camera;   }
export function getRenderer() { return _renderer; }

// Get cake top-center world position (used for confetti cannon origin)
export function getCakeTopPosition() {
  const pos = new THREE.Vector3();
  _cake.getWorldPosition(pos);
  pos.y += 3.5; // approx candle height offset
  return pos;
}

// ── Animate — call every frame ─────────────────────────────────
export function animateScene(time) {
  // Balloons: float up/down + gentle orbit sway
  _balloons.forEach(b => {
    b.group.position.y = b.yBase + Math.sin(time * b.speed + b.floatPhase) * b.floatAmplitude;
    b.group.rotation.z = Math.sin(time * b.speed * 0.7 + b.floatPhase) * b.swayAmplitude;
  });

  // Candle flames: flicker (scale + position jitter)
  _flames.forEach(f => {
    const flicker = 1 + Math.sin(time * 12 + f.phase) * 0.15 + Math.cos(time * 17 + f.phase * 2) * 0.08;
    f.mesh.scale.set(flicker, flicker * 1.2, flicker);
    f.mesh.position.x = f.px + Math.sin(time * 9  + f.phase) * 0.02;
    f.mesh.position.y = f.baseY + Math.sin(time * 11 + f.phase) * 0.025;
  });

  // Crown: slow float + gentle spin
  if (_crown) {
    _crown.position.y = 4.2 + Math.sin(time * 0.8) * 0.18;
    _crown.rotation.y = time * 0.35;
  }

  // Cake: very slow gentle bob
  if (_cake) {
    _cake.position.y = -1.5 + Math.sin(time * 0.4) * 0.06;
    _cake.rotation.y = time * 0.07;
  }

  // Gift boxes: gentle bobbing
  _gifts.forEach(g => {
    g.group.position.y += Math.sin(time * g.speed + g.phase) * 0.001;
    g.group.rotation.y  = Math.sin(time * 0.3 + g.phase) * 0.12;
  });

  // Stars: twinkle opacity
  _stars.forEach((s, i) => {
    s.sprite.material.opacity = s.baseOpacity * (0.7 + Math.sin(time * 2.5 + i * 0.7) * 0.3);
  });
}

// ── Camera gentle sway (called from main.js) ───────────────────
export function animateCamera(time) {
  _camera.position.x = Math.sin(time * 0.18) * 1.2;
  _camera.position.y = 3 + Math.sin(time * 0.12) * 0.4;
  _camera.lookAt(0, 1.2, 0);
}

// ── Resize ─────────────────────────────────────────────────────
function _onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  _renderer.setSize(w, h);
  _camera.aspect = w / h;
  _camera.updateProjectionMatrix();
}
