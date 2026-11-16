import { notFound } from "next/navigation";

/**
 * Any address no page answers: hand it to the localized not-found page, so
 * a mistyped link lands on the site (header, footer, ways back) and not on
 * the framework's bare 404.
 */
export default function Missing() {
  notFound();
}
