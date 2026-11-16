import Link from "next/link";

export default function NotFound() {
  return (
    <section className="ov-page">
      <div className="ov-shell flex min-h-[78vh] flex-col justify-end pb-20 pt-32 md:pb-28">
        <p className="ov-label mb-6 text-ink/55">
          <span className="mr-3 inline-block h-px w-8 translate-y-[-0.25em] bg-gold align-middle" aria-hidden />
          404
        </p>
        <h1 className="ov-h1 max-w-4xl text-ink">
          Lost at sea <span className="text-ink/35">·</span> <span lang="fr">Perdu en mer</span>
        </h1>
        <p className="ov-body mt-6 max-w-lg">
          This page drifted away — the villa, its rates and its calendar are still exactly where they
          should be. <span lang="fr">Cette page a dérivé ; la villa, elle, n&apos;a pas bougé.</span>
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link href="/" className="ov-btn ov-btn-gold">
            Villa ONLY VIEW
          </Link>
          <Link href="/villa" className="ov-btn ov-btn-line">
            The villa
          </Link>
          <Link href="/rates" className="ov-btn ov-btn-line">
            Rates
          </Link>
          <Link href="/booking" className="ov-btn ov-btn-line">
            Availability
          </Link>
          <Link href="/fr" className="ov-btn ov-btn-line">
            Version française
          </Link>
        </div>
      </div>
    </section>
  );
}
