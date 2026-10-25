import { llmsFull } from "@/lib/llms";

export const revalidate = 3600;

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
