import "server-only";
import { createHash } from "node:crypto";
import QRCode from "qrcode";
import { prisma } from "./db";
import { getSettings } from "./settings";
import { addDays, todayISO } from "./dates";

/**
 * The villa's practical info on the guest portal (Wi-Fi, safe…). The
 * credentials live in Réglages (wifi_*, safe_code), the instructions in the
 * site copy (block "stayInfo"). Shown only around a confirmed stay: from
 * SHOW_DAYS_BEFORE days before check-in until check-out.
 */
export const SHOW_DAYS_BEFORE = 14;

export interface Wifi {
  ssid: string;
  password: string;
  security: "WPA" | "WEP" | "nopass";
  hidden: boolean;
}

export async function getWifi(): Promise<Wifi | null> {
  const s = await getSettings();
  const ssid = s.wifi_ssid?.trim();
  if (!ssid) return null;
  const password = s.wifi_password ?? "";
  const kind = (s.wifi_security ?? "").trim().toUpperCase();
  const security = !password ? "nopass" : kind === "WEP" ? "WEP" : ["OUVERT", "OPEN", "NOPASS", "NONE", "AUCUNE"].includes(kind) ? "nopass" : "WPA";
  return { ssid, password, security, hidden: ["1", "true", "oui", "yes"].includes((s.wifi_hidden ?? "").trim().toLowerCase()) };
}

export async function getSafeCode(): Promise<string | null> {
  return (await getSettings()).safe_code?.trim() || null;
}

/** Does this guest have a confirmed stay that is about to start or under way? */
export async function hasStayInfoAccess(clientId: number): Promise<boolean> {
  const today = new Date(`${todayISO()}T00:00:00Z`);
  const soon = new Date(`${addDays(todayISO(), SHOW_DAYS_BEFORE)}T00:00:00Z`);
  const stay = await prisma.reservation.findFirst({
    where: { clientId, status: "confirmed", isArchived: false, startDate: { lte: soon }, endDate: { gte: today } },
    select: { id: true },
  });
  return stay != null;
}

/** `WIFI:` payload the phone cameras read (the de-facto ZXing format). */
export function wifiQrPayload(w: Wifi): string {
  const esc = (v: string) => v.replace(/([\\;,:"])/g, "\\$1");
  return `WIFI:T:${w.security};S:${esc(w.ssid)};${w.security === "nopass" ? "" : `P:${esc(w.password)};`}${w.hidden ? "H:true;" : ""};`;
}

export async function wifiQrSvg(w: Wifi): Promise<string> {
  return QRCode.toString(wifiQrPayload(w), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#1c1917", light: "#ffffff" } });
}

const xml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Stable UUID-shaped id derived from a seed, so re-installing replaces the profile. */
function uuidFrom(seed: string): string {
  const h = createHash("sha1").update(seed).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`.toUpperCase();
}

/**
 * Apple configuration profile holding the network: iPhone, iPad and Mac
 * install it from Settings and then join the Wi-Fi on their own.
 */
export function wifiMobileconfig(w: Wifi, name: string): string {
  const encryption = w.security === "nopass" ? "None" : w.security === "WEP" ? "WEP" : "WPA";
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>PayloadContent</key>
  <array>
    <dict>
      <key>PayloadType</key><string>com.apple.wifi.managed</string>
      <key>PayloadVersion</key><integer>1</integer>
      <key>PayloadIdentifier</key><string>com.onlyview.wifi.network</string>
      <key>PayloadUUID</key><string>${uuidFrom(`net:${w.ssid}`)}</string>
      <key>PayloadDisplayName</key><string>${xml(w.ssid)}</string>
      <key>SSID_STR</key><string>${xml(w.ssid)}</string>
      <key>HIDDEN_NETWORK</key><${w.hidden}/>
      <key>AutoJoin</key><true/>
      <key>EncryptionType</key><string>${encryption}</string>${
        encryption === "None" ? "" : `\n      <key>Password</key><string>${xml(w.password)}</string>`
      }
    </dict>
  </array>
  <key>PayloadType</key><string>Configuration</string>
  <key>PayloadVersion</key><integer>1</integer>
  <key>PayloadIdentifier</key><string>com.onlyview.wifi</string>
  <key>PayloadUUID</key><string>${uuidFrom(`profile:${w.ssid}`)}</string>
  <key>PayloadDisplayName</key><string>${xml(name)}</string>
  <key>PayloadOrganization</key><string>Villa ONLY VIEW</string>
  <key>PayloadRemovalDisallowed</key><false/>
</dict>
</plist>
`;
}
