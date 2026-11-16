import { notFound } from "next/navigation";

/**
 * Any address no page answers: without this catch-all Next serves its bare
 * default 404 (white page, no way back) and the site's own "Lost at sea" page
 * (not-found.tsx, next to this folder) is never shown.
 */
export default function UnknownPage() {
  notFound();
}
