import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createMagicLink } from "@/lib/guest-auth";
import { sendMail } from "@/lib/mailer";
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

  const { sent } = await sendMail({
    to: client.email!,
    toName: `${client.firstname} ${client.lastname}`,
    templateSlug: "guest_magic_link",
    clientId: client.id,
    subject: fr
      ? "Votre lien de connexion — Villa ONLY VIEW"
      : "Your sign-in link — Villa ONLY VIEW",
    html: fr
      ? `<p>Bonjour <strong>${client.firstname}</strong>,</p>
<p>Voici votre lien de connexion à votre espace client Villa ONLY VIEW :</p>
<p style="text-align:center;margin:24px 0;"><a href="${url}" style="background:#C9A962;color:#fff;padding:13px 26px;text-decoration:none;letter-spacing:0.1em;">ACCÉDER À MON ESPACE</a></p>
<p style="font-size:12px;color:#8a8a8a;">Ce lien est valable 7 jours et ne peut être utilisé qu'une fois.</p>`
      : `<p>Hello <strong>${client.firstname}</strong>,</p>
<p>Here is your sign-in link for your Villa ONLY VIEW guest portal:</p>
<p style="text-align:center;margin:24px 0;"><a href="${url}" style="background:#C9A962;color:#fff;padding:13px 26px;text-decoration:none;letter-spacing:0.1em;">OPEN MY PORTAL</a></p>
<p style="font-size:12px;color:#8a8a8a;">This link is valid for 7 days and can only be used once.</p>`,
  });

  // Development convenience: when SMTP is not configured, surface the link
  // locally so the flow can be exercised. Never in production.
  const devLink = !sent && process.env.NODE_ENV !== "production" ? url : undefined;

  return NextResponse.json({ success: true, devLink });
}
