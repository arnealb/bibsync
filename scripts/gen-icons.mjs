// Generates the app icons: a black "B" with retro flames behind it.
// Run: node scripts/gen-icons.mjs
import sharp from "sharp";

// A layered retro flame (red → orange → yellow), with a bold black B on top.
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="38%" r="80%">
      <stop offset="0%" stop-color="#222222"/>
      <stop offset="100%" stop-color="#000000"/>
    </radialGradient>
    <path id="flame" d="M256 80
      C 286 170, 350 200, 322 286
      C 360 270, 384 326, 356 372
      C 398 356, 420 420, 384 452
      C 416 482, 300 500, 256 472
      C 212 500, 96 482, 128 452
      C 92 420, 114 356, 156 372
      C 128 326, 152 270, 190 286
      C 162 200, 226 170, 256 80 Z"/>
  </defs>

  <rect width="512" height="512" fill="url(#bg)"/>

  <g transform="translate(0 14)">
    <use href="#flame" fill="#c81d11"/>
    <use href="#flame" fill="#f77f00"
      transform="translate(256 472) scale(0.72) translate(-256 -472)"/>
    <use href="#flame" fill="#ffd23f"
      transform="translate(256 472) scale(0.44) translate(-256 -472)"/>
  </g>

  <text x="50%" y="53%" text-anchor="middle" dominant-baseline="middle"
    font-family="'Arial Black', Arial, Helvetica, sans-serif" font-size="300"
    font-weight="900" fill="#ededed">B</text>
</svg>`;

const buffer = Buffer.from(svg);
const targets = [
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["src/app/icon.png", 256],
  ["src/app/apple-icon.png", 180],
];

for (const [file, size] of targets) {
  await sharp(buffer).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}
