import "server-only";
import { cookies } from "next/headers";
import { randomBytes, createHash } from "node:crypto";
import { prisma } from "./db";

const COOKIE = "ov_guest";
const LINK_TTL_HOURS = 24 * 7;
const SESSION_DAYS = 30;

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

/** Create a magic-link token for a client (guest portal login). */
export async function createMagicLink(clientId: number): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.clientAuthToken.create({
    data: {
      tokenHash: hashToken(token),
      clientId,
      expiresAt: new Date(Date.now() + LINK_TTL_HOURS * 3600000),
    },
  });
  return token;
}

/**
 * Redeem a magic link → open a guest session cookie.
 * Single-use inside its validity window.
 */
export async function redeemMagicLink(token: string): Promise<number | null> {
  const row = await prisma.clientAuthToken.findUnique({
    where: { tokenHash: hashToken(token) },
  });
  if (!row || row.expiresAt < new Date() || row.usedAt) return null;
  await prisma.clientAuthToken.update({
    where: { id: row.id },
    data: { usedAt: new Date() },
  });
  await openGuestSession(row.clientId);
  return row.clientId;
}

/**
 * Guest session cookie: `clientId.tokenHash` where a matching non-expired
 * ClientAuthToken row (kind: session) must exist. We reuse ClientAuthToken
 * storage with a long expiry for sessions.
 */
export async function openGuestSession(clientId: number): Promise<void> {
  const token = randomBytes(32).toString("hex");
  await prisma.clientAuthToken.create({
    data: {
      tokenHash: hashToken("sess:" + token),
      clientId,
      expiresAt: new Date(Date.now() + SESSION_DAYS * 86400000),
      usedAt: new Date(), // marks it as a session row (not a pending link)
    },
  });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function getGuestClientId(): Promise<number | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const row = await prisma.clientAuthToken.findUnique({
    where: { tokenHash: hashToken("sess:" + token) },
  });
  if (!row || row.expiresAt < new Date()) return null;
  return row.clientId;
}

export async function guestLogout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    await prisma.clientAuthToken.deleteMany({
      where: { tokenHash: hashToken("sess:" + token) },
    });
  }
  jar.delete(COOKIE);
}

/** Reservation-scoped portal token (sent by the admin, like the PHP portal). */
export async function resolvePortalToken(token: string) {
  if (!token || token.length < 16) return null;
  return prisma.reservation.findUnique({
    where: { portalToken: token },
    include: { client: true },
  });
}

export function newPortalToken(): string {
  return randomBytes(24).toString("hex");
}
