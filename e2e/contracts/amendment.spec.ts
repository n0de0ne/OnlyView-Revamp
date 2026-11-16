import { test, expect, addDays, emailLogs, laneWindow, today, TINY_PNG } from "../support/fixtures";
import { addPayment, contractRow, issueContract, reservationOf, updateReservation } from "../support/contracts";
import { pdfText } from "../support/pdf";

const longDate = (day: string, locale: "en" | "fr" = "en") =>
  new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(`${day}T00:00:00Z`)
  );
const money = (n: number) => Math.round(n).toLocaleString("en-US");
const signPage = async (visitor: any, token: string) => String((await visitor.get(`/contracts/sign/${token}`)).body).replace(/&nbsp;| | /g, " ");

/**
 * Amendments ("avenants"): once a stay has an agreement or money received, a
 * change of dates must give a document that names the dates released and
 * carries over what was paid. No checkbox: it is detected.
 */
test.describe("contract amendments", () => {
  test("moving a signed stay turns the next contract into an amendment naming the released dates", async ({ admin, visitor, scratch }) => {
    const { client, reservation } = await scratch.guestStay("contracts-amendment");
    const original = await issueContract(admin, reservation.id, { lang: "en" });
    const signed = await visitor.post("/api/contracts/sign", { token: original.contract.token, typedName: client.fullName, signature: TINY_PNG });
    expect(signed.status).toBe(200);

    // nothing to amend while the dates are those of the signed agreement
    expect((await reservationOf(admin, reservation.id)).releasedDates).toBeNull();

    const moved = laneWindow("contracts-amendment", reservation.slot + 1);
    const update = await updateReservation(admin, reservation.id, moved);
    expect(update.status, JSON.stringify(update.body)).toBe(200);
    const stay = update.body.reservation;
    expect(stay.releasedDates).toEqual({ startDate: reservation.startDate, endDate: reservation.endDate });
    // the move is on the stay's record
    expect(stay.dateChanges[0]).toMatchObject({ source: "admin", status: "approved", fromStart: reservation.startDate, toStart: moved.startDate });

    const amendment = await issueContract(admin, reservation.id, { send: true, lang: "en" });
    expect(amendment.amendment).toBe(true);
    expect(amendment.contract.kind).toBe("amendment");

    const html = await signPage(visitor, amendment.contract.token);
    expect(html, "released dates").toContain(longDate(reservation.startDate));
    expect(html).toContain(longDate(reservation.endDate));
    expect(html, "new dates").toContain(longDate(moved.startDate));
    expect(html).toContain(longDate(moved.endDate));

    const mail = (await emailLogs(admin)).find((l) => l.templateSlug === "contract_amendment_request" && l.recipientEmail === client.email);
    expect(mail, "amendment sent for signature").toBeTruthy();
    expect(mail!.body).toContain(`/contracts/sign/${amendment.contract.token}`);

    // the signed agreement stays signed and downloadable beside it
    expect((await contractRow(admin, original.contract.token)).status).toBe("signed");

    // the amendment is signed like a contract and its PDF certifies it
    expect((await visitor.post("/api/contracts/sign", { token: amendment.contract.token, typedName: client.fullName, signature: TINY_PNG })).status).toBe(200);
    const pdf = pdfText(await (await visitor.ctx.get(`/api/contracts/pdf/${amendment.contract.token}`)).body());
    expect(pdf).toMatch(/CERTIFICATION/i);
    // issued again for the same dates, it would still release the dates of the first agreement
    expect((await reservationOf(admin, reservation.id)).releasedDates).toEqual({ startDate: reservation.startDate, endDate: reservation.endDate });
  });

  test("money already received is carried into the amendment, with what remains to pay", async ({ admin, visitor, scratch }) => {
    const { reservation } = await scratch.guestStay("contracts-amendment", {}, {});
    // a deposit was wired, no contract was ever issued
    const deposit = Math.round(reservation.priceTTC * 0.3);
    await addPayment(admin, reservation.id, "deposit", deposit, addDays(today(), -10));
    const moved = laneWindow("contracts-amendment", reservation.slot + 1);
    expect((await updateReservation(admin, reservation.id, moved)).status).toBe(200);

    const issued = await issueContract(admin, reservation.id, { lang: "en" });
    expect(issued.contract.kind, "paid stay moved = amendment, even with no contract before").toBe("amendment");
    const after = await reservationOf(admin, reservation.id);
    const html = await signPage(visitor, issued.contract.token);
    expect(html).toContain(longDate(reservation.startDate));
    expect(html, "amount received").toContain(money(deposit));
    expect(html, "remaining balance").toContain(money(after.priceTTC - deposit));
    expect(html).toMatch(/already received/i);
  });

  test("a stay moved before any contract or payment gets a plain contract", async ({ admin, scratch }) => {
    const { reservation } = await scratch.guestStay("contracts-amendment");
    const moved = laneWindow("contracts-amendment", reservation.slot + 1);
    expect((await updateReservation(admin, reservation.id, moved)).status).toBe(200);
    expect((await reservationOf(admin, reservation.id)).releasedDates).toBeNull();
    const issued = await issueContract(admin, reservation.id);
    expect(issued.contract.kind).toBe("contract");
    expect(issued.amendment).toBe(false);
  });

  test("the released dates can be set by hand, or the amendment waived", async ({ admin, visitor, scratch }) => {
    const { client, reservation } = await scratch.guestStay("contracts-amendment");
    const first = await issueContract(admin, reservation.id, { lang: "en" });
    await visitor.post("/api/contracts/sign", { token: first.contract.token, typedName: client.fullName, signature: TINY_PNG });

    // a stay moved before the site kept track: the owner types the old dates
    const previous = { startDate: addDays(reservation.startDate, -30), endDate: addDays(reservation.startDate, -23) };
    const manual = await issueContract(admin, reservation.id, { lang: "en", previous });
    expect(manual.contract.kind).toBe("amendment");
    expect(await signPage(visitor, manual.contract.token)).toContain(longDate(previous.startDate));

    const bad = await admin.post(`/api/admin/reservations/${reservation.id}/actions`, {
      action: "generate-contract", previous: { startDate: previous.endDate, endDate: previous.startDate },
    });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe("invalid_previous_dates");

    const plain = await issueContract(admin, reservation.id, { lang: "en", previous: null });
    expect(plain.contract.kind).toBe("contract");
  });

  test("an amendment is written in French for a French guest", async ({ admin, visitor, scratch }) => {
    const { client, reservation } = await scratch.guestStay("contracts-amendment", {}, { language: "fr" });
    const first = await issueContract(admin, reservation.id);
    await visitor.post("/api/contracts/sign", { token: first.contract.token, typedName: client.fullName, signature: TINY_PNG });
    const moved = laneWindow("contracts-amendment", reservation.slot + 1);
    await updateReservation(admin, reservation.id, moved);
    const amendment = await issueContract(admin, reservation.id);
    expect(amendment.contract.kind).toBe("amendment");
    const html = String((await visitor.get(`/fr/contracts/sign/${amendment.contract.token}`)).body).replace(/&nbsp;| | /g, " ");
    expect(html).toContain(longDate(reservation.startDate, "fr"));
    expect(html).toContain(longDate(moved.startDate, "fr"));
    expect(html).toMatch(/AVENANT/i);
  });
});
