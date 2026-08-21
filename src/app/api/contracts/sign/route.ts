import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { sendMail } from "@/lib/mailer";
import { SITE_URL } from "@/lib/seo";

export const dynamic = "force-dynamic";

const Body = z.object({
  token: z.string().min(16).max(128),
  typedName: z.string().min(2).max(150),
  signature: z
    .string()
    .startsWith("data:image/png;base64,")
    .max(400_000),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "invalid_input" }, { status: 400 });
  }
  const { token, typedName, signature } = parsed.data;

  const contract = await prisma.contract.findUnique({
    where: { token },
    include: { reservation: true },
  });
  if (!contract || contract.status !== "pending") {
    return NextResponse.json({ success: false, error: "not_signable" }, { status: 404 });
  }
  if (contract.expiresAt && contract.expiresAt < new Date()) {
    return NextResponse.json({ success: false, error: "expired" }, { status: 410 });
  }

  const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");
  if (norm(typedName) !== norm(contract.clientName)) {
    return NextResponse.json({ success: false, error: "name_mismatch" }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  await prisma.contract.update({
    where: { id: contract.id },
    data: {
      status: "signed",
      signatureData: signature,
      signedAt: new Date(),
      signerIp: ip,
      signerUserAgent: req.headers.get("user-agent")?.slice(0, 250) ?? null,
    },
  });

  await audit({
    action: "contract_signed",
    entityType: "contract",
    entityId: contract.id,
    details: { reservationId: contract.reservationId, by: typedName, ip },
  });

  // Notify the owner
  await sendMail({
    to: process.env.ADMIN_NOTIFY_EMAIL ?? "contact@onlyviewstbarth.com",
    subject: `Contract signed — ${contract.clientName}`,
    templateSlug: "contract_signed_admin",
    reservationId: contract.reservationId,
    html: `<p><strong>${contract.clientName}</strong> signed the rental agreement for reservation #${contract.reservationId}.</p>
<p><a href="${SITE_URL}/api/contracts/pdf/${contract.token}">Download the signed PDF</a></p>`,
  });

  return NextResponse.json({ success: true });
}
