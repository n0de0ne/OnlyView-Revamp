import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-5 pt-24 text-center">
      <p className="eyebrow mb-4">404</p>
      <h1 className="font-display text-5xl text-ink">Lost at sea</h1>
      <p className="mt-4 max-w-md text-ink/60">
        This page drifted away. The view, however, is still exactly where it should be.
      </p>
      <Link href="/" className="btn-gold mt-8">
        Villa ONLY VIEW
      </Link>
    </div>
  );
}
