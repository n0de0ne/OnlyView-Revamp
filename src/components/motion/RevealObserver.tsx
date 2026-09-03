"use client";

/**
 * Scroll reveals for every `.reveal` element, in every browser: once
 * mounted, the root gets `.motion`, the CSS hides the elements still below
 * the fold, and an IntersectionObserver lets each one rise as it enters.
 * Without JavaScript nothing is ever hidden — crawlers and readers see the
 * page whole. Elements already on screen are marked before the class lands,
 * so nothing flashes.
 */
import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function RevealObserver() {
  const pathname = usePathname();
  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>(".reveal:not(.in)"));
    const vh = window.innerHeight;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.top < vh * 0.9 && r.bottom > 0) el.classList.add("in");
    }
    root.classList.add("motion");
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            io.unobserve(e.target);
          }
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.05 }
    );
    for (const el of els) if (!el.classList.contains("in")) io.observe(el);
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
