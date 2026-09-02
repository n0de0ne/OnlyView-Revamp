import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { renderContractPdfFor } from "@/lib/contract-render";

export const dynamic = "force-dynamic";

/** Streams the contract PDF (with the signature + certification once signed). */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const contract = await prisma.contract.findUnique({
    where: { token },
    include: { reservation: true },
  });
  if (!contract) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { pdf, filename } = await renderContractPdfFor(contract);
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
