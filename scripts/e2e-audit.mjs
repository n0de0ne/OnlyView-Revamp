/**
 * End-to-end smoke test of the core back-office flows against a RUNNING app:
 * agencies, clients, reservations (pricing, conflicts, seasons), availability
 * + iCal, payments + loyalty, contracts (generate → sign → PDF), expenses,
 * stats cross-checks and every email path. Creates its own data in 2027 and
 * deletes it afterwards.
 *
 *   BASE_URL=http://localhost:3000 ADMIN_USER=admin ADMIN_PASS=... node scripts/e2e-audit.mjs
 */
const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ADMIN_USER = process.env.ADMIN_USER ?? "admin";
const ADMIN_PASS = process.env.ADMIN_PASS ?? "onlyview2026";
let cookie = "";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const results = [];
const ok = (name, cond, detail = "") => {
  results.push({ name, pass: !!cond, detail });
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
};

async function call(path, init = {}) {
  const res = await fetch(BASE + path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      cookie,
      ...(init.headers ?? {}),
    },
    body: init.json !== undefined ? JSON.stringify(init.json) : init.body,
    redirect: "manual",
  });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) cookie = setCookie.split(";")[0];
  const ct = res.headers.get("content-type") ?? "";
  const body = ct.includes("json") ? await res.json() : await res.arrayBuffer();
  return { status: res.status, body, headers: res.headers };
}


/** Text of a pdf-lib document: inflate streams, decode hex/literal Tj strings. */
function extractPdfText(bytes) {
  const zlib = require("node:zlib");
  const buf = Buffer.from(bytes);
  const s = buf.toString("latin1");
  let out = "";
  const re = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
  let m;
  while ((m = re.exec(s))) {
    const raw = Buffer.from(m[1], "latin1");
    let data;
    try { data = zlib.inflateSync(raw).toString("latin1"); } catch { data = m[1]; }
    for (const h of data.matchAll(/<([0-9A-Fa-f]+)>\s*Tj/g)) out += Buffer.from(h[1], "hex").toString("latin1") + " ";
    for (const p of data.matchAll(/\((.*?)\)\s*Tj/g)) out += p[1] + " ";
  }
  return out;
}

const uniq = Date.now().toString(36);

/* ── login ── */
const login = await call("/api/admin/login", { method: "POST", json: { username: ADMIN_USER, password: ADMIN_PASS } });
ok("admin login", login.status === 200 && login.body.success);

/* ── agencies ── */
const agency = await call("/api/admin/agencies", {
  method: "POST",
  json: { name: `Audit Agency ${uniq}`, commissionPercent: 20, contactName: "Marie", email: "marie@example.com" },
});
ok("agency create", agency.status === 200 && agency.body.agency?.id, JSON.stringify(agency.body).slice(0, 120));
const agencyId = agency.body.agency?.id;

/* ── clients ── */
const client = await call("/api/admin/clients", {
  method: "POST",
  json: { firstname: "Audit", lastname: `Client ${uniq}`, email: `audit-${uniq}@example.com`, language: "fr", country: "France", isVip: true, discountPercent: 0 },
});
ok("client create", client.status === 200 && client.body.client?.id, JSON.stringify(client.body).slice(0, 120));
const clientId = client.body.client?.id;
const search = await call(`/api/admin/clients?q=${uniq}`);
ok("client search", search.body.clients?.some((c) => c.id === clientId));
const upd = await call(`/api/admin/clients/${clientId}`, {
  method: "PUT",
  json: { firstname: "Audit", lastname: `Client ${uniq}`, email: `audit-${uniq}@example.com`, language: "fr", country: "France", isVip: true, discountPercent: 10, discountReason: "repeat guest", blacklisted: false, source: "direct" },
});
ok("client update (discount 10%)", upd.status === 200 && upd.body.client?.discountPercent === 10, JSON.stringify(upd.body).slice(0, 120));

/* ── reservation: winter week, agency 20%, 4 bedrooms ── */
const resIn = {
  status: "confirmed",
  startDate: "2027-02-06",
  endDate: "2027-02-13",
  clientId,
  clientName: `Audit Client ${uniq}`,
  email: `audit-${uniq}@example.com`,
  bedrooms: 4,
  guests: 8,
  agencyId,
  agencyFeePercent: 20,
  discountPercent: 0,
};
const quote = await call("/api/quote", { method: "POST", json: { startDate: resIn.startDate, endDate: resIn.endDate, bedrooms: 4 } });
ok("public quote endpoint", quote.status === 200 && quote.body.quote?.totalTTC > 0, `TTC ${quote.body.quote?.totalTTC}`);

const created = await call("/api/admin/reservations", { method: "POST", json: { ...resIn, sendConfirmationEmail: true } });
ok("reservation create", created.status === 200 && created.body.reservation?.id, JSON.stringify(created.body).slice(0, 160));
const r = created.body.reservation;
const rid = r?.id;
if (r) {
  const expectedTax = Math.round(r.priceHT * 0.05);
  ok("tax = 5% of HT", Math.abs(r.taxAmount - expectedTax) <= 1, `HT ${r.priceHT} tax ${r.taxAmount} TTC ${r.priceTTC}`);
  ok("TTC = HT + tax", Math.abs(r.priceTTC - (r.priceHT + r.taxAmount)) <= 1);
  ok("deposit = 30% TTC", Math.abs(r.depositAmount - Math.round(r.priceTTC * 0.3)) <= 1, `deposit ${r.depositAmount}`);
  ok("quote matches persisted TTC", Math.abs(quote.body.quote.totalTTC - r.priceTTC) <= 1, `${quote.body.quote.totalTTC} vs ${r.priceTTC}`);
  ok("agency linked with 20%", r.agency?.id === agencyId && r.agencyFeePercent === 20);
  ok("client linked", r.client?.id === clientId);
}

/* ── conflicts ── */
const overlap = await call("/api/admin/reservations", { method: "POST", json: { ...resIn, clientId: null, startDate: "2027-02-10", endDate: "2027-02-15", status: "option" } });
ok("overlapping option rejected (409)", overlap.status === 409, `status ${overlap.status} ${overlap.body?.error}`);
const backToBack = await call("/api/admin/reservations", { method: "POST", json: { ...resIn, clientId: null, agencyId: null, agencyFeePercent: 0, startDate: "2027-02-13", endDate: "2027-02-20", status: "option", optionExpires: "2027-01-15" } });
ok("back-to-back arrival on checkout day allowed", backToBack.status === 200, `status ${backToBack.status} ${backToBack.body?.error ?? ""}`);
const rid2 = backToBack.body.reservation?.id;
const cancelled = await call("/api/admin/reservations", { method: "POST", json: { ...resIn, clientId: null, agencyId: null, agencyFeePercent: 0, startDate: "2027-02-08", endDate: "2027-02-11", status: "cancelled" } });
ok("cancelled stay never blocks", cancelled.status === 200, `status ${cancelled.status}`);
const rid3 = cancelled.body.reservation?.id;

/* ── calendar / season listing ── */
const list = await call("/api/admin/reservations?season=2026");
ok("season 2026 (Sep26→Aug27) lists the Feb-2027 stays", list.body.reservations?.some((x) => x.id === rid) && list.body.reservations?.some((x) => x.id === rid2));
const listOther = await call("/api/admin/reservations?season=2027");
ok("season 2027 does not list them", !listOther.body.reservations?.some((x) => x.id === rid));

/* ── public availability + iCal ── */
const avail = await call("/api/availability");
const ranges = avail.body.bookings ?? [];
const rangeList = Array.isArray(ranges) ? ranges : [];
ok("public availability lists the confirmed stay", rangeList.some((x) => x.start === "2027-02-06" && x.end === "2027-02-13"), JSON.stringify(avail.body).slice(0, 140));
ok("public availability hides the cancelled one", !rangeList.some((x) => x.id === rid3));
const icalPub = await fetch(BASE + "/api/ical").then((x) => x.text());
ok("public iCal anonymized", icalPub.includes("DTSTART;VALUE=DATE:20270206") && !icalPub.includes(`Audit Client`));
const icalPriv = await fetch(BASE + "/api/ical", { headers: { cookie } }).then((x) => x.text());
ok("private iCal shows client name", icalPriv.includes("Audit Client"));

/* ── payments ── */
const dep = await call(`/api/admin/reservations/${rid}/actions`, { method: "POST", json: { action: "add-payment", payment: { kind: "deposit", amount: r.depositAmount, method: "wire", receivedAt: "2026-10-01" } } });
ok("deposit payment recorded", dep.status === 200 && dep.body.totalPaid === r.depositAmount);
let after = (await call(`/api/admin/reservations/${rid}`)).body.reservation;
ok("depositReceived flag set", after.depositReceived === true && after.balanceReceived === false);
const bal = await call(`/api/admin/reservations/${rid}/actions`, { method: "POST", json: { action: "add-payment", payment: { kind: "balance", amount: r.priceTTC - r.depositAmount, method: "wire", receivedAt: "2027-01-05" } } });
ok("balance payment recorded", bal.status === 200);
after = (await call(`/api/admin/reservations/${rid}`)).body.reservation;
ok("balanceReceived flag set after full payment", after.balanceReceived === true);
const loyalty = await call(`/api/admin/clients/${clientId}`);
const pts = loyalty.body.client?.loyalty?.points ?? loyalty.body.client?.loyalty?.lifetimePoints;
ok("loyalty points earned on paid stay (1pt/$100 HT)", pts === Math.floor(r.priceHT / 100), `points ${pts} expected ${Math.floor(r.priceHT / 100)}`);

/* ── contracts ── */
const gen = await call(`/api/admin/reservations/${rid}/actions`, { method: "POST", json: { action: "send-contract", lang: "fr" } });
ok("contract generated + email queued", gen.status === 200 && gen.body.contract?.token, JSON.stringify(gen.body).slice(0, 160));
const token = gen.body.contract?.token;
const contracts = await call(`/api/admin/contracts`);
const c = contracts.body.contracts?.find((x) => x.token === token);
ok("contract listed in admin", !!c);
ok("contract total = reservation TTC", c && Math.abs(c.totalPrice - r.priceTTC) <= 1, `${c?.totalPrice} vs ${r.priceTTC}`);
ok("contract deposit = 30% of total", c && Math.abs(c.depositAmount - Math.round(r.priceTTC * 0.3)) <= 1, `${c?.depositAmount}`);
const signPage = await fetch(`${BASE}/fr/contracts/sign/${token}`).then((x) => x.text());
ok("sign page renders contract (FR)", signPage.includes("CONTRAT DE LOCATION") && signPage.includes(String(Math.round(r.priceTTC)).replace(/\B(?=(\d{3})+(?!\d))/g, ",")), "amount in page");
const pdfBefore = await fetch(`${BASE}/api/contracts/pdf/${token}`);
const pdfBytes = new Uint8Array(await pdfBefore.arrayBuffer());
ok("unsigned PDF renders", pdfBefore.status === 200 && pdfBytes[0] === 0x25 && pdfBytes[1] === 0x50, `${pdfBytes.length} bytes`);
const png1x1 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const badName = await call("/api/contracts/sign", { method: "POST", json: { token, typedName: "Someone Else", signature: png1x1 } });
ok("signing with wrong name rejected", badName.status === 400 && badName.body.error === "name_mismatch");
const signed = await call("/api/contracts/sign", { method: "POST", json: { token, typedName: `audit client ${uniq}`, signature: png1x1 } });
ok("signing with matching name succeeds", signed.status === 200 && signed.body.success, JSON.stringify(signed.body));
const resign = await call("/api/contracts/sign", { method: "POST", json: { token, typedName: `Audit Client ${uniq}`, signature: png1x1 } });
ok("double signing rejected", resign.status === 404);
const cAfter = (await call(`/api/admin/contracts`)).body.contracts?.find((x) => x.token === token);
ok("contract status signed with timestamp + IP", cAfter?.status === "signed" && cAfter?.signedAt, `signedAt ${cAfter?.signedAt} ip ${cAfter?.signerIp}`);
const pdfSigned = await fetch(`${BASE}/api/contracts/pdf/${token}`);
const sbytes = new Uint8Array(await pdfSigned.arrayBuffer());
ok("signed PDF renders (larger, has signature)", pdfSigned.status === 200 && sbytes.length > pdfBytes.length, `${sbytes.length} vs ${pdfBytes.length} bytes`);
const pdfText = extractPdfText(sbytes);
ok("signed PDF carries e-signature certification (signatory / date / IP)", /CERTIFICATION/.test(pdfText) && /IP/.test(pdfText) && pdfText.includes(`Audit Client ${uniq}`));
const voidTry = await call(`/api/admin/contracts/${cAfter?.id}`, { method: "PUT", json: { action: "void" } });
ok("cannot void a signed contract", voidTry.status === 409);

/* ── expenses ── */
const stats0 = (await call("/api/admin/stats?season=2026")).body;
const nov0 = stats0.months.find((m) => m.month === "2026-11")?.expensesEUR ?? 0;
const exp1 = await call("/api/admin/expenses", { method: "POST", json: { date: "2026-11-15", category: "menage", amount: 450, description: `audit ${uniq}` } });
ok("one-off expense created", exp1.status === 200 && exp1.body.expense?.id);
const exp2 = await call("/api/admin/expenses", { method: "POST", json: { date: "2026-09-01", category: "assurance", amount: 100, description: `audit fixed ${uniq}`, isFixed: true, frequency: "monthly", paymentDay: 5 } });
ok("recurring expense created", exp2.status === 200 && exp2.body.expense?.id);
const expList = await call("/api/admin/expenses?season=2026");
ok("expenses listed for season", expList.body.expenses?.some((e) => e.id === exp1.body.expense.id) && expList.body.recurring?.some((e) => e.id === exp2.body.expense.id));

/* ── stats cross-check (season 2026) ── */
const stats = (await call("/api/admin/stats?season=2026")).body;
const feb = stats.months.find((m) => m.month === "2027-02");
const nov = stats.months.find((m) => m.month === "2026-11");
ok("stats: Feb-2027 revenue includes the confirmed stay only", feb && Math.abs(feb.revenueHT - r.priceHT) <= 1, `feb HT ${feb?.revenueHT} vs ${r.priceHT} (option/cancelled excluded)`);
ok("stats: commissions = 20% of TTC", feb && Math.abs(feb.commissions - Math.round(r.priceTTC * 0.2)) <= 1, `${feb?.commissions}`);
ok("stats: 7 nights booked in Feb", feb?.nightsBooked === 7, `${feb?.nightsBooked}`);
ok("stats: Nov expenses grew by 450 + recurring 100", nov && Math.abs(nov.expensesEUR - nov0 - 550) < 0.01, `${nov0} → ${nov?.expensesEUR}`);
ok("stats: recurring expense hits all 12 months", stats.months.every((m, i) => m.expensesEUR - stats0.months[i].expensesEUR >= 100), stats.months.map((m) => m.expensesEUR).join(","));
ok("stats: cash-in Oct-2026 = deposit", stats.months.find((m) => m.month === "2026-10")?.cashIn === r.depositAmount);
ok("stats: cash-in Jan-2027 = balance", stats.months.find((m) => m.month === "2027-01")?.cashIn === r.priceTTC - r.depositAmount);
const src = stats.sources.find((s) => s.name === `Audit Agency ${uniq}`);
ok("stats: booking source attributed to agency", src && src.count === 1 && Math.abs(src.revenue - r.priceHT) <= 1);
const agencies = (await call("/api/admin/agencies")).body.agencies;
const ag = agencies.find((a) => a.id === agencyId);
ok("agency stats: 1 reservation, commission 20% TTC", ag?.stats.reservations === 1 && Math.abs(ag.stats.commissions - r.priceTTC * 0.2) <= 1, JSON.stringify(ag?.stats));
const cl = (await call(`/api/admin/clients?q=${uniq}`)).body.clients.find((x) => x.id === clientId);
ok("client stats: 1 stay, 7 nights, spent = HT", cl?.stats.stays === 1 && cl?.stats.nights === 7 && Math.abs(cl.stats.spent - r.priceHT) <= 1, JSON.stringify(cl?.stats));

/* ── emails ── */
const req = await call("/api/booking-request", { method: "POST", json: { startDate: "2027-03-06", endDate: "2027-03-13", bedrooms: 3, guests: 6, name: `Web Guest ${uniq}`, email: `web-${uniq}@example.com`, locale: "fr", message: "Hello from audit" } });
ok("public booking request accepted", req.status === 200 && req.body.id);
const logs = (await call("/api/admin/email-logs?take=50")).body.logs;
const has = (slug, to) => logs.some((l) => l.templateSlug === slug && (!to || l.recipientEmail === to));
ok("email: admin notified of booking request", has("admin_booking_request"));
ok("email: guest acknowledgement", has("booking_request_ack", `web-${uniq}@example.com`));
ok("email: contract signature request to client", has("contract_signature_request", `audit-${uniq}@example.com`));
ok("email: admin notified of signed contract", has("contract_signed_admin"));
ok("email: client receives signed contract copy", has("contract_signed_client", `audit-${uniq}@example.com`));
ok("email: booking confirmation to client", has("booking_confirmed", `audit-${uniq}@example.com`));
const reqs = (await call("/api/admin/requests")).body.requests;
const myReq = reqs?.find((x) => x.id === req.body.id);
ok("request in admin inbox", !!myReq);

/* ── cleanup ── */
for (const id of [rid, rid2, rid3]) if (id) await call(`/api/admin/reservations/${id}`, { method: "DELETE" });
if (exp1.body.expense?.id) await call(`/api/admin/expenses/${exp1.body.expense.id}`, { method: "DELETE" });
if (exp2.body.expense?.id) await call(`/api/admin/expenses/${exp2.body.expense.id}`, { method: "DELETE" });
if (clientId) await call(`/api/admin/clients/${clientId}`, { method: "DELETE" });
if (agencyId) await call(`/api/admin/agencies/${agencyId}`, { method: "DELETE" });
if (myReq) await call(`/api/admin/requests/${myReq.id}`, { method: "DELETE" });

const failed = results.filter((x) => !x.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) console.log("FAILED:\n" + failed.map((f) => " - " + f.name + (f.detail ? ` (${f.detail})` : "")).join("\n"));
process.exit(failed.length ? 1 : 0);
