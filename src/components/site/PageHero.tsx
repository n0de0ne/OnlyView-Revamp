import Image from "next/image";
import { SplitHeading } from "@/components/motion/SplitHeading";

export function PageHero(props: {
  title: string;
  eyebrow?: string;
  intro?: string;
  image?: { url: string; alt: string };
}) {
  return (
    <section className="relative overflow-hidden bg-night pb-16 pt-36 text-white md:pb-20 md:pt-44">
      {props.image && (
        <>
          <Image
            src={props.image.url}
            alt=""
            fill
            sizes="100vw"
            priority
            className="hero-drift object-cover opacity-40"
            aria-hidden
          />
          <div className="absolute inset-0 bg-gradient-to-b from-night/60 to-night" />
        </>
      )}
      <div className="relative mx-auto max-w-7xl px-5 lg:px-8">
        {props.eyebrow && (
          <p className="eyebrow rise-in mb-4" style={{ animationDelay: "0.05s" }}>
            {props.eyebrow}
          </p>
        )}
        <SplitHeading as="h1" text={props.title} delay={0.15} className="font-display text-4xl leading-tight md:text-6xl" />
        {props.intro && (
          <p className="rise-in mt-5 max-w-2xl leading-relaxed text-white/75" style={{ animationDelay: "0.55s" }}>
            {props.intro}
          </p>
        )}
      </div>
    </section>
  );
}
