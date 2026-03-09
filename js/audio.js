// ============================================================
// js/audio.js  —  Howler.js audio manager
// Howl + Howler are globals loaded via <script> in HTML.
// Sound files live in assets/sounds/ — paths come from lib/sounds.js
// The site works fine with no sound files; errors are swallowed.
// ============================================================

import { SOUNDS } from '../lib/sounds.js';

// ── Internal state ────────────────────────────────────────────
let _muted   = false;
let _music   = null;   // background music Howl instance
let _sfx     = {};     // map of name → Howl instance

// Volume levels
const MUSIC_VOL = 0.28;
const SFX_VOL   = 0.70;

// ── Build one Howl safely (swallows load errors gracefully) ──
function _makeHowl(src, loop = false, volume = SFX_VOL) {
  try {
    return new Howl({
      src:      [src],
      loop,
      volume,
      html5:    false,     // use Web Audio for low latency
      onloaderror: (_id, err) => {
        console.warn(`[audio] Could not load: ${src}`, err);
      },
    });
  } catch (e) {
    console.warn('[audio] Howl creation failed:', e);
    return null;
  }
}

// ── Initialise all sounds ─────────────────────────────────────
// Call this ONCE after the user's first click (to satisfy
// browser autoplay policies). main.js calls init() on start.
export function init() {
  _music = _makeHowl(SOUNDS.music, true, MUSIC_VOL);

  _sfx = {
    confetti: _makeHowl(SOUNDS.confetti, false, SFX_VOL),
    pop:      _makeHowl(SOUNDS.pop,      false, SFX_VOL),
    sparkle:  _makeHowl(SOUNDS.sparkle,  false, SFX_VOL * 0.7),
    thud:     _makeHowl(SOUNDS.thud,     false, SFX_VOL),
  };
}

// ── Start background music ─────────────────────────────────────
export function startMusic() {
  if (!_music || _muted) return;
  if (!_music.playing()) _music.play();
}

// ── Stop / pause background music ─────────────────────────────
export function stopMusic() {
  if (_music && _music.playing()) _music.pause();
}

// ── Play a one-shot sound effect ──────────────────────────────
// name: 'confetti' | 'pop' | 'sparkle' | 'thud'
export function playSound(name) {
  if (_muted) return;
  const h = _sfx[name];
  if (!h) return;
  // Stop previous instance so rapid hits don't stack infinitely
  h.stop();
  h.play();
}

// ── Toggle mute (music + SFX) ─────────────────────────────────
// Returns new muted state (true = now muted)
export function toggleMute() {
  _muted = !_muted;
  Howler.mute(_muted);   // mutes ALL Howler sounds globally
  if (!_muted && _music && !_music.playing()) {
    _music.play();
  }
  return _muted;
}

// ── Query helpers ──────────────────────────────────────────────
export function isMuted()        { return _muted; }
export function isMusicPlaying() { return _music ? _music.playing() : false; }
