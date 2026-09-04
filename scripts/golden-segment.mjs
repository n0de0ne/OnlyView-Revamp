/**
 * Semantic segmentation of the golden-hour frame.
 *
 * Runs SegFormer-B5 (trained on ADE20K: sky, mountain, sea, tree, palm,
 * swimming pool, railing, awning …) on public/media/golden/view-night-01.webp
 * and writes a label map, public/media/golden/segments-night-01.png, one grey
 * level per region:
 *
 *   0 other · 1 sky · 2 hills and land · 3 sea · 4 vegetation · 5 pool
 *
 * scripts/golden-mask.mjs uses that map as its starting point and refines the
 * contours on the pixels; this script is the only one that needs the model
 * (downloaded once into node_modules/@huggingface/transformers/.cache).
 *
 *   node scripts/golden-segment.mjs              (SEG_SCALES=1024,1280,1600 by default: widths the model is run at)
 */
import { AutoProcessor, SegformerForSemanticSegmentation, RawImage } from "@huggingface/transformers";
import sharp from "sharp";

const PHOTO = "public/media/golden/view-night-01.webp";
const DEST = "public/media/golden/segments-night-01.png";
const MODEL = process.env.SEG_MODEL ?? "Xenova/segformer-b5-finetuned-ade-640-640";

const GROUPS = {
  sky: ["sky"],
  land: ["mountain", "hill", "earth", "land", "rock", "building", "house", "sand", "road", "path", "tower", "hovel", "wall", "skyscraper", "field", "dirt track", "bridge", "pier"],
  sea: ["sea", "water", "lake", "river"],
  veg: ["tree", "plant", "palm", "grass", "flower"],
  pool: ["swimming pool"],
};
const GROUP_ID = { other: 0, sky: 1, land: 2, sea: 3, veg: 4, pool: 5 };

console.log(`model ${MODEL}`);
const image = await RawImage.read(PHOTO);
const processor = await AutoProcessor.from_pretrained(MODEL);
const model = await SegformerForSemanticSegmentation.from_pretrained(MODEL, { dtype: "fp32" });
const id2label = model.config.id2label;

const groups = Object.keys(GROUP_ID);
const W = image.width;
const H = image.height;

// bilinear, pixel centres aligned (sharp cannot resize 16-bit single-channel raw data)
const up = (arr, w, h) => {
  const out = new Float32Array(W * H);
  for (let y = 0; y < H; y++) {
    const sy = Math.min(h - 1, Math.max(0, ((y + 0.5) * h) / H - 0.5));
    const y0 = Math.floor(sy);
    const y1 = Math.min(h - 1, y0 + 1);
    const fy = sy - y0;
    for (let x = 0; x < W; x++) {
      const sx = Math.min(w - 1, Math.max(0, ((x + 0.5) * w) / W - 0.5));
      const x0 = Math.floor(sx);
      const x1 = Math.min(w - 1, x0 + 1);
      const fx = sx - x0;
      const top = arr[y0 * w + x0] * (1 - fx) + arr[y0 * w + x1] * fx;
      const bottom = arr[y1 * w + x0] * (1 - fx) + arr[y1 * w + x1] * fx;
      out[y * W + x] = top * (1 - fy) + bottom * fy;
    }
  }
  return out;
};
// multi-scale inference: the model was trained at 640 px, so one large input alone
// misreads the glare on the water; the class probabilities of several scales are
// averaged at the photo's resolution and the decision is taken per pixel
const SCALES = (process.env.SEG_SCALES ?? "1024,1280,1600").split(",").map(Number);
const full = Object.fromEntries(groups.map((g) => [g, new Float32Array(W * H)]));
let groupOf = null;
for (const sw of SCALES) {
  const sh = Math.round((sw * 3) / 4);
  processor.image_processor.size = { width: sw, height: sh };
  const inputs = await processor(image);
  const t0 = Date.now();
  const { logits } = await model(inputs);
  const [, C, h, w] = logits.dims;
  console.log(`scale ${sw}×${sh}: inference ${((Date.now() - t0) / 1000).toFixed(1)} s, logits ${h}×${w}`);
  const L = logits.data;
  if (!groupOf) {
    groupOf = new Array(C).fill("other");
    for (let c = 0; c < C; c++) {
      const name = String(id2label[c]).toLowerCase();
      for (const [g, names] of Object.entries(GROUPS)) if (names.includes(name)) groupOf[c] = g;
    }
  }
  // softmax per cell, summed per group
  const prob = Object.fromEntries(groups.map((g) => [g, new Float32Array(h * w)]));
  const cells = h * w;
  for (let i = 0; i < cells; i++) {
    let mx = -Infinity;
    for (let c = 0; c < C; c++) if (L[c * cells + i] > mx) mx = L[c * cells + i];
    let sum = 0;
    for (let c = 0; c < C; c++) sum += Math.exp(L[c * cells + i] - mx);
    for (let c = 0; c < C; c++) prob[groupOf[c]][i] += Math.exp(L[c * cells + i] - mx) / sum;
  }
  for (const g of groups) {
    const u = up(prob[g], w, h);
    const acc = full[g];
    for (let i = 0; i < W * H; i++) acc[i] += u[i] / SCALES.length;
  }
}
const labels = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) {
  let best = "other";
  for (const g of groups) if (full[g][i] > full[best][i]) best = g;
  labels[i] = GROUP_ID[best];
}
const counts = Object.fromEntries(groups.map((g) => [g, 0]));
for (let i = 0; i < W * H; i++) counts[groups[labels[i]]]++;
console.log("coverage", Object.fromEntries(groups.map((g) => [g, ((counts[g] / (W * H)) * 100).toFixed(1) + "%"])));
await sharp(labels, { raw: { width: W, height: H, channels: 1 } }).png({ compressionLevel: 9 }).toFile(DEST);
console.log("wrote", DEST);

if (process.argv.includes("--preview")) {
  const palette = { 0: [0, 0, 0, 0], 1: [80, 140, 255, 110], 2: [200, 120, 40, 110], 3: [0, 255, 120, 110], 4: [255, 220, 0, 110], 5: [255, 60, 200, 110] };
  const overlay = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const [r, g, b, a] = palette[labels[i]];
    overlay[i * 4] = r;
    overlay[i * 4 + 1] = g;
    overlay[i * 4 + 2] = b;
    overlay[i * 4 + 3] = a;
  }
  const out = process.env.PREVIEW_OUT ?? "public/media/golden/segments-preview.jpg";
  // composite at full size first (sharp resizes before it composites), then shrink
  const composed = await sharp(PHOTO)
    .composite([{ input: overlay, raw: { width: W, height: H, channels: 4 } }])
    .png()
    .toBuffer();
  await sharp(composed).resize(1600).jpeg({ quality: 85 }).toFile(out);
  console.log("preview", out);
}
