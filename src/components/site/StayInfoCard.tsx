"use client";

import { useEffect, useState } from "react";
import { Check, Copy, Info, QrCode, Vault, Wifi } from "lucide-react";
import type { Dict } from "@/lib/i18n";

type Platform = "apple" | "android" | "other";

/**
 * Guest portal — the villa's practical info: the Wi-Fi (copy the password,
 * install it on Apple devices, QR code for any camera), the safe and the
 * owner's other notes. Browsers can't join a Wi-Fi network themselves, so
 * "join" means the Apple profile or a QR code read by a phone's camera.
 */
export function StayInfoCard({
  t,
  info,
  wifi,
  qrSvg,
  safeCode,
}: {
  t: Dict["account"]["house"];
  info: Dict["stayInfo"];
  wifi: { ssid: string; password: string } | null;
  qrSvg: string | null;
  safeCode: string | null;
}) {
  const [platform, setPlatform] = useState<Platform>("other");
  const [copied, setCopied] = useState<string | null>(null);
  const [qrOpen, setQrOpen] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    // iPadOS reports itself as a Mac: both install the profile the same way
    if (/iPhone|iPad|iPod|Macintosh/.test(ua)) setPlatform("apple");
    else if (/Android/.test(ua)) setPlatform("android");
    // a computer can't join from here: the code is for the guests' phones
    else setQrOpen(true);
  }, []);

  const copy = async (key: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(key);
      setTimeout(() => setCopied((k) => (k === key ? null : k)), 2000);
    } catch {
      // clipboard refused (old browser): the value stays selectable
    }
  };

  const CopyButton = ({ id, value }: { id: string; value: string }) => (
    <button
      type="button"
      onClick={() => copy(id, value)}
      className="inline-flex shrink-0 items-center gap-1.5 border border-ink/15 px-2.5 py-1 text-[0.65rem] font-semibold uppercase tracking-widest text-ink/70 transition hover:border-gold hover:text-gold"
    >
      {copied === id ? <Check className="h-3.5 w-3.5 text-st-free" strokeWidth={1.75} /> : <Copy className="h-3.5 w-3.5" strokeWidth={1.5} />}
      {copied === id ? t.copied : t.copy}
    </button>
  );

  const steps = info.safeSteps.filter((s) => s.trim());
  const more = info.more.filter((m) => m.title.trim() || m.text.trim());

  return (
    <details className="group border border-gold/40 bg-white p-5" id="stay-info">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="eyebrow !text-[0.6rem] flex items-center gap-2">
            <Wifi className="h-4 w-4 text-gold" strokeWidth={1.25} />
            {info.title}
          </span>
          <span className="mt-1 block truncate text-xs text-ink/55">
            {wifi ? `${t.wifiTitle} · ${wifi.ssid}` : info.intro}
          </span>
        </span>
        <span className="text-gold transition group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      {info.intro && <p className="mt-4 text-sm text-ink/60">{info.intro}</p>}

      {wifi && (
        <div className="mt-5">
          <h3 className="eyebrow !text-[0.6rem] flex items-center gap-2">
            <Wifi className="h-4 w-4 text-gold" strokeWidth={1.25} />
            {t.wifiTitle}
          </h3>
          <dl className="mt-3 divide-y divide-ink/8 border-y border-ink/8 text-sm">
            <div className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <dt className="text-[0.65rem] uppercase tracking-widest text-ink/45">{t.network}</dt>
                <dd className="break-all font-semibold select-all">{wifi.ssid}</dd>
              </div>
              <CopyButton id="ssid" value={wifi.ssid} />
            </div>
            <div className="flex items-center justify-between gap-3 py-2.5">
              <div className="min-w-0">
                <dt className="text-[0.65rem] uppercase tracking-widest text-ink/45">{t.password}</dt>
                <dd className="break-all font-mono font-semibold select-all">{wifi.password || t.openNetwork}</dd>
              </div>
              {wifi.password && <CopyButton id="password" value={wifi.password} />}
            </div>
          </dl>

          <div className="mt-4 space-y-3">
            {platform === "apple" && (
              <>
                <a href="/api/account/wifi" className="btn-gold inline-flex w-full items-center justify-center gap-2">
                  <Wifi className="h-4 w-4" strokeWidth={1.5} />
                  {t.joinApple}
                </a>
                <p className="text-xs leading-relaxed text-ink/55">{t.joinAppleHelp}</p>
              </>
            )}
            {platform === "android" && wifi.password && (
              <>
                <button
                  type="button"
                  onClick={() => copy("password", wifi.password)}
                  className="btn-gold inline-flex w-full items-center justify-center gap-2"
                >
                  {copied === "password" ? <Check className="h-4 w-4" strokeWidth={1.75} /> : <Copy className="h-4 w-4" strokeWidth={1.5} />}
                  {copied === "password" ? t.copied : t.joinAndroid}
                </button>
                <p className="text-xs leading-relaxed text-ink/55">{t.joinAndroidHelp}</p>
              </>
            )}
            {qrSvg && (
              <div>
                <button
                  type="button"
                  onClick={() => setQrOpen((o) => !o)}
                  aria-expanded={qrOpen}
                  className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-gold"
                >
                  <QrCode className="h-4 w-4" strokeWidth={1.5} />
                  {qrOpen ? t.hideQr : t.showQr}
                </button>
                {qrOpen && (
                  <div className="mt-3 flex flex-col items-center gap-3 sm:flex-row sm:items-start">
                    <div
                      className="h-40 w-40 shrink-0 border border-ink/10 p-1 [&>svg]:h-full [&>svg]:w-full"
                      role="img"
                      aria-label={`QR code Wi-Fi ${wifi.ssid}`}
                      dangerouslySetInnerHTML={{ __html: qrSvg }}
                    />
                    <p className="text-xs leading-relaxed text-ink/55">{t.qrHelp}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {(steps.length > 0 || safeCode) && (
        <div className="mt-7">
          <h3 className="eyebrow !text-[0.6rem] flex items-center gap-2">
            <Vault className="h-4 w-4 text-gold" strokeWidth={1.25} />
            {info.safeTitle}
          </h3>
          {safeCode && (
            <div className="mt-3 flex items-center justify-between gap-3 border-y border-ink/8 py-2.5 text-sm">
              <div>
                <div className="text-[0.65rem] uppercase tracking-widest text-ink/45">{t.safeCode}</div>
                <div className="font-mono font-semibold">{safeCode}</div>
              </div>
              <CopyButton id="safe" value={safeCode} />
            </div>
          )}
          {steps.length > 0 && (
            <ol className="mt-3 space-y-2 text-sm text-ink/75">
              {steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-gold/60 text-[0.65rem] font-semibold text-gold">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}

      {more.map((m, i) => (
        <div key={i} className="mt-7">
          <h3 className="eyebrow !text-[0.6rem] flex items-center gap-2">
            <Info className="h-4 w-4 text-gold" strokeWidth={1.25} />
            {m.title}
          </h3>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/75">{m.text}</p>
        </div>
      ))}
    </details>
  );
}
