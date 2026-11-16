import { test, expect, today, uniq, type Scratch } from "../support/fixtures";

const article = (slug: string, over: Record<string, unknown> = {}) => ({
  slug,
  category: "practical",
  publishedOn: today(),
  updatedOn: today(),
  title: { en: `E2E guide ${slug}`, fr: `E2E guide FR ${slug}` },
  description: { en: "E2E description of the article.", fr: "E2E description de l'article." },
  metaTitle: { en: "", fr: "" },
  metaDescription: { en: "", fr: "" },
  sections: {
    en: [{ h: "E2E first heading", p: ["E2E first paragraph in English."] }],
    fr: [{ h: "E2E premier titre", p: ["E2E premier paragraphe en français."] }],
  },
  links: [{ label: { en: "E2E link", fr: "E2E lien" }, url: "https://example.com/e2e" }],
  ...over,
});

async function create(scratch: Scratch, over: Record<string, unknown> = {}) {
  const slug = `e2e-${uniq()}`;
  const res = await scratch.admin.post("/api/admin/guides", article(slug, over));
  expect(res.status, JSON.stringify(res.body)).toBe(200);
  scratch.track(() => scratch.admin.del(`/api/admin/guides/${res.body.guide.id}`));
  return { slug, id: res.body.guide.id as number };
}

/** Guide articles are written in the back-office and published on /guide in both languages. */
test.describe("guide articles", () => {
  test("a published article is online in both languages, listed and in the sitemap", async ({ visitor, scratch }) => {
    const { slug } = await create(scratch);
    const en = await visitor.get(`/guide/${slug}`);
    expect(en.status).toBe(200);
    expect(en.body).toContain(`E2E guide ${slug}`);
    expect(en.body).toContain("E2E first paragraph in English.");
    expect(en.body).toContain("https://example.com/e2e");
    const fr = await visitor.get(`/fr/guide/${slug}`);
    expect(fr.status).toBe(200);
    expect(fr.body).toContain("E2E premier paragraphe en français.");
    expect(fr.body).not.toContain("E2E first paragraph in English.");
    await expect.poll(async () => String((await visitor.get("/guide")).body).includes(`/guide/${slug}`)).toBe(true);
    expect(String((await visitor.get("/sitemap.xml")).body)).toContain(`/guide/${slug}`);
  });

  test("a draft is not online; publishing, editing and deleting follow at once", async ({ admin, visitor, scratch }) => {
    const { slug, id } = await create(scratch, { isPublished: false });
    expect((await visitor.get(`/guide/${slug}`)).status).toBe(404);
    expect(String((await visitor.get("/guide")).body)).not.toContain(`/guide/${slug}`);
    expect(String((await visitor.get("/sitemap.xml")).body)).not.toContain(`/guide/${slug}`);

    const edited = article(slug, { isPublished: true, title: { en: `E2E retitled ${slug}`, fr: `E2E retitré ${slug}` } });
    expect((await admin.put(`/api/admin/guides/${id}`, edited)).status).toBe(200);
    await expect.poll(async () => (await visitor.get(`/guide/${slug}`)).status).toBe(200);
    expect(String((await visitor.get(`/guide/${slug}`)).body)).toContain(`E2E retitled ${slug}`);

    expect((await admin.del(`/api/admin/guides/${id}`)).status).toBe(200);
    await expect.poll(async () => (await visitor.get(`/guide/${slug}`)).status).toBe(404);
    expect((await admin.del(`/api/admin/guides/${id}`)).status).toBe(404);
  });

  test("an address already used, a missing translation or a bad address is refused", async ({ admin, scratch }) => {
    const { slug, id } = await create(scratch);
    const other = await create(scratch);
    expect((await admin.post("/api/admin/guides", article(slug))).body.error).toBe("slug_taken");
    expect((await admin.put(`/api/admin/guides/${other.id}`, article(slug))).body.error).toBe("slug_taken");
    expect((await admin.put(`/api/admin/guides/${id}`, article(slug))).status, "saving it under its own address is fine").toBe(200);
    expect((await admin.post("/api/admin/guides", article("E2E Bad Slug!"))).status).toBe(400);
    expect((await admin.post("/api/admin/guides", article(`e2e-${uniq()}`, { title: { en: "Only English", fr: "" } }))).status).toBe(400);
    expect((await admin.post("/api/admin/guides", article(`e2e-${uniq()}`, { category: "gossip" }))).status).toBe(400);
    expect((await admin.post("/api/admin/guides", article(`e2e-${uniq()}`, { links: [{ label: { en: "x", fr: "x" }, url: "not a url" }] }))).status).toBe(400);
    expect((await admin.put("/api/admin/guides/99999999", article(`e2e-${uniq()}`))).status).toBe(404);
  });

  test("the guide screen lists the articles", async ({ page, scratch }) => {
    const { slug } = await create(scratch);
    await page.goto("/admin/guide");
    await expect(page.locator("main")).toContainText(slug);
  });
});
