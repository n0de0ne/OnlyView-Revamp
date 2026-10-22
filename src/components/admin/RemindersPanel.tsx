"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, Card, useToast } from "./ui";

interface Action {
  reservationId: number;
  clientName: string | null;
  kind: string;
  to: string;
  description: string;
}

/** Réglages → what the automatic reminders would send today, and a manual run. */
export function RemindersPanel() {
  const { push } = useToast();
  const [data, setData] = useState<{ enabled: boolean; today: string; actions: Action[] } | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    api<{ enabled: boolean; today: string; actions: Action[] }>("/api/admin/reminders").then(
      (d) => d.success && setData(d)
    );
  }, []);
  useEffect(load, [load]);

  const runNow = async () => {
    setBusy(true);
    const res = await api<{ actions: Action[] }>("/api/admin/reminders", { method: "POST" });
    setBusy(false);
    if (res.success) {
      push(`${res.actions.length} rappel(s) traité(s) — voir le journal des emails`);
      load();
    } else if (res.error === "reminders_disabled") {
      push("Activez d'abord les rappels (1) et enregistrez", "error");
    } else push(`Erreur : ${res.error}`, "error");
  };

  return (
    <Card
      title="⏰ Rappels — à envoyer aujourd'hui"
      action={
        <button onClick={runNow} disabled={busy || !data?.enabled} className="abtn-ghost !px-2.5 !py-1 text-xs">
          {busy ? "Envoi…" : "Envoyer maintenant"}
        </button>
      }
    >
      {!data ? (
        <p className="text-sm text-slate-400">Chargement…</p>
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-500">
            {data.enabled
              ? "Actifs : vérifiés chaque heure. Chaque rappel n'est envoyé qu'une fois."
              : "Désactivés — aperçu de ce qui partirait s'ils étaient actifs (Rappels actifs = 1)."}{" "}
            Les emails au client ne concernent que les réservations directes (pas les agences).
          </p>
          {data.actions.length === 0 ? (
            <p className="text-sm text-slate-400">Rien à envoyer aujourd&apos;hui ({data.today}).</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm">
              {data.actions.map((a) => (
                <li key={`${a.reservationId}-${a.kind}`} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <Link href={`/admin/reservations/${a.reservationId}`} className="font-medium text-navy underline">
                      {a.clientName ?? `#${a.reservationId}`}
                    </Link>{" "}
                    <span className="text-slate-600">· {a.description}</span>
                  </span>
                  <span className="text-xs text-slate-400">{a.to === "owner" ? "→ vous" : `→ ${a.to}`}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </Card>
  );
}
