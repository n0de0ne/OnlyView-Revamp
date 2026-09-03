"use client";

/**
 * Inertial scrolling (Lenis) driven by GSAP's ticker, with ScrollTrigger
 * kept in sync — the "weight" of a good site. Off when the visitor asks for
 * reduced motion; native on touch screens, where the OS already does it.
 */
import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const lenis = new Lenis({
      lerp: 0.09,
      wheelMultiplier: 0.95,
      anchors: { offset: -80 },
      // nested scrollers (the map's ledger, modals) opt out with data-lenis-prevent
    });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);
  return null;
}
