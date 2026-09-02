import { notFound } from "next/navigation";
import { ReservationEditor } from "@/components/admin/ReservationEditor";
import { RouteModal } from "@/components/admin/RouteModal";
import {
  getReservationEditorData,
  parseReservationParam,
} from "@/lib/reservation-editor-data";

export const dynamic = "force-dynamic";

/**
 * The reservation editor as an overlay: opening one from the calendar, the
 * list, the dashboard or a contract keeps that page underneath, so closing
 * returns exactly where the user was instead of re-running its filters.
 */
export default async function ReservationEditorModal({
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
    <RouteModal
      routePath={`/admin/reservations/${id}`}
      title={reservationId ? `Réservation #${reservationId}` : "Nouvelle réservation"}
    >
      <ReservationEditor
        reservationId={reservationId}
        {...data}
        prefill={{ start: sp.start ?? null, end: sp.end ?? null }}
        inModal
      />
    </RouteModal>
  );
}
