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

export function jsonOk(data: Record<string, unknown> = {}) {
  return NextResponse.json({ success: true, ...data });
}
