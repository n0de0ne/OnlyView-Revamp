import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 pt-24 text-center">
      <p className="eyebrow mb-4">404</p>
      <h1 className="font-display text-5xl text-ink">Lost at sea · Perdu en mer</h1>
      <p className="mt-4 max-w-md text-ink/60">
        This page drifted away — the villa, its rates and its calendar are still exactly where they
        should be. <span lang="fr">Cette page a dérivé ; la villa, elle, n'a pas bougé.</span>
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-gold">
          Villa ONLY VIEW
        </Link>
        <Link href="/villa" className="btn-outline">
          The villa
        </Link>
        <Link href="/rates" className="btn-outline">
          Rates
        </Link>
        <Link href="/booking" className="btn-outline">
          Availability
        </Link>
        <Link href="/fr" className="btn-outline">
          Version française
        </Link>
      </div>
    </div>
  );
}
