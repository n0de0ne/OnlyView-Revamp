import { NextRequest, NextResponse } from "next/server";
import { googleTagsConfig } from "@/lib/google-tags";
import { isBot } from "@/lib/analytics/ua";

export const dynamic = "force-dynamic";

/**
 * Which Google tags the public site may offer (components/site/GoogleTags).
 * Read at runtime rather than baked into pages, so an ID pasted in Réglages
 * applies without a deploy. The owner's own browser (admin session) and bots
 * get nothing: no banner, and no visits or conversions of theirs in Google.
 */
export async function GET(req: NextRequest) {
  const off = req.cookies.has("ov_admin") || isBot(req.headers.get("user-agent") ?? "");
  const config = off ? { ga: null, ads: null, labels: {} } : await googleTagsConfig();
  return NextResponse.json(config, { headers: { "Cache-Control": "private, max-age=300" } });
}
