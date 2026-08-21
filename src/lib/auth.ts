import "server-only";
import { cookies, headers } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "./db";

const COOKIE = "ov_admin";
const SESSION_DAYS = 7;

export type Role = "owner" | "manager" | "viewer";

export interface SessionUser {
  id: number;
  username: string;
  email: string;
  firstname: string | null;
  lastname: string | null;
  role: Role;
  mustChangePassword: boolean;
}

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function login(
  username: string,
  password: string
): Promise<{ ok: true; user: SessionUser } | { ok: false; error: string }> {
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: username.toLowerCase() }, { email: username.toLowerCase() }],
      isActive: true,
    },
  });
  // constant-time-ish: always run a bcrypt compare
  const hash = user?.passwordHash ?? "$2a$12$invalidinvalidinvalidinvaliduH6yGz0eQeQeQeQeQeQeQeQeQeQe";
  const valid = await bcrypt.compare(password, hash);
  if (!user || !valid) return { ok: false, error: "invalid_credentials" };

  const token = randomBytes(32).toString("hex");
  const h = await headers();
  await prisma.session.create({
    data: {
      token: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
      ipAddress: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
      userAgent: h.get("user-agent")?.slice(0, 250) ?? null,
    },
  });
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLogin: new Date() },
  });

  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });

  return { ok: true, user: toSessionUser(user) };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token: hashToken(token) } });
  }
  jar.delete(COOKIE);
}

function toSessionUser(u: {
  id: number;
  username: string;
  email: string;
  firstname: string | null;
  lastname: string | null;
  role: string;
  mustChangePassword: boolean;
}): SessionUser {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    firstname: u.firstname,
    lastname: u.lastname,
    role: (u.role as Role) ?? "viewer",
    mustChangePassword: u.mustChangePassword,
  };
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.isActive) {
    return null;
  }
  return toSessionUser(session.user);
}

/** Throws (redirect-friendly) when unauthenticated — for API routes. */
export async function requireUser(minRole?: Role): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new AuthError(401, "unauthenticated");
  if (minRole && !roleAtLeast(user.role, minRole)) {
    throw new AuthError(403, "forbidden");
  }
  return user;
}

const ROLE_RANK: Record<Role, number> = { viewer: 0, manager: 1, owner: 2 };
export function roleAtLeast(role: Role, min: Role): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export class AuthError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function changePassword(userId: number, newPassword: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: await bcrypt.hash(newPassword, 12),
      mustChangePassword: false,
    },
  });
}

export async function cleanExpiredSessions() {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
