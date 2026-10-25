/** Labels and formatting shared by the Analytique screens (French UI). */

export const CHANNELS: Record<string, { label: string; color: string; icon: string }> = {
  search: { label: "Moteurs de recherche", color: "#2a78d6", icon: "🔎" },
  ai: { label: "Assistants IA", color: "#6250d6", icon: "✨" },
  agency: { label: "Agences & annonces", color: "#eb6834", icon: "🤝" },
  social: { label: "Réseaux sociaux", color: "#e87ba4", icon: "💬" },
  email: { label: "Email", color: "#eda100", icon: "✉️" },
  paid: { label: "Publicité", color: "#e34948", icon: "📣" },
  referral: { label: "Autres sites", color: "#1baf7a", icon: "🔗" },
  direct: { label: "Direct", color: "#008300", icon: "⌨️" },
};

const DEVICES: Record<string, string> = { mobile: "📱 Mobile", tablet: "📲 Tablette", desktop: "🖥️ Ordinateur" };
export const deviceLabel = (d: string | null | undefined) => (d ? DEVICES[d] ?? d : "—");

const EVENTS: Record<string, string> = {
  quote_view: "Devis affiché",
  booking_form_start: "Demande commencée",
  booking_request: "Demande envoyée",
  contact_form_start: "Formulaire contact commencé",
  contact_submit: "Message de contact envoyé",
  click_whatsapp: "Clic WhatsApp",
  click_email: "Clic email",
  click_phone: "Clic téléphone",
  click_book: "Clic « Réserver »",
  outbound: "Lien vers un autre site",
  tour_start: "Visite 3D lancée",
  gallery_open: "Photo ouverte",
  map_place: "Lieu ouvert sur la carte",
  language_switch: "Changement de langue",
  portal_login: "Connexion espace client",
  share: "Partage",
  cta_click: "Clic sur un bouton (ancien site)",
  cta_view: "Bouton vu (ancien site)",
  form_view: "Formulaire vu (ancien site)",
  form_start: "Formulaire commencé (ancien site)",
  form_submit: "Formulaire envoyé (ancien site)",
  scroll_50: "Défilement 50 % (ancien site)",
  scroll_100: "Défilement 100 % (ancien site)",
};
export const eventLabel = (n: string) => EVENTS[n] ?? n;

export const BOT_CATEGORIES: Record<string, string> = {
  ai_search: "IA — recherche",
  ai_user: "IA — à la demande d'un utilisateur",
  ai_training: "IA — entraînement",
  search: "Moteur de recherche",
  seo: "Outil SEO",
  social: "Aperçu de lien",
  other: "Autre",
};

let regionNames: Intl.DisplayNames | null = null;
export function countryName(code: string | null | undefined) {
  if (!code || code === "??") return "Inconnu";
  try {
    regionNames ??= new Intl.DisplayNames(["fr"], { type: "region" });
    return regionNames.of(code) ?? code;
  } catch {
    return code;
  }
}
export function flag(code: string | null | undefined) {
  if (!code || !/^[A-Z]{2}$/.test(code)) return "🏳️";
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}
export function fmtDuration(sec: number) {
  if (!sec) return "0 s";
  if (sec < 60) return `${Math.round(sec)} s`;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m < 60) return s ? `${m} min ${s} s` : `${m} min`;
  return `${Math.floor(m / 60)} h ${m % 60} min`;
}
