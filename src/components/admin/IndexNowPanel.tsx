"use client";

import { useEffect, useState } from "react";
import { api, Card, useToast } from "./ui";

interface Last {
  ok: boolean;
  status: number;
  count: number;
  at: string;
  error?: string;
}
interface State {
  enabled: boolean;
  siteUrl: string;
  keyUrl: string;
  last: Last | null;
}

/**
 * Réglages → Référencement: one button that tells Bing (and through it
 * Copilot and ChatGPT search) that the site changed, and the result of the
 * last call. Reviews approved in the admin ping it on their own.
 */
export function IndexNowPanel() {
  const { push } = useToast();
  const [state, setState] = useState<State | null>(null);
  const [busy, setBusy] = useState(false);

  const load = () =>
    api<State>("/api/admin/seo/indexnow").then((d) => d.success && setState(d as unknown as State));
  useEffect(() => {
    load();
  }, []);

  const submit = async () => {
    setBusy(true);
    const res = await api<{ result: Last }>("/api/admin/seo/indexnow", { method: "POST" });
    setBusy(false);
    if (res.success && res.result?.ok) push(`IndexNow : ${res.result.count} URL envoyées à Bing (HTTP ${res.result.status})`);
    else push(`IndexNow : échec (${res.success ? res.result?.error : res.error})`, "error");
    load();
  };

  const fmt = (iso: string) => new Date(iso).toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });

  return (
    <Card title="Référencement — IndexNow (Bing, Copilot, ChatGPT)">
      <p className="text-xs text-slate-500">
        IndexNow prévient Bing dès qu&apos;une page change, au lieu d&apos;attendre son prochain passage. Bing alimente
        Copilot et la recherche de ChatGPT. Google n&apos;utilise pas IndexNow : pour lui, Search Console et le sitemap
        suffisent. Un avis approuvé envoie le signal tout seul ; ce bouton renvoie toutes les pages du site.
      </p>
      {state && !state.enabled && (
        <p className="mt-3 text-xs text-amber-600">
          Désactivé : SITE_URL vaut {state.siteUrl} — IndexNow n&apos;accepte que l&apos;adresse publique en https.
        </p>
      )}
      {state?.last && (
        <p className="mt-3 text-xs text-slate-600">
          Dernier envoi : {fmt(state.last.at)} — {state.last.count} URL,{" "}
          {state.last.ok ? `reçu (HTTP ${state.last.status})` : `échec (${state.last.error ?? state.last.status})`}
        </p>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button onClick={submit} disabled={busy || !state?.enabled} className="abtn-primary">
          {busy ? "Envoi…" : "📡 Envoyer toutes les pages à Bing"}
        </button>
        {state?.enabled && (
          <a href={state.keyUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 underline">
            clé IndexNow
          </a>
        )}
      </div>
    </Card>
  );
}
