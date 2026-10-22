"use client";

/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import { api, Card, ConfirmButton, fmtDate, Spinner, StatusBadge, useToast } from "./ui";

interface Photo {
  id: number;
  category: string;
  url: string;
  alt: string | null;
  sortOrder: number;
  published: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  "pool-terrace": "Piscine & terrasse",
  living: "Salon",
  kitchen: "Cuisine",
  bedroom1: "Chambre 1",
  bedroom2: "Chambre 2",
  bedroom3: "Chambre 3",
  bedroom4: "Chambre 4",
  night: "Nuit",
  exterior: "Extérieur",
};

interface Testimonial {
  id: number;
  name: string;
  country: string | null;
  rating: number;
  message: string;
  language: string;
  isApproved: boolean;
  isFeatured: boolean;
  createdAt: string;
}

interface EmailLog {
  id: number;
  templateSlug: string | null;
  recipientEmail: string;
  subject: string | null;
  status: string;
  errorMessage: string | null;
  sentAt: string;
}

export function SiteContentBoard() {
  const { push } = useToast();
  const [tab, setTab] = useState<"photos" | "reviews" | "emails">("photos");
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[] | null>(null);
  const [emails, setEmails] = useState<EmailLog[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCat, setUploadCat] = useState("pool-terrace");

  const load = useCallback(() => {
    api<{ photos: Photo[]; categories: string[] }>("/api/admin/photos").then((d) => {
      if (d.success) {
        setPhotos(d.photos);
        setCategories([...d.categories]);
      }
    });
    api<{ testimonials: Testimonial[] }>("/api/admin/testimonials").then(
      (d) => d.success && setTestimonials(d.testimonials)
    );
    api<{ logs: EmailLog[] }>("/api/admin/email-logs").then(
      (d) => d.success && setEmails(d.logs)
    );
  }, []);
  useEffect(load, [load]);

  const upload = async (file: File) => {
    setUploading(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("category", uploadCat);
    const res = await fetch("/api/admin/photos", { method: "POST", body: fd });
    const data = await res.json();
    setUploading(false);
    if (data.success) {
      push("Photo ajoutée");
      load();
    } else push(`Erreur : ${data.error}`, "error");
  };

  const patchPhoto = async (id: number, patch: Partial<Photo>) => {
    const res = await api("/api/admin/photos", { method: "PUT", json: { id, ...patch } });
    if (res.success) load();
  };

  const [drag, setDrag] = useState<{ id: number; category: string } | null>(null);
  const dragStartOrder = useRef<string>("");
  const photosRef = useRef(photos);
  photosRef.current = photos;

  const saveOrder = async (category: string, list: Photo[]) => {
    const ids = list.filter((p) => p.category === category).map((p) => p.id);
    const res = await api("/api/admin/photos/reorder", { method: "POST", json: { category, ids } });
    if (res.success) push("Ordre enregistré");
    else {
      push(`Erreur : ${res.error}`, "error");
      load();
    }
  };

  const startDrag = (e: React.PointerEvent, p: Photo) => {
    const target = e.target as HTMLElement;
    if (target.closest("[data-tile-actions]")) return;
    if (e.pointerType === "mouse" ? e.button !== 0 : !target.closest("[data-drag-handle]")) return;
    e.preventDefault();
    dragStartOrder.current = (photos ?? []).map((x) => x.id).join(",");
    setDrag({ id: p.id, category: p.category });
  };

  useEffect(() => {
    if (!drag) return;
    const move = (e: PointerEvent) => {
      const over = document
        .elementFromPoint(e.clientX, e.clientY)
        ?.closest<HTMLElement>("[data-photo-id]");
      if (!over || over.dataset.category !== drag.category) return;
      const overId = Number(over.dataset.photoId);
      if (overId === drag.id) return;
      setPhotos((prev) => {
        if (!prev) return prev;
        const from = prev.findIndex((x) => x.id === drag.id);
        const to = prev.findIndex((x) => x.id === overId);
        const next = [...prev];
        next.splice(to, 0, ...next.splice(from, 1));
        return next;
      });
    };
    const up = () => {
      setDrag(null);
      const current = photosRef.current;
      if (current && current.map((x) => x.id).join(",") !== dragStartOrder.current) {
        saveOrder(drag.category, current);
      }
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag]);

  const makeCover = (p: Photo) => {
    if (!photos) return;
    const next = [p, ...photos.filter((x) => x.id !== p.id)];
    setPhotos(next);
    saveOrder(p.category, next);
  };

  const deletePhoto = async (id: number) => {
    const res = await api(`/api/admin/photos?id=${id}`, { method: "DELETE" });
    if (res.success) {
      push("Photo supprimée");
      load();
    }
  };

  const patchTestimonial = async (id: number, patch: Partial<Testimonial>) => {
    const res = await api("/api/admin/testimonials", { method: "PUT", json: { id, ...patch } });
    if (res.success) {
      push("Avis mis à jour");
      load();
    }
  };

  const deleteTestimonial = async (id: number) => {
    const res = await api(`/api/admin/testimonials?id=${id}`, { method: "DELETE" });
    if (res.success) {
      push("Avis supprimé");
      load();
    }
  };

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-bold text-slate-800">Site & contenu</h1>

      <div className="flex gap-2">
        {(
          [
            ["photos", "🖼️ Photos"],
            ["reviews", "⭐ Avis"],
            ["emails", "✉️ Emails"],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-xl px-4 py-2 text-sm font-medium ${
              tab === k ? "bg-navy text-white" : "bg-white text-slate-600 border border-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "photos" && (
        <Card
          title={`Galerie (${photos?.length ?? "…"})`}
          action={
            <div className="flex items-center gap-2">
              <select
                value={uploadCat}
                onChange={(e) => setUploadCat(e.target.value)}
                className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <label className="abtn-gold !px-3 !py-1.5 cursor-pointer text-xs">
                {uploading ? "Envoi…" : "+ Ajouter"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])}
                />
              </label>
            </div>
          }
        >
          {!photos ? (
            <Spinner />
          ) : (
            <div className="space-y-6">
              {categories.map((cat) => {
                const group = photos.filter((p) => p.category === cat);
                if (group.length === 0) return null;
                const coverId = group.find((p) => p.published)?.id;
                return (
                  <section key={cat}>
                    <h3 className="mb-2 text-sm font-semibold text-slate-700">
                      {CATEGORY_LABELS[cat] ?? cat}{" "}
                      <span className="font-normal text-slate-400">· {group.length}</span>
                    </h3>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                      {group.map((p) => (
                        <div
                          key={p.id}
                          data-photo-id={p.id}
                          data-category={p.category}
                          onPointerDown={(e) => startDrag(e, p)}
                          className={`group relative select-none overflow-hidden rounded-xl border pointer-fine:cursor-grab ${
                            p.published ? "border-slate-200" : "border-red-200 opacity-50"
                          } ${drag?.id === p.id ? "z-10 scale-[1.03] shadow-lg ring-2 ring-gold" : ""}`}
                        >
                          <img
                            src={p.url}
                            alt={p.alt ?? ""}
                            draggable={false}
                            className="pointer-events-none aspect-[4/3] w-full object-cover"
                            loading="lazy"
                          />
                          {p.id === coverId && (
                            <div className="absolute left-1.5 top-1.5 rounded bg-gold px-1.5 py-0.5 text-[0.6rem] font-semibold text-white shadow">
                              ★ Couverture
                            </div>
                          )}
                          <div className="absolute inset-x-0 bottom-0 bg-black/60 px-2 py-1 text-[0.6rem] text-white">
                            #{group.indexOf(p) + 1}
                          </div>
                          <div
                            data-drag-handle
                            title="Glisser pour réordonner"
                            className="absolute bottom-0 right-0 touch-none bg-black/60 px-2 py-1 text-xs text-white hidden pointer-coarse:block"
                          >
                            ⠿
                          </div>
                          <div
                            data-tile-actions
                            className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition group-hover:opacity-100 pointer-coarse:opacity-100"
                          >
                            {p.id !== coverId && p.published && (
                              <button
                                onClick={() => makeCover(p)}
                                title="Mettre en couverture"
                                className="rounded bg-white/90 px-1.5 py-0.5 text-xs shadow"
                              >
                                ★
                              </button>
                            )}
                            <button
                              onClick={() => patchPhoto(p.id, { published: !p.published })}
                              title={p.published ? "Masquer" : "Publier"}
                              className="rounded bg-white/90 px-1.5 py-0.5 text-xs shadow"
                            >
                              {p.published ? "👁" : "🚫"}
                            </button>
                            <ConfirmButton
                              className="rounded bg-white/90 px-1.5 py-0.5 text-xs text-red-600 shadow"
                              confirmLabel="✓?"
                              onConfirm={() => deletePhoto(p.id)}
                            >
                              🗑
                            </ConfirmButton>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
          <p className="mt-4 text-xs text-slate-400">
            Glissez-déposez les photos pour changer leur ordre (sur mobile, via la poignée ⠿). La
            première photo publiée de chaque catégorie sert de couverture sur le site. Les photos
            téléchargées sont optimisées automatiquement (WebP, 1800 px max).
          </p>
        </Card>
      )}

      {tab === "reviews" && (
        <Card title="Modération des avis">
          {!testimonials ? (
            <Spinner />
          ) : testimonials.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Aucun avis</p>
          ) : (
            <div className="space-y-3">
              {testimonials.map((r) => (
                <div
                  key={r.id}
                  className={`rounded-xl border p-4 ${
                    r.isApproved ? "border-slate-200" : "border-amber-300 bg-amber-50/50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm">
                      <span className="font-semibold">{r.name}</span>
                      {r.country && <span className="text-slate-400"> · {r.country}</span>}
                      <span className="ml-2 text-gold">{"★".repeat(r.rating)}</span>
                      <span className="ml-2 text-xs uppercase text-slate-400">{r.language}</span>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <button
                        onClick={() => patchTestimonial(r.id, { isApproved: !r.isApproved })}
                        className={r.isApproved ? "text-amber-600 hover:underline" : "font-semibold text-emerald-600 hover:underline"}
                      >
                        {r.isApproved ? "Dépublier" : "✓ Approuver"}
                      </button>
                      <button
                        onClick={() => patchTestimonial(r.id, { isFeatured: !r.isFeatured })}
                        className="text-navy hover:underline"
                      >
                        {r.isFeatured ? "★ En avant" : "☆ Mettre en avant"}
                      </button>
                      <ConfirmButton
                        className="text-red-500 hover:underline"
                        onConfirm={() => deleteTestimonial(r.id)}
                      >
                        Supprimer
                      </ConfirmButton>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{r.message}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "emails" && (
        <Card title="Journal des emails">
          {!emails ? (
            <Spinner />
          ) : emails.length === 0 ? (
            <p className="py-8 text-center text-sm text-slate-400">Aucun email</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs uppercase text-slate-400">
                    <th className="pb-2 pr-3 font-medium">Date</th>
                    <th className="pb-2 pr-3 font-medium">Destinataire</th>
                    <th className="pb-2 pr-3 font-medium">Sujet</th>
                    <th className="pb-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {emails.map((e) => (
                    <tr key={e.id} className="border-b border-slate-100 last:border-0">
                      <td className="py-2.5 pr-3 text-xs text-slate-400">
                        {fmtDate(e.sentAt.slice(0, 10))}
                      </td>
                      <td className="py-2.5 pr-3">{e.recipientEmail}</td>
                      <td className="py-2.5 pr-3 text-slate-600">{e.subject}</td>
                      <td className="py-2.5" title={e.errorMessage ?? undefined}>
                        <StatusBadge status={e.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-xs text-slate-400">
            Sans configuration SMTP, les emails sont stockés « En file » au lieu d&apos;être
            envoyés — configurez SMTP_* dans les variables d&apos;environnement.
          </p>
        </Card>
      )}
    </div>
  );
}
