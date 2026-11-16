import { test, expect, emailLogs, guestApi, laneWindow, openGuestPortal, TINY_PNG, type Api } from "../support/fixtures";
import { issueContract, reservationOf } from "../support/contracts";

const pendingFor = async (admin: Api, reservationId: number) =>
  ((await admin.get("/api/admin/date-changes?status=pending")).body.changes as any[]).find((c) => c.reservation.id === reservationId);

/** A free window of the target lane for this stay (the preview says so), or throws. */
async function freeTarget(guest: Api, reservationId: number) {
  for (let slot = 0; slot < 5; slot++) {
    const target = laneWindow("portal-dates-target", slot);
    const res = await guest.post(`/api/account/reservations/${reservationId}/date-change`, { ...target, preview: true });
    if (res.status === 200) return { target, preview: res.body };
    if (res.status !== 409) throw new Error(`preview: ${JSON.stringify(res.body)}`);
  }
  throw new Error("no free window in the portal-dates-target lane");
}

/**
 * The guest asks to move the stay; the owner approves (the stay moves, is
 * repriced, and a signed stay gets an amendment) or rejects with a note.
 */
test.describe("guest portal: change of dates", () => {
  test("request from the portal, approved by the owner: the stay moves and an amendment goes out", async ({ page, admin, visitor, scratch }) => {
    const { client, reservation } = await scratch.guestStay("portal-dates");
    const id = reservation.id;
    // the stay has a signed agreement, so the move needs an amendment
    const original = await issueContract(admin, id, { lang: "en" });
    expect((await visitor.post("/api/contracts/sign", { token: original.contract.token, typedName: client.fullName, signature: TINY_PNG })).status).toBe(200);

    const guest = await guestApi(admin, id);
    const { target } = await freeTarget(guest, id);
    await guest.dispose();

    await openGuestPortal(page, admin, id);
    const section = page.locator("div.border-t").filter({ has: page.locator("button") }).filter({ hasText: /dates/i }).last();
    await section.getByRole("button").first().click();
    await page.locator(`#dc-start-${id}`).fill(target.startDate);
    await page.locator(`#dc-end-${id}`).fill(target.endDate);
    await page.locator(`#dc-msg-${id}`).fill("E2E: our flights moved");
    const buttons = page.locator(`#dc-msg-${id}`).locator("xpath=ancestor::div[contains(@class,'space-y-4')][1]").locator("button");
    const checked = page.waitForResponse((r) => r.url().includes(`/reservations/${id}/date-change`));
    await buttons.first().click(); // check availability
    expect((await checked).status()).toBe(200);
    await expect(page.locator("main")).toContainText("7 nights");
    const sent = page.waitForResponse((r) => r.url().includes(`/reservations/${id}/date-change`) && r.request().method() === "POST");
    await buttons.first().click(); // send the request
    expect((await sent).status()).toBe(200);
    await expect(page.locator(`#dc-start-${id}`)).toHaveCount(0);

    // the owner is told and finds it in the requests inbox
    const pending = await pendingFor(admin, id);
    expect(pending).toMatchObject({ status: "pending", toStart: target.startDate, toEnd: target.endDate, message: "E2E: our flights moved" });
    expect((await emailLogs(admin)).some((l) => l.templateSlug === "admin_guest_update" && l.reservationId === id)).toBe(true);
    expect((await admin.get("/api/admin/badges")).body.requests).toBeGreaterThan(0);

    const decision = await admin.put(`/api/admin/date-changes/${pending.id}`, { action: "approve", note: "E2E: with pleasure" });
    expect(decision.status, JSON.stringify(decision.body)).toBe(200);
    expect(decision.body.contractId, "an amendment was issued").toBeTruthy();

    const moved = await reservationOf(admin, id);
    expect(moved.startDate).toBe(target.startDate);
    expect(moved.endDate).toBe(target.endDate);
    expect(moved.releasedDates).toEqual({ startDate: reservation.startDate, endDate: reservation.endDate });
    const amendment = (moved.contracts as any[]).find((c) => c.id === decision.body.contractId);
    expect(amendment.kind).toBe("amendment");
    const mail = (await emailLogs(admin)).find((l) => l.templateSlug === "date_change_approved" && l.recipientEmail === client.email);
    expect(mail, "the guest is told").toBeTruthy();

    // the guest sees the answer, the new dates and the amendment to sign
    await page.reload();
    await expect(page.locator("main")).toContainText("E2E: with pleasure");
    await expect(page.locator('a[href*="/contracts/sign/"]').first()).toBeVisible();
    // a decision is final
    expect((await admin.put(`/api/admin/date-changes/${pending.id}`, { action: "reject" })).status).toBe(409);
  });

  test("a stay with no agreement yet is moved without an amendment", async ({ admin, scratch }) => {
    const { reservation } = await scratch.guestStay("portal-dates");
    const guest = await guestApi(admin, reservation.id);
    const { target, preview } = await freeTarget(guest, reservation.id);
    expect(preview.preview.nights).toBe(7);
    expect(preview.currentTTC).toBe(reservation.priceTTC);
    expect((await guest.post(`/api/account/reservations/${reservation.id}/date-change`, target)).status).toBe(200);
    const pending = await pendingFor(admin, reservation.id);
    const decision = await admin.put(`/api/admin/date-changes/${pending.id}`, { action: "approve", notifyGuest: false });
    expect(decision.status).toBe(200);
    expect(decision.body.contractId).toBeNull();
    expect(decision.body.emailSent).toBe(false);
    const moved = await reservationOf(admin, reservation.id);
    expect(moved.startDate).toBe(target.startDate);
    // the rent follows the new dates
    if (preview.preview.quotedTTC != null) expect(moved.priceTTC).toBe(preview.preview.quotedTTC);
    await guest.dispose();
  });

  test("rejected with a note: the stay stays put and the guest reads why", async ({ page, admin, scratch }) => {
    const { client, reservation } = await scratch.guestStay("portal-dates");
    const guest = await guestApi(admin, reservation.id);
    const { target } = await freeTarget(guest, reservation.id);
    expect((await guest.post(`/api/account/reservations/${reservation.id}/date-change`, target)).status).toBe(200);
    // one request at a time
    const again = await guest.post(`/api/account/reservations/${reservation.id}/date-change`, target);
    expect(again.status).toBe(409);
    expect(again.body.error).toBe("already_pending");
    await guest.dispose();

    const pending = await pendingFor(admin, reservation.id);
    const decision = await admin.put(`/api/admin/date-changes/${pending.id}`, { action: "reject", note: "E2E: those weeks are taken by family" });
    expect(decision.status).toBe(200);
    const same = await reservationOf(admin, reservation.id);
    expect(same.startDate).toBe(reservation.startDate);
    expect((await emailLogs(admin)).some((l) => l.templateSlug === "date_change_rejected" && l.recipientEmail === client.email)).toBe(true);

    await openGuestPortal(page, admin, reservation.id);
    await expect(page.locator("main")).toContainText("E2E: those weeks are taken by family");
    // and may ask again
    await expect(page.locator(`#dc-start-${reservation.id}`)).toHaveCount(0);
  });

  test("the guest withdraws a request before the owner answers", async ({ page, admin, scratch }) => {
    const { reservation } = await scratch.guestStay("portal-dates");
    const guest = await guestApi(admin, reservation.id);
    const { target } = await freeTarget(guest, reservation.id);
    expect((await guest.post(`/api/account/reservations/${reservation.id}/date-change`, target)).status).toBe(200);
    await guest.dispose();

    await openGuestPortal(page, admin, reservation.id);
    const withdrawn = page.waitForResponse((r) => r.url().includes("/date-change") && r.request().method() === "DELETE");
    await page.locator("button.underline").filter({ hasText: /withdraw/i }).click();
    expect((await withdrawn).status()).toBe(200);
    expect(await pendingFor(admin, reservation.id)).toBeUndefined();
    const all = ((await admin.get("/api/admin/date-changes")).body.changes as any[]).find((c) => c.reservation.id === reservation.id);
    expect(all.status).toBe("cancelled");
    // nothing left to withdraw
    const again = await page.request.delete(`/api/account/reservations/${reservation.id}/date-change`);
    expect(again.status()).toBe(404);
  });

  test("dates that are taken, in the past, identical or absurd are refused", async ({ admin, scratch }) => {
    const mine = await scratch.guestStay("portal-dates");
    const neighbour = await scratch.reservation("portal-dates");
    const guest = await guestApi(admin, mine.reservation.id);
    const ask = (startDate: string, endDate: string) =>
      guest.post(`/api/account/reservations/${mine.reservation.id}/date-change`, { startDate, endDate, preview: true });

    const taken = await ask(neighbour.startDate, neighbour.endDate);
    expect(taken.status).toBe(409);
    expect(taken.body.error).toBe("dates_unavailable");
    expect((await ask(mine.reservation.startDate, mine.reservation.endDate)).body.error).toBe("same_dates");
    expect((await ask("2020-01-01", "2020-01-08")).body.error).toBe("past_dates");
    expect((await ask(mine.reservation.endDate, mine.reservation.startDate)).body.error).toBe("invalid_dates");
    expect((await ask("soon", "later")).body.error).toBe("invalid_input");
    await guest.dispose();
  });

  test("approval fails cleanly when the dates were taken in the meantime", async ({ admin, scratch }) => {
    const { reservation } = await scratch.guestStay("portal-dates");
    const guest = await guestApi(admin, reservation.id);
    const { target } = await freeTarget(guest, reservation.id);
    expect((await guest.post(`/api/account/reservations/${reservation.id}/date-change`, target)).status).toBe(200);
    await guest.dispose();
    // someone else books those dates first
    await scratch.reservation("portal-dates-target", target);
    const pending = await pendingFor(admin, reservation.id);
    const decision = await admin.put(`/api/admin/date-changes/${pending.id}`, { action: "approve" });
    expect(decision.status).toBe(409);
    expect(decision.body.error).toBe("dates_unavailable");
    expect((await reservationOf(admin, reservation.id)).startDate).toBe(reservation.startDate);
  });
});
