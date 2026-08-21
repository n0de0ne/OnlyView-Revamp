"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api, Card, fmtDate, fmtUSD, Spinner, StatusBadge, useToast } from "./ui";

interface ContractRow {
  id: number;
  token: string;
  status: string;
  language: string;
  clientName: string;
  clientEmail: string | null;
  totalPrice: number;
  signedAt: string | null;
  viewCount: number;
  createdAt: string;
  expiresAt: string | null;
  reservation: { id: number; startDate: string; endDate: string; status: string };
}

export function ContractsBoard() {
  const { push } = useToast();
  const [contracts, setContracts] = useState<ContractRow[] | null>(null);
  const [filter, setFilter] = useState("all");

  const load = useCallback(() => {
    api<{ contracts: ContractRow[] }>("/api/admin/contracts").then(
      (d) => d.success && setContracts(d.contracts)
    );
  }, []);
  useEffect(load, [load]);

  const filtered = contracts?.filter((c) => filter === "all" || c.status === filter);

  const act = async (id: number, action: "void" | "extend") => {
    const res = await api(`/api/admin/contracts/${id}`, { method: "PUT", json: { action } });
    if (res.success) {
      push(action === "void" ? "Contrat annulé" : "Validité prolongée de 30 jours");
      load();
    } else push(`Erreur : ${res.error}`, "error");
  };

  const copyLink = async (c: ContractRow) => {
    const url = `${window.location.origin}${c.language === "fr" ? "/fr" : ""}/contracts/sign/${c.token}`;
    await navigator.clipboard.writeText(url).catch(() => {});
    push("Lien de signature copié");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-slate-800">Contrats</h1>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          <option value="all">Tous</option>
          <option value="pending">En attente</option>
          <option value="signed">Signés</option>
          <option value="void">Annulés</option>
        </select>
      </div>

      <Card>
        {!filtered ? (
          <Spinner />
        ) : filtered.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-400">
            Aucun contrat — générez-les depuis une réservation.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-400">
                  <th className="pb-2.5 pr-3 font-medium">Client</th>
                  <th className="pb-2.5 pr-3 font-medium">Séjour</th>
                  <th className="pb-2.5 pr-3 text-right font-medium">Montant</th>
                  <th className="pb-2.5 pr-3 text-center font-medium">Langue</th>
                  <th className="pb-2.5 pr-3 text-center font-medium">Vues</th>
                  <th className="pb-2.5 pr-3 font-medium">Statut</th>
                  <th className="pb-2.5 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100 last:border-0">
                    <td className="py-3 pr-3">
                      <div className="font-semibold text-slate-800">{c.clientName}</div>
                      <div className="text-xs text-slate-400">{c.clientEmail}</div>
                    </td>
                    <td className="py-3 pr-3 text-slate-600">
                      <Link
                        href={`/admin/reservations/${c.reservation.id}`}
                        className="hover:text-navy hover:underline"
                      >
                        {fmtDate(c.reservation.startDate)} → {fmtDate(c.reservation.endDate)}
                      </Link>
                      {c.status === "signed" && c.signedAt && (
                        <div className="text-xs text-emerald-600">
                          ✓ signé le {fmtDate(c.signedAt.slice(0, 10))}
                        </div>
                      )}
                      {c.status === "pending" && c.expiresAt && (
                        <div className="text-xs text-slate-400">
                          expire {fmtDate(c.expiresAt.slice(0, 10))}
                        </div>
                      )}
                    </td>
                    <td className="py-3 pr-3 text-right font-semibold">{fmtUSD(c.totalPrice)}</td>
                    <td className="py-3 pr-3 text-center uppercase text-slate-500">{c.language}</td>
                    <td className="py-3 pr-3 text-center text-slate-500">{c.viewCount}</td>
                    <td className="py-3 pr-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="py-3">
                      <div className="flex flex-wrap gap-2 text-xs">
                        <a
                          href={`/api/contracts/pdf/${c.token}`}
                          target="_blank"
                          className="text-navy hover:underline"
                        >
                          PDF
                        </a>
                        {c.status === "pending" && (
                          <>
                            <button onClick={() => copyLink(c)} className="text-navy hover:underline">
                              Copier lien
                            </button>
                            <button onClick={() => act(c.id, "extend")} className="text-slate-500 hover:underline">
                              Prolonger
                            </button>
                            <button onClick={() => act(c.id, "void")} className="text-red-500 hover:underline">
                              Annuler
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
