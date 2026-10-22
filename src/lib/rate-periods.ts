import type { RatePeriod } from "@prisma/client";
import { toISODate } from "./dates";

export function serializeRatePeriod(p: RatePeriod) {
  return {
    ...p,
    startDate: toISODate(p.startDate),
    endDate: toISODate(p.endDate),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}
