import { notFound } from "next/navigation";
import { ReservationEditor } from "@/components/admin/ReservationEditor";
import {
  getReservationEditorData,
  parseReservationParam,
} from "@/lib/reservation-editor-data";

export const dynamic = "force-dynamic";

/**
 * Standalone editor — what a hard load, refresh or shared link renders.
 * Soft navigations from inside the back-office are intercepted by
 * `@modal/(.)reservations/[id]` and open as an overlay instead.
 */
export default async function ReservationEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ start?: string; end?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const reservationId = parseReservationParam(id);
  if (reservationId === false) notFound();

  const data = await getReservationEditorData();

  return (
    <ReservationEditor
      reservationId={reservationId}
      {...data}
      prefill={{ start: sp.start ?? null, end: sp.end ?? null }}
    />
  );
}
