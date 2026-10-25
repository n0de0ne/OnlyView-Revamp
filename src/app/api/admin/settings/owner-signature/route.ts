import sharp from "sharp";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { invalidateSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import { OWNER_SIGNATURE_KEY } from "@/lib/contract-pdf";

export const dynamic = "force-dynamic";

/**
 * The owner's handwritten signature, printed in the Owner box of every
 * contract. Stored in the database (never in the repository): trimmed and
 * resized to a small transparent PNG.
 */
export const POST = adminRoute("owner", async (req, _ctx, user) => {
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) return jsonError("missing_file");
  if (file.size > 8 * 1024 * 1024) return jsonError("file_too_large");
  let png: Buffer;
  try {
    png = await sharp(Buffer.from(await file.arrayBuffer()))
      .trim()
      .resize({ width: 600, height: 300, fit: "inside", withoutEnlargement: true })
      .png()
      .toBuffer();
  } catch {
    return jsonError("invalid_image");
  }
  const value = `data:image/png;base64,${png.toString("base64")}`;
  await prisma.setting.upsert({
    where: { key: OWNER_SIGNATURE_KEY },
    create: { key: OWNER_SIGNATURE_KEY, value },
    update: { value },
  });
  invalidateSettings();
  await audit({ action: "owner_signature_set", entityType: "settings", userId: user.id, username: user.username });
  return jsonOk({ signature: value });
});

export const DELETE = adminRoute("owner", async (_req, _ctx, user) => {
  await prisma.setting.deleteMany({ where: { key: OWNER_SIGNATURE_KEY } });
  invalidateSettings();
  await audit({ action: "owner_signature_removed", entityType: "settings", userId: user.id, username: user.username });
  return jsonOk();
});
