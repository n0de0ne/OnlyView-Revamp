import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createMagicLink } from "@/lib/guest-auth";
import { sendMail } from "@/lib/mailer";
import { emailButton, emailTexts, renderEmail } from "@/lib/email-templates";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const Body = z.object({
  email: z.string().email().max(200),
  locale: z.enum(["en", "fr"]).default("en"),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 400 });
  }
  const { email, locale } = parsed.data;
  const fr = locale === "fr";

  const client = await prisma.client.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Always answer success (no account enumeration)
  if (!client) return NextResponse.json({ success: true });

  const token = await createMagicLink(client.id);
  const url = `${SITE_URL}/api/account/login?token=${token}&locale=${locale}`;

  // wording: Admin → Textes du site → Emails
  const t = await emailTexts("magicLink", fr ? "fr" : "en");
  const { subject, html } = await renderEmail(
    "magicLink",
    fr ? "fr" : "en",
    { name: client.firstname },
    { button: emailButton(url, t.button) }
  );
  const { sent } = await sendMail({
    to: client.email!,
    toName: `${client.firstname} ${client.lastname}`,
    templateSlug: "guest_magic_link",
    clientId: client.id,
    subject,
    html,
  });

  // Development convenience: when SMTP is not configured, surface the link
  // locally so the flow can be exercised. Never in production.
  const devLink = !sent && process.env.NODE_ENV !== "production" ? url : undefined;

  return NextResponse.json({ success: true, devLink });
}
