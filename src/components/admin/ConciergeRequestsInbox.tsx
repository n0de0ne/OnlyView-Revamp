"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Card, Spinner } from "./ui";
import { ConciergeRequestList, type ConciergeRequest } from "./ConciergeRequestList";

const SCOPES: Record<string, string> = {
  open: "À traiter",
  upcoming: "Séjours en cours et à venir",
  all: "Toutes",
};

/** Guests' table, boat, private chef and activity requests, the unanswered ones first. */
export function ConciergeRequestsInbox() {
  const [scope, setScope] = useState("open");
  const [items, setItems] = useState<ConciergeRequest[] | null>(null);

  const load = useCallback(() => {
    setItems(null);
    api<{ requests: ConciergeRequest[] }>(`/api/admin/concierge-requests?scope=${scope}`).then(
      (d) => d.success && setItems(d.requests)
    );
  }, [scope]);
  useEffect(load, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Demandes conciergerie</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Restaurants, bateaux, chef et activités demandés depuis l&apos;espace client. Réservez auprès du prestataire puis
            confirmez : le client reçoit un email et voit la réponse dans son espace.
          </p>
        </div>
        <select
          value={scope}
          onChange={(e) => setScope(e.target.value)}
          className="min-h-[40px] rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {Object.entries(SCOPES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <Card>
        {!items ? (
          <Spinner />
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            {scope === "open" ? "Aucune demande en attente 🎉" : "Aucune demande"}
          </p>
        ) : (
          <ConciergeRequestList
            items={items}
            showStay
            onChange={(next) =>
              setItems((list) =>
                // answered requests leave the "to do" view
                scope === "open" && next.status !== "requested"
                  ? (list ?? []).filter((i) => i.id !== next.id)
                  : (list ?? []).map((i) => (i.id === next.id ? next : i))
              )
            }
          />
        )}
      </Card>
    </div>
  );
}
