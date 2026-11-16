"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BedDouble,
  BookOpen,
  CalendarDays,
  CalendarRange,
  ChartLine,
  ConciergeBell,
  Euro,
  ExternalLink,
  FilePenLine,
  Handshake,
  Images,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  MapPinned,
  Settings2,
  ShieldCheck,
  Sparkles,
  Tag,
  Type,
  Users,
  UtensilsCrossed,
  Wine,
  X,
  type LucideIcon,
} from "lucide-react";
import type { SessionUser } from "@/lib/auth";
import { api, Modal, useToast } from "./ui";

type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  minRole?: "owner" | "manager";
  /** hidden unless the matching feature is enabled */
  feature?: "loyalty";
  /** count of what waits for an answer, from /api/admin/badges */
  badge?: keyof Badges;
};

type Badges = { requests: number; concierge: number };

/** Fire after answering something, so the menu counts refresh at once. */
export const BADGES_EVENT = "onlyview:admin-badges";


/** The menu, by what Alan is doing: bookings, selling, the guests' stay, the website, running the villa. */
const NAV: Array<{ title: string | null; items: NavItem[] }> = [
  { title: null, items: [{ href: "/admin", label: "Tableau de bord", icon: LayoutDashboard }] },
  {
    title: "Réservations",
    items: [
      { href: "/admin/calendar", label: "Calendrier", icon: CalendarDays },
      { href: "/admin/reservations", label: "Réservations", icon: BedDouble },
      { href: "/admin/requests", label: "Demandes", icon: Inbox, badge: "requests" },
      { href: "/admin/concierge-requests", label: "Concierge", icon: UtensilsCrossed, badge: "concierge" },
      { href: "/admin/contracts", label: "Contrats", icon: FilePenLine },
      { href: "/admin/clients", label: "Clients", icon: Users },
      { href: "/admin/loyalty", label: "Fidélité", icon: Sparkles, feature: "loyalty" },
    ],
  },
  {
    title: "Tarifs & ventes",
    items: [
      { href: "/admin/pricing", label: "Tarifs par date", icon: CalendarRange, minRole: "owner" },
      { href: "/admin/promotions", label: "Promotions", icon: Tag },
      { href: "/admin/agencies", label: "Agences", icon: Handshake },
      { href: "/admin/extras", label: "Extras", icon: Wine },
    ],
  },
  {
    title: "Séjour des clients",
    items: [
      { href: "/admin/concierge", label: "Conciergerie", icon: ConciergeBell },
      { href: "/admin/map", label: "Carte de l'île", icon: MapPinned },
    ],
  },
  {
    title: "Site web",
    items: [
      { href: "/admin/site", label: "Site & contenu", icon: Images },
      { href: "/admin/texts", label: "Textes du site", icon: Type },
      { href: "/admin/guide", label: "Guide", icon: BookOpen },
      { href: "/admin/analytics", label: "Analytique", icon: ChartLine },
    ],
  },
  {
    title: "Gestion",
    items: [
      { href: "/admin/finance", label: "Finances", icon: Euro, minRole: "owner" },
      { href: "/admin/settings", label: "Réglages", icon: Settings2, minRole: "owner" },
      { href: "/admin/users", label: "Utilisateurs", icon: ShieldCheck, minRole: "owner" },
    ],
  },
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
  const [badges, setBadges] = useState<Badges>({ requests: 0, concierge: 0 });

  // refreshed on every page change, every minute, and when a page answers something
  useEffect(() => {
    const load = () =>
      api<Badges>("/api/admin/badges").then(
        (r) => r.success && setBadges({ requests: r.requests, concierge: r.concierge }),
        () => {}
      );
    load();
    const timer = window.setInterval(load, 60_000);
    window.addEventListener(BADGES_EVENT, load);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(BADGES_EVENT, load);
    };
  }, [pathname]);
  const pending = badges.requests + badges.concierge;

  const canSee = (item: NavItem) => {
    if (item.feature && !features?.[item.feature]) return false;
    if (!item.minRole) return true;
    if (item.minRole === "owner") return user.role === "owner";
    return user.role === "owner" || user.role === "manager";
  };
  const visibleNav = NAV.map((g) => ({ ...g, items: g.items.filter(canSee) })).filter((g) => g.items.length);

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
    <nav className="space-y-5">
      {visibleNav.map((group) => (
        <div key={group.title ?? "home"}>
          {group.title && (
            <div className="admin-label mb-1.5 px-3 text-slate-400">{group.title}</div>
          )}
          <div className="space-y-px">
            {group.items.map((item) => {
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
              const count = item.badge ? badges[item.badge] : 0;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-[44px] items-center gap-3 rounded-lg px-3 py-2 text-[0.92rem] transition lg:min-h-[36px] lg:py-1.5 lg:text-[0.86rem] ${
                    active
                      ? "bg-white font-medium text-slate-900 shadow-[0_0_0_1px_var(--color-slate-200)]"
                      : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
                  }`}
                >
                  <Icon
                    aria-hidden
                    strokeWidth={1.5}
                    className={`h-[1.05rem] w-[1.05rem] shrink-0 ${active ? "text-gold-dark" : "text-slate-400 group-hover:text-slate-600"}`}
                  />
                  <span className="flex-1">{item.label}</span>
                  {count > 0 && (
                    <span
                      className="min-w-[1.35rem] rounded-full bg-gold px-1.5 text-center font-mono text-[0.68rem] font-medium leading-[1.35rem] text-night"
                      aria-label={`${count} en attente`}
                    >
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );

  const initials = (user.firstname ?? user.username).slice(0, 1).toUpperCase();

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop): quiet, on the page's own warm ground */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-[#efebe3] px-3 py-5 lg:flex">
        <Link href="/admin" className="mb-6 flex items-baseline gap-2.5 px-3">
          <span className="font-display text-[1.35rem] tracking-[0.24em] text-slate-900">ONLY&nbsp;VIEW</span>
          <span className="admin-label text-gold-dark">Admin</span>
        </Link>
        <div className="-mx-1 flex-1 overflow-y-auto px-1">
          <NavLinks />
        </div>
        <div className="mt-4 border-t border-slate-200 pt-4">
          <a
            href="/"
            target="_blank"
            rel="noopener"
            className="mb-2 flex min-h-[36px] items-center gap-3 rounded-lg px-3 text-[0.86rem] text-slate-600 hover:bg-white/70 hover:text-slate-900"
          >
            <ExternalLink aria-hidden strokeWidth={1.5} className="h-[1.05rem] w-[1.05rem] text-slate-400" />
            Voir le site
          </a>
          <div className="flex items-center gap-3 px-3 py-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 font-display text-sm text-white">
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-800">{user.firstname ?? user.username}</div>
              <div className="admin-label text-slate-400">{user.role}</div>
            </div>
            <button
              onClick={() => setPwdOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white hover:text-slate-800"
              aria-label="Mot de passe"
              title="Mot de passe"
            >
              <KeyRound className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <button
              onClick={logout}
              className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-white hover:text-slate-800"
              aria-label="Déconnexion"
              title="Déconnexion"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div
        className="fixed inset-x-0 top-0 z-40 flex items-center justify-between border-b border-slate-200 bg-[#f6f3ed]/90 px-4 backdrop-blur-xl lg:hidden"
        style={{ paddingTop: "max(0.5rem, env(safe-area-inset-top))", paddingBottom: "0.5rem" }}
      >
        <Link href="/admin" className="-mx-2 flex h-11 items-baseline gap-2 px-2 pt-2.5">
          <span className="font-display text-lg tracking-[0.22em] text-slate-900">ONLY&nbsp;VIEW</span>
          <span className="admin-label text-gold-dark">Admin</span>
        </Link>
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="flex h-11 items-center gap-2 rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-800"
          aria-expanded={menuOpen}
        >
          {menuOpen ? <X className="h-4 w-4" strokeWidth={1.5} /> : null}
          Menu
          {!menuOpen && pending > 0 && (
            <span className="min-w-[1.35rem] rounded-full bg-gold px-1.5 text-center font-mono text-[0.68rem] leading-[1.35rem] text-night">
              {pending}
            </span>
          )}
        </button>
      </div>
      {menuOpen && (
        <div
          className="fixed inset-0 z-30 overflow-y-auto overscroll-contain bg-[#efebe3] px-3 pt-20 lg:hidden"
          style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
        >
          <NavLinks />
          <div className="mt-6 grid grid-cols-3 gap-2 border-t border-slate-200 pt-4">
            <a href="/" target="_blank" rel="noopener" className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-slate-300 bg-white text-sm text-slate-700">
              <ExternalLink className="h-4 w-4" strokeWidth={1.5} /> Site
            </a>
            <button
              onClick={() => {
                setMenuOpen(false);
                setPwdOpen(true);
              }}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-slate-300 bg-white text-sm text-slate-700"
            >
              <KeyRound className="h-4 w-4" strokeWidth={1.5} /> Mot de passe
            </button>
            <button
              onClick={logout}
              className="flex min-h-[44px] items-center justify-center gap-2 rounded-full border border-slate-300 bg-white text-sm text-slate-700"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.5} /> Sortir
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main
        className="min-h-screen w-full min-w-0 overflow-x-hidden px-4 pb-16 pt-20 lg:ml-64 lg:px-10 lg:pt-9"
        style={{ paddingBottom: "max(4rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto max-w-[1400px]">{children}</div>
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
