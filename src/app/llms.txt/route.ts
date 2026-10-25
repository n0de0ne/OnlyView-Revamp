import { llmsBrief } from "@/lib/llms";

// built from the admin-edited copy, guides and facts: read at request time
// (the image is built without a database), cached by the browser and CDN header
export const dynamic = "force-dynamic";

/**
 * /llms.txt — the plain-text brief AI answer engines read first when it
 * exists (the llmstxt.org convention): who we are, the facts that must not
 * be guessed, and where the detailed pages live. Kept factual and short so
 * it gets quoted rather than summarised. The whole site as text is at
 * /llms-full.txt.
 */
export async function GET() {
  return new Response(await llmsBrief(), {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
