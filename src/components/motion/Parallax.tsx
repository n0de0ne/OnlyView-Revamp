"use client";

/**
 * A photo that drifts slower than the page as it passes — depth without a
 * scroll library. The image is rendered a little taller than its frame and
 * moved with the scroll position; reduced motion leaves it still.
 */
import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export function Parallax({
  children,
  className = "",
  amount = 10,
}: {
  children: React.ReactNode;
  className?: string;
  /** percent of the frame height travelled while it crosses the viewport */
  amount?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const y = useTransform(scrollYProgress, [0, 1], [`-${amount}%`, `${amount}%`]);
  return (
    <div ref={ref} className={`overflow-hidden ${className}`}>
      <motion.div style={reduced ? undefined : { y, scale: 1 + amount / 45 }} className="will-change-transform">
        {children}
      </motion.div>
    </div>
  );
}
