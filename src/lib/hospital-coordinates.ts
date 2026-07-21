export function pointToLngLat(geojsonPoint: { coordinates: [number, number] } | null): [number, number] | null {
  if (!geojsonPoint) return null;
  return geojsonPoint.coordinates;
}
