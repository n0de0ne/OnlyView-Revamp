import { LineIcon } from "@/components/LineIcon";

/**
 * The villa's key facts as a plain definition list — the block answer engines
 * quote and Google lifts into featured snippets. No images, no scripts: just
 * labelled facts in the page text, the same ones the JSON-LD carries.
 *
 * On a phone the twelve rows are a screenful of their own, so the headline
 * shows as one sentence and the table opens on demand (a CSS-only
 * disclosure — the facts stay in the HTML either way, which is what
 * crawlers read). From `sm` up the full ledger is always visible.
 */
export function KeyFacts({
  title,
  label,
  summary,
  toggle,
  facts,
  icons,
  className = "",
}: {
  title: string;
  label: string;
  /** one-line version of the facts, shown on phones */
  summary: string;
  /** label of the "show everything" control */
  toggle: string;
  facts: Record<string, [string, string]>;
  /** a line icon per fact (Admin → Textes du site → Icônes) */
  icons?: Record<string, string>;
  className?: string;
}) {
  return (
    <section className={`bg-paper ${className}`} aria-labelledby="key-facts">
      <div className="ov-shell py-10 lg:py-16">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 sm:mb-6">
          <h2 id="key-facts" className="ov-h3 text-ink">
            {title}
          </h2>
          <p className="ov-label text-ink/50">{label}</p>
        </div>

        <p className="text-sm leading-relaxed text-ink/75 sm:hidden">{summary}</p>

        {/* peer checkbox → the label and the table below react to it in CSS */}
        <input id="key-facts-more" type="checkbox" className="peer sr-only" />
        <label
          htmlFor="key-facts-more"
          className="tap ov-label inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 text-gold-dark peer-checked:hidden sm:hidden"
        >
          {toggle}
          <span aria-hidden>↓</span>
        </label>

        <dl
          className="grid max-h-0 gap-x-10 overflow-hidden border-ink/12 peer-checked:max-h-[500rem] peer-checked:border-t sm:max-h-none sm:grid-cols-2 sm:border-t lg:grid-cols-3"
        >
          {Object.entries(facts).map(([key, [term, detail]]) => (
            <div
              key={key}
              className={`border-b border-ink/12 py-3 text-sm sm:grid sm:items-baseline sm:gap-x-3 ${
                icons ? "sm:grid-cols-[8rem_1fr]" : "sm:grid-cols-[6.5rem_1fr]"
              }`}
            >
              <dt className="ov-label flex items-center gap-2 text-ink/50">
                {icons?.[key] && <LineIcon name={icons[key]} className="h-4 w-4 text-gold-dark" />}
                {term}
              </dt>
              <dd className="mt-0.5 leading-snug text-ink/80 sm:mt-0">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
