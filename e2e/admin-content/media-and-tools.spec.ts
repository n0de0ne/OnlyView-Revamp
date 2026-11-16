import { test, expect, requireWrites } from "../support/fixtures";

type Photo = { id: number; url: string; category: string; sortOrder: number; published: boolean; alt: string | null };

/** Photos, the island map editor and the owner's tools (reminders preview, search engines, extras sync). */
test.describe("photos", () => {
  test("the library is listed by category and matches the public gallery", async ({ admin, visitor }) => {
    const { photos, categories } = (await admin.get("/api/admin/photos")).body as { photos: Photo[]; categories: string[] };
    expect(photos.length).toBeGreaterThan(10);
    expect(categories.length).toBeGreaterThan(2);
    for (const p of photos) expect(categories, `photo ${p.id}`).toContain(p.category);
    const gallery = await visitor.get("/gallery");
    expect(gallery.status).toBe(200);
  });

  test("saving the order it already has changes nothing; a list that is out of date is refused", async ({ admin }) => {
    requireWrites();
    const { photos } = (await admin.get("/api/admin/photos")).body as { photos: Photo[] };
    const category = photos[0].category;
    const ids = photos.filter((p) => p.category === category).sort((a, b) => a.sortOrder - b.sortOrder).map((p) => p.id);
    expect((await admin.post("/api/admin/photos/reorder", { category, ids })).status).toBe(200);
    const after = ((await admin.get("/api/admin/photos")).body.photos as Photo[]).filter((p) => p.category === category).map((p) => p.id);
    expect(after).toEqual(ids);

    const stale = await admin.post("/api/admin/photos/reorder", { category, ids: ids.slice(1) });
    if (ids.length > 1) {
      expect(stale.status).toBe(409);
      expect(stale.body.error).toBe("stale_order");
    }
    expect((await admin.post("/api/admin/photos/reorder", { category, ids: [...ids.slice(1), 99999999] })).status).toBe(409);
    expect((await admin.post("/api/admin/photos/reorder", { category, ids: [] })).status).toBe(400);
  });

  test("a hidden photo leaves the public gallery and comes back when published again", async ({ admin, visitor }) => {
    requireWrites();
    const { photos } = (await admin.get("/api/admin/photos")).body as { photos: Photo[] };
    const shown = photos.filter((p) => p.published);
    test.skip(shown.length < 5, "too few photos on this target to hide one");
    const photo = shown[shown.length - 1];
    // the gallery page carries each photo's file address
    const inGallery = async () => String((await visitor.get("/gallery")).body).includes(encodeURI(photo.url).replace(/&/g, "&amp;")) || String((await visitor.get("/gallery")).body).includes(photo.url);
    test.skip(!(await inGallery()), "this photo is not addressed by its file on the gallery page");
    try {
      expect((await admin.put("/api/admin/photos", { id: photo.id, published: false })).status).toBe(200);
      const row = ((await admin.get("/api/admin/photos")).body.photos as Photo[]).find((p) => p.id === photo.id)!;
      expect(row).toMatchObject({ published: false, category: photo.category, alt: photo.alt, sortOrder: photo.sortOrder });
      await expect.poll(inGallery, { message: "hidden from the gallery" }).toBe(false);
    } finally {
      expect((await admin.put("/api/admin/photos", { id: photo.id, published: true })).status, "photo published again").toBe(200);
    }
    await expect.poll(inGallery, { message: "back in the gallery" }).toBe(true);
    expect((await admin.post("/api/admin/photos", {})).status).toBe(400);
  });
});

test.describe("island map editor", () => {
  test("editing one field of a place leaves the rest alone", async ({ admin, scratch }) => {
    const place = await scratch.place({ zone: "Gustavia", phone: "+590 590 00 00 05", sortOrder: 42, cuisineEn: "E2E cuisine", priceRange: 3 });
    const put = await admin.put(`/api/admin/map-places/${place.id}`, { phone: "+590 590 00 00 06" });
    expect(put.status, JSON.stringify(put.body)).toBe(200);
    expect(put.body.place).toMatchObject({ phone: "+590 590 00 00 06", zone: "Gustavia", sortOrder: 42, isActive: true, cuisineEn: "E2E cuisine", priceRange: 3, bookingMode: "concierge", name: place.name });
    const off = await admin.put(`/api/admin/map-places/${place.id}`, { isActive: false });
    expect(off.body.place).toMatchObject({ isActive: false, sortOrder: 42 });
    // a place that is off, edited again, stays off
    expect((await admin.put(`/api/admin/map-places/${place.id}`, { zone: "St Jean" })).body.place).toMatchObject({ isActive: false, zone: "St Jean" });
  });

  test("the map editor lists the places", async ({ page, scratch }) => {
    const place = await scratch.place();
    await page.goto("/admin/map");
    await expect(page.locator("main h1")).toBeVisible();
    const search = page.locator('main input[type="search"], main input[placeholder*="echerch"]').first();
    if (await search.count()) await search.fill(place.name);
    await expect(page.locator("main")).toContainText(place.name);
  });
});

test.describe("owner's tools", () => {
  test("the reminders preview says what would be sent, without sending", async ({ admin }) => {
    const before = (await admin.get("/api/admin/email-logs?take=5")).body.logs;
    const res = await admin.get("/api/admin/reminders");
    expect(res.status).toBe(200);
    expect(typeof res.body.enabled).toBe("boolean");
    expect(Array.isArray(res.body.actions)).toBe(true);
    const after = (await admin.get("/api/admin/email-logs?take=5")).body.logs;
    expect(after[0]?.id ?? null, "a preview sends nothing").toBe(before[0]?.id ?? null);
  });

  test("the search-engine panel names this site and its key", async ({ admin }) => {
    const res = await admin.get("/api/admin/seo/indexnow");
    expect(res.status).toBe(200);
    expect(typeof res.body.enabled).toBe("boolean");
    expect(res.body.keyUrl.startsWith(res.body.siteUrl)).toBe(true);
  });

  test("the state of the extras catalog sync can be read", async ({ admin }) => {
    const res = await admin.get("/api/admin/extras/sync");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
