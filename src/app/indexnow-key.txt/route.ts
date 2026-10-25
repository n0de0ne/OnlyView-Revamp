import { getIndexNowKey, indexNowEnabled } from "@/lib/indexnow";

export const dynamic = "force-dynamic";

/** The IndexNow key file the engines fetch to verify a submission came from
    this host. Its content is the key itself, nothing else. */
export async function GET() {
  if (!indexNowEnabled()) return new Response("Not found", { status: 404 });
  let key: string;
  try {
    key = await getIndexNowKey();
  } catch {
    return new Response("Unavailable", { status: 503 });
  }
  return new Response(key, {
    headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=86400" },
  });
}
