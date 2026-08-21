"use client";

import { useEffect, useRef, useState } from "react";
import { getDict, type Locale } from "@/lib/i18n";

/**
 * Canvas signature capture + signing form. Posts the drawn signature
 * (PNG data-URL) with the typed name to the sign endpoint.
 */
export function SignaturePad({
  token,
  locale,
  expectedName,
}: {
  token: string;
  locale: Locale;
  expectedName: string;
}) {
  const t = getDict(locale);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);
  const [typedName, setTypedName] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [state, setState] = useState<"idle" | "signing" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const scale = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * scale;
    canvas.height = rect.height * scale;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(scale, scale);
    ctx.strokeStyle = "#12324a";
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, []);

  const pos = (e: PointerEvent | React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: React.PointerEvent) => {
    e.preventDefault();
    drawing.current = true;
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext("2d")!;
    const { x, y } = pos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    hasInk.current = true;
  };
  const end = () => {
    drawing.current = false;
  };

  const clear = () => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
  };

  const submit = async () => {
    setError(null);
    if (
      typedName.trim().toLowerCase().replace(/\s+/g, " ") !==
      expectedName.trim().toLowerCase().replace(/\s+/g, " ")
    ) {
      setError(t.contract.nameMismatch);
      return;
    }
    if (!hasInk.current || !agreed) return;
    setState("signing");
    try {
      const res = await fetch(`/api/contracts/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          typedName: typedName.trim(),
          signature: canvasRef.current!.toDataURL("image/png"),
        }),
      });
      if (res.ok) {
        setState("done");
        window.location.reload();
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    }
  };

  return (
    <div className="border border-ink/15 bg-white p-6 md:p-8">
      <h2 className="font-display text-2xl">{t.contract.signHere}</h2>
      <div className="relative mt-4">
        <canvas
          ref={canvasRef}
          className="h-40 w-full touch-none rounded border border-dashed border-ink/25 bg-sand"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          aria-label={t.contract.signHere}
        />
        <button
          type="button"
          onClick={clear}
          className="absolute right-2 top-2 rounded bg-white/90 px-2.5 py-1 text-xs text-ink/60 shadow hover:text-ink"
        >
          {t.contract.clear}
        </button>
      </div>

      <div className="field mt-5">
        <label htmlFor="sig-name">{t.contract.typeName} *</label>
        <input
          id="sig-name"
          value={typedName}
          onChange={(e) => setTypedName(e.target.value)}
          placeholder={expectedName}
        />
      </div>

      <label className="mt-4 flex items-start gap-3 text-sm text-ink/75">
        <input
          type="checkbox"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1 accent-gold"
        />
        {t.contract.agreeLabel}
      </label>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      {state === "error" && <p className="mt-3 text-sm text-red-600">{t.booking.error}</p>}

      <button
        onClick={submit}
        disabled={state === "signing" || !agreed}
        className="btn-gold mt-6 w-full"
      >
        {state === "signing" ? t.contract.signing : t.contract.signButton}
      </button>
    </div>
  );
}
