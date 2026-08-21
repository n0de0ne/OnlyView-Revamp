import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import sharp from "sharp";
import { prisma } from "@/lib/db";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { PHOTO_CATEGORIES } from "@/lib/photos";

export const dynamic = "force-dynamic";

export const GET = adminRoute("viewer", async () => {
  const photos = await prisma.photo.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
  return jsonOk({ photos, categories: PHOTO_CATEGORIES });
});

/**
 * Upload a photo (multipart/form-data: file, category, alt).
 * Stored under public/media/photos/uploads (persistent-disk deployments;
 * for serverless hosts use object storage instead — see README).
 */
export const POST = adminRoute("manager", async (req, _ctx, user) => {
  const form = await req.formData().catch(() => null);
  if (!form) return jsonError("invalid_form");
  const file = form.get("file");
  const category = String(form.get("category") ?? "");
  const alt = String(form.get("alt") ?? "");
  if (!(file instanceof File)) return jsonError("missing_file");
  if (!(PHOTO_CATEGORIES as readonly string[]).includes(category)) {
    return jsonError("invalid_category");
  }
  if (file.size > 25_000_000) return jsonError("file_too_large");

  const buf = Buffer.from(await file.arrayBuffer());
  let image: Buffer;
  let width = 0;
  let height = 0;
  try {
    const processed = await sharp(buf)
      .rotate()
      .resize({ width: 1800, height: 1800, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 78 })
      .toBuffer({ resolveWithObject: true });
    image = processed.data;
    width = processed.info.width;
    height = processed.info.height;
  } catch {
    return jsonError("invalid_image");
  }

  const dir = path.join(process.cwd(), "public", "media", "photos", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  const name = `${category}-${Date.now().toString(36)}.webp`;
  fs.writeFileSync(path.join(dir, name), image);

  const max = await prisma.photo.aggregate({
    where: { category },
    _max: { sortOrder: true },
  });
  const photo = await prisma.photo.create({
    data: {
      category,
      url: `/media/photos/uploads/${name}`,
      alt: alt || null,
      width,
      height,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  await audit({
    action: "photo_upload",
    entityType: "photo",
    entityId: photo.id,
    userId: user.id,
    username: user.username,
  });
  return jsonOk({ photo });
});

const PatchBody = z.object({
  id: z.number().int(),
  alt: z.string().max(300).optional(),
  category: z.string().optional(),
  sortOrder: z.number().int().optional(),
  published: z.boolean().optional(),
});

export const PUT = adminRoute("manager", async (req, _ctx, user) => {
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  const { id, ...data } = parsed.data;
  try {
    const photo = await prisma.photo.update({ where: { id }, data });
    await audit({
      action: "photo_update",
      entityType: "photo",
      entityId: id,
      userId: user.id,
      username: user.username,
    });
    return jsonOk({ photo });
  } catch {
    return jsonError("not_found", 404);
  }
});

export const DELETE = adminRoute("manager", async (req, _ctx, user) => {
  const id = parseInt(req.nextUrl.searchParams.get("id") ?? "", 10);
  if (!id) return jsonError("missing_id");
  const photo = await prisma.photo.delete({ where: { id } }).catch(() => null);
  if (photo?.url.startsWith("/media/photos/uploads/")) {
    const p = path.join(process.cwd(), "public", photo.url);
    fs.rm(p, { force: true }, () => {});
  }
  await audit({
    action: "photo_delete",
    entityType: "photo",
    entityId: id,
    userId: user.id,
    username: user.username,
  });
  return jsonOk();
});
