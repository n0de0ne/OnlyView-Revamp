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
      <div className="mx-auto max-w-7xl px-5 py-20 lg:px-8">
        <p className="eyebrow mb-4">{label}</p>
        <h2 id="key-facts" className="section-title mb-10 !text-3xl md:!text-4xl">
          {title}
        </h2>
        <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(facts).map(([key, [term, detail]]) => (
            <div key={key} className="border-t border-ink/10 pt-4">
              <dt className="text-[0.68rem] font-semibold uppercase tracking-[0.22em] text-gold">
                {term}
              </dt>
              <dd className="mt-1.5 leading-relaxed text-ink/80">{detail}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
