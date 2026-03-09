// ============================================================
// js/Car.js  —  Procedural pink princess car (no GLB needed)
//   Built entirely from BoxGeometry + CylinderGeometry.
//   Exposes a simple update(inputs, delta) method for driving.
// ============================================================

import * as THREE from 'three';

// ── Driving constants ──────────────────────────────────────────
const MAX_SPEED     =  0.18;   // units per frame
const ACCELERATION  =  0.012;
const DECELERATION  =  0.018;  // natural friction
const TURN_SPEED    =  0.045;  // radians per frame at full speed
const ROAD_HALF_W   = 50.0;   // half-size of open world boundary

export class Car {
  constructor(scene) {
    this.group    = new THREE.Group();
    this.velocity = 0;   // current forward speed (negative = reverse)
    this.scene    = scene;

    this._buildMesh();
    this._buildWheels();
    this._buildWindshield();
    this._buildLights();

    scene.add(this.group);

    // Bounding box (updated each frame for collision)
    this.box = new THREE.Box3();
  }

  // ── Build car body ─────────────────────────────────────────
  _buildMesh() {
    const bodyMat = new THREE.MeshStandardMaterial({
      color:     0xFF69B4,  // hot pink
      roughness: 0.25,
      metalness: 0.45,
    });

    // Main body
    const bodyGeo  = new THREE.BoxGeometry(1.4, 0.55, 2.6);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.35;
    bodyMesh.castShadow = true;
    this.group.add(bodyMesh);

    // Cabin (top, smaller)
    const cabinGeo  = new THREE.BoxGeometry(1.1, 0.48, 1.4);
    const cabinMesh = new THREE.Mesh(cabinGeo, bodyMat);
    cabinMesh.position.set(0, 0.84, 0.1);
    cabinMesh.castShadow = true;
    this.group.add(cabinMesh);

    // Front bumper
    const bumpGeo  = new THREE.BoxGeometry(1.42, 0.22, 0.18);
    const bumpMat  = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.3, metalness: 0.6 });
    const bumpMesh = new THREE.Mesh(bumpGeo, bumpMat);
    bumpMesh.position.set(0, 0.18, -1.35);
    this.group.add(bumpMesh);

    // Rear bumper
    const rBump = bumpMesh.clone();
    rBump.position.z = 1.35;
    this.group.add(rBump);

    // Star decoration on hood
    const starMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.1, metalness: 0.8, emissive: new THREE.Color(0xFFD700), emissiveIntensity: 0.3 });
    const starGeo = new THREE.OctahedronGeometry(0.12);
    const starMesh = new THREE.Mesh(starGeo, starMat);
    starMesh.position.set(0, 0.65, -0.7);
    starMesh.rotation.y = Math.PI / 4;
    this.group.add(starMesh);
    this._star = starMesh;

    // Crown on top
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.15, metalness: 0.85 });
    const crownBase = new THREE.CylinderGeometry(0.22, 0.22, 0.1, 5);
    const crownMesh = new THREE.Mesh(crownBase, crownMat);
    crownMesh.position.set(0, 1.12, 0.1);
    this.group.add(crownMesh);

    // Crown spikes (3 small cones)
    for (let s = 0; s < 3; s++) {
      const angle = (s / 3) * Math.PI * 2;
      const sGeo  = new THREE.ConeGeometry(0.055, 0.18, 5);
      const sMesh = new THREE.Mesh(sGeo, crownMat);
      sMesh.position.set(Math.cos(angle) * 0.16, 1.24, 0.1 + Math.sin(angle) * 0.16);
      this.group.add(sMesh);
    }

    // Exhaust pipe (cute tiny cylinder)
    const exGeo  = new THREE.CylinderGeometry(0.04, 0.04, 0.25, 8);
    const exMat  = new THREE.MeshStandardMaterial({ color: 0xaaaaaa, roughness: 0.5, metalness: 0.8 });
    const exMesh = new THREE.Mesh(exGeo, exMat);
    exMesh.rotation.x = Math.PI / 2;
    exMesh.position.set(-0.45, 0.18, 1.48);
    this.group.add(exMesh);
  }

  // ── Wheels ─────────────────────────────────────────────────
  _buildWheels() {
    this._wheels = [];

    const tyreMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
    const rimMat  = new THREE.MeshStandardMaterial({ color: 0xFF69B4, roughness: 0.2, metalness: 0.7 });

    const positions = [
      { x: -0.78, z: -0.85 }, // front-left
      { x:  0.78, z: -0.85 }, // front-right
      { x: -0.78, z:  0.85 }, // rear-left
      { x:  0.78, z:  0.85 }, // rear-right
    ];

    positions.forEach(({ x, z }) => {
      const group = new THREE.Group();

      // Tyre
      const tGeo  = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 16);
      const tMesh = new THREE.Mesh(tGeo, tyreMat);
      tMesh.rotation.z = Math.PI / 2;
      group.add(tMesh);

      // Rim
      const rGeo  = new THREE.CylinderGeometry(0.18, 0.18, 0.24, 12);
      const rMesh = new THREE.Mesh(rGeo, rimMat);
      rMesh.rotation.z = Math.PI / 2;
      group.add(rMesh);

      // Hub cap
      const hGeo  = new THREE.CylinderGeometry(0.06, 0.06, 0.26, 8);
      const hMat  = new THREE.MeshStandardMaterial({ color: 0xFFD700, roughness: 0.1, metalness: 0.9 });
      const hMesh = new THREE.Mesh(hGeo, hMat);
      hMesh.rotation.z = Math.PI / 2;
      group.add(hMesh);

      group.position.set(x, 0.3, z);
      this.group.add(group);
      this._wheels.push(group);
    });
  }

  // ── Windshield ─────────────────────────────────────────────
  _buildWindshield() {
    const glassMat = new THREE.MeshStandardMaterial({
      color:       0x88CCFF,
      roughness:   0.0,
      metalness:   0.0,
      transparent: true,
      opacity:     0.45,
    });

    // Front windshield
    const fGeo  = new THREE.BoxGeometry(1.0, 0.38, 0.06);
    const fMesh = new THREE.Mesh(fGeo, glassMat);
    fMesh.position.set(0, 0.84, -0.6);
    fMesh.rotation.x = 0.25;
    this.group.add(fMesh);

    // Side windows (left + right)
    [-0.56, 0.56].forEach(x => {
      const sGeo  = new THREE.BoxGeometry(0.06, 0.32, 1.1);
      const sMesh = new THREE.Mesh(sGeo, glassMat);
      sMesh.position.set(x, 0.84, 0.12);
      this.group.add(sMesh);
    });

    // Rear window
    const rGeo  = new THREE.BoxGeometry(1.0, 0.38, 0.06);
    const rMesh = new THREE.Mesh(rGeo, glassMat);
    rMesh.position.set(0, 0.84, 0.82);
    rMesh.rotation.x = -0.2;
    this.group.add(rMesh);
  }

  // ── Head / tail lights ─────────────────────────────────────
  _buildLights() {
    // Headlights (white)
    const hlMat = new THREE.MeshStandardMaterial({
      color: 0xFFFFCC,
      emissive: new THREE.Color(0xFFFFAA),
      emissiveIntensity: 1.5,
    });
    [-0.48, 0.48].forEach(x => {
      const hGeo  = new THREE.BoxGeometry(0.22, 0.12, 0.06);
      const hMesh = new THREE.Mesh(hGeo, hlMat);
      hMesh.position.set(x, 0.38, -1.33);
      this.group.add(hMesh);
    });

    // Tail lights (red)
    const tlMat = new THREE.MeshStandardMaterial({
      color: 0xFF2200,
      emissive: new THREE.Color(0xFF1100),
      emissiveIntensity: 1.2,
    });
    [-0.48, 0.48].forEach(x => {
      const tGeo  = new THREE.BoxGeometry(0.22, 0.12, 0.06);
      const tMesh = new THREE.Mesh(tGeo, tlMat);
      tMesh.position.set(x, 0.38, 1.33);
      this.group.add(tMesh);
    });

    // Point light for headlamp glow
    const glow = new THREE.PointLight(0xFFEEBB, 1.2, 5);
    glow.position.set(0, 0.4, -1.6);
    this.group.add(glow);
  }

  // ── update — called every frame ───────────────────────────
  // inputs: { forward, backward, left, right }  (booleans)
  update(inputs, delta) {
    const dt = Math.min(delta, 0.05); // clamp huge deltas

    // Acceleration
    if (inputs.forward) {
      this.velocity = Math.max(-MAX_SPEED,
        Math.min(MAX_SPEED, this.velocity + ACCELERATION));
    } else if (inputs.backward) {
      this.velocity = Math.max(-MAX_SPEED * 0.6,
        Math.min(MAX_SPEED, this.velocity - ACCELERATION));
    } else {
      // Friction
      if (Math.abs(this.velocity) < DECELERATION) {
        this.velocity = 0;
      } else {
        this.velocity -= Math.sign(this.velocity) * DECELERATION;
      }
    }

    // Steering (only when moving)
    const speedFactor = Math.abs(this.velocity) / MAX_SPEED;
    if (speedFactor > 0.05) {
      const dir = Math.sign(this.velocity);
      if (inputs.left)  this.group.rotation.y += TURN_SPEED * speedFactor * dir;
      if (inputs.right) this.group.rotation.y -= TURN_SPEED * speedFactor * dir;
    }

    // Move forward in facing direction
    const dx = -Math.sin(this.group.rotation.y) * this.velocity;
    const dz = -Math.cos(this.group.rotation.y) * this.velocity;
    this.group.position.x += dx;
    this.group.position.z += dz;

    // Clamp to open world boundary
    this.group.position.x = Math.max(-ROAD_HALF_W, Math.min(ROAD_HALF_W, this.group.position.x));
    this.group.position.z = Math.max(-ROAD_HALF_W, Math.min(ROAD_HALF_W, this.group.position.z));

    // Spin wheels based on velocity
    const wheelSpin = this.velocity * 0.8;
    this._wheels.forEach(w => { w.rotation.x += wheelSpin; });

    // Spin star decoration
    if (this._star) this._star.rotation.y += 0.04;

    // Update bounding box for collision detection
    this.box.setFromObject(this.group);
  }

  // ── Public helpers ─────────────────────────────────────────
  getPosition()    { return this.group.position; }
  getBoundingBox() { return this.box; }

  // Place car at world position
  setPosition(x, y, z) { this.group.position.set(x, y, z); }

  // Shake car (on collision)
  shake() {
    if (!window.gsap) return;
    gsap.to(this.group.position, {
      x: this.group.position.x + (Math.random() - 0.5) * 0.3,
      duration: 0.08,
      ease:     'power1.inOut',
      yoyo:     true,
      repeat:   3,
    });
  }
}
