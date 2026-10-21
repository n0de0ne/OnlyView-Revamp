/**
 * A heading whose words rise one after another. Pure CSS (keyframes with a
 * per-word delay), so the text is in the HTML for engines and visible even
 * if scripts never run; `prefers-reduced-motion` shows it at once.
 */
export function SplitHeading({
  text,
  as: Tag = "h2",
  className = "",
  delay = 0,
  children,
}: {
  text: string;
  as?: "h1" | "h2" | "h3" | "p";
  className?: string;
  /** seconds before the first word */
  delay?: number;
  /** anything that follows the words inside the heading (sr-only suffixes…) */
  children?: React.ReactNode;
}) {
  const words = text.split(/(\s+)/);
  let i = 0;
  return (
    <Tag className={className}>
      {words.map((w, k) =>
        /^\s+$/.test(w) ? (
          <span key={k}> </span>
        ) : (
          <span key={k} className="split-word">
            <span className="split-word-inner" style={{ animationDelay: `${delay + i++ * 0.07}s` }}>
              {w}
            </span>
          </span>
        )
      )}
      {children}
    </Tag>
  );
}
