import { expect } from "@playwright/test";
import type { Api } from "./api";

/** Generate (or generate and email) the agreement of a stay, as the reservation editor does. */
export async function issueContract(
  admin: Api,
  reservationId: number,
  opts: { send?: boolean; lang?: "en" | "fr"; previous?: { startDate: string; endDate: string } | null } = {}
) {
  const res = await admin.post(`/api/admin/reservations/${reservationId}/actions`, {
    action: opts.send ? "send-contract" : "generate-contract",
    ...(opts.lang ? { lang: opts.lang } : {}),
    ...(opts.previous !== undefined ? { previous: opts.previous } : {}),
  });
  expect(res.status, `issue contract: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body as {
    contract: { id: number; token: string; status: string; kind: "contract" | "amendment" };
    signUrl: string;
    emailSent: boolean;
    amendment: boolean;
  };
}

/** The contract as the back-office lists it. */
export async function contractRow(admin: Api, token: string) {
  const rows = (await admin.get("/api/admin/contracts")).body.contracts as any[];
  return rows.find((c) => c.token === token);
}

export const reservationOf = async (admin: Api, id: number) => (await admin.get(`/api/admin/reservations/${id}`)).body.reservation;

/** Change a stay as the editor's save does: the whole record goes back with the new values. */
export async function updateReservation(admin: Api, id: number, changes: Record<string, unknown>) {
  const r = await reservationOf(admin, id);
  const res = await admin.put(`/api/admin/reservations/${id}`, {
    status: r.status,
    startDate: r.startDate,
    endDate: r.endDate,
    clientId: r.clientId,
    clientName: r.clientName,
    email: r.email,
    phone: r.phone,
    bedrooms: r.bedrooms,
    guests: r.guests,
    agencyId: r.agencyId,
    agencyFeePercent: r.agencyFeePercent,
    customWeeklyRate: r.customWeeklyRate,
    finalPriceOverride: r.finalPriceOverride,
    discountPercent: r.discountPercent,
    offerOneRoom: r.offerOneRoom,
    freeNights: r.freeNights,
    noTax: r.noTax,
    promoCode: r.promoCode,
    optionExpires: r.optionExpires,
    depositReceived: r.depositReceived,
    balanceReceived: r.balanceReceived,
    notes: r.notes,
    periods: r.periods.map((p: any) => ({ startDate: p.startDate, endDate: p.endDate, bedrooms: p.bedrooms, weeklyRate: p.weeklyRate })),
    ...changes,
  });
  return res;
}

export async function addPayment(admin: Api, reservationId: number, kind: "deposit" | "balance" | "extra" | "refund", amount: number, receivedAt: string) {
  const res = await admin.post(`/api/admin/reservations/${reservationId}/actions`, {
    action: "add-payment",
    payment: { kind, amount, method: "wire", receivedAt },
  });
  expect(res.status, `add payment: ${JSON.stringify(res.body)}`).toBe(200);
  return res.body as { totalPaid: number };
}
