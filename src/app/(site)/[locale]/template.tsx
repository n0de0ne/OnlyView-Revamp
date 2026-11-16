"use client";

/**
 * Route transitions: each page rises in as you navigate. The very first
 * paint is untouched (no hidden-then-shown content for the crawler or the
 * Largest Contentful Paint); only client-side navigations animate.
 */
import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";

let navigated = false;

export default function Template({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  // decided once per mount, and the flag flips after commit: flipping it
  // during render made React's dev double-render disagree with the server
  const [animate] = useState(() => navigated && !reduced);
  useEffect(() => {
    navigated = true;
  }, []);
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 14 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}
