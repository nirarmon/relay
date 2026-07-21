import { createClient } from "@/lib/supabase/server";
import { getMissionDetail } from "@/lib/queries/missions";
import { pointToLngLat } from "@/lib/hospital-coordinates";
import { MissionDetailClient } from "./MissionDetailClient";
import type { MapMarker } from "@/components/MissionMap";

export default async function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const mission = await getMissionDetail(supabase, id);

  // The `location` column is a PostGIS `geography(point, 4326)`. PostgREST/postgrest-js
  // serializes geography columns as WKB hex by default (e.g. "0101000020E610...") when
  // fetched with a plain `.select()` — not as GeoJSON. `.geojson()` requests the
  // `application/geo+json` representation instead, reshaping the response into a
  // FeatureCollection whose `features[].geometry` matches the `{ coordinates: [lng, lat] }`
  // shape `pointToLngLat` expects.
  const { data: donorGeo } = await supabase
    .from("hospital")
    .select("location")
    .eq("id", mission.donorHospital.id)
    .geojson();
  const { data: recipientGeo } = await supabase
    .from("hospital")
    .select("location")
    .eq("id", mission.recipientHospital.id)
    .geojson();

  const mapMarkers: MapMarker[] = [];
  const donorLngLat = pointToLngLat((donorGeo as any)?.features?.[0]?.geometry ?? null);
  const recipientLngLat = pointToLngLat((recipientGeo as any)?.features?.[0]?.geometry ?? null);
  if (donorLngLat) mapMarkers.push({ id: "donor", lngLat: donorLngLat, label: mission.donorHospital.name, kind: "hospital" });
  if (recipientLngLat) mapMarkers.push({ id: "recipient", lngLat: recipientLngLat, label: mission.recipientHospital.name, kind: "hospital" });

  async function refreshMission() {
    "use server";
    const client = await createClient();
    return getMissionDetail(client, id);
  }

  return <MissionDetailClient initialMission={mission} refreshMission={refreshMission} mapMarkers={mapMarkers} />;
}
