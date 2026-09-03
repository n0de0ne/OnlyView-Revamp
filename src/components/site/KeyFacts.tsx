/**
 * The villa's key facts as a plain definition list — the block answer engines
 * quote and Google lifts into featured snippets. No images, no scripts: just
 * labelled facts in the page text, the same ones the JSON-LD carries.
 */
export function KeyFacts({
  title,
  label,
  facts,
  className = "",
}: {
  title: string;
  label: string;
  facts: Record<string, [string, string]>;
  className?: string;
}) {
  return (
    <section className={`bg-white ${className}`} aria-labelledby="key-facts">
      <div className="mx-auto max-w-7xl px-5 py-10 lg:px-8 lg:py-12">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 sm:mb-6">
          <h2 id="key-facts" className="font-display text-2xl text-ink md:text-3xl">
            {title}
          </h2>
          <p className="eyebrow !mb-0">{label}</p>
        </div>
        {/* phone: label over its fact, so nothing is squeezed into a narrow
            column. From sm up: a two-column ledger, label left, fact right. */}
        <dl className="grid gap-x-10 border-t border-ink/10 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(facts).map(([key, [term, detail]]) => (
            <div
              key={key}
              className="border-b border-ink/10 py-2.5 text-sm sm:grid sm:grid-cols-[6.5rem_1fr] sm:items-baseline sm:gap-x-3 sm:py-2.5"
            >
              <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-gold">
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
