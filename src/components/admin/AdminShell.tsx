"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import type { SessionUser } from "@/lib/auth";
import { api, Modal, useToast } from "./ui";

const NAV: Array<{
  href: string;
  label: string;
  icon: string;
  minRole?: "owner" | "manager";
  /** hidden unless the matching feature is enabled */
  feature?: "loyalty";
}> = [
  { href: "/admin", label: "Tableau de bord", icon: "📊" },
  { href: "/admin/calendar", label: "Calendrier", icon: "📅" },
  { href: "/admin/reservations", label: "Réservations", icon: "🛏️" },
  { href: "/admin/requests", label: "Demandes", icon: "📥" },
  { href: "/admin/clients", label: "Clients", icon: "👥" },
  { href: "/admin/contracts", label: "Contrats", icon: "✍️" },
  { href: "/admin/finance", label: "Finances", icon: "💶", minRole: "owner" },
  { href: "/admin/loyalty", label: "Fidélité", icon: "✦", feature: "loyalty" },
  { href: "/admin/agencies", label: "Agences", icon: "🤝" },
  { href: "/admin/promotions", label: "Promotions", icon: "🏷️" },
  { href: "/admin/site", label: "Site & contenu", icon: "🖼️" },
  { href: "/admin/map", label: "Carte de l'île", icon: "🗺️" },
  { href: "/admin/settings", label: "Réglages", icon: "⚙️", minRole: "owner" },
  { href: "/admin/users", label: "Utilisateurs", icon: "🔐", minRole: "owner" },
];

export function AdminShell({
  user,
  children,
  features,
}: {
  user: SessionUser;
  children: React.ReactNode;
  /** optional modules, switched from Réglages */
  features?: { loyalty?: boolean };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { push } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pwdOpen, setPwdOpen] = useState(user.mustChangePassword);
  const [pwd, setPwd] = useState({ current: "", next: "" });
  const [pwdBusy, setPwdBusy] = useState(false);

  const visibleNav = NAV.filter((item) => {
    if (item.feature && !features?.[item.feature]) return false;
    if (!item.minRole) return true;
    if (item.minRole === "owner") return user.role === "owner";
    return user.role === "owner" || user.role === "manager";
  });

  const logout = async () => {
    await api("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  };

  const changePwd = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdBusy(true);
    const res = await api("/api/admin/change-password", {
      method: "POST",
      json: { currentPassword: pwd.current, newPassword: pwd.next },
    });
    setPwdBusy(false);
    if (res.success) {
      push("Mot de passe mis à jour");
      setPwdOpen(false);
      setPwd({ current: "", next: "" });
    } else {
      push(
        res.error === "invalid_credentials"
          ? "Mot de passe actuel incorrect"
          : "Erreur (10 caractères minimum)",
        "error"
      );
    }
  };

  const NavLinks = () => (
    <nav className="space-y-0.5">
      {visibleNav.map((item) => {
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={() => setMenuOpen(false)}
            className={`flex min-h-[44px] items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm transition ${
              active
                ? "bg-white/12 font-semibold text-white"
                : "text-white/65 hover:bg-white/8 hover:text-white"
            }`}
          >
            <span aria-hidden className="w-5 text-center">
              {item.icon}
            </span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col bg-gradient-to-b from-navy-deep to-night px-4 py-6 lg:flex">
        <Link href="/admin" className="mb-8 block px-2">
          <div className="font-display text-xl tracking-[0.28em] text-white">ONLY&nbsp;VIEW</div>
          <div className="mt-0.5 text-[0.55rem] font-semibold uppercase tracking-[0.35em] text-gold">
            Administration
          </div>
        </Link>
        <div className="flex-1 overflow-y-auto">
          <NavLinks />
        </div>
        <div className="mt-4 border-t border-white/10 pt-4">
          <div className="px-2 text-xs text-white/60">
            {user.firstname ?? user.username}
            <span className="ml-1.5 rounded bg-white/10 px-1.5 py-0.5 text-[0.6rem] uppercase">
              {user.role}
            </span>
          </div>
          <div className="mt-2 flex gap-1 px-1">
            <button
              onClick={() => setPwdOpen(true)}
              className="flex-1 rounded-lg px-2 py-1.5 text-left text-xs text-white/60 hover:bg-white/10 hover:text-white"
            >
              Mot de passe
            </button>
            <button
              onClick={logout}
              className="flex-1 rounded-lg px-2 py-1.5 text-left text-xs text-white/60 hover:bg-white/10 hover:text-white"
            >
              Déconnexion
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div
        className="fixed inset-x-0 top-0 z-40 flex items-center justify-between bg-navy-deep px-4 lg:hidden"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "0.5rem" }}
      >
        <Link href="/admin" className="-mx-2 flex h-11 items-center px-2 font-display text-lg tracking-[0.25em] text-white">
          ONLY&nbsp;VIEW
        </Link>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-11 items-center rounded-lg bg-white/10 px-4 text-sm text-white"
          aria-expanded={menuOpen}
        >
          {menuOpen ? "✕" : "☰"} Menu
        </button>
      </div>
      {menuOpen && (
        <div className="fixed inset-0 z-30 bg-night/98 px-4 pb-6 pt-16 lg:hidden">
          <NavLinks />
          <button
            onClick={logout}
            className="mt-4 w-full rounded-xl bg-white/10 px-3 py-2.5 text-sm text-white/80"
          >
            Déconnexion
          </button>
        </div>
      )}

      {/* Content */}
      <main
        className="min-h-screen w-full min-w-0 overflow-x-hidden px-4 pb-16 pt-16 lg:ml-60 lg:px-8 lg:pt-8"
        style={{ paddingBottom: "max(4rem, env(safe-area-inset-bottom))" }}
      >
        {children}
      </main>

      {/* Change password modal */}
      <Modal
        open={pwdOpen}
        onClose={() => !user.mustChangePassword && setPwdOpen(false)}
        title={
          user.mustChangePassword
            ? "Sécurité — changez votre mot de passe"
            : "Changer le mot de passe"
        }
      >
        {user.mustChangePassword && (
          <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Votre compte utilise encore le mot de passe initial. Choisissez-en un nouveau
            (10 caractères minimum).
          </p>
        )}
        <form onSubmit={changePwd} className="space-y-3">
          <div className="afield">
            <label>Mot de passe actuel</label>
            <input
              type="password"
              required
              value={pwd.current}
              onChange={(e) => setPwd({ ...pwd, current: e.target.value })}
            />
          </div>
          <div className="afield">
            <label>Nouveau mot de passe (min. 10 caractères)</label>
            <input
              type="password"
              required
              minLength={10}
              value={pwd.next}
              onChange={(e) => setPwd({ ...pwd, next: e.target.value })}
            />
          </div>
          <button className="abtn-primary w-full" disabled={pwdBusy}>
            {pwdBusy ? "…" : "Mettre à jour"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
