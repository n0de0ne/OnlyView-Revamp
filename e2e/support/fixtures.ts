import { test as base, expect, type Browser, type BrowserContextOptions, type Page } from "@playwright/test";
import fs from "node:fs";
import { Api, newAdminClient, newClient, marked, testEmail, uniq } from "./api";
import { AUTH_FILE, BASE_URL, HAS_ADMIN, IS_PRODUCTION, WRITES_ALLOWED } from "./env";
import { addDays, laneWindow, today, type Lane } from "./dates";

export { expect };
export * from "./api";
export * from "./dates";
export * from "./env";

type Json = Record<string, any>;

/**
 * What a test created, removed again when it ends (newest first), whether it
 * passed or not. Anything that slips through is named "E2E …" and is swept by
 * the cleanup project (or `npm run e2e:cleanup`).
 */
export class Scratch {
  private undo: Array<() => Promise<unknown>> = [];
  constructor(readonly admin: Api) {}

  /** Register how to remove something the test created by other means. */
  track(remove: () => Promise<unknown>) {
    this.undo.push(remove);
  }

  async client(over: Json = {}) {
    const id = uniq();
    const data = {
      firstname: "E2E",
      lastname: `Guest ${id}`,
      email: testEmail(id),
      language: "en",
      country: "France",
      ...over,
    };
    const res = await this.admin.post("/api/admin/clients", data);
    expect(res.status, `create client: ${JSON.stringify(res.body)}`).toBe(200);
    const client = res.body.client as Json;
    this.track(() => this.admin.del(`/api/admin/clients/${client.id}`));
    return { ...client, fullName: `${data.firstname} ${data.lastname}` } as Json & { id: number; email: string; fullName: string };
  }

  async agency(over: Json = {}) {
    const res = await this.admin.post("/api/admin/agencies", { name: marked("Agency"), commissionPercent: 20, ...over });
    expect(res.status, `create agency: ${JSON.stringify(res.body)}`).toBe(200);
    const agency = res.body.agency as Json & { id: number; name: string };
    this.track(() => this.admin.del(`/api/admin/agencies/${agency.id}`));
    return agency;
  }

  /** A back-office account "e2e-…" (it still has its first password, like any new account). */
  async user(role: "owner" | "manager" | "viewer", over: Json = {}) {
    const id = uniq();
    const account = { username: `e2e-${id}`, email: testEmail(id), password: `E2e-first-${id}`, role, firstname: "E2E", lastname: role, ...over };
    const res = await this.admin.post("/api/admin/users", account);
    expect(res.status, `create user: ${JSON.stringify(res.body)}`).toBe(200);
    const userId = res.body.user.id as number;
    this.track(() => this.admin.del(`/api/admin/users/${userId}`));
    return { id: userId, ...account };
  }

  /** An extra of the guest catalog (bookable from the portal unless told otherwise). */
  async extra(over: Json = {}) {
    const name = marked("Extra");
    const res = await this.admin.post("/api/admin/extras", {
      nameEn: name,
      nameFr: name,
      price: 40,
      unit: "stay",
      categoryEn: "E2E tests",
      categoryFr: "E2E tests",
      ...over,
    });
    expect(res.status, `create extra: ${JSON.stringify(res.body)}`).toBe(200);
    const extra = res.body.extra as Json & { id: number; nameEn: string };
    this.track(() => this.admin.del(`/api/admin/extras/${extra.id}`));
    return extra;
  }

  /** A record of the concierge catalog: partners, taxis, boats, chef-offers, activities, activity-categories. */
  async concierge(type: string, data: Json) {
    const res = await this.admin.post(`/api/admin/concierge/${type}`, data);
    expect(res.status, `create concierge ${type}: ${JSON.stringify(res.body)}`).toBe(200);
    const item = res.body.item as Json & { id: number };
    this.track(() => this.admin.del(`/api/admin/concierge/${type}/${item.id}`));
    return item;
  }

  /** A pin of the island map (a restaurant guests can ask a table at, by default). */
  async place(over: Json = {}) {
    const res = await this.admin.post("/api/admin/map-places", {
      category: "restaurant",
      name: marked("Table"),
      lat: 17.9,
      lng: -62.83,
      bookingMode: "concierge",
      ...over,
    });
    expect(res.status, `create place: ${JSON.stringify(res.body)}`).toBe(200);
    const place = res.body.place as Json & { id: number; name: string; slug: string };
    this.track(() => this.admin.del(`/api/admin/map-places/${place.id}`));
    return place;
  }

  /**
   * A stay on free dates of the given lane. Dates already taken (a real
   * booking on the staging copy, a leftover) are skipped: the next slot is tried.
   */
  async reservation(lane: Lane, over: Json = {}, opts: { nights?: number; fromSlot?: number } = {}) {
    const nights = opts.nights ?? 7;
    let last: Json | null = null;
    for (let slot = opts.fromSlot ?? 0; slot < (opts.fromSlot ?? 0) + 12; slot++) {
      const dates = over.startDate ? { startDate: over.startDate, endDate: over.endDate } : laneWindow(lane, slot, nights);
      const res = await this.admin.post("/api/admin/reservations", {
        status: "confirmed",
        bedrooms: 4,
        guests: 8,
        clientName: marked("Stay"),
        ...dates,
        ...over,
      });
      if (res.status === 200) {
        const r = res.body.reservation as Json & { id: number; startDate: string; endDate: string };
        this.track(() => this.admin.del(`/api/admin/reservations/${r.id}`));
        return Object.assign(r, { slot });
      }
      last = res.body;
      if (res.status !== 409 || over.startDate) break;
    }
    throw new Error(`could not create a test stay in lane "${lane}": ${JSON.stringify(last)}`);
  }

  /** A client and their confirmed stay: what most guest-side tests start from. */
  async guestStay(lane: Lane, over: Json = {}, clientOver: Json = {}) {
    const client = await this.client(clientOver);
    const reservation = await this.reservation(lane, {
      clientId: client.id,
      clientName: client.fullName,
      email: client.email,
      ...over,
    });
    return { client, reservation };
  }

  async cleanup() {
    for (const remove of this.undo.reverse()) await remove().catch(() => {});
    this.undo = [];
  }
}

/** Sign the browser in to the guest portal as the client of a stay (the link the owner sends). */
export async function openGuestPortal(page: Page, admin: Api, reservationId: number, locale: "en" | "fr" = "en") {
  const link = await admin.post(`/api/admin/reservations/${reservationId}/actions`, { action: "portal-link" });
  expect(link.status, `portal link: ${JSON.stringify(link.body)}`).toBe(200);
  const token = new URL(link.body.portalUrl).searchParams.get("pt");
  // the session cookie is set on this call; the page is then opened on the target itself,
  // wherever the server believes its public address is
  await page.request.get(`/api/account/login?pt=${token}&locale=${locale}`, { maxRedirects: 0 });
  await page.goto(locale === "fr" ? "/fr/account" : "/account");
}

/** An API client signed in to the guest portal as the client of a stay. */
export async function guestApi(admin: Api, reservationId: number): Promise<Api> {
  const link = await admin.post(`/api/admin/reservations/${reservationId}/actions`, { action: "portal-link" });
  expect(link.status, `portal link: ${JSON.stringify(link.body)}`).toBe(200);
  const token = new URL(link.body.portalUrl).searchParams.get("pt");
  const guest = await newClient();
  await guest.get(`/api/account/login?pt=${token}`, { maxRedirects: 0 });
  return guest;
}

/**
 * A confirmed stay that starts within days (what unlocks the villa essentials
 * on the portal). Near dates may be taken by a real booking on a staging copy:
 * null when no gap of two nights is free in the next two weeks.
 */
export async function nearStay(scratch: Scratch) {
  const client = await scratch.client();
  for (let offset = 2; offset <= 12; offset++) {
    const startDate = addDays(today(), offset);
    const res = await scratch.admin.post("/api/admin/reservations", {
      status: "confirmed",
      bedrooms: 4,
      guests: 8,
      clientId: client.id,
      clientName: client.fullName,
      email: client.email,
      startDate,
      endDate: addDays(startDate, 2),
    });
    if (res.status === 200) {
      const reservation = res.body.reservation as Json & { id: number; startDate: string; endDate: string };
      scratch.track(() => scratch.admin.del(`/api/admin/reservations/${reservation.id}`));
      return { client, reservation };
    }
    if (res.status !== 409) throw new Error(`could not create a near stay: ${JSON.stringify(res.body)}`);
  }
  return null;
}

/** An API client signed in to the back-office as the given account. */
export async function signInAs(username: string, password: string): Promise<Api> {
  const client = await newClient();
  const res = await client.post("/api/admin/login", { username, password });
  expect(res.status, `sign in as ${username}: ${JSON.stringify(res.body)}`).toBe(200);
  return client;
}

/** A browser context signed in to the back-office as the owner of the run (the test is skipped without credentials). */
export async function adminContext(browser: Browser, options: BrowserContextOptions = {}) {
  base.skip(!HAS_ADMIN || !fs.existsSync(AUTH_FILE), "needs a back-office account: set E2E_ADMIN_USER and E2E_ADMIN_PASS");
  return browser.newContext({ storageState: AUTH_FILE, ...options });
}

/** A browser context with no session at all (the admin suites start signed in). */
export const ANONYMOUS = { storageState: { cookies: [], origins: [] } };

export interface SuiteOptions {
  /** Set per suite in playwright.config.ts: its pages open signed in to the back-office. */
  signedIn: boolean;
}

interface Fixtures {
  /** Back-office API, signed in as the owner account of the run. */
  admin: Api;
  /** Anonymous API client (a visitor). */
  visitor: Api;
  /** Creates test records and removes them after the test. Skips the test on the live site. */
  scratch: Scratch;
}

export const test = base.extend<Fixtures & SuiteOptions>({
  signedIn: [false, { option: true }],

  // back-office suites browse with the session saved by the setup project
  storageState: async ({ signedIn }, use) => {
    await use(signedIn && HAS_ADMIN && fs.existsSync(AUTH_FILE) ? AUTH_FILE : undefined);
  },

  admin: async ({}, use) => {
    base.skip(!HAS_ADMIN, "needs a back-office account: set E2E_ADMIN_USER and E2E_ADMIN_PASS");
    base.skip(!fs.existsSync(AUTH_FILE), "back-office sign-in did not run (setup project)");
    const admin = await newAdminClient();
    await use(admin);
    await admin.dispose();
  },

  visitor: async ({}, use) => {
    const visitor = await newClient();
    await use(visitor);
    await visitor.dispose();
  },

  scratch: async ({ admin }, use) => {
    base.skip(!WRITES_ALLOWED, `${BASE_URL} is the live site: tests that create data never run there`);
    const scratch = new Scratch(admin);
    await use(scratch);
    await scratch.cleanup();
  },

  // every page a test opens is watched: an uncaught script error or a 5xx from
  // the site fails the test even when its own assertions passed
  page: async ({ page, signedIn }, use, testInfo) => {
    // without credentials the screens of a back-office suite are skipped rather than failed
    base.skip(signedIn && !HAS_ADMIN, "needs a back-office account: set E2E_ADMIN_USER and E2E_ADMIN_PASS");
    base.skip(signedIn && !fs.existsSync(AUTH_FILE), "back-office sign-in did not run (setup project)");
    const problems: string[] = [];
    const origin = new URL(BASE_URL).origin;
    page.on("pageerror", (e) => problems.push(`script error on ${page.url()}: ${e.message}`));
    page.on("response", (res) => {
      if (res.status() >= 500 && res.url().startsWith(origin)) problems.push(`HTTP ${res.status()} ${res.url()}`);
    });
    await use(page);
    if (testInfo.status === "passed") {
      expect(problems, "the pages opened by this test raised errors").toEqual([]);
    }
  },
});

/** For tests that change something without `scratch` (a public form, a setting). */
export function requireWrites() {
  base.skip(IS_PRODUCTION, `${BASE_URL} is the live site: tests that create data never run there`);
}

/**
 * The public forms allow a handful of sends per hour and per address. A run
 * that hits that limit (several runs in the hour) is not a regression: the
 * test is skipped with a note rather than failed.
 */
export function skipIfRateLimited(status: number, what: string) {
  base.skip(status === 429, `${what}: hourly limit of the public form reached on this server, try again later`);
}
