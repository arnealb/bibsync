// One-off: generate PWA icons from an inline SVG. Run: node scripts/gen-icons.mjs
import sharp from "sharp";

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#4f46e5"/>
  <text x="50%" y="52%" text-anchor="middle" dominant-baseline="middle"
        font-family="Arial, Helvetica, sans-serif" font-size="300" font-weight="700"
        fill="#ffffff">B</text>
</svg>`;

const buffer = Buffer.from(svg);
const targets = [
  ["public/icon-192.png", 192],
  ["public/icon-512.png", 512],
  ["public/apple-icon.png", 180],
];

for (const [file, size] of targets) {
  await sharp(buffer).resize(size, size).png().toFile(file);
  console.log("wrote", file);
}
