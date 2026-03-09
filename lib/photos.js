// ============================================================
// ✏️  lib/photos.js  — ADD YOUR GALLERY PHOTOS HERE
//
//  TWO SECTIONS:
//
//  1. GALLERY_PHOTOS — photos scattered freely across the world
//     Put your general photo files here.
//
//  2. GALLERY_BY_YEAR — photos grouped by year, shown in the
//     "Year Zone" area (far side of the world).
//     Add a new object per year with:
//       year:   the year label shown on the arch gateway
//       emoji:  displayed on the arch sign
//       color:  hex color for that year's zone circle
//       photos: array of file paths for that year
//
//  All photo files go in:  assets/photos/
//  Supported formats: .jpg  .jpeg  .png  .webp
// ============================================================

// General world photos (scattered everywhere)
export const GALLERY_PHOTOS = [
  'assets/photos/photo1.jpg',
  'assets/photos/photo2.jpg',
  'assets/photos/photo3.jpg',
  'assets/photos/photo4.jpg',
  'assets/photos/photo5.jpg',
  // Add more ↓
  // 'assets/photos/photo6.jpg',
  // 'assets/photos/photo7.jpg',
];

// Year-zone photos (grouped far side of world)
export const GALLERY_BY_YEAR = [
  {
    year:   'Year 1',
    emoji:  '🍼',
    color:  0xFF69B4,   // pink
    photos: [
      'assets/photos/year1_a.jpg',
      'assets/photos/year1_b.jpg',
      'assets/photos/year1_c.jpg',
    ],
  },
  {
    year:   'Year 2',
    emoji:  '🎂',
    color:  0x9370DB,   // purple
    photos: [
      'assets/photos/year2_a.jpg',
      'assets/photos/year2_b.jpg',
      'assets/photos/year2_c.jpg',
    ],
  },
  {
    year:   'Year 3',
    emoji:  '⭐',
    color:  0xFFD700,   // gold
    photos: [
      'assets/photos/year3_a.jpg',
      'assets/photos/year3_b.jpg',
      'assets/photos/year3_c.jpg',
    ],
  },
  // Add more years ↓
  // {
  //   year: 'Year 4', emoji: '🌟', color: 0x87CEEB,
  //   photos: ['assets/photos/year4_a.jpg'],
  // },
];
