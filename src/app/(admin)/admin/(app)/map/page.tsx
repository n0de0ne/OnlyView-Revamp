import { MapPlacesBoard } from "@/components/admin/MapPlacesBoard";
import { getSettings } from "@/lib/settings";
import { VILLA } from "@/lib/site-facts";

export const dynamic = "force-dynamic";

export default async function AdminMapPage() {
  const s = await getSettings();
  const lat = parseFloat(s.villa_lat ?? "");
  const lng = parseFloat(s.villa_lng ?? "");
  const villa: [number, number] =
    Number.isFinite(lat) && Number.isFinite(lng) ? [lat, lng] : [VILLA.lat, VILLA.lng];
  return <MapPlacesBoard villa={villa} />;
}
