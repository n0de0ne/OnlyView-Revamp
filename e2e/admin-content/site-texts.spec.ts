import { test, expect, requireWrites, uniq } from "../support/fixtures";

type Block = { key: string; group: string; label: string; values: Record<string, { value: any; original: any }> };

/** The first plain sentence of a block that the page shows as is. */
function editableField(value: Record<string, unknown>, html: string): string | null {
  for (const [field, text] of Object.entries(value)) {
    if (typeof text === "string" && /^[A-Za-z0-9 ,.]{8,}$/.test(text) && html.includes(text)) return field;
  }
  return null;
}

/**
 * Site copy lives in the database and is edited in the back-office: a change
 * shows on the public site at once, in its language only. The test puts the
 * original text back whatever happens.
 */
test.describe.configure({ mode: "serial" });
test.describe("site texts", () => {
  test("every block of copy is listed in both languages with its shipped original", async ({ admin }) => {
    const { groups, blocks } = (await admin.get("/api/admin/site-texts")).body as { groups: any[]; blocks: Block[] };
    expect(groups.length).toBeGreaterThan(5);
    expect(blocks.length).toBeGreaterThan(20);
    const groupIds = new Set(groups.map((g) => g.id));
    for (const b of blocks) {
      expect(groupIds.has(b.group), `${b.key} is filed under a known group`).toBe(true);
      expect(Object.keys(b.values).length, `${b.key} has at least one language`).toBeGreaterThan(0);
      for (const [locale, v] of Object.entries(b.values)) {
        expect(v.value, `${b.key}/${locale}`).not.toBeNull();
        expect(typeof v.value, `${b.key}/${locale} keeps the shape of its original`).toBe(typeof v.original);
      }
    }
    expect(blocks.some((b) => b.key === "hero")).toBe(true);
  });

  test("an edit shows on the public page at once, in its language only, and is put back", async ({ admin, visitor }) => {
    requireWrites();
    const blocks = (await admin.get("/api/admin/site-texts")).body.blocks as Block[];
    const home = String((await visitor.get("/")).body);
    const candidates = blocks.filter((b) => b.group === "home" && b.values.en && b.values.fr && typeof b.values.en.value === "object" && !Array.isArray(b.values.en.value));
    const block = candidates.find((b) => editableField(b.values.en.value, home));
    test.skip(!block, "no plain sentence of the home page copy to edit on this target");
    const original = block!.values.en.value;
    const field = editableField(original, home)!;
    const marker = `E2E${uniq()}`;

    try {
      const put = await admin.put("/api/admin/site-texts", { key: block!.key, locale: "en", value: { ...original, [field]: `${original[field]} ${marker}` } });
      expect(put.status, JSON.stringify(put.body)).toBe(200);
      await expect.poll(async () => String((await visitor.get("/")).body).includes(marker), { message: "the English home page shows the edit" }).toBe(true);
      expect(String((await visitor.get("/fr")).body)).not.toContain(marker);
      const saved = ((await admin.get("/api/admin/site-texts")).body.blocks as Block[]).find((b) => b.key === block!.key)!;
      expect(saved.values.en.value[field]).toContain(marker);
      expect(saved.values.en.original, "the shipped original is kept for a reset").toEqual(block!.values.en.original);
    } finally {
      const back = await admin.put("/api/admin/site-texts", { key: block!.key, locale: "en", value: original });
      expect(back.status, "original copy restored").toBe(200);
    }
    await expect.poll(async () => String((await visitor.get("/")).body).includes(marker)).toBe(false);
  });

  test("copy of the wrong shape, for an unknown block or language, is refused", async ({ admin }) => {
    const blocks = (await admin.get("/api/admin/site-texts")).body.blocks as Block[];
    const hero = blocks.find((b) => b.key === "hero")!;
    const before = JSON.stringify(hero.values.en.value);
    expect((await admin.put("/api/admin/site-texts", { key: "hero", locale: "en", value: "just a string" })).body.error).toBe("invalid_shape");
    expect((await admin.put("/api/admin/site-texts", { key: "hero", locale: "en", value: { nothing: "like the original" } })).body.error).toBe("invalid_shape");
    expect((await admin.put("/api/admin/site-texts", { key: "no-such-block", locale: "en", value: {} })).body.error).toBe("unknown_block");
    expect((await admin.put("/api/admin/site-texts", { key: "hero", locale: "de", value: hero.values.en.value })).body.error).toBe("unknown_block");
    expect((await admin.put("/api/admin/site-texts", { locale: "en" })).status).toBe(400);
    const after = ((await admin.get("/api/admin/site-texts")).body.blocks as Block[]).find((b) => b.key === "hero")!;
    expect(JSON.stringify(after.values.en.value)).toBe(before);
  });

  test("an email can be previewed before its wording is saved", async ({ admin }) => {
    const blocks = (await admin.get("/api/admin/site-texts")).body.blocks as Block[];
    const email = blocks.find((b) => b.group === "emails" && b.values.en);
    test.skip(!email, "no email copy on this target");
    const res = await admin.post("/api/admin/site-texts/preview", { key: email!.key, locale: "en", value: email!.values.en.value });
    expect(res.status, JSON.stringify(res.body).slice(0, 300)).toBe(200);
    if (res.body.kind === "email") {
      expect(res.body.subject.length).toBeGreaterThan(3);
      expect(res.body.html).toContain("<");
      expect(res.body.html, "placeholders are filled in").not.toMatch(/\{name\}/);
    }
  });

  test("the texts screen and the site screen open", async ({ page }) => {
    for (const path of ["/admin/texts", "/admin/site"]) {
      await page.goto(path);
      await expect(page.locator("main h1"), path).toBeVisible();
      await expect(page.locator("main"), path).not.toContainText(/\[object Object\]|undefined/);
    }
  });
});
