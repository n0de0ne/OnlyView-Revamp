"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        router.replace(params.get("next") ?? "/admin");
        router.refresh();
      } else {
        setError(
          data.error === "rate_limited"
            ? "Trop de tentatives — réessayez dans 15 minutes."
            : "Identifiants invalides."
        );
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm space-y-4">
      <div className="afield">
        <label htmlFor="username">Identifiant ou email</label>
        <input
          id="username"
          autoComplete="username"
          required
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
      <div className="afield">
        <label htmlFor="password">Mot de passe</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <button type="submit" disabled={loading} className="abtn-primary w-full !min-h-[2.9rem]">
        {loading ? "Connexion…" : "Se connecter"}
      </button>
    </form>
  );
}

export default function AdminLoginPage() {
  return (
    <div className="grid min-h-screen bg-[#f6f3ed] lg:grid-cols-2">
      {/* the view, so the back office opens on what it is all for */}
      <div className="relative hidden overflow-hidden bg-night lg:block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/media/photos/night/night-01.webp" alt="" className="absolute inset-0 h-full w-full object-cover opacity-90" aria-hidden />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-black/20" />
        <div className="absolute inset-x-10 bottom-10 text-white">
          <p className="font-mono text-[0.66rem] uppercase tracking-[0.16em] text-white/65">Pointe Milou · Saint-Barthélemy</p>
          <p className="mt-3 max-w-md font-display text-3xl italic leading-snug text-white/95">
            Réservations, contrats, conciergerie et textes du site, au même endroit.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-10">
            <div className="font-display text-[1.7rem] tracking-[0.26em] text-[#1a1714]">ONLY&nbsp;VIEW</div>
            <div className="mt-1 font-mono text-[0.62rem] uppercase tracking-[0.18em] text-gold-dark">Administration</div>
          </div>
          <h1 className="mb-6 font-display text-[2rem] leading-tight text-[#1a1714]">Connexion</h1>
          <Suspense>
            <LoginForm />
          </Suspense>
          <a href="/" className="mt-10 inline-block font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[#776f64] hover:text-[#1a1714]">
            ← Retour au site
          </a>
        </div>
      </div>
    </div>
  );
}
