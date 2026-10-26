import type { Dict } from "@/lib/i18n";

export interface GuestConciergeRequest {
  id: number;
  label: string;
  category: string | null;
  status: string;
  serviceDate: string | null;
  serviceTime: string | null;
  guests: number | null;
  notes: string | null;
  adminNote: string | null;
  /** answered since the guest last opened the portal */
  isNew: boolean;
  /** a table request's restaurant on the island map */
  placeSlug: string | null;
}

export const CONCIERGE_ICON: Record<string, string> = { restaurant: "🍽️", boat: "⛵", chef: "👨‍🍳", activity: "🤿" };

export const REQUEST_STATUS_STYLE: Record<string, string> = {
  requested: "bg-st-option/15 text-st-option border-st-option/40",
  confirmed: "bg-st-free/15 text-st-free border-st-free/40",
  declined: "bg-slate-100 text-slate-500 border-slate-300",
  cancelled: "bg-slate-100 text-slate-400 border-slate-200",
};

/** "Sat, Oct 2 · 8:00 PM · 4 guests" */
export function requestWhen(
  i: Pick<GuestConciergeRequest, "serviceDate" | "serviceTime" | "guests">,
  locale: "en" | "fr",
  t: Dict["account"]["conciergeRequests"]
) {
  const tag = locale === "fr" ? "fr-FR" : "en-US";
  const parts: string[] = [];
  if (i.serviceDate) {
    parts.push(
      new Date(`${i.serviceDate}T00:00:00Z`).toLocaleDateString(tag, {
        weekday: "short",
        day: "numeric",
        month: "short",
        timeZone: "UTC",
      })
    );
  }
  if (i.serviceTime) {
    parts.push(
      new Date(`1970-01-01T${i.serviceTime}:00Z`).toLocaleTimeString(tag, {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
      })
    );
  }
  if (i.guests != null) parts.push((i.guests > 1 ? t.guests : t.guest).replace("{n}", String(i.guests)));
  return parts.join(" · ");
}

