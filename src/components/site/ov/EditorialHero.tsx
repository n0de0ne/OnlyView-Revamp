import Image from "next/image";
import { SplitHeading } from "@/components/motion/SplitHeading";

/**
 * The opening of every inner page in the redesign: on warm paper, a mono
 * index label, a monumental serif title, the introduction set against it on
 * the right, then (when the page has one) a wide photograph that bleeds to
 * the edges. No dark veil: the photograph is shown as it is.
 */
export function EditorialHero(props: {
  title: string;
  eyebrow?: string;
  intro?: string;
  image?: { url: string; alt: string };
  /** a short mono line under the eyebrow (a count, a season…) */
  meta?: string;
  /** tighter on phones, where the page below needs the room (booking, map) */
  compact?: boolean;
  /** photo height; the default is a wide 21:9 band */
  imageClass?: string;
  children?: React.ReactNode;
}) {
  return (
    <section className="ov-page relative">
      <div className={`ov-shell ${props.compact ? "pb-8 pt-24 md:pb-12 md:pt-36" : "pb-12 pt-28 md:pb-16 md:pt-40"}`}>
        <div className="grid gap-x-10 gap-y-6 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            {props.eyebrow && (
              <p className="ov-label rise-in mb-5 text-ink/55" style={{ animationDelay: "0.05s" }}>
                <span className="mr-3 inline-block h-px w-8 translate-y-[-0.25em] bg-gold align-middle" aria-hidden />
                {props.eyebrow}
              </p>
            )}
            <SplitHeading as="h1" text={props.title} delay={0.12} className="ov-h1 text-ink" />
          </div>
          {(props.intro || props.meta) && (
            <div className="rise-in lg:col-span-4 lg:pb-2" style={{ animationDelay: "0.45s" }}>
              {props.meta && <p className="ov-label mb-3 text-gold-dark">{props.meta}</p>}
              {props.intro && (
                <p className={`ov-body max-w-md ${props.compact ? "hidden md:block" : ""}`}>{props.intro}</p>
              )}
            </div>
          )}
        </div>
        {props.children}
      </div>
      {props.image && (
        <div className="ov-shell">
          <div className={`ov-photo relative w-full ${props.imageClass ?? "aspect-[16/10] md:aspect-[21/9]"}`}>
            <Image
              src={props.image.url}
              alt={props.image.alt}
              fill
              sizes="(max-width: 1440px) 100vw, 1440px"
              priority
              className="hero-drift object-cover"
            />
          </div>
        </div>
      )}
    </section>
  );
}

/** A section's heading pair: mono label over a serif title, an optional aside on the right. */
export function SectionHead(props: {
  label?: string;
  title: string;
  id?: string;
  aside?: React.ReactNode;
  light?: boolean;
  className?: string;
}) {
  return (
    <div className={`mb-10 grid gap-6 md:mb-14 lg:grid-cols-12 lg:items-end ${props.className ?? ""}`}>
      <div className="lg:col-span-8">
        {props.label && (
          <p className={`ov-label mb-4 ${props.light ? "text-white/55" : "text-ink/55"}`}>
            <span className="mr-3 inline-block h-px w-8 translate-y-[-0.25em] bg-gold align-middle" aria-hidden />
            {props.label}
          </p>
        )}
        <h2 id={props.id} className={`ov-h2 ${props.light ? "text-white" : "text-ink"}`}>
          {props.title}
        </h2>
      </div>
      {props.aside && <div className="lg:col-span-4 lg:justify-self-end">{props.aside}</div>}
    </div>
  );
}
