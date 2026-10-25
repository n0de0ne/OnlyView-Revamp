"use client";

import { useEffect, useState } from "react";

/** Privacy page switch: stop (or resume) the site's audience measurement in this browser. */
export function AnalyticsOptOut({ fr }: { fr: boolean }) {
  const [out, setOut] = useState<boolean | null>(null);
  useEffect(() => setOut(/(?:^|;\s*)ov_optout=1/.test(document.cookie)), []);
  const toggle = () => {
    const next = !out;
    document.cookie = next
      ? `ov_optout=1; path=/; max-age=${395 * 86400}; samesite=lax`
      : "ov_optout=; path=/; max-age=0; samesite=lax";
    setOut(next);
  };
  if (out === null) return null;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-4 border border-ink/10 bg-white px-5 py-4">
      <p className="flex-1 text-sm text-ink/75">
        {out
          ? fr
            ? "Vos visites ne sont plus mesurées dans ce navigateur."
            : "Your visits are no longer measured in this browser."
          : fr
            ? "Vos visites sont mesurées de façon anonyme."
            : "Your visits are measured anonymously."}
      </p>
      <button onClick={toggle} className="border border-ink/20 px-4 py-2 text-sm text-ink transition hover:border-gold">
        {out ? (fr ? "Réactiver la mesure" : "Allow measurement again") : fr ? "Ne plus mesurer mes visites" : "Don't measure my visits"}
      </button>
    </div>
  );
}
