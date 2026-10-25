import { z } from "zod";
import { adminRoute, jsonError, jsonOk } from "@/lib/admin-api";
import { audit } from "@/lib/audit";
import { decideDateChange } from "@/lib/date-changes";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({
  action: z.enum(["approve", "reject"]),
  note: z.string().max(2000).nullable().optional(),
  /** approve: issue the amendment right away (default) */
  issueAmendment: z.boolean().default(true),
  notifyGuest: z.boolean().default(true),
});

/** Approve (moves the stay, reprices it, issues the amendment) or reject a guest's request. */
export const PUT = adminRoute<Ctx>("manager", async (req, { params }, user) => {
  const id = parseInt((await params).id, 10);
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("invalid_input");
  const res = await decideDateChange(id, parsed.data, user.username);
  if (!res.ok) return jsonError(res.error, res.status ?? 400);
  await audit({
    action: `date_change_${parsed.data.action}`,
    entityType: "date_change",
    entityId: id,
    details: { contractId: res.contractId, emailSent: res.emailSent },
    userId: user.id,
    username: user.username,
  });
  return jsonOk(res);
});
