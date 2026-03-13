// ============================================================
// js/PhotoFrame.js  —  Photo frame for open-world gallery
//
//  Two types:
//    'standing' — upright panel scattered in the world.
//                 Car drives into it → GSAP topple + thud sound.
//    'flat'     — photo lying flat on the ground.
//                 Car drives over it → soft sparkle discovery.
//                 No collision — car passes over freely.
//
// ============================================================

import * as THREE from 'three';
import { playSound }   from './audio.js';
import { spawnSparkle } from './particles.js';

// ── Shared constants ───────────────────────────────────────────
const FRAME_W  = 3.2;   // width  (standing) / depth (flat)
const FRAME_H  = 4.0;   // height (standing) / length (flat)
const BORDER   = 0.2;   // frame border thickness

// Each fallen frame gets a slightly higher y so later falls always
// render on top of earlier falls — no z-fighting between stacked frames.
let _fallOrder = 0;

const FRAME_COLORS = [
  0xFF69B4, 0xFFD700, 0x87CEEB, 0x98FF98,
  0xFF6B6B, 0x9370DB, 0xFFB347, 0xE6D5FF,
];

// Fallback canvas texture when image missing
function _makeFallback(index) {
  const palettes = [
    ['#FF69B4','#ff99cc'], ['#FFD700','#fff0aa'], ['#87CEEB','#c8eeff'],
    ['#98FF98','#ccffcc'], ['#9370DB','#ccaaff'],
  ];
  const [a, b] = palettes[index % palettes.length];
  const cv = document.createElement('canvas');
  cv.width = 256; cv.height = 320;
  const ctx = cv.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 256, 320);
  g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 320);
  ctx.font = '72px serif'; ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.fillText('📷', 128, 180);
  return new THREE.CanvasTexture(cv);
}

// ── PhotoFrame class ──────────────────────────────────────────
export class PhotoFrame {
  /**
   * @param {THREE.Scene}    scene
   * @param {string}         photoPath
   * @param {number}         index       colour cycling index
   * @param {THREE.Vector3}  position    world position
   * @param {'standing'|'flat'} type
   * @param {number}         facingAngle (standing) rotation.y to face camera approach
   */
  constructor(scene, photoPath, index, position, type = 'standing', facingAngle = 0) {
    this.scene       = scene;
    this.index       = index;
    this.type        = type;
    this.fallen      = false;
    this.discovered  = false;   // true once car has visited

    this.group = new THREE.Group();
    this.group.position.copy(position);
    // 'YXZ' order: Ry(facing) applied first, then Rx(fall).
    // This ensures world y when fallen = local z, independent of facingAngle.
    // With default 'XYZ', Rx applies after Ry which flips z-sign for some facingAngles,
    // making the front face land underground.
    this.group.rotation.order = 'YXZ';

    if (type === 'standing') {
      this.group.rotation.y = facingAngle;
      this._buildStanding(photoPath, index);
    } else {
      this._buildFlat(photoPath, index);
    }

    scene.add(this.group);
    this.box = new THREE.Box3().setFromObject(this.group);
  }

  // ── STANDING frame ─────────────────────────────────────────
  //
  // PIVOT DESIGN: group origin (local y=0) = ground level (base of frame).
  // All geometry is shifted up so the bottom sits at y=0.
  // This means the fall rotation (around local X) pivots at the ground —
  // the base never moves underground during the animation.
  //
  _buildStanding(photoPath, index) {
    const col      = FRAME_COLORS[index % FRAME_COLORS.length];
    const frameMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: 0.25 });

    // All local Y positions are offset by +FRAME_H/2 so local y=0 is the base.
    const BY = FRAME_H / 2; // base offset = 1.4

    // Border pieces: top / bottom / left / right
    // Left/right span the inner height only (no corners) so top/bottom cap the ends.
    // This prevents corner z-fighting between overlapping pieces.
    // z offset: back face at z=0 so no underground clipping when fallen.
    // Top/bottom sit at z=0.06 (slightly in front of left/right at z=0.05)
    // so they always win the depth test at the corner edges.
    const innerH = FRAME_H - BORDER * 2; // height of side strips minus corner caps
    const borders = [
      { w: FRAME_W,  h: BORDER,  x: 0,                         y: BY + FRAME_H / 2 - BORDER / 2, z: 0.05 }, // top
      { w: FRAME_W,  h: BORDER,  x: 0,                         y: BY - FRAME_H / 2 + BORDER / 2, z: 0.05 }, // bottom
      { w: BORDER,   h: innerH,  x: -FRAME_W / 2 + BORDER / 2, y: BY,                            z: 0.05 }, // left
      { w: BORDER,   h: innerH,  x:  FRAME_W / 2 - BORDER / 2, y: BY,                            z: 0.05 }, // right
    ];
    borders.forEach(({ w, h, x, y, z }) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.1), frameMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      this.group.add(m);
    });

    // Photo plane — centred on frame, shifted up by BY
    this._addPhotoPlane(photoPath, index,
      FRAME_W - BORDER * 2, FRAME_H - BORDER * 2,
      new THREE.Vector3(0, BY, 0.10),
      'vertical'
    );

    // Star on top — offset in local Z so when frame falls flat,
    // star center maps to world y=0.22 (vertices stay above ground).
    this._addStar(new THREE.Vector3(0, FRAME_H + 0.2, 0.22));
  }

  // ── FLAT frame (lying on ground) ───────────────────────────
  _buildFlat(photoPath, index) {
    const col      = FRAME_COLORS[index % FRAME_COLORS.length];
    const frameMat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.15 });

    // Flat frame sits clearly above ground circles (circles at y=0.01).
    // Group at y=0.10 so border bottom is at y=0.06 — well above any circle.
    this.group.position.y = 0.10;

    // Border strips (now acting as edges of the horizontal frame)
    const borders = [
      { axis: 'z', w: FRAME_W,  d: BORDER,  ox: 0,                       oz: -FRAME_H / 2 + BORDER / 2 },
      { axis: 'z', w: FRAME_W,  d: BORDER,  ox: 0,                       oz:  FRAME_H / 2 - BORDER / 2 },
      { axis: 'x', w: BORDER,   d: FRAME_H, ox: -FRAME_W / 2 + BORDER / 2, oz: 0 },
      { axis: 'x', w: BORDER,   d: FRAME_H, ox:  FRAME_W / 2 - BORDER / 2, oz: 0 },
    ];
    borders.forEach(({ w, d, ox, oz }) => {
      const geo = new THREE.BoxGeometry(w, 0.08, d);
      const m   = new THREE.Mesh(geo, frameMat);
      m.position.set(ox, 0, oz);
      this.group.add(m);
    });

    // Photo plane lying flat (PlaneGeometry, faces up)
    this._addPhotoPlane(photoPath, index,
      FRAME_W - BORDER * 2, FRAME_H - BORDER * 2,
      new THREE.Vector3(0, 0.06, 0),
      'horizontal'
    );

    // Small stars at corners as decoration
    [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx, sz]) => {
      const starMat = new THREE.MeshStandardMaterial({
        color: 0xFFD700, roughness: 0.1, metalness: 0.8,
        emissive: new THREE.Color(0xFFD700), emissiveIntensity: 0.5,
      });
      const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), starMat);
      star.position.set(sx * FRAME_W * 0.55, 0.12, sz * FRAME_H * 0.55);
      this.group.add(star);
    });
  }

  // ── Shared: load photo texture onto a plane ────────────────
  _addPhotoPlane(photoPath, index, w, h, offset, orientation) {
    const geo = orientation === 'horizontal'
      ? new THREE.PlaneGeometry(w, h)
      : new THREE.PlaneGeometry(w, h);

    const fallback = _makeFallback(index);
    const mat = new THREE.MeshStandardMaterial({
      map: fallback, roughness: 0.5, metalness: 0.0, side: THREE.DoubleSide,
      // Shift depth slightly so photo renders in front of coplanar border boxes
      polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4,
    });

    new THREE.TextureLoader().load(
      photoPath,
      (tex) => {
        tex.colorSpace  = THREE.SRGBColorSpace;
        tex.anisotropy  = PhotoFrame.maxAnisotropy || 8;
        tex.minFilter   = THREE.LinearMipmapLinearFilter;
        tex.magFilter   = THREE.LinearFilter;
        mat.map = tex;
        mat.needsUpdate = true;
      },
      undefined,
      () => { /* keep fallback */ }
    );

    const mesh = new THREE.Mesh(geo, mat);
    if (orientation === 'horizontal') {
      mesh.rotation.x = -Math.PI / 2;
    }
    mesh.position.copy(offset);
    mesh.userData.isPhotoPlane = true;
    mesh.userData.photoPath    = photoPath;
    this.group.add(mesh);
  }

  // ── Shared: decorative golden star ────────────────────────
  _addStar(pos) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xFFD700, roughness: 0.1, metalness: 0.8,
      emissive: new THREE.Color(0xFFD700), emissiveIntensity: 0.4,
    });
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.16), mat);
    star.position.copy(pos);
    star.rotation.y = Math.PI / 4;
    this.group.add(star);
    this._topStar = star;
  }

  // ── Standing: topple on collision ─────────────────────────
  // Group pivot IS the base (local y=0 = ground level, geometry shifted up by FRAME_H/2).
  // Fall is pure rotation.x = -PI/2 — base stays at y=0, zero underground clipping.
  // rotation.x = -PI/2 → local +Z maps to world +Y → photo lands FACE-UP.
  fall() {
    if (this.type !== 'standing' || this.fallen) return;
    this.fallen          = true;
    this.discovered      = true;
    this.group.position.y = 0;   // guarantee pivot is at ground level
    this.group.rotation.z = 0;   // kill idle sway immediately
    playSound('thud');

    if (window.gsap) {
      gsap.to(this.group.rotation, {
        x:        -Math.PI / 2,
        duration: 0.6,
        ease:     'power3.in',
        onComplete: () => {
          // Each fallen frame sits 5 mm higher than the previous —
          // later falls always render on top, no z-fighting between stacked frames.
          this.group.position.y = 0.02 + (_fallOrder++) * 0.002;
          // Small settle bounce
          gsap.to(this.group.rotation, {
            x: -Math.PI / 2 + 0.06,
            duration: 0.15, ease: 'power1.out', yoyo: true, repeat: 1,
          });
        },
      });
    } else {
      this.group.rotation.x = -Math.PI / 2;
      this.group.position.y = 0.02 + (_fallOrder++) * 0.002;
    }

    // Burst of sparkles at frame centre
    const wp = new THREE.Vector3();
    this.group.getWorldPosition(wp);
    spawnSparkle(wp.x, wp.y + 1, wp.z);
    spawnSparkle(wp.x + 0.4, wp.y + 1.5, wp.z - 0.3);
  }

  // ── Flat: discover when car is close ──────────────────────
  // Returns true first time the car enters the flat frame zone
  checkFlatDiscovery(carX, carZ) {
    if (this.type !== 'flat' || this.discovered) return false;
    const lx = Math.abs(carX - this.group.position.x);
    const lz = Math.abs(carZ - this.group.position.z);
    if (lx < FRAME_W / 2 + 0.6 && lz < FRAME_H / 2 + 0.6) {
      this.discovered = true;
      // Gentle discovery sparkle from ground level
      spawnSparkle(this.group.position.x, 0.5, this.group.position.z);
      spawnSparkle(this.group.position.x + 0.5, 0.8, this.group.position.z + 0.5);
      playSound('sparkle');
      return true;
    }
    return false;
  }

  // ── Standing: collision check with car box ─────────────────
  checkCollision(carBox) {
    if (this.type !== 'standing' || this.fallen) return false;
    this.box.setFromObject(this.group);
    return this.box.intersectsBox(carBox);
  }

  // ── Per-frame animation ────────────────────────────────────
  update(time) {
    if (this._topStar) {
      this._topStar.rotation.y = time * 1.4;
    }
    if (this.type === 'standing' && !this.fallen) {
      // Subtle idle sway (only while upright — don't overwrite GSAP fall)
      this.group.rotation.z = Math.sin(time * 0.6 + this.index * 0.8) * 0.018;
    } else if (this.type === 'standing' && this.fallen) {
      // Keep idle sway zeroed after fall so GSAP animation holds
      this.group.rotation.z = 0;
    }
    // Corner stars on flat frames
    if (this.type === 'flat') {
      this.group.children.forEach((c, i) => {
        if (c.geometry && c.geometry.type === 'OctahedronGeometry') {
          c.rotation.y = time * 1.2 + i;
        }
      });
    }
  }

  dispose() { this.scene.remove(this.group); }
}
