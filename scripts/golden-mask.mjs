/**
 * Region masks for the "living photograph" golden-hour scene.
 *
 * The scene animates the villa's own photo (public/media/golden/view-night-01.webp,
 * the sun on the hills seen from the pool). The shader needs to know where the
 * sky, the sea, the pool and the vegetation are, so this script writes two RGB
 * lossless WebPs at the photo's full size (2400×1800):
 *
 *   a: R = sky (0.5 on the umbrella canopy) · G = sea · B = pool      b: R = vegetation
 *
 * Two passes. First, a rough mask from the photograph itself: the ridge and the
 * foot of the hills as the strongest edge in a search band, the vegetation by
 * colour closed into solid bushes, the shoreline where the solid bush begins,
 * the pool's edges fitted as straight lines, the rigid umbrella and rail traced
 * by hand from pixel measurements. Second, and this is where the precision
 * comes from, every channel is refined with a colour guided filter (He, Sun &
 * Tang) using the photograph as the guide: the mask becomes a locally linear
 * function of the image colours, so its edges snap to the real edges of the
 * picture at sub-pixel precision, with partial coverage across leaves and haze,
 * instead of following the detector's own staircase.
 *
 *   node scripts/golden-mask.mjs            → public/media/golden/mask-night-01-{a,b}.webp (lossless)
 *   node scripts/golden-mask.mjs --preview  → also writes tinted overlays to check the contours
 */
import sharp from "sharp";
import { existsSync, mkdirSync, statSync } from "node:fs";

const PHOTO = "public/media/golden/view-night-01.webp";
// two lossless RGB files, no alpha: browsers premultiply an image's colour by its
// alpha when they decode it, which would corrupt three channels next to every leaf
const DEST = "public/media/golden/mask-night-01-a.webp"; // R sky · G sea · B pool
const DEST_B = "public/media/golden/mask-night-01-b.webp"; // R vegetation
const PREVIEW_DIR = process.env.PREVIEW_DIR ?? "public/media/golden";

// everything below was measured on a 1200×900 frame; S scales it to the photo
const meta = await sharp(PHOTO).metadata();
const W = meta.width;
const H = meta.height;
const S = W / 1200;
if (Math.abs(W / H - 4 / 3) > 0.001) throw new Error(`${PHOTO} is ${W}×${H}; the masks need a 4:3 frame`);

// ---- where to look (rough polylines, x → y, 1200-frame) -----------------------
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
const POOL_TOP0 = 599;
const POOL_RIGHT0 = [[599, 692], [850, 852]];
const POOL_BOTTOM0 = 850;

// ---- rigid shapes, measured on the pixels (1200-frame) ---------------------------
const CANOPY = [
  [762, 400], [800, 393], [820, 387], [860, 380], [900, 376], [960, 373], [1000, 371],
  [1060, 368], [1100, 365], [1150, 361], [1162, 372], [1160, 404], [1120, 406], [1080, 409],
  [1040, 412], [1000, 416], [960, 420], [920, 426], [885, 429], [860, 420], [840, 412], [800, 404],
];
// the pole: its centre runs from x≈824 at row 340 to x≈792 at row 520
const POLE = [[819, 334], [831, 334], [779, 624], [767, 624]];
const RAIL = (x) => (507 - (x / S - 820) * 0.025) * S; // the top rail, x ≥ 820·S
const POSTS = [[889, 901], [1007, 1019], [1157, 1169]].map(([a, b]) => [a * S, b * S]);
const scaled = (pts) => pts.map(([x, y]) => [x * S, y * S]);
const CANOPY_S = scaled(CANOPY);
const POLE_S = scaled(POLE);

// ---- the photograph ------------------------------------------------------------
const { data } = await sharp(PHOTO).removeAlpha().raw().toBuffer({ resolveWithObject: true });
const N = W * H;
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
const lum3 = (x, y) => (lum(x - 1, y) + lum(x, y) + lum(x + 1, y)) / 3;
// vertical contrast over ±3 original pixels: bright above → dark below is positive
const T = [2, 4, 6].map((k) => Math.round((k * S) / 2));
const grad = (x, y) => (lum3(x, y - T[0]) + lum3(x, y - T[1]) + lum3(x, y - T[2]) - lum3(x, y + T[0]) - lum3(x, y + T[1]) - lum3(x, y + T[2])) / 3;

const lineAt = (pts, x) => {
  // pts in the 1200-frame, x and the result in the photo's frame
  const xx = x / S;
  let y;
  if (xx <= pts[0][0]) y = pts[0][1];
  else {
    y = pts[pts.length - 1][1];
    for (let i = 1; i < pts.length; i++) {
      if (xx <= pts[i][0]) {
        const [x0, y0] = pts[i - 1];
        const [x1, y1] = pts[i];
        y = y0 + ((y1 - y0) * (xx - x0)) / (x1 - x0);
        break;
      }
    }
  }
  return y * S;
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
const median = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};
const window = (arr, i, r) => arr.slice(Math.max(0, i - r), Math.min(arr.length, i + r + 1));
const medN = (arr, r) => arr.map((_, i) => median(window(arr, i, r)));
const settle = (arr, r, tol) => {
  const m = medN(arr, r);
  return arr.map((v, i) => (Math.abs(v - m[i]) > tol ? m[i] : v));
};

// leaves: green (the sunlit tips included), or dark and not blue and not grey
const isVeg = (x, y) => {
  const [r, g, b] = px(x, y);
  const l = lum(x, y);
  const blueish = b > r + 15 && b > g + 5;
  const grey = sat(x, y) < 0.12;
  return (g >= r - 2 && g > b + 4) || (l < 0.42 && !blueish && !grey);
};
// the red roofs across the bay: red, not orange (the water under the sun is orange)
const isRoof = (x, y) => {
  const [r, g, b] = px(x, y);
  return r > g + 40 && g < b + 25 && lum(x, y) < 0.6;
};
const isCoping = (x, y) => lum(x, y) > 0.66 && sat(x, y) < 0.22;
// the pool's right-hand edge: the coping's lit inner face is a little darker than its
// top, and the fit must land on the water line, so the face counts as stone here
const isStone = (x, y) => lum(x, y) > 0.6 && sat(x, y) < 0.22;

// separable morphology on a 0/255 mask
const morph1D = (src, r, dilate, horizontal) => {
  const out = new Uint8Array(N);
  const len = horizontal ? W : H;
  const lines = horizontal ? H : W;
  for (let l = 0; l < lines; l++) {
    for (let i = 0; i < len; i++) {
      let v = dilate ? 0 : 255;
      for (let k = -r; k <= r; k++) {
        const j = i + k;
        if (j < 0 || j >= len) continue;
        const s = horizontal ? src[l * W + j] : src[j * W + l];
        if (dilate ? s > 0 : s === 0) {
          v = dilate ? 255 : 0;
          break;
        }
      }
      if (horizontal) out[l * W + i] = v;
      else out[i * W + l] = v;
    }
  }
  return out;
};
const morph = (src, r, dilate) => morph1D(morph1D(src, r, dilate, true), r, dilate, false);

// ---- pass one: the rough mask ----------------------------------------------------
const ridge = new Float32Array(W);
const base = new Float32Array(W);
for (let x = 0; x < W; x++) {
  const r0 = lineAt(RIDGE0, x);
  let ry = r0;
  for (let y = Math.round(r0 - 45 * S); y <= r0 + 25 * S; y++) {
    const g = grad(x, y);
    if (g > 0.17) {
      let best = y;
      let bg = g;
      for (let k = 1; k <= 4 * S; k++) {
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
  const b0 = lineAt(BASE0, x);
  let by = b0;
  let bg = 0;
  for (let y = Math.round(b0 - 14 * S); y <= b0 + 14 * S; y++) {
    if (y <= ry + 2 * S) continue;
    const g = -grad(x, y);
    if (g > bg) {
      bg = g;
      by = y;
    }
  }
  base[x] = bg > 0.06 ? by : Math.max(b0, ry + 3 * S);
}
const ridgeS = settle(ridge, 2 * S, 6 * S);
const baseS = settle(base, 4 * S, 5 * S);

// the pool: straight edges, fitted
const poolTop = new Float32Array(W);
const poolBottom = new Float32Array(W);
// the far edge, top to bottom: the pale coping, then the tiled wall of the pool
// (dark, saturated blue), then the water line, which is where the water mask starts
const isTile = (x, y) => lum(x, y) < 0.5 && sat(x, y) > 0.35;
for (let x = 0; x < W; x++) {
  let pt = 612 * S;
  let seenCoping = false;
  let seenTile = false;
  for (let y = Math.round(578 * S); y <= 650 * S; y++) {
    if (!seenCoping) {
      if (isCoping(x, y) && isCoping(x, y + 1)) seenCoping = true;
      continue;
    }
    if (!seenTile) {
      if (isTile(x, y) && isTile(x, y + 1)) seenTile = true;
      continue;
    }
    if (!isTile(x, y) && !isTile(x, y + 1) && !isTile(x, y + 2)) {
      pt = y;
      break;
    }
  }
  poolTop[x] = pt;
  let pb = POOL_BOTTOM0 * S;
  for (let y = Math.round(834 * S); y <= 874 * S; y++) {
    if (isCoping(x, y) && isCoping(x, y + 1)) {
      pb = y;
      break;
    }
  }
  poolBottom[x] = pb;
}
const poolTopY = median(poolTop.slice(0, Math.round(620 * S)));
const poolBottomY = median(poolBottom.slice(Math.round(40 * S), Math.round(700 * S)));
const rightOffsets = [];
// POOL_RIGHT0 maps y → x, so interpolate it by hand
const rightAt = (y) => {
  const [[y0, x0], [y1, x1]] = POOL_RIGHT0;
  return (x0 + ((x1 - x0) * (y / S - y0)) / (y1 - y0)) * S;
};
for (let y = Math.round((POOL_TOP0 + 10) * S); y < (POOL_BOTTOM0 - 10) * S; y++) {
  const x0 = rightAt(y);
  for (let x = Math.round(x0 - 26 * S); x <= x0 + 26 * S; x++) {
    if (isStone(x, y) && isStone(x + 1, y) && isStone(x + 2, y)) {
      // the water line is further in: back from the stone across the tiled inner
      // face of the wall to the last dark pixel of water
      let xw = x;
      for (let k = x - 1; k >= x - 30 * S; k--) {
        if (lum(k, y) < 0.34 && lum(k - 1, y) < 0.34) {
          xw = k + 1;
          break;
        }
      }
      rightOffsets.push([y, xw - x0]);
      break;
    }
  }
}
const third = Math.floor(rightOffsets.length / 3);
const offTop = median(rightOffsets.slice(0, third).map((o) => o[1]));
const offBottom = median(rightOffsets.slice(-third).map((o) => o[1]));
const yTop = rightOffsets[Math.floor(third / 2)][0];
const yBottom = rightOffsets[rightOffsets.length - 1 - Math.floor(third / 2)][0];
const poolRight = new Float32Array(H);
for (let y = 0; y < H; y++) {
  const k = (y - yTop) / (yBottom - yTop);
  poolRight[y] = rightAt(y) + offTop + (offBottom - offTop) * k;
}
// the same line in texture space (y up), for the shader's water-line fade
const edgeUv = (y) => [poolRight[Math.round(y)] / W, 1 - y / H];
const [ex0, ey0] = edgeUv(600 * S);
const [ex1, ey1] = edgeUv(840 * S);
console.log(`pool water line (uv): x = ${ex0.toFixed(4)} + (${ey0.toFixed(4)} - y) * ${((ex1 - ex0) / (ey0 - ey1)).toFixed(4)}`);
console.log(`pool far water line (uv y): ${(1 - poolTopY / H).toFixed(4)}   coping underside (uv y): ${(1 - (583 * S) / H).toFixed(4)}`);

// the vegetation, by colour, closed into solid bushes
const vegBottom = (x) => (x < 780 * S ? poolTopY - 14 * S : 586 * S);
const vegRaw = new Uint8Array(N);
for (let x = 0; x < W; x++) {
  for (let y = Math.round(baseS[x]) + 2 * S; y < vegBottom(x); y++) {
    if (inPoly(POLE_S, x, y)) continue;
    if (isVeg(x, y)) vegRaw[y * W + x] = 255;
  }
}
const vegClosed = morph(morph(morph(vegRaw, 2 * S, true), 3 * S, false), 1 * S, true);
for (let y = Math.round(440 * S); y < 600 * S; y++) {
  for (let x = Math.round(820 * S); x < W; x++) {
    const rail = RAIL(x);
    const onRail = y >= rail - 3 * S && y <= rail + 7 * S;
    const onPost = y >= rail && POSTS.some(([a, b]) => x >= a && x <= b);
    if (onRail || onPost) vegClosed[y * W + x] = 0;
  }
}

// the shore: where the solid bush (or a roof) begins; above it, what is not foliage is water
const halfSolid = 2 * S;
const solid = (x, y) => {
  for (let dx = -halfSolid; dx <= halfSolid; dx++) if (vegClosed[y * W + x + dx] === 0 || vegClosed[(y + 1) * W + x + dx] === 0) return false;
  return true;
};
const shoreS = new Float32Array(W);
for (let x = halfSolid; x < W - halfSolid; x++) {
  const s0 = lineAt(SHORE0, x);
  let sy = s0 + 34 * S;
  for (let y = Math.round(baseS[x]) + 2 * S; y <= s0 + 34 * S; y++) {
    if (solid(x, y) || (isRoof(x, y) && isRoof(x, y + 1))) {
      sy = y;
      break;
    }
  }
  if (x >= 820 * S) sy = Math.min(sy, RAIL(x) - 1);
  shoreS[x] = sy;
}
for (let x = 0; x < halfSolid; x++) shoreS[x] = shoreS[halfSolid];
for (let x = W - halfSolid; x < W; x++) shoreS[x] = shoreS[W - halfSolid - 1];

const sky = new Float32Array(N);
const sea = new Float32Array(N);
const pool = new Float32Array(N);
const veg = new Float32Array(N);
const rigid = (x, y) => {
  if (x < 820 * S || y < 440 * S || y >= 600 * S) return false;
  const rail = RAIL(x);
  return (y >= rail - 3 * S && y <= rail + 7 * S) || (y >= rail && POSTS.some(([a, b]) => x >= a && x <= b));
};
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const pole = inPoly(POLE_S, x, y);
    if (y < ridgeS[x] && !pole) sky[i] = inPoly(CANOPY_S, x, y) ? 0.5 : 1;
    if (y >= baseS[x] && y < shoreS[x] && !pole && vegClosed[i] === 0) sea[i] = 1;
    if (y >= poolTopY && y < poolBottomY && x < poolRight[y]) pool[i] = 1;
    if (vegClosed[i] > 0) veg[i] = 1;
  }
}

// ---- the semantic segmentation, when it has been run: it replaces the colour
// heuristics for the sky, the sea and the vegetation (scripts/golden-segment.mjs,
// SegFormer-B5 on ADE20K, decided pixel by pixel from its class scores). The pool
// keeps its fitted lines, the umbrella and rail their measured shapes.
const SEG = "public/media/golden/segments-night-01.png";
if (existsSync(SEG)) {
  const { data: lab, info } = await sharp(SEG).raw().toBuffer({ resolveWithObject: true });
  if (info.width !== W || info.height !== H) throw new Error(`${SEG} is ${info.width}×${info.height}, the frame is ${W}×${H}`);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const l = lab[i * info.channels];
      const pole = inPoly(POLE_S, x, y);
      // the edge-detected ridge and hill base stand guard, loosely: a gross mislabel
      // (sea in the sky, sky under the hills) cannot pass, a few pixels can
      const underRidge = y > ridgeS[x] + 12 * S;
      const aboveBase = y < baseS[x] - 12 * S;
      sky[i] = inPoly(CANOPY_S, x, y) ? 0.5 : l === 1 && !pole && !underRidge ? 1 : 0;
      sea[i] = l === 3 && !pole && !aboveBase ? 1 : 0;
      veg[i] = l === 4 && !pole && !rigid(x, y) ? 1 : 0;
    }
  }
  console.log("regions from the semantic segmentation");
} else {
  console.log("no segmentation map: regions from the colour heuristics");
}

// ---- pass two: the guided filter, the photograph as guide -------------------------
// box mean with border normalisation, separable, O(N)
const boxMean = (src, r) => {
  const tmp = new Float32Array(N);
  const out = new Float32Array(N);
  for (let y = 0; y < H; y++) {
    const row = y * W;
    let sum = 0;
    for (let x = 0; x <= r && x < W; x++) sum += src[row + x];
    for (let x = 0; x < W; x++) {
      const lo = Math.max(0, x - r);
      const hi = Math.min(W - 1, x + r);
      tmp[row + x] = sum / (hi - lo + 1);
      if (x + r + 1 < W) sum += src[row + x + r + 1];
      if (x - r >= 0) sum -= src[row + x - r];
    }
  }
  for (let x = 0; x < W; x++) {
    let sum = 0;
    for (let y = 0; y <= r && y < H; y++) sum += tmp[y * W + x];
    for (let y = 0; y < H; y++) {
      const lo = Math.max(0, y - r);
      const hi = Math.min(H - 1, y + r);
      out[y * W + x] = sum / (hi - lo + 1);
      if (y + r + 1 < H) sum += tmp[(y + r + 1) * W + x];
      if (y - r >= 0) sum -= tmp[(y - r) * W + x];
    }
  }
  return out;
};
const mul = (a, b) => {
  const o = new Float32Array(N);
  for (let i = 0; i < N; i++) o[i] = a[i] * b[i];
  return o;
};

const R = Math.round(5 * S); // window radius: 11 original pixels
const EPS = 2e-3;
const I = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
for (let i = 0; i < N; i++) {
  I[0][i] = data[i * 3] / 255;
  I[1][i] = data[i * 3 + 1] / 255;
  I[2][i] = data[i * 3 + 2] / 255;
}
console.log("guided filter: guide statistics");
const mI = I.map((c) => boxMean(c, R));
const pairs = [[0, 0], [0, 1], [0, 2], [1, 1], [1, 2], [2, 2]];
const mII = pairs.map(([a, b]) => boxMean(mul(I[a], I[b]), R));
// per-pixel inverse of the 3×3 covariance (+ eps on the diagonal)
const inv = new Float32Array(N * 9);
for (let i = 0; i < N; i++) {
  const rr = mII[0][i] - mI[0][i] * mI[0][i] + EPS;
  const rg = mII[1][i] - mI[0][i] * mI[1][i];
  const rb = mII[2][i] - mI[0][i] * mI[2][i];
  const gg = mII[3][i] - mI[1][i] * mI[1][i] + EPS;
  const gb = mII[4][i] - mI[1][i] * mI[2][i];
  const bb = mII[5][i] - mI[2][i] * mI[2][i] + EPS;
  const det = rr * (gg * bb - gb * gb) - rg * (rg * bb - gb * rb) + rb * (rg * gb - gg * rb);
  const d = 1 / det;
  const o = i * 9;
  inv[o] = (gg * bb - gb * gb) * d;
  inv[o + 1] = (rb * gb - rg * bb) * d;
  inv[o + 2] = (rg * gb - rb * gg) * d;
  inv[o + 3] = inv[o + 1];
  inv[o + 4] = (rr * bb - rb * rb) * d;
  inv[o + 5] = (rb * rg - rr * gb) * d;
  inv[o + 6] = inv[o + 2];
  inv[o + 7] = inv[o + 5];
  inv[o + 8] = (rr * gg - rg * rg) * d;
}
const guided = (p) => {
  const mp = boxMean(p, R);
  const mIp = I.map((c) => boxMean(mul(c, p), R));
  const a = [new Float32Array(N), new Float32Array(N), new Float32Array(N)];
  const b = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const c0 = mIp[0][i] - mI[0][i] * mp[i];
    const c1 = mIp[1][i] - mI[1][i] * mp[i];
    const c2 = mIp[2][i] - mI[2][i] * mp[i];
    const o = i * 9;
    a[0][i] = inv[o] * c0 + inv[o + 1] * c1 + inv[o + 2] * c2;
    a[1][i] = inv[o + 3] * c0 + inv[o + 4] * c1 + inv[o + 5] * c2;
    a[2][i] = inv[o + 6] * c0 + inv[o + 7] * c1 + inv[o + 8] * c2;
    b[i] = mp[i] - a[0][i] * mI[0][i] - a[1][i] * mI[1][i] - a[2][i] * mI[2][i];
  }
  const ma = a.map((c) => boxMean(c, R));
  const mb = boxMean(b, R);
  const q = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    const v = ma[0][i] * I[0][i] + ma[1][i] * I[1][i] + ma[2][i] * I[2][i] + mb[i];
    q[i] = Math.round(Math.min(1, Math.max(0, v)) * 255);
  }
  return q;
};
console.log("guided filter: sky");
const r = guided(sky);
console.log("guided filter: sea");
const g = guided(sea);
// the pool's edges are exact fitted lines: no guided filter there (the lit inner face of
// the coping matches the water's reflection line and the filter would bleed onto it),
// only a one-pixel feather
const poolHard = new Uint8Array(N);
for (let i = 0; i < N; i++) poolHard[i] = pool[i] > 0 ? 255 : 0;
const { data: b } = await sharp(poolHard, { raw: { width: W, height: H, channels: 1 } })
  .blur(0.5 * S)
  .toColourspace("b-w")
  .raw()
  .toBuffer({ resolveWithObject: true });
console.log("guided filter: vegetation");
const a = guided(veg);

if (process.env.DEBUG) {
  for (const x of [100, 350, 400, 600, 900, 1100].map((v) => v * S)) {
    console.log(x / S, { ridge: ridgeS[x] / S, base: baseS[x] / S, shore: shoreS[x] / S });
  }
  console.log("pool", { poolTopY: poolTopY / S, poolBottomY: poolBottomY / S, offTop: offTop / S, offBottom: offBottom / S });
}

const rgbA = Buffer.alloc(N * 3);
const rgbB = Buffer.alloc(N * 3);
for (let i = 0; i < N; i++) {
  rgbA[i * 3] = r[i];
  rgbA[i * 3 + 1] = g[i];
  rgbA[i * 3 + 2] = b[i];
  rgbB[i * 3] = a[i];
}
mkdirSync("public/media/golden", { recursive: true });
await sharp(rgbA, { raw: { width: W, height: H, channels: 3 } }).webp({ lossless: true, effort: 6 }).toFile(DEST);
await sharp(rgbB, { raw: { width: W, height: H, channels: 3 } }).webp({ lossless: true, effort: 6 }).toFile(DEST_B);
console.log("wrote", DEST, `${Math.round(statSync(DEST).size / 1024)} KB`, "and", DEST_B, `${Math.round(statSync(DEST_B).size / 1024)} KB`, `(${W}×${H})`);

if (process.argv.includes("--preview")) {
  const tint = (m, color, alpha = 0.45) => {
    const out = Buffer.alloc(N * 4);
    for (let i = 0; i < N; i++) {
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
  const cover = [r, g, b, a].map((m) => ((m.filter((v) => v > 128).length / N) * 100).toFixed(1) + "%");
  console.log("coverage sky/sea/pool/veg", cover.join(" "));
  const full = await sharp(PHOTO)
    .composite(layers.map((input) => ({ input })))
    .png()
    .toBuffer();
  await sharp(full).resize(1200).jpeg({ quality: 85 }).toFile(`${PREVIEW_DIR}/mask-preview.jpg`);
  const crops = [
    ["left", 0, 370, 420, 240],
    ["middle", 380, 400, 440, 240],
    ["right", 800, 320, 400, 300],
    ["pool", 560, 570, 340, 310],
    ["ridge-zoom", 150, 380, 240, 120],
  ];
  for (const [name, left, top, width, height] of crops) {
    await sharp(full)
      .extract({ left: left * S, top: top * S, width: width * S, height: height * S })
      .resize({ width: Math.min(1400, width * 4) })
      .jpeg({ quality: 88 })
      .toFile(`${PREVIEW_DIR}/mask-${name}.jpg`);
  }
  console.log("previews in", PREVIEW_DIR);
}
