"use client";

/**
 * A card that tilts toward the pointer with a moving sheen, in perspective.
 * Desktop only; inert on touch and with reduced motion.
 */
import { motion, useMotionTemplate, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";
import { useRef } from "react";

export function Tilt({
  children,
  className = "",
  max = 7,
}: {
  children: React.ReactNode;
  className?: string;
  /** degrees */
  max?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), { stiffness: 180, damping: 20 });
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), { stiffness: 180, damping: 20 });
  const sheenX = useTransform(px, [0, 1], ["0%", "100%"]);
  const sheenY = useTransform(py, [0, 1], ["0%", "100%"]);
  const sheen = useMotionTemplate`radial-gradient(420px circle at ${sheenX} ${sheenY}, rgba(255,255,255,0.18), transparent 60%)`;

  const onMove = (e: React.PointerEvent) => {
    if (reduced || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const reset = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <motion.div
      ref={ref}
      className={`relative [transform-style:preserve-3d] ${className}`}
      style={{ rotateX: rx, rotateY: ry, perspective: 1000 }}
      onPointerMove={onMove}
      onPointerLeave={reset}
    >
      {children}
      <motion.div className="pointer-events-none absolute inset-0 z-10" style={{ background: sheen }} aria-hidden />
    </motion.div>
  );
}
