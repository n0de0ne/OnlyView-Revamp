import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { login } from "@/lib/auth";
import { audit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const Body = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1).max(200),
});

const attempts = new Map<string, { count: number; at: number }>();

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const now = Date.now();
  const a = attempts.get(ip);
  if (a && now - a.at < 15 * 60_000 && a.count >= 10) {
    return NextResponse.json({ success: false, error: "rate_limited" }, { status: 429 });
  }

  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 400 });
  }

  const result = await login(parsed.data.username, parsed.data.password);
  if (!result.ok) {
    const cur = attempts.get(ip);
    attempts.set(ip, {
      count: cur && now - cur.at < 15 * 60_000 ? cur.count + 1 : 1,
      at: now,
    });
    return NextResponse.json({ success: false, error: "invalid_credentials" }, { status: 401 });
  }

  attempts.delete(ip);
  await audit({
    action: "login",
    userId: result.user.id,
    username: result.user.username,
  });
  return NextResponse.json({
    success: true,
    user: result.user,
    mustChangePassword: result.user.mustChangePassword,
  });
}
