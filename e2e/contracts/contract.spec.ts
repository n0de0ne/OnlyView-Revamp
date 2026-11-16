import { test, expect, emailLogs, settings, today, TINY_PNG } from "../support/fixtures";
import { contractRow, issueContract } from "../support/contracts";
import { isPdf, pdfText } from "../support/pdf";

const money = (n: number) => Math.round(n).toLocaleString("en-US");

/** A rental agreement, from the owner generating it to the guest's signed copy. */
test.describe("rental agreement", () => {
  test("is generated from the stay with its amounts, and can be read and downloaded by the guest", async ({ admin, visitor, scratch }) => {
    const { client, reservation } = await scratch.guestStay("contracts");
    const s = await settings(admin);
    const issued = await issueContract(admin, reservation.id, { lang: "en" });
    expect(issued.contract).toMatchObject({ status: "pending", kind: "contract" });
    expect(issued.amendment).toBe(false);
    expect(issued.emailSent).toBe(false);
    expect(new URL(issued.signUrl).pathname).toBe(`/contracts/sign/${issued.contract.token}`);

    const row = await contractRow(admin, issued.contract.token);
    expect(row).toMatchObject({ status: "pending", language: "en", clientName: client.fullName, clientEmail: client.email, viewCount: 0 });
    expect(Math.round(row.totalPrice)).toBe(Math.round(reservation.priceTTC));
    expect(Math.round(row.depositAmount)).toBe(Math.round((reservation.priceTTC * Number(s.deposit_percent)) / 100));
    expect(row.reservation).toMatchObject({ id: reservation.id, startDate: reservation.startDate, endDate: reservation.endDate });
    // valid for a month
    expect(Date.parse(row.expiresAt) - Date.now()).toBeGreaterThan(25 * 86_400_000);

    const page = await visitor.get(new URL(issued.signUrl).pathname);
    expect(page.status).toBe(200);
    const html = String(page.body);
    expect(html).toContain(client.fullName);
    expect(html).toContain(money(reservation.priceTTC));
    expect(html).toContain(money(row.depositAmount));
    expect(html).toContain(s.bank_iban);

    const pdf = await visitor.ctx.get(`/api/contracts/pdf/${issued.contract.token}`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()["content-type"]).toBe("application/pdf");
    const bytes = await pdf.body();
    expect(isPdf(bytes)).toBe(true);
    const text = pdfText(bytes);
    expect(text).toContain(client.fullName);
    expect(text).not.toMatch(/CERTIFICATION/i);
  });

  test("emailing it sends the guest their signature link, in their language", async ({ admin, scratch }) => {
    const { client, reservation } = await scratch.guestStay("contracts", {}, { language: "fr" });
    // no language asked: the client's own is used
    const issued = await issueContract(admin, reservation.id, { send: true });
    expect(new URL(issued.signUrl).pathname).toBe(`/fr/contracts/sign/${issued.contract.token}`);
    const mail = (await emailLogs(admin)).find((l) => l.templateSlug === "contract_signature_request" && l.recipientEmail === client.email);
    expect(mail, "signature request in the email log").toBeTruthy();
    expect(mail!.reservationId).toBe(reservation.id);
    expect(mail!.body).toContain(`/fr/contracts/sign/${issued.contract.token}`);
    expect((await contractRow(admin, issued.contract.token)).language).toBe("fr");
  });

  test("generating it again replaces the unsigned one, whose link stops working", async ({ admin, visitor, scratch }) => {
    const { reservation } = await scratch.guestStay("contracts");
    const first = await issueContract(admin, reservation.id);
    const second = await issueContract(admin, reservation.id);
    expect(second.contract.token).not.toBe(first.contract.token);
    expect((await contractRow(admin, first.contract.token)).status).toBe("void");
    expect((await contractRow(admin, second.contract.token)).status).toBe("pending");
    // still a plain contract: nothing was signed or paid in between
    expect(second.contract.kind).toBe("contract");

    const refused = await visitor.post("/api/contracts/sign", { token: first.contract.token, typedName: reservation.clientName, signature: TINY_PNG });
    expect(refused.status).toBe(404);
    const oldPage = String((await visitor.get(`/contracts/sign/${first.contract.token}`)).body);
    expect(oldPage).not.toContain('id="sig-name"');
  });

  test("the guest signs with their own name only, once, and everyone gets the signed copy", async ({ admin, visitor, scratch }) => {
    const { client, reservation } = await scratch.guestStay("contracts");
    const issued = await issueContract(admin, reservation.id, { send: true, lang: "en" });
    const token = issued.contract.token;
    const unsigned = await (await visitor.ctx.get(`/api/contracts/pdf/${token}`)).body();

    const sign = (body: Record<string, unknown>) => visitor.post("/api/contracts/sign", { token, signature: TINY_PNG, ...body });
    const wrongName = await sign({ typedName: "Someone Else" });
    expect(wrongName.status).toBe(400);
    expect(wrongName.body.error).toBe("name_mismatch");
    expect((await sign({ typedName: client.fullName, signature: "data:image/jpeg;base64,AAAA" })).status, "not a drawn signature").toBe(400);
    expect((await contractRow(admin, token)).status).toBe("pending");

    // capitals and extra spaces do not matter
    const signed = await sign({ typedName: `  ${client.fullName.toUpperCase().replace(" ", "   ")} ` });
    expect(signed.status, JSON.stringify(signed.body)).toBe(200);
    expect(signed.body.copySentTo).toBe(client.email);

    const row = await contractRow(admin, token);
    expect(row.status).toBe("signed");
    expect(row.signedAt.slice(0, 10)).toBe(today());

    expect((await sign({ typedName: client.fullName })).status, "a signed agreement cannot be signed again").toBe(404);
    expect((await admin.put(`/api/admin/contracts/${row.id}`, { action: "void" })).status, "nor cancelled").toBe(409);

    const pdf = await (await visitor.ctx.get(`/api/contracts/pdf/${token}`)).body();
    expect(pdf.length).toBeGreaterThan(unsigned.length);
    const text = pdfText(pdf);
    expect(text).toMatch(/CERTIFICATION/i);
    expect(text).toContain(client.fullName);

    const logs = (await emailLogs(admin)).filter((l) => l.reservationId === reservation.id);
    expect(logs.find((l) => l.templateSlug === "contract_signed_admin"), "owner told the contract is signed").toBeTruthy();
    const copy = logs.find((l) => l.templateSlug === "contract_signed_client");
    expect(copy, "signed copy to the guest").toBeTruthy();
    expect(copy!.recipientEmail).toBe(client.email);

    // the stay's own record shows the signed agreement
    const stay = (await admin.get(`/api/admin/reservations/${reservation.id}`)).body.reservation;
    expect(stay.contracts[0]).toMatchObject({ token, status: "signed", kind: "contract" });
  });

  test("an unsigned agreement can be cancelled or given another month", async ({ admin, visitor, scratch }) => {
    const { reservation } = await scratch.guestStay("contracts");
    const issued = await issueContract(admin, reservation.id);
    const row = await contractRow(admin, issued.contract.token);

    expect((await admin.put(`/api/admin/contracts/${row.id}`, { action: "void" })).status).toBe(200);
    expect((await contractRow(admin, issued.contract.token)).status).toBe("void");
    const refused = await visitor.post("/api/contracts/sign", { token: issued.contract.token, typedName: reservation.clientName, signature: TINY_PNG });
    expect(refused.status).toBe(404);

    expect((await admin.put(`/api/admin/contracts/${row.id}`, { action: "extend" })).status).toBe(200);
    const extended = await contractRow(admin, issued.contract.token);
    expect(extended.status).toBe("pending");
    expect(Date.parse(extended.expiresAt) - Date.now()).toBeGreaterThan(29 * 86_400_000);

    expect((await admin.put(`/api/admin/contracts/${row.id}`, { action: "shred" })).status).toBe(400);
    expect((await admin.put("/api/admin/contracts/999999999", { action: "void" })).status).toBe(404);
  });

  test("it cannot be emailed to a guest without an address, nor made for a stay without a name", async ({ admin, scratch }) => {
    const noEmail = await scratch.reservation("contracts", { email: null });
    const send = await admin.post(`/api/admin/reservations/${noEmail.id}/actions`, { action: "send-contract" });
    expect(send.status).toBe(400);
    expect(send.body.error).toBe("missing_client_email");
    // it can still be generated, to hand over another way
    expect((await admin.post(`/api/admin/reservations/${noEmail.id}/actions`, { action: "generate-contract" })).status).toBe(200);

    const noName = await scratch.reservation("contracts", { clientName: null, status: "blocked" });
    scratch.track(async () => {});
    const gen = await admin.post(`/api/admin/reservations/${noName.id}/actions`, { action: "generate-contract" });
    expect(gen.status).toBe(400);
    expect(gen.body.error).toBe("missing_client_name");
  });

  test("the contract list and its actions are closed to visitors; a wrong link gives nothing away", async ({ visitor }) => {
    expect((await visitor.get("/api/admin/contracts")).status).toBe(401);
    expect((await visitor.put("/api/admin/contracts/1", { action: "void" })).status).toBe(401);
    expect((await visitor.get("/api/contracts/pdf/0000000000000000")).status).toBe(404);
    const page = await visitor.get("/contracts/sign/0000000000000000");
    expect(page.status).toBe(200);
    expect(String(page.body)).not.toContain('id="sig-name"');
    expect((await visitor.post("/api/contracts/sign", { token: "0000000000000000", typedName: "Nobody", signature: TINY_PNG })).status).toBe(404);
  });
});
