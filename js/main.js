// ============================================================
// js/main.js  —  App entry point
//   1. Populates DOM text from lib/content.js
//   2. Waits for user click on intro screen
//   3. Initialises scene, audio, particles, events
//   4. Runs the render loop
//   5. Wires up gallery button → gallery.html
// ============================================================

import * as THREE from 'three';

// Lib — content + theme
import {
  TITLE_LINE1, TITLE_LINE2, SUBTITLE,
  WISH_PROMPT, GALLERY_BTN, BIRTHDAY_WISH,
} from '../lib/content.js';

// Modules
import * as Audio     from './audio.js';
import * as Particles from './particles.js';
import * as Scene     from './scene.js';
import { initEvents } from './events.js';

// ── 1. Populate DOM text ───────────────────────────────────────
// (runs immediately, before canvas is ready)
(function populateText() {
  _setText('title-line1',   TITLE_LINE1);
  _setText('title-line2',   TITLE_LINE2);
  _setText('subtitle',      SUBTITLE);
  _setText('btn-wish',      WISH_PROMPT);
  _setText('btn-gallery',   GALLERY_BTN);
  _setText('wish-text',     BIRTHDAY_WISH);
})();

function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = text;
}

// ── 2. Intro screen — wait for user click ─────────────────────
const btnStart    = document.getElementById('btn-start');
const introScreen = document.getElementById('intro-screen');
const uiOverlay   = document.getElementById('ui');

btnStart?.addEventListener('click', _onStart, { once: true });

function _onStart() {
  // Hide intro with fade
  if (window.gsap) {
    gsap.to(introScreen, {
      opacity:  0,
      duration: 0.6,
      ease:     'power2.out',
      onComplete: () => { introScreen.style.display = 'none'; },
    });
  } else {
    introScreen.style.display = 'none';
  }

  // Show UI overlay
  uiOverlay.style.display = 'block';
  if (window.gsap) {
    gsap.fromTo(uiOverlay,
      { opacity: 0 },
      { opacity: 1, duration: 0.8, ease: 'power2.out' }
    );
  }

  // Boot the 3D app
  _boot();
}

// ── 3. Boot the app ───────────────────────────────────────────
function _boot() {
  const canvas = document.getElementById('canvas');

  // Init Three.js scene
  const { renderer, scene, camera } = Scene.initScene(canvas);

  // Init audio (must be after user interaction)
  Audio.init();
  Audio.startMusic();

  // Init particle systems (added to the same scene)
  Particles.createConfettiSystem(scene);
  Particles.createConfettiCannon(scene);
  Particles.createSparkleSystem(scene);
  Particles.createAmbientDust(scene);

  // Entry animation — cake scale-in
  _playCakeIntro();

  // Init event handlers
  initEvents({
    camera,
    scene,
    renderer,
    onBalloonPop: () => { /* balloon pop already plays sound in events.js */ },
  });

  // Gallery button
  document.getElementById('btn-gallery')?.addEventListener('click', () => {
    window.location.href = 'gallery.html';
  });

  // Start render loop
  _startLoop(renderer, scene, camera);
}

// ── Intro cake animation ───────────────────────────────────────
// CSS sets opacity:0 on each title child; GSAP reveals them.
function _playCakeIntro() {
  if (!window.gsap) {
    // Fallback: show everything immediately
    ['.title-line1','.title-line2','.subtitle','.btn-row'].forEach(s => {
      document.querySelectorAll(s).forEach(el => { el.style.opacity = 1; });
    });
    return;
  }

  gsap.fromTo('.title-line1', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'back.out(1.4)', delay: 0.2 });
  gsap.fromTo('.title-line2', { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.9, ease: 'back.out(1.4)', delay: 0.45 });
  gsap.fromTo('.subtitle',    { y: 15, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'power2.out',    delay: 0.7 });
  gsap.fromTo('.btn-row',     { y: 22, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'back.out(1.4)', delay: 0.9 });
}

// ── 4. Render loop ─────────────────────────────────────────────
const _clock = new THREE.Clock();

function _startLoop(renderer, scene, camera) {
  function loop() {
    requestAnimationFrame(loop);

    const elapsed = _clock.getElapsedTime();
    const delta   = _clock.getDelta(); // note: getDelta() must be after getElapsedTime()

    // Animate 3D scene objects
    Scene.animateScene(elapsed);
    Scene.animateCamera(elapsed);

    // Animate particle systems
    Particles.updateConfetti(elapsed);
    Particles.updateConfettiCannon();
    Particles.updateSparkles();
    Particles.updateAmbientDust(elapsed);

    // Render
    renderer.render(scene, camera);
  }

  loop();
}
