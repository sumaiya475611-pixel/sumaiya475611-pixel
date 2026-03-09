// ============================================================
// ✏️  lib/theme.js  — CHANGE THE LOOK HERE
//     Edit colours and fonts to restyle the whole site.
// ============================================================

export const THEME = {
  // ── CSS colour strings (used in HTML / CSS overlays) ───────
  primaryPink:  '#FF69B4',
  deepPink:     '#FF1493',
  purple:       '#9370DB',
  darkPurple:   '#2D1B69',
  gold:         '#FFD700',
  lavender:     '#E6D5FF',
  skyBlue:      '#87CEEB',
  mintGreen:    '#98FF98',
  peach:        '#FFB6D9',
  cream:        '#FFFAF0',

  // ── Three.js hex numbers (0x format for renderer/lights) ───
  bgColor:      0x1a0a2e,   // deep night-purple background
  ambientColor: 0xE6D5FF,
  light1Color:  0xFF69B4,
  light2Color:  0xFFD700,

  // ── Balloon colour cycle ────────────────────────────────────
  balloonColors: [
    0xFF69B4,  // pink
    0xFFD700,  // gold
    0x87CEEB,  // sky blue
    0x98FF98,  // mint
    0xFF6B6B,  // coral
    0x9370DB,  // purple
    0xFFB347,  // peach-orange
    0xE6D5FF,  // lavender
  ],

  // ── Confetti colour palette ─────────────────────────────────
  confettiColors: [
    '#FF69B4', '#FFD700', '#87CEEB',
    '#98FF98', '#FF6B6B', '#9370DB',
    '#FFB6D9', '#FFFAF0',
  ],

  // ── Google Fonts ────────────────────────────────────────────
  fontTitle:   'Fredoka One',   // big headings
  fontDisplay: 'Rubik Bubbles', // name / age
  fontBody:    'Comfortaa',     // body text, buttons
};
