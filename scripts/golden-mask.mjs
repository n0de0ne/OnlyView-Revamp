/**
 * Region masks for the "living photograph" golden-hour scene.
 *
 * The scene animates the villa's own photo (night/night-01.webp, the sun on
 * the hills seen from the pool). The shader needs to know where the sky,
 * the sea, the pool and the vegetation are, so this script rasterises four
 * hand-traced polygons (coordinates in a 1200×900 frame of that photo) into
 * one RGBA PNG:  R = sky (0.5 on the umbrella canopy) · G = sea · B = pool · A = vegetation.
 *
 *   node scripts/golden-mask.mjs            → public/media/golden/mask-night-01.png
 *   node scripts/golden-mask.mjs --preview  → also writes a tinted overlay to check the tracing
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const W = 1200;
const H = 900;
const OUT = 900; // mask width; the edges are soft anyway
const PHOTO = "public/media/photos/night/night-01.webp";
const DEST = "public/media/golden/mask-night-01.png";

// the ridge line of the hills across the bay, left to right
const RIDGE = [
  [0, 396], [60, 392], [120, 402], [170, 425], [220, 442], [290, 440], [350, 446],
  [420, 447], [500, 440], [560, 441], [620, 444], [660, 440], [720, 448], [790, 454],
  [860, 456], [930, 452], [960, 449], [1000, 457], [1100, 460], [1200, 462],
];
// the foot of the hills, where the water starts, left to right
const BASE = [
  [0, 471], [100, 470], [160, 466], [175, 462], [300, 462], [500, 460], [700, 461], [800, 462],
  [900, 462], [950, 461], [1000, 464], [1100, 467], [1200, 470],
];
// where the water ends: tree tops and the terrace, left to right
const SHORE = [
  [1200, 506], [1110, 500], [1060, 476], [1000, 470], [980, 472], [945, 504], [900, 520],
  [830, 522], [760, 526], [700, 522], [650, 520], [590, 502], [562, 456], [400, 452],
  [380, 458], [340, 476], [300, 490], [230, 506], [150, 516], [80, 522], [0, 520],
];
// the umbrella canopy and its pole, cut out of sky and sea
const CANOPY = [[762, 400], [832, 344], [1150, 378], [1146, 428], [900, 434]];
const POLE = [[797, 336], [813, 336], [813, 625], [797, 625]];
// the infinity pool
const POOL = [[0, 599], [692, 599], [852, 850], [0, 850]];
// the greenery between the water and the pool, and the trees on the right
const VEG = [
  [0, 522], [80, 524], [150, 518], [230, 508], [300, 492], [340, 478], [380, 460], [400, 454],
  [562, 458], [590, 504], [650, 522], [700, 524], [780, 528], [780, 578], [560, 580], [300, 574], [0, 574],
];
const VEG_RIGHT = [
  [830, 524], [900, 522], [945, 506], [980, 474], [1000, 472], [1060, 478], [1110, 502],
  [1200, 508], [1200, 552], [1090, 556], [960, 560], [830, 564],
];

const poly = (pts, fill = "#fff") => `<polygon points="${pts.map((p) => p.join(",")).join(" ")}" fill="${fill}"/>`;
const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="#000"/>${body}</svg>`);

// the canopy is grey in the sky channel: it takes the sky's colour as the
// evening goes (it is pale fabric reflecting it) but never a star or the sun
const sky = svg(poly([[0, 0], [W, 0], ...[...RIDGE].reverse()]) + poly(CANOPY, "#808080") + poly(POLE, "#000"));
const sea = svg(poly([...BASE, ...SHORE]) + poly(POLE, "#000"));
const pool = svg(poly(POOL));
const veg = svg(poly(VEG) + poly(VEG_RIGHT));

const raster = (buf, blur) =>
  sharp(buf).resize(OUT, Math.round((OUT * H) / W)).blur(blur).extractChannel(0).raw().toBuffer();

const [r, g, b, a] = await Promise.all([raster(sky, 1.2), raster(sea, 1.4), raster(pool, 1.6), raster(veg, 2.5)]);
const h = Math.round((OUT * H) / W);
mkdirSync("public/media/golden", { recursive: true });
await sharp(r, { raw: { width: OUT, height: h, channels: 1 } })
  .joinChannel([g, b, a], { raw: { width: OUT, height: h, channels: 1 } })
  .png({ compressionLevel: 9 })
  .toFile(DEST);
console.log("wrote", DEST, `${OUT}×${h}`);

if (process.argv.includes("--preview")) {
  const tint = (buf, color) =>
    sharp(buf).resize(W, H).extractChannel(0).raw().toBuffer().then((m) => {
      const px = Buffer.alloc(W * H * 4);
      for (let i = 0; i < W * H; i++) {
        px[i * 4] = color[0];
        px[i * 4 + 1] = color[1];
        px[i * 4 + 2] = color[2];
        px[i * 4 + 3] = Math.round(m[i] * 0.45);
      }
      return sharp(px, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
    });
  const layers = await Promise.all([
    tint(sky, [80, 140, 255]),
    tint(sea, [0, 255, 120]),
    tint(pool, [255, 60, 200]),
    tint(veg, [255, 220, 0]),
  ]);
  const out = process.env.PREVIEW_OUT ?? "public/media/golden/mask-preview.jpg";
  await sharp(PHOTO).resize(W, H).composite(layers.map((input) => ({ input }))).jpeg({ quality: 85 }).toFile(out);
  console.log("preview", out);
}
