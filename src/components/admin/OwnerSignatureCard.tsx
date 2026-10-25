"use client";

import { useEffect, useRef, useState } from "react";
import { api, Card, ConfirmButton, useToast } from "./ui";

/** Réglages — the owner's signature printed on every contract. */
export function OwnerSignatureCard() {
  const { push } = useToast();
  const [signature, setSignature] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api<{ settings: Record<string, string> }>("/api/admin/settings").then(
      (d) => d.success && setSignature(d.settings.owner_signature ?? null)
    );
  }, []);

  const upload = async (file: File) => {
    setBusy(true);
    const body = new FormData();
    body.append("file", file);
    const res = await api<{ signature: string }>("/api/admin/settings/owner-signature", {
      method: "POST",
      body,
    });
    setBusy(false);
    if (res.success) {
      setSignature(res.signature);
      push("Signature enregistrée — elle figure sur tous les contrats");
    } else push(`Erreur : ${res.error}`, "error");
  };

  const remove = async () => {
    const res = await api("/api/admin/settings/owner-signature", { method: "DELETE" });
    if (res.success) {
      setSignature(null);
      push("Signature retirée");
    }
  };

  return (
    <Card title="✍️ Signature du propriétaire">
      <p className="text-sm text-slate-500">
        Imprimée dans la case « Propriétaire » de chaque contrat et avenant (PDF et page de signature).
        Image PNG ou JPG, fond blanc ou transparent : elle est recadrée automatiquement.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <div className="flex h-24 w-56 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-white">
          {signature === undefined ? (
            <span className="text-xs text-slate-400">…</span>
          ) : signature ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={signature} alt="Signature du propriétaire" className="max-h-20 max-w-[13rem]" />
          ) : (
            <span className="text-xs text-slate-400">Aucune signature</span>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
            e.target.value = "";
          }}
        />
        <button disabled={busy} onClick={() => input.current?.click()} className="abtn-primary">
          {busy ? "Envoi…" : signature ? "Remplacer" : "Ajouter la signature"}
        </button>
        {signature && (
          <ConfirmButton onConfirm={remove} confirmLabel="Retirer ?">
            Retirer
          </ConfirmButton>
        )}
      </div>
    </Card>
  );
}
