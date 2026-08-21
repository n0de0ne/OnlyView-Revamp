import { prisma } from "./db";

export async function audit(opts: {
  action: string;
  entityType?: string;
  entityId?: number;
  details?: unknown;
  userId?: number;
  username?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: opts.action,
        entityType: opts.entityType,
        entityId: opts.entityId,
        details: opts.details != null ? JSON.stringify(opts.details) : null,
        userId: opts.userId,
        username: opts.username,
      },
    });
  } catch {
    // audit must never break the main operation
  }
}
