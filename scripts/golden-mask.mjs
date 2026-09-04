/**
 * Region masks for the "living photograph" golden-hour scene.
 *
 * The scene animates the villa's own photo (night/night-01.webp, the sun on
 * the hills seen from the pool). The shader needs to know where the sky,
 * the sea, the pool and the vegetation are, so this script writes one RGBA
 * PNG at the photo's working size (1200×900):
 *
 *   R = sky (0.5 on the umbrella canopy) · G = sea · B = pool · A = vegetation
 *
 * The contours come from the photograph itself, not from hand-drawn
 * polygons: the ridge of the hills, the foot of the hills and the shoreline
 * are found column by column as the strongest edge inside a search band,
 * the pool's edges row by row against the pale coping, and the vegetation
 * by colour. Only the rigid, man-made shapes (umbrella, pole, rail) are
 * traced by hand. The rough polylines below only say where to look.
 *
 *   node scripts/golden-mask.mjs            → public/media/golden/mask-night-01.png
 *   node scripts/golden-mask.mjs --preview  → also writes tinted overlays to check the contours
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const W = 1200;
const H = 900;
const PHOTO = "public/media/photos/night/night-01.webp";
const DEST = "public/media/golden/mask-night-01.png";
const PREVIEW_DIR = process.env.PREVIEW_DIR ?? "public/media/golden";

// ---- where to look (rough polylines, x → y) ----------------------------------
const RIDGE0 = [
  [0, 396], [60, 392], [120, 402], [170, 425], [220, 442], [290, 440], [350, 446],
  [420, 447], [500, 440], [560, 441], [620, 444], [660, 440], [720, 448], [790, 454],
  [860, 456], [930, 452], [960, 449], [1000, 457], [1100, 460], [1200, 462],
];
const BASE0 = [
  [0, 471], [100, 470], [160, 466], [175, 462], [300, 462], [500, 460], [700, 461], [800, 462],
  [900, 462], [950, 461], [1000, 464], [1100, 467], [1200, 470],
];
const SHORE0 = [
  [0, 520], [80, 522], [150, 516], [230, 506], [300, 490], [340, 476], [380, 458], [400, 452],
  [562, 456], [590, 502], [650, 520], [700, 522], [760, 526], [830, 522], [900, 520], [945, 504],
  [980, 472], [1000, 470], [1060, 476], [1110, 500], [1200, 506],
];
// the pool's far coping and its right-hand edge (x0 at y), and the near coping
const POOL_TOP0 = 599;
const POOL_RIGHT0 = [[599, 692], [850, 852]];
const POOL_BOTTOM0 = 850;

// ---- rigid shapes, traced on 3–4× zooms ---------------------------------------
const CANOPY = [
  [762, 400], [800, 393], [820, 387], [860, 380], [900, 376], [960, 373], [1000, 371],
  [1060, 368], [1100, 365], [1150, 361], [1162, 372], [1160, 404], [1120, 406], [1080, 409],
  [1040, 412], [1000, 416], [960, 420], [920, 426], [885, 429], [860, 420], [840, 412], [800, 404],
];
const POLE = [[814, 326], [828, 326], [794, 640], [780, 640]];
const RAIL = (x) => 507 - (x - 820) * 0.025; // the top rail, x ≥ 820

// ---- the photograph ------------------------------------------------------------
const { data } = await sharp(PHOTO).resize(W, H).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const px = (x, y) => {
  const i = (Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 3;
  return [data[i], data[i + 1], data[i + 2]];
};
const lum = (x, y) => {
  const [r, g, b] = px(x, y);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
const sat = (x, y) => {
  const [r, g, b] = px(x, y);
  const mx = Math.max(r, g, b);
  return mx === 0 ? 0 : (mx - Math.min(r, g, b)) / mx;
};
// mean luminance of a 3×3 patch, to tame grain
const lum3 = (x, y) => (lum(x - 1, y) + lum(x, y) + lum(x + 1, y)) / 3;
// vertical contrast: bright above → dark below is positive
const grad = (x, y) => (lum3(x, y - 3) + lum3(x, y - 2) + lum3(x, y - 1) - lum3(x, y + 1) - lum3(x, y + 2) - lum3(x, y + 3)) / 3;

const lineAt = (pts, x) => {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    if (x <= pts[i][0]) {
      const [x0, y0] = pts[i - 1];
      const [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return pts[pts.length - 1][1];
};

const inPoly = (pts, x, y) => {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

// what is not water: leaves, shadow, the red roofs, anything strongly coloured
const notSea = (x, y) => {
  const [r, g, b] = px(x, y);
  const l = lum(x, y);
  return (g > r + 6 && g > b + 6) || l < 0.33 || (r > g + 25 && r > b + 25) || sat(x, y) > 0.45;
};
const isVeg = (x, y) => {
  const [r, g, b] = px(x, y);
  const l = lum(x, y);
  if (l > 0.72) return false; // rail, coping, cushions
  const blueish = b > r + 15 && b > g + 5;
  return (g >= r - 2 && g > b + 4) || (l < 0.42 && !blueish);
};
const isCoping = (x, y) => lum(x, y) > 0.66 && sat(x, y) < 0.22;

// ---- the contours ----------------------------------------------------------------
const ridge = new Float32Array(W);
const base = new Float32Array(W);
const shore = new Float32Array(W);
const poolTop = new Float32Array(W);
const poolBottom = new Float32Array(W);
const poolRight = new Float32Array(H);

for (let x = 0; x < W; x++) {
  // the ridge: the first strong bright→dark edge coming down from the sky
  const r0 = lineAt(RIDGE0, x);
  let ry = r0;
  for (let y = Math.round(r0) - 45; y <= r0 + 25; y++) {
    const g = grad(x, y);
    if (g > 0.17) {
      let best = y;
      let bg = g;
      for (let k = 1; k <= 4; k++) {
        const gg = grad(x, y + k);
        if (gg > bg) {
          bg = gg;
          best = y + k;
        }
      }
      ry = best;
      break;
    }
  }
  ridge[x] = ry;

  // the foot of the hills: the strongest dark→bright edge around the rough line
  const b0 = lineAt(BASE0, x);
  let by = b0;
  let bg = 0;
  for (let y = Math.round(b0) - 14; y <= b0 + 14; y++) {
    if (y <= ry + 2) continue;
    const g = -grad(x, y);
    if (g > bg) {
      bg = g;
      by = y;
    }
  }
  base[x] = bg > 0.06 ? by : Math.max(b0, ry + 3);

  // the shore: the first thing that is not water, two rows in a row
  const s0 = lineAt(SHORE0, x);
  let sy = s0;
  for (let y = Math.round(Math.max(base[x] + 2, s0 - 32)); y <= s0 + 34; y++) {
    if (notSea(x, y) && notSea(x, y + 1)) {
      sy = y;
      break;
    }
  }
  if (x >= 820) sy = Math.min(sy, RAIL(x) - 1);
  shore[x] = sy;

  // the pool's far edge: the pale coping first, then the dark tiled wall under the water
  let pt = POOL_TOP0;
  let seenCoping = false;
  for (let y = 578; y <= 632; y++) {
    if (!seenCoping) {
      if (isCoping(x, y) && isCoping(x, y + 1)) seenCoping = true;
      continue;
    }
    if (lum(x, y) < 0.6 && lum(x, y + 1) < 0.6) {
      pt = y;
      break;
    }
  }
  poolTop[x] = pt;
  let pb = POOL_BOTTOM0;
  for (let y = 834; y <= 874; y++) {
    if (isCoping(x, y) && isCoping(x, y + 1)) {
      pb = y;
      break;
    }
  }
  poolBottom[x] = pb;
}
// a stray column should not move a contour on its own
const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const window = (arr, i, r) => arr.slice(Math.max(0, i - r), Math.min(arr.length, i + r + 1));
const medN = (arr, r) => arr.map((_, i) => median(window(arr, i, r)));
// keep the detail, drop the outliers: a column further than `tol` from its neighbours' median is replaced
const settle = (arr, r, tol) => {
  const m = medN(arr, r);
  return arr.map((v, i) => (Math.abs(v - m[i]) > tol ? m[i] : v));
};
const ridgeS = settle(ridge, 2, 6);
const baseS = settle(base, 4, 5);
// the water ends at the first leaf of the nearest tree, not between the leaves: topmost of 5 columns
const shoreS = shore.map((_, i) => Math.min(...window(shore, i, 2)));

// the pool's edges are straight lines in the photograph: fit them, do not trace them
const poolTopY = median(poolTop.slice(0, 620));
const poolBottomY = median(poolBottom.slice(40, 700));
const rightOffsets = [];
for (let y = POOL_TOP0 + 10; y < POOL_BOTTOM0 - 10; y++) {
  const x0 = lineAt(POOL_RIGHT0, y);
  for (let x = Math.round(x0) - 26; x <= x0 + 26; x++) {
    if (isCoping(x, y) && isCoping(x + 1, y) && isCoping(x + 2, y)) {
      rightOffsets.push([y, x - x0]);
      break;
    }
  }
}
const third = Math.floor(rightOffsets.length / 3);
const offTop = median(rightOffsets.slice(0, third).map((o) => o[1]));
const offBottom = median(rightOffsets.slice(-third).map((o) => o[1]));
const yTop = rightOffsets[Math.floor(third / 2)][0];
const yBottom = rightOffsets[rightOffsets.length - 1 - Math.floor(third / 2)][0];
for (let y = 0; y < H; y++) {
  const k = (y - yTop) / (yBottom - yTop);
  poolRight[y] = lineAt(POOL_RIGHT0, y) + offTop + (offBottom - offTop) * k;
}

if (process.env.DEBUG) {
  for (const x of [100, 330, 600, 900, 1100]) {
    console.log(x, { ridge: ridge[x], ridgeS: ridgeS[x], base: base[x], baseS: baseS[x], shore: shore[x], shoreS: shoreS[x] });
  }
  console.log("pool", { poolTopY, poolBottomY, offTop, offBottom, right600: poolRight[600], right840: poolRight[840] });
}

// ---- the masks -------------------------------------------------------------------
const sky = new Uint8Array(W * H);
const sea = new Uint8Array(W * H);
const pool = new Uint8Array(W * H);
const veg = new Uint8Array(W * H);

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const pole = inPoly(POLE, x, y);
    if (y < ridgeS[x] && !pole) sky[i] = inPoly(CANOPY, x, y) ? 128 : 255;
    if (y >= baseS[x] && y < shoreS[x] && !pole) sea[i] = 255;
    if (y >= poolTopY && y < poolBottomY && x < poolRight[y]) pool[i] = 255;
    // greenery: between the water and the pool's coping, and along the right, by colour
    const vegBottom = x < 780 ? poolTopY - 14 : 586;
    if (y >= shoreS[x] - 3 && y < vegBottom && !pole && isVeg(x, y)) veg[i] = 255;
  }
}

// close the leaves (dilate then erode) so the breeze moves whole bushes, not speckles
const morph = (src, r, dilate) => {
  const out = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let v = dilate ? 0 : 255;
      for (let dy = -r; dy <= r && (dilate ? v === 0 : v === 255); dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const s = src[yy * W + xx];
          if (dilate ? s > 0 : s === 0) {
            v = dilate ? 255 : 0;
            break;
          }
        }
      }
      out[y * W + x] = v;
    }
  }
  return out;
};
let vegClosed = morph(morph(morph(veg, 2, true), 3, false), 1, true);
// the rail and its posts are rigid: no breeze there
const POSTS = [[889, 901], [1007, 1019], [1157, 1169]];
for (let y = 440; y < 600; y++) {
  for (let x = 820; x < W; x++) {
    const rail = RAIL(x);
    const onRail = y >= rail - 3 && y <= rail + 7;
    const onPost = y >= rail && POSTS.some(([a, b]) => x >= a && x <= b);
    if (onRail || onPost) vegClosed[y * W + x] = 0;
  }
}
// the water between two leaves is water, but a one-column sliver of it only flickers: open the sea mask
const seaOpen = morph(morph(sea, 3, false), 3, true);

// a soft edge of under a pixel: enough to antialias, not enough to blur the contour
const channel = async (buf, blur) => {
  const { data: out, info } = await sharp(buf, { raw: { width: W, height: H, channels: 1 } })
    .blur(blur)
    .toColourspace("b-w")
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (info.channels !== 1) throw new Error(`expected one channel, got ${info.channels}`);
  return out;
};
const [r, g, b, a] = await Promise.all([channel(sky, 0.7), channel(seaOpen, 0.7), channel(pool, 0.8), channel(vegClosed, 1.4)]);
const rgba = Buffer.alloc(W * H * 4);
for (let i = 0; i < W * H; i++) {
  rgba[i * 4] = r[i];
  rgba[i * 4 + 1] = g[i];
  rgba[i * 4 + 2] = b[i];
  rgba[i * 4 + 3] = a[i];
}
mkdirSync("public/media/golden", { recursive: true });
await sharp(rgba, { raw: { width: W, height: H, channels: 4 } }).png({ compressionLevel: 9 }).toFile(DEST);
console.log("wrote", DEST, `${W}×${H}`);

if (process.argv.includes("--preview")) {
  const tint = (m, color, alpha = 0.45) => {
    const out = Buffer.alloc(W * H * 4);
    for (let i = 0; i < W * H; i++) {
      out[i * 4] = color[0];
      out[i * 4 + 1] = color[1];
      out[i * 4 + 2] = color[2];
      out[i * 4 + 3] = Math.round(m[i] * alpha);
    }
    return sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toBuffer();
  };
  const layers = await Promise.all([
    tint(r, [80, 140, 255]),
    tint(g, [0, 255, 120]),
    tint(b, [255, 60, 200]),
    tint(a, [255, 220, 0]),
  ]);
  const cover = [r, g, b, a].map((m) => (m.filter((v) => v > 128).length / (W * H) * 100).toFixed(1) + "%");
  console.log("coverage sky/sea/pool/veg", cover.join(" "));
  const full = await sharp(PHOTO)
    .resize(W, H)
    .composite(layers.map((input) => ({ input })))
    .png()
    .toBuffer();
  await sharp(full).jpeg({ quality: 85 }).toFile(`${PREVIEW_DIR}/mask-preview.jpg`);
  const crops = [
    ["left", 0, 370, 420, 240],
    ["middle", 380, 400, 440, 240],
    ["right", 800, 320, 400, 300],
    ["pool", 560, 570, 340, 310],
  ];
  for (const [name, left, top, width, height] of crops) {
    await sharp(full).extract({ left, top, width, height }).resize(width * 2, height * 2, { kernel: "nearest" }).jpeg({ quality: 88 }).toFile(`${PREVIEW_DIR}/mask-${name}.jpg`);
  }
  console.log("previews in", PREVIEW_DIR);
}
