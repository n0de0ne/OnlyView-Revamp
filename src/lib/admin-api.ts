import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { AuthError, requireUser, type Role, type SessionUser } from "./auth";

type Handler<Ctx> = (
  req: NextRequest,
  ctx: Ctx,
  user: SessionUser
) => Promise<NextResponse | Response>;

/**
 * Wrap an admin route handler with session + role enforcement and
 * uniform error responses.
 */
export function adminRoute<Ctx = unknown>(minRole: Role, handler: Handler<Ctx>) {
  return async (req: NextRequest, ctx: Ctx) => {
    try {
      const user = await requireUser(minRole);
      return await handler(req, ctx, user);
    } catch (e) {
      if (e instanceof AuthError) {
        return NextResponse.json({ success: false, error: e.message }, { status: e.status });
      }
      console.error("[admin-api]", e);
      return NextResponse.json(
        { success: false, error: "server_error" },
        { status: 500 }
      );
    }
  };
}

export function jsonError(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status });
}

/** 400 invalid_input, naming the offending fields so the UI can point at them. */
export function jsonInvalid(error: { issues: Array<{ path: PropertyKey[] }> }) {
  const fields = [...new Set(error.issues.map((i) => String(i.path[0] ?? "")).filter(Boolean))];
  return NextResponse.json({ success: false, error: "invalid_input", fields }, { status: 400 });
}

export function jsonOk(data: Record<string, unknown> = {}) {
  return NextResponse.json({ success: true, ...data });
}
