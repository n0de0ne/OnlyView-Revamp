import { llmsFull } from "@/lib/llms";

// built from the admin-edited copy, guides and facts: read at request time
// (the image is built without a database), cached by the browser and CDN header
export const dynamic = "force-dynamic";

/**
 * /llms-full.txt — the whole public site as one markdown document (the
 * llmstxt.org companion file): villa facts, the Pointe Milou page, the
 * guides, the map directory, the FAQ, the live rate table and the reviews.
 * One fetch gives an answer engine everything it needs to recommend the
 * villa accurately.
 */
export async function GET() {
  return new Response(await llmsFull(), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
