import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendMail } from "@/lib/mailer";
import { ownerNotifyEmail } from "@/lib/contact";
import { esc, hourlyLimit, oneLine, requestIp } from "@/lib/request-guard"; // night GN-507/508

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().trim().min(2).max(120).refine(oneLine),
  email: z.string().email().max(200),
  message: z.string().min(5).max(4000),
  website: z.string().max(0).optional(), // honeypot
});

/** night GN-508: the contact form had no limit at all */
const rateLimited = hourlyLimit(8);

export async function POST(req: NextRequest) {
  if (rateLimited(requestIp(req.headers))) return NextResponse.json({ success: false, error: "rate_limited" }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 400 });
  }
  const { name, email, message } = parsed.data;
  await sendMail({
    to: await ownerNotifyEmail(),
    subject: `Website message — ${name}`,
    templateSlug: "contact_message",
    html: `<p><strong>${esc(name)}</strong> &lt;${esc(email)}&gt;</p><p style="background:#f6f4ef;padding:12px;border-radius:8px;white-space:pre-wrap;">${esc(message)}</p>`, // night GN-507
  });
  return NextResponse.json({ success: true });
}
