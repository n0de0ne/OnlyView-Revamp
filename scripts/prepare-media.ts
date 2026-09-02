/**
 * One-off media pipeline: curates photos from the legacy PHP repo
 * (../OnlyView/uploads/photos), resizes/re-encodes them for the web and
 * writes a manifest consumed by the Prisma seed.
 *
 * Usage: npx tsx scripts/prepare-media.ts [source-photos-dir]
 */
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const SOURCE =
  process.argv[2] ?? path.join(__dirname, "..", "..", "OnlyView", "uploads", "photos");
const VIDEO_SOURCE = path.join(SOURCE, "..", "videos");
const OUT = path.join(__dirname, "..", "public", "media", "photos");
const VIDEO_OUT = path.join(__dirname, "..", "public", "media", "video");
const MANIFEST = path.join(__dirname, "..", "src", "data", "photos.json");

// how many photos to keep per category (chronological order)
const PICKS: Record<string, number> = {
  living: 6,
  "pool-terrace": 8,
  kitchen: 4,
  bedroom1: 4,
  bedroom2: 3,
  bedroom3: 3,
  bedroom4: 4,
  night: 6,
  exterior: 4,
};

// Sources are 4000×3000; 2400 keeps full-bleed and retina layouts sharp
// (a 1200 CSS px frame at 2× DPR) without doubling the payload.
const MAX_EDGE = 2400;
const QUALITY = 76;

interface ManifestEntry {
  category: string;
  url: string;
  width: number;
  height: number;
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source photo dir not found: ${SOURCE}`);
    process.exit(1);
  }
  fs.mkdirSync(OUT, { recursive: true });
  fs.mkdirSync(VIDEO_OUT, { recursive: true });
  fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });

  const files = fs
    .readdirSync(SOURCE)
    .filter((f) => f.endsWith(".webp"))
    .sort();

  const manifest: ManifestEntry[] = [];

  for (const [category, count] of Object.entries(PICKS)) {
    const catFiles = files
      .filter((f) => f.startsWith(category + "_"))
      .slice(0, count);
    const dir = path.join(OUT, category);
    fs.mkdirSync(dir, { recursive: true });

    let i = 0;
    for (const file of catFiles) {
      i += 1;
      const outName = `${category}-${String(i).padStart(2, "0")}.webp`;
      const outPath = path.join(dir, outName);
      const img = sharp(path.join(SOURCE, file)).rotate();
      const meta = await img.metadata();
      const resized = img.resize({
        width: MAX_EDGE,
        height: MAX_EDGE,
        fit: "inside",
        withoutEnlargement: true,
      });
      await resized.webp({ quality: QUALITY }).toFile(outPath);
      const outMeta = await sharp(outPath).metadata();
      manifest.push({
        category,
        url: `/media/photos/${category}/${outName}`,
        width: outMeta.width ?? meta.width ?? 0,
        height: outMeta.height ?? meta.height ?? 0,
      });
      console.log(`✓ ${category}/${outName} (${outMeta.width}×${outMeta.height})`);
    }
  }

  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest: ${MANIFEST} (${manifest.length} photos)`);

  // hero videos (already compressed) — copy as-is
  for (const v of ["hero.webm", "hero-mobile.mp4"]) {
    const src = path.join(VIDEO_SOURCE, v);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, path.join(VIDEO_OUT, v));
      console.log(`✓ video ${v}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
