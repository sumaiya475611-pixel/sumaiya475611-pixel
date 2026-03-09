// ============================================================
// js/gallery.js  —  Open-world drive-through photo gallery
//
//  Bruno Simon style:
//   • Over-the-shoulder camera (fixed angle, follows car, not eagle-eye)
//   • Open world — car roams freely across a big purple world
//   • Photo frames scattered in CLUSTERS (3-5 close together)
//   • Year zones on the FAR side of the world (high-Z area)
//       Each year has an arch gateway + sign + grouped photos
//   • Interactive gift boxes — car bumps them → bounce + sparkle
//   • Arrow keys / WASD + on-screen D-pad
// ============================================================

import * as THREE from 'three';
import { THEME }  from '../lib/theme.js';
import { GALLERY_TITLE, GALLERY_HINT, BACK_BTN } from '../lib/content.js';
import { GALLERY_PHOTOS, GALLERY_BY_YEAR } from '../lib/photos.js';
import * as Audio  from './audio.js';
import * as Parts  from './particles.js';
import { Car }         from './Car.js';
import { PhotoFrame }  from './PhotoFrame.js';

// ── DOM ────────────────────────────────────────────────────────
document.getElementById('gallery-title').textContent = GALLERY_TITLE;
document.getElementById('gallery-hint').textContent  = GALLERY_HINT;
document.getElementById('btn-back').textContent      = BACK_BTN;

// ── Renderer ───────────────────────────────────────────────────
const canvas   = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(THEME.bgColor, 1);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

// ── Scene ──────────────────────────────────────────────────────
const scene = new THREE.Scene();
scene.fog   = new THREE.FogExp2(0x2a0060, 0.004); // dark purple fog blends with ground

// ── Camera — over-the-shoulder, lower angle ───────────────────
// Offset: slightly above and behind car (not eagle-eye)
const camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 220);
// Camera is placed 12 units behind + 9 units above the car, rotates with car
camera.position.set(0, 9, 12);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ── Lights ─────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0xffffff, 1.2));

const sunLight = new THREE.DirectionalLight(0xFFEEDD, 2.0);
sunLight.position.set(10, 20, 10);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = sunLight.shadow.camera.bottom = -40;
sunLight.shadow.camera.right = sunLight.shadow.camera.top   =  40;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0xFF88CC, 0.7);
fillLight.position.set(-8, 8, -5);
scene.add(fillLight);

const backLight = new THREE.DirectionalLight(0x88AAFF, 0.5);
backLight.position.set(5, 6, -10);
scene.add(backLight);

const startGlow = new THREE.PointLight(0xFF69B4, 4.0, 22);
startGlow.position.set(0, 4, 8);
scene.add(startGlow);

// ── World ──────────────────────────────────────────────────────
const WORLD = 50; // half-size boundary (matches Car.js)

// ── Year zone config ───────────────────────────────────────────
// Year zones live on the far-Z side of the world (high positive Z)
const YEAR_ZONE_Z_MIN   = 35;
const YEAR_ZONE_STEP_X  = 16; // fixed gap between arches
const YEAR_ZONE_START_X = -(GALLERY_BY_YEAR.length - 1) * YEAR_ZONE_STEP_X / 2;

// Collidable arch pillar boxes (populated by buildYearZone)
const _archPillars = [];

// ── Build world ────────────────────────────────────────────────
function buildWorld() {
  // Ground — solid purple, no black tiles
  const groundMat = new THREE.MeshStandardMaterial({
    color:             0x5522aa,
    roughness:         0.88,
    emissive:          new THREE.Color(0x1a0050),
    emissiveIntensity: 0.35,
  });
  // Ground is 300×300 — much larger than the playable area so edges are never visible
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300, 1, 1), groundMat);
  ground.rotation.x    = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // Colored zone circles scattered around the main world (not year zone)
  const mainZones = [
    { x:   0, z:   0, r: 4,   color: 0xbb55ee }, // start zone
    { x: -16, z: -12, r: 7,   color: 0x8822cc },
    { x:  16, z: -14, r: 7,   color: 0xaa44dd },
    { x: -16, z:  10, r: 6,   color: 0x9933cc },
    { x:  16, z:   8, r: 6,   color: 0x7722bb },
    { x:   0, z: -22, r: 6,   color: 0x6611bb },
    { x: -28, z: -22, r: 7,   color: 0x5511aa },
    { x:  28, z: -22, r: 7,   color: 0x9922cc },
    { x: -28, z:   8, r: 6,   color: 0x7733bb },
    { x:  28, z:   8, r: 6,   color: 0x8833cc },
    { x:   0, z: -40, r: 6,   color: 0x6622bb },
    { x: -28, z: -40, r: 5,   color: 0x9944cc },
    { x:  28, z: -40, r: 5,   color: 0x7711aa },
  ];
  mainZones.forEach(({ x, z, r, color }) => {
    const mat = new THREE.MeshStandardMaterial({
      color, roughness: 0.9,
      emissive: new THREE.Color(color), emissiveIntensity: 0.22,
    });
    const m = new THREE.Mesh(new THREE.CircleGeometry(r, 32), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.002, z);
    scene.add(m);
  });

  // Year zone band — distinct lighter purple strip
  {
    const yzMat = new THREE.MeshStandardMaterial({
      color: 0x7733cc, roughness: 0.85,
      emissive: new THREE.Color(0x220066), emissiveIntensity: 0.4,
    });
    const yzDepth = (WORLD - YEAR_ZONE_Z_MIN + 10) * 2; // extend slightly past world edge
    const yzMesh  = new THREE.Mesh(
      new THREE.PlaneGeometry(300, yzDepth),
      yzMat,
    );
    yzMesh.rotation.x = -Math.PI / 2;
    yzMesh.position.set(0, 0.005, (YEAR_ZONE_Z_MIN + WORLD) / 2);
    scene.add(yzMesh);
  }

  // Decorative dots on the ground
  const dotColors = [0xFFD700, 0xFF69B4, 0xE6D5FF, 0x87CEEB, 0x98FF98];
  for (let i = 0; i < 90; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = 3 + Math.random() * 26;
    const x     = Math.cos(angle) * dist;
    const z     = Math.sin(angle) * dist - 4; // bias toward center/back
    const s     = 0.08 + Math.random() * 0.22;
    const mat   = new THREE.MeshBasicMaterial({
      color: dotColors[i % dotColors.length],
      transparent: true, opacity: 0.35 + Math.random() * 0.35,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s, s), mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 0.02, z);
    scene.add(m);
  }

  // World edge markers
  const edgeColors = [0xFF69B4, 0xFFD700, 0x87CEEB, 0x98FF98];
  [[-WORLD, WORLD], [WORLD, WORLD], [WORLD, -WORLD], [-WORLD, -WORLD]].forEach(([x, z], i) => {
    for (let c = 0; c < 3; c++) {
      const m = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.22, 1.5 + c * 0.4, 8),
        new THREE.MeshStandardMaterial({ color: edgeColors[(i + c) % edgeColors.length], roughness: 0.3, metalness: 0.4 }),
      );
      m.position.set(
        x + c * 0.7 * (x < 0 ? 1 : -1),
        0.9,
        z + c * 0.7 * (z < 0 ? 1 : -1),
      );
      scene.add(m);
    }
  });

  // Sky sphere — match fog colour so horizon blends seamlessly
  scene.add(new THREE.Mesh(
    new THREE.SphereGeometry(280, 16, 8),
    new THREE.MeshBasicMaterial({ color: 0x2a0060, side: THREE.BackSide }),
  ));
}
buildWorld();

// ── Year zone arch gateways ─────────────────────────────────────
// Draws a sign canvas — NO mirroring needed (used with THREE.Sprite which auto-faces camera)
function _makeCanvasSign(text, emoji, color) {
  const cv  = document.createElement('canvas');
  cv.width  = 512; cv.height = 256;
  const ctx = cv.getContext('2d');

  // Background pill
  const hex = '#' + color.toString(16).padStart(6, '0');
  ctx.fillStyle = hex + 'f0';
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(6, 6, cv.width - 12, cv.height - 12, 28);
  else ctx.rect(6, 6, cv.width - 12, cv.height - 12);
  ctx.fill();

  // White border
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 5;
  ctx.stroke();

  // Year + emoji line
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur  = 8;
  ctx.font = 'bold 82px sans-serif';
  ctx.fillText(emoji + '  ' + text, cv.width / 2, 118);

  // Sub-label
  ctx.font = '40px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.92)';
  ctx.fillText('🚗  Drive in!', cv.width / 2, 200);

  return new THREE.CanvasTexture(cv);
}


function buildYearZone(yearData, zoneIndex) {
  const cx = YEAR_ZONE_START_X + zoneIndex * YEAR_ZONE_STEP_X;
  const cz = YEAR_ZONE_Z_MIN + 8;

  const col = yearData.color;

  // Zone circle on ground
  const zoneMat = new THREE.MeshStandardMaterial({
    color: col, roughness: 0.85,
    emissive: new THREE.Color(col), emissiveIntensity: 0.3,
  });
  const zoneCircle = new THREE.Mesh(new THREE.CircleGeometry(7, 32), zoneMat);
  zoneCircle.rotation.x = -Math.PI / 2;
  zoneCircle.position.set(cx, 0.01, cz);
  scene.add(zoneCircle);

  // Arch gateway posts — also register as collidable pillars
  const postMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.3, metalness: 0.6 });
  [-2.2, 2.2].forEach(dx => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 4.5, 10), postMat);
    post.position.set(cx + dx, 2.25, YEAR_ZONE_Z_MIN);
    scene.add(post);
    _archPillars.push(new THREE.Box3(
      new THREE.Vector3(cx + dx - 0.4, 0, YEAR_ZONE_Z_MIN - 0.4),
      new THREE.Vector3(cx + dx + 0.4, 4.5, YEAR_ZONE_Z_MIN + 0.4),
    ));
  });

  // Arch crossbar
  const bar = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.4, 0.35), postMat);
  bar.position.set(cx, 4.6, YEAR_ZONE_Z_MIN);
  scene.add(bar);

  // ── Billboard sprite (always faces camera — visible from any angle/height) ──
  const spriteTex = _makeCanvasSign(yearData.year, yearData.emoji, col);
  const sprite    = new THREE.Sprite(new THREE.SpriteMaterial({ map: spriteTex, depthTest: true }));
  sprite.position.set(cx, 7.5, YEAR_ZONE_Z_MIN);  // above the arch, centred
  sprite.scale.set(5.5, 2.75, 1);
  scene.add(sprite);


  // Decorative balls on top of posts
  [-2, 2].forEach(dx => {
    const ball = new THREE.Mesh(
      new THREE.SphereGeometry(0.28, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.1, metalness: 0.9, emissive: new THREE.Color(0xFFD700), emissiveIntensity: 0.5 }),
    );
    ball.position.set(cx + dx, 4.75, YEAR_ZONE_Z_MIN);
    scene.add(ball);
  });

  // Place year photos in a tight cluster inside the zone
  yearData.photos.forEach((photoPath, pi) => {
    const angle   = (pi / yearData.photos.length) * Math.PI * 1.5 - Math.PI * 0.25;
    const radius  = 2.5 + pi * 0.5;
    const px      = cx + Math.cos(angle) * radius;
    const pz      = cz + Math.sin(angle) * radius;
    const isFlat  = pi % 3 === 0; // every 3rd is flat
    const frameIdx = 100 + zoneIndex * 10 + pi; // unique index for colour cycling

    frames.push(new PhotoFrame(
      scene, photoPath, frameIdx,
      new THREE.Vector3(px, 0, pz),
      isFlat ? 'flat' : 'standing',
      angle + Math.PI,
    ));
  });
}

// ── Photo frames — dense clusters ─────────────────────────────
//
// Clusters spread across the main world (NOT the year zone area).
// Each cluster has 3-5 frames placed close together.
// Mix of standing + flat within each cluster.

const CLUSTER_DEFS = [
  // Main area clusters — all z < YEAR_ZONE_Z_MIN (35)
  { cx:   0, cz:  14 },
  { cx: -14, cz:  10 },
  { cx:  14, cz:  10 },
  { cx: -20, cz:  -4 },
  { cx:  20, cz:  -4 },
  { cx:   0, cz: -10 },
  { cx: -14, cz: -16 },
  { cx:  14, cz: -16 },
  { cx: -28, cz: -10 },
  { cx:  28, cz: -10 },
  { cx:   0, cz: -26 },
  { cx: -20, cz: -28 },
  { cx:  20, cz: -28 },
  { cx: -36, cz:  -4 },
  { cx:  36, cz:  -4 },
  { cx: -36, cz: -24 },
  { cx:  36, cz: -24 },
  { cx:   0, cz: -40 },
];

const frames = [];
let visitedCount = 0;

function placeFrameClusters() {
  const photos = GALLERY_PHOTOS;
  if (!photos.length) return;

  let photoIdx = 0;

  CLUSTER_DEFS.forEach((cluster, ci) => {
    // 3-5 frames per cluster
    const count = 3 + (ci % 3);
    for (let fi = 0; fi < count; fi++) {
      const photo = photos[photoIdx % photos.length];
      photoIdx++;

      // Spread within cluster: ±3 units
      const angle  = (fi / count) * Math.PI * 2;
      const radius = 1.5 + Math.random() * 1.5;
      const px     = cluster.cx + Math.cos(angle) * radius + (Math.random() - 0.5);
      const pz     = cluster.cz + Math.sin(angle) * radius + (Math.random() - 0.5);

      // Alternate flat / standing: even frames are standing, every 3rd is flat
      const isFlat = fi % 3 === 2;
      const facing = angle + Math.PI + (Math.random() - 0.5) * 0.4;

      frames.push(new PhotoFrame(
        scene, photo, photoIdx,
        new THREE.Vector3(px, 0, pz),
        isFlat ? 'flat' : 'standing',
        facing,
      ));
    }
  });
}

// Build year zones + year frames, then main clusters
GALLERY_BY_YEAR.forEach((yd, i) => buildYearZone(yd, i));
placeFrameClusters();

// ── Decorative balloons ────────────────────────────────────────
const _decoBalloons = [];
function buildDecoBalloons() {
  const colors = THEME.balloonColors;
  const count  = 24;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
    const dist  = 10 + Math.random() * 18;
    const x = Math.cos(angle) * dist;
    const z = Math.sin(angle) * dist - 5;
    const col = colors[i % colors.length];

    const group = new THREE.Group();
    const bMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.42, 14, 10),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.2, metalness: 0.1 }),
    );
    bMesh.scale.y = 1.3;
    group.add(bMesh);

    const sMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 6, 6),
      new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }),
    );
    sMesh.position.set(-0.14, 0.22, 0.3);
    group.add(sMesh);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.55, 0),
      new THREE.Vector3(0.05, -1.1, 0),
      new THREE.Vector3(-0.03, -1.7, 0),
    ]);
    group.add(new THREE.Mesh(
      new THREE.TubeGeometry(curve, 6, 0.007, 4),
      new THREE.MeshStandardMaterial({ color: 0xffffff }),
    ));

    group.position.set(x, 2.5 + Math.random() * 2, z);
    group.scale.setScalar(0.7 + Math.random() * 0.5);
    scene.add(group);

    _decoBalloons.push({
      group,
      baseY:      group.position.y,
      floatSpeed: 0.3 + Math.random() * 0.3,
      floatAmp:   0.3 + Math.random() * 0.25,
      floatPhase: Math.random() * Math.PI * 2,
      swayAmp:    0.07 + Math.random() * 0.06,
    });
  }
}
buildDecoBalloons();

// ── Interactive gift boxes ─────────────────────────────────────
//
// Each gift has a bounding Box3.  When the car collides it bounces
// away and plays sparkle + pop sounds.
//
const _gifts = [];

function buildGifts() {
  const giftDefs = [
    { x: -16, z:  3,   color: 0xFF69B4, ribbon: 0xFFD700,  s: 0.9 },
    { x:  15, z: -7,   color: 0x9370DB, ribbon: 0xFF69B4,  s: 0.75 },
    { x:  -7, z:  15,  color: 0x87CEEB, ribbon: 0xFF6B6B,  s: 0.65 },
    { x:  16, z:  13,  color: 0xFFD700, ribbon: 0x9370DB,  s: 0.8 },
    { x:  -2, z: -20,  color: 0x98FF98, ribbon: 0xFF69B4,  s: 0.7 },
    { x: -22, z:  0,   color: 0xFF6B6B, ribbon: 0xFFD700,  s: 0.85 },
    { x:  22, z:  0,   color: 0xFFD700, ribbon: 0x87CEEB,  s: 0.75 },
    { x:   8, z:  16,  color: 0xFF69B4, ribbon: 0x9370DB,  s: 0.6 },
    { x: -10, z: -22,  color: 0x9370DB, ribbon: 0x98FF98,  s: 0.8 },
    { x:  10, z: -22,  color: 0x87CEEB, ribbon: 0xFF69B4,  s: 0.7 },
  ];

  giftDefs.forEach(({ x, z, color, ribbon, s }) => {
    const g      = new THREE.Group();
    const boxMat = new THREE.MeshStandardMaterial({ color, roughness: 0.6 });
    const ribMat = new THREE.MeshStandardMaterial({ color: ribbon, roughness: 0.3 });

    // Box body
    g.add(Object.assign(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), boxMat), { castShadow: true }));

    // Lid
    const lid = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.22, 1.08), boxMat);
    lid.position.y = 0.61;
    g.add(lid);

    // Ribbons
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.05, 1.02), ribMat));
    g.add(new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.05, 0.12), ribMat));

    // Bow loops
    [0, Math.PI / 2].forEach(ry => {
      const bow = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.05, 6, 14), ribMat);
      bow.position.y = 0.75;
      bow.rotation.set(Math.PI / 2, ry, 0);
      g.add(bow);
    });

    g.position.set(x, 0.5 * s, z);
    g.scale.setScalar(s);
    scene.add(g);

    const box3 = new THREE.Box3().setFromObject(g);
    _gifts.push({
      group:   g,
      box3,
      baseY:   g.position.y,
      bouncing: false,
      velY:    0,
    });
  });
}
buildGifts();

// ── Gift collision + bounce ────────────────────────────────────
function updateGifts(carBox) {
  _gifts.forEach(gift => {
    // Refresh box
    gift.box3.setFromObject(gift.group);

    if (!gift.bouncing && gift.box3.intersectsBox(carBox)) {
      gift.bouncing = true;
      gift.velY     = 0.18;
      Audio.playSound('sparkle');
      Parts.spawnSparkle(gift.group.position.x, gift.group.position.y + 1, gift.group.position.z);
      Parts.spawnSparkle(gift.group.position.x + 0.3, gift.group.position.y + 1.4, gift.group.position.z - 0.3);

      // Spin animation via GSAP
      if (window.gsap) {
        gsap.to(gift.group.rotation, {
          y: gift.group.rotation.y + Math.PI * 2,
          duration: 0.6,
          ease: 'power2.out',
        });
      }
    }

    if (gift.bouncing) {
      gift.velY -= 0.012; // gravity
      gift.group.position.y += gift.velY;
      if (gift.group.position.y <= gift.baseY) {
        gift.group.position.y = gift.baseY;
        gift.bouncing = false;
        gift.velY     = 0;
      }
    }
  });
}

// ── Ambient particles ──────────────────────────────────────────
Parts.createAmbientDust(scene);
Parts.createSparkleSystem(scene);
Parts.createConfettiCannon(scene);

// ── Car ────────────────────────────────────────────────────────
const car = new Car(scene);
car.setPosition(0, 0.3, 0);

// ── Input ──────────────────────────────────────────────────────
const inputs = { forward: false, backward: false, left: false, right: false };

const KEY_MAP = {
  ArrowUp: 'forward', ArrowDown: 'backward', ArrowLeft: 'left', ArrowRight: 'right',
  KeyW:    'forward', KeyS:      'backward', KeyA:      'left', KeyD:       'right',
};
document.addEventListener('keydown', e => { if (KEY_MAP[e.code]) { inputs[KEY_MAP[e.code]] = true;  e.preventDefault(); } });
document.addEventListener('keyup',   e => { if (KEY_MAP[e.code]) { inputs[KEY_MAP[e.code]] = false; e.preventDefault(); } });

function bindDpad(id, key) {
  const btn = document.getElementById(id);
  if (!btn) return;
  const on  = () => { inputs[key] = true;  btn.classList.add('pressed'); };
  const off = () => { inputs[key] = false; btn.classList.remove('pressed'); };
  btn.addEventListener('pointerdown',   on,  { passive: true });
  btn.addEventListener('pointerup',     off, { passive: true });
  btn.addEventListener('pointercancel', off, { passive: true });
  btn.addEventListener('pointerleave',  off, { passive: true });
}
bindDpad('dpad-up',    'forward');
bindDpad('dpad-down',  'backward');
bindDpad('dpad-left',  'left');
bindDpad('dpad-right', 'right');

// ── Music ──────────────────────────────────────────────────────
Audio.init();
Audio.startMusic();

document.getElementById('btn-music')?.addEventListener('click', () => {
  const muted = Audio.toggleMute();
  const btn   = document.getElementById('btn-music');
  if (btn) btn.textContent = muted ? '🔇' : '🎵';
});

// ── Play-again reset ───────────────────────────────────────────
document.getElementById('btn-play-again')?.addEventListener('click', () => {
  const el = document.getElementById('all-found');
  if (el) { el.style.display = 'none'; el.classList.remove('visible'); }

  frames.forEach(f => {
    f.fallen     = false;
    f.discovered = false;
    if (f.type === 'standing') {
      f.group.rotation.x = 0;
      f.group.rotation.z = 0;
      f.group.position.y = 0;
    }
  });
  car.setPosition(0, 0.3, 0);
  car.velocity = 0;
  visitedCount = 0;
});

// ── Camera state ───────────────────────────────────────────────
const _camTarget = new THREE.Vector3();

// ── Render loop ────────────────────────────────────────────────
const clock = new THREE.Clock();

(function loop() {
  requestAnimationFrame(loop);

  const elapsed = clock.getElapsedTime();

  const rawDelta = 1 / 60;
  car.update(inputs, rawDelta);
  const carPos = car.getPosition();

  // ── Third-person camera — rotates with car ───────────────
  // Place camera behind the car in its own facing direction.
  // Car "back" world direction = (sin(ry), 0, cos(ry))  [opposite of car forward]
  const carAngle = car.group.rotation.y;
  _camTarget.set(
    carPos.x + Math.sin(carAngle) * 12,
    carPos.y + 9,
    carPos.z + Math.cos(carAngle) * 12,
  );
  const snapDist  = camera.position.distanceTo(_camTarget);
  const lerpSpeed = snapDist > 40 ? 1 : 0.12;
  camera.position.lerp(_camTarget, lerpSpeed);
  camera.lookAt(carPos.x, carPos.y + 0.8, carPos.z);

  // ── Collisions ───────────────────────────────────────────
  const carBox = car.getBoundingBox();

  frames.forEach(frame => {
    if (frame.type === 'standing') {
      // Not yet falling — check initial collision
      if (!frame.fallen && frame.checkCollision(carBox)) {
        frame.fall();
        car.shake();
        Audio.playSound('confetti');
        if (!frame.discovered) {
          frame.discovered = true;
          visitedCount++;
          _checkAllFound(carPos);
        }
      }
      // Actively falling — car cannot ghost through; apply friction + push frame
      else if (frame.fallen && frame.group.rotation.x > -Math.PI / 2 + 0.08) {
        frame.box.setFromObject(frame.group);
        if (frame.box.intersectsBox(carBox)) {
          car.velocity *= 0.88; // friction drag
          // Nudge frame forward in car's travel direction
          const pushX = -Math.sin(carAngle) * Math.abs(car.velocity) * 0.25;
          const pushZ = -Math.cos(carAngle) * Math.abs(car.velocity) * 0.25;
          frame.group.position.x += pushX;
          frame.group.position.z += pushZ;
        }
      }
    } else {
      if (frame.checkFlatDiscovery(carPos.x, carPos.z)) {
        visitedCount++;
        _checkAllFound(carPos);
      }
    }

    frame.update(elapsed);
  });

  // Gift box collisions
  updateGifts(carBox);

  // Arch pillar collisions — solid, push car back
  _archPillars.forEach(pillarBox => {
    if (carBox.intersectsBox(pillarBox)) {
      car.velocity *= -0.4; // bounce back
      car.shake();
      // Nudge car away from pillar centre
      const px = (pillarBox.min.x + pillarBox.max.x) / 2;
      const pz = (pillarBox.min.z + pillarBox.max.z) / 2;
      const dx = carPos.x - px;
      const dz = carPos.z - pz;
      const len = Math.sqrt(dx * dx + dz * dz) || 1;
      car.group.position.x += (dx / len) * 0.4;
      car.group.position.z += (dz / len) * 0.4;
    }
  });

  // ── Animate balloons ─────────────────────────────────────
  _decoBalloons.forEach(b => {
    b.group.position.y = b.baseY + Math.sin(elapsed * b.floatSpeed + b.floatPhase) * b.floatAmp;
    b.group.rotation.z = Math.sin(elapsed * b.floatSpeed * 0.7 + b.floatPhase) * b.swayAmp;
  });

  // ── Particles ────────────────────────────────────────────
  Parts.updateSparkles();
  Parts.updateConfettiCannon();
  Parts.updateAmbientDust(elapsed);

  renderer.render(scene, camera);
})();

// ── All photos found ───────────────────────────────────────────
function _checkAllFound(carPos) {
  if (visitedCount < frames.length) return;
  setTimeout(() => {
    Parts.triggerConfettiCannon(carPos.x, carPos.y + 3, carPos.z);
    Audio.playSound('confetti');
    const el = document.getElementById('all-found');
    if (el) { el.style.display = 'flex'; el.classList.add('visible'); }
  }, 600);
}
