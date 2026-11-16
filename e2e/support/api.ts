import { request as pwRequest, type APIRequestContext, type APIResponse } from "@playwright/test";
import fs from "node:fs";
import { AUTH_FILE, BASE_URL, MARK } from "./env";

export interface ApiResult<T = any> {
  status: number;
  ok: boolean;
  body: T;
  headers: Record<string, string>;
  raw: APIResponse;
}

const httpCredentials = process.env.E2E_HTTP_USER
  ? { username: process.env.E2E_HTTP_USER, password: process.env.E2E_HTTP_PASS ?? "" }
  : undefined;

/** A plain HTTP client on the target site: anonymous by default, or with a saved session. */
export async function newClient(storageState?: string): Promise<Api> {
  const ctx = await pwRequest.newContext({
    baseURL: BASE_URL,
    storageState: storageState && fs.existsSync(storageState) ? storageState : undefined,
    httpCredentials,
    // tests read the status themselves
    failOnStatusCode: false,
  });
  return new Api(ctx);
}

export const newAdminClient = () => newClient(AUTH_FILE);

export class Api {
  constructor(readonly ctx: APIRequestContext) {}

  private async wrap(res: APIResponse): Promise<ApiResult> {
    const headers = res.headers();
    const type = headers["content-type"] ?? "";
    let body: any = null;
    if (type.includes("json")) body = await res.json().catch(() => null);
    else if (type.startsWith("text/") || type.includes("xml") || type.includes("calendar")) body = await res.text();
    return { status: res.status(), ok: res.ok(), body, headers, raw: res };
  }

  async get(url: string, opts: { headers?: Record<string, string>; maxRedirects?: number } = {}) {
    return this.wrap(await this.ctx.get(url, opts));
  }
  async post(url: string, data?: unknown, opts: { headers?: Record<string, string> } = {}) {
    return this.wrap(await this.ctx.post(url, { data, ...opts }));
  }
  async put(url: string, data?: unknown) {
    return this.wrap(await this.ctx.put(url, { data }));
  }
  async del(url: string) {
    return this.wrap(await this.ctx.delete(url));
  }
  dispose() {
    return this.ctx.dispose();
  }
}

/** Short unique token for names and emails of one test's records. */
export const uniq = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Every record a test creates is named "E2E …" so it can be recognised and swept. */
export const marked = (label: string, id = uniq()) => `${MARK} ${label} ${id}`;
export const isMarked = (s: string | null | undefined) => !!s && s.startsWith(`${MARK} `);

/** An address nobody receives mail at (example.com is reserved for this). */
export const testEmail = (id = uniq()) => `e2e-${id}@example.com`;

/** A 1×1 PNG, enough for the signature the server stores. */
export const TINY_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

/** The newest emails the app logged (sent, or queued when the server has no SMTP). */
export async function emailLogs(admin: Api, take = 100) {
  const res = await admin.get(`/api/admin/email-logs?take=${take}`);
  return (res.body?.logs ?? []) as Array<{
    templateSlug: string | null;
    recipientEmail: string;
    subject: string | null;
    body: string | null;
    reservationId: number | null;
    status: string;
  }>;
}

export async function settings(admin: Api): Promise<Record<string, string>> {
  const res = await admin.get("/api/admin/settings");
  return res.body?.settings ?? {};
}
