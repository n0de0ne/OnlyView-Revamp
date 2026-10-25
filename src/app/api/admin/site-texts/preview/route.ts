import { z } from "zod";
import { adminRoute, jsonError, jsonInvalid, jsonOk } from "@/lib/admin-api";
import { previewContentBlock } from "@/lib/site-content";
import { emailButton, emailNote, emailTable, renderEmailSubject, renderEmailText } from "@/lib/email-templates";
import { buildContract, contractToHtml, type ContractTemplate } from "@/lib/contract-content";
import { wrapEmail } from "@/lib/mailer";
import { getRateConfig, getSettings } from "@/lib/settings";
import { addDays, formatDate, todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

const Body = z.object({ key: z.string().min(1), locale: z.enum(["en", "fr"]), value: z.unknown() });

/**
 * How a guest email or the contract reads with the draft wording, filled with
 * a made-up stay, before the owner saves it (Admin → Textes du site).
 */
export const POST = adminRoute("viewer", async (req) => {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonInvalid(parsed.error);
  const { key, locale, value } = parsed.data;
  const draft = await previewContentBlock(key, locale, value);
  if (draft === null) return jsonError("invalid_shape");
  const fr = locale === "fr";
  const checkIn = addDays(todayISO(), 60);
  const checkOut = addDays(checkIn, 7);
  const ci = formatDate(checkIn, locale);
  const co = formatDate(checkOut, locale);
  const name = "Jane Smith";

  if (key === "contractText") {
    const [s, rates] = await Promise.all([getSettings(), getRateConfig()]);
    const contract = buildContract({
      clientName: name,
      checkIn,
      checkOut,
      nights: 7,
      bedrooms: 3,
      guests: 6,
      totalPrice: 35000,
      lang: locale,
      ownerName: s.owner_name ?? "Annie CHRIQUI",
      depositRate: rates.depositPercent,
      template: draft as unknown as ContractTemplate,
      bank: {
        accountName: s.bank_account_name ?? "",
        accountNumber: s.bank_account_number ?? "",
        bankName: s.bank_name ?? "",
        iban: s.bank_iban ?? "",
        bic: s.bank_bic ?? "",
      },
    });
    return jsonOk({ subject: contract.title, html: contractToHtml(contract), kind: "contract" });
  }

  if (!key.startsWith("emails.")) return jsonError("no_preview");
  const t = draft as Record<string, string>;
  const stay = `${ci} → ${co}`;
  const sampleNote = fr ? "(Le mot que vous ajoutez pour le client.)" : "(The note you add for the guest.)";
  const text: Record<string, string | number> = {
    name,
    checkIn: ci,
    checkOut: co,
    previousCheckIn: formatDate(addDays(checkIn, -7), locale),
    previousCheckOut: formatDate(addDays(checkOut, -7), locale),
    bedrooms: 3,
    guests: 6,
    stay,
    expires: formatDate(addDays(todayISO(), 3), locale),
    amount: "$17,500 USD",
    due: formatDate(addDays(checkIn, -30), locale),
    from: `${formatDate(addDays(checkIn, -7), locale)} → ${formatDate(addDays(checkOut, -7), locale)}`,
    to: stay,
    request: "Le Tamarin",
    verdict: t.verdictConfirmed ?? "",
    status: (t.statusConfirmed ?? "").toLowerCase(),
    otherOption: "",
  };
  const button = (label?: string) => (label ? emailButton("#", label) : "");
  const blocks: Record<string, string> = {
    button: button(t.button),
    details: emailTable([
      [fr ? "Arrivée" : "Arrival", ci],
      [fr ? "Départ" : "Departure", co],
      [fr ? "Total" : "Total", "$35,000 USD"],
    ]),
    summary: emailTable([
      [fr ? "Séjour" : "Stay", stay],
      [fr ? "Total" : "Total", "$35,000 USD"],
    ]),
    bank: emailTable([["IBAN", "FR76 …"], ["BIC/SWIFT", "…"]]),
    note: emailNote(sampleNote),
    arrivalDetails: renderEmailText(t.askDetails ?? "", text),
    practical: emailTable([
      [fr ? "Arrivée" : "Check-in", "16:00"],
      [fr ? "Départ" : "Check-out", "11:00"],
    ]),
    amendment: t.amendment ? renderEmailText(t.amendment, text) + button(t.amendmentButton) : "",
    request: `<p style="border:1px solid #e5e5e5;padding:14px 18px;"><strong>Restaurant — Le Tamarin</strong><br>${ci} · 20:00</p>`,
  };
  const subject = renderEmailSubject(t.subject ?? "", text);
  return jsonOk({ subject, html: wrapEmail(subject, renderEmailText(t.body ?? "", text, blocks)), kind: "email" });
});
