import { isMarked, type Api } from "./api";
import { MARK } from "./env";

/**
 * Removes every record named "E2E …" that tests left behind (a run that was
 * interrupted, a test that failed before its own cleanup). Only records
 * carrying the marker are touched. Returns what was removed, by kind.
 */
export async function sweep(admin: Api): Promise<Record<string, number>> {
  const removed: Record<string, number> = {};
  const drop = async (kind: string, url: string) => {
    const res = await admin.del(url);
    if (res.ok) removed[kind] = (removed[kind] ?? 0) + 1;
  };
  const list = async (url: string, key: string): Promise<any[]> => (await admin.get(url)).body?.[key] ?? [];

  // stays first: contracts, payments, extras and date changes go with them
  for (const r of await list("/api/admin/reservations?archived=all", "reservations")) {
    if (isMarked(r.clientName) || r.client?.firstname === MARK) await drop("reservations", `/api/admin/reservations/${r.id}`);
  }
  for (const r of await list("/api/admin/requests", "requests")) {
    if (isMarked(r.name)) await drop("requests", `/api/admin/requests/${r.id}`);
  }
  // the client search returns a dozen rows at a time
  for (let round = 0; round < 50; round++) {
    const found = (await list(`/api/admin/clients?q=${MARK}`, "clients")).filter((c) => c.firstname === MARK);
    if (!found.length) break;
    for (const c of found) await drop("clients", `/api/admin/clients/${c.id}`);
  }
  for (const a of await list("/api/admin/agencies", "agencies")) {
    if (isMarked(a.name)) await drop("agencies", `/api/admin/agencies/${a.id}`);
  }
  const exp = (await admin.get("/api/admin/expenses")).body ?? {};
  for (const e of [...(exp.expenses ?? []), ...(exp.recurring ?? [])]) {
    if (isMarked(e.description)) await drop("expenses", `/api/admin/expenses/${e.id}`);
  }
  for (const p of await list("/api/admin/promotions", "promotions")) {
    if (isMarked(p.name)) await drop("promotions", `/api/admin/promotions/${p.id}`);
  }
  for (const p of await list("/api/admin/rate-periods", "periods")) {
    if (isMarked(p.name)) await drop("rate periods", `/api/admin/rate-periods/${p.id}`);
  }
  for (const x of await list("/api/admin/extras", "extras")) {
    if (isMarked(x.nameEn)) await drop("extras", `/api/admin/extras/${x.id}`);
  }
  for (const p of await list("/api/admin/map-places", "places")) {
    if (isMarked(p.name)) await drop("map places", `/api/admin/map-places/${p.id}`);
  }
  for (const g of await list("/api/admin/guides", "guides")) {
    if (String(g.slug).startsWith("e2e-")) await drop("guide articles", `/api/admin/guides/${g.id}`);
  }
  for (const t of await list("/api/admin/testimonials", "testimonials")) {
    if (isMarked(t.name)) await drop("reviews", `/api/admin/testimonials?id=${t.id}`);
  }
  for (const type of ["taxis", "boats", "chef-offers", "activities", "activity-categories", "partners"]) {
    for (const i of await list(`/api/admin/concierge/${type}`, "items")) {
      if (isMarked(i.name) || isMarked(i.nameEn)) await drop(`concierge ${type}`, `/api/admin/concierge/${type}/${i.id}`);
    }
  }
  for (const u of await list("/api/admin/users", "users")) {
    if (String(u.username).startsWith("e2e-")) await drop("users", `/api/admin/users/${u.id}`);
  }
  return removed;
}
