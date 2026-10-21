"use client";

/**
 * "200 m²" counted up from zero when it scrolls into view (GSAP). The final
 * text is what the server renders — engines and no-script readers see the
 * figure, the animation is a bonus.
 */
import { useEffect, useRef } from "react";
import gsap from "gsap";

export function CountUp({ value, className = "" }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const m = value.match(/^([^\d]*)([\d\s,.]+)(.*)$/);
    if (!m) return;
    const [, prefix, digits, suffix] = m;
    const target = parseFloat(digits.replace(/[\s,]/g, ""));
    if (!Number.isFinite(target)) return;
    const decimals = (digits.split(".")[1] ?? "").length;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0].isIntersecting) return;
        io.disconnect();
        const obj = { n: 0 };
        gsap.to(obj, {
          n: target,
          duration: 1.6,
          ease: "power3.out",
          onUpdate: () => {
            el.textContent = `${prefix}${obj.n.toLocaleString("en-US", {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })}${suffix}`;
          },
          onComplete: () => {
            el.textContent = value;
          },
        });
      },
      { threshold: 0.6 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value]);
  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
