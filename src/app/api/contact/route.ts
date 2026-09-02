import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sendMail } from "@/lib/mailer";
import { ownerNotifyEmail } from "@/lib/contact";

export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email().max(200),
  message: z.string().min(5).max(4000),
  website: z.string().max(0).optional(), // honeypot
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 400 });
  }
  const { name, email, message } = parsed.data;
  await sendMail({
    to: await ownerNotifyEmail(),
    subject: `Website message — ${name}`,
    templateSlug: "contact_message",
    html: `<p><strong>${name}</strong> &lt;${email}&gt;</p><p style="background:#f6f4ef;padding:12px;border-radius:8px;white-space:pre-wrap;">${message.replace(/</g, "&lt;")}</p>`,
  });
  return NextResponse.json({ success: true });
}
