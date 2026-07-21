"use client";

import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";

export interface MapMarker {
  id: string;
  lngLat: [number, number];
  label: string;
  kind: "hospital" | "airport" | "custody";
  status?: "ON_TIME" | "AT_RISK" | "BREACHED";
}

export interface MissionMapProps {
  markers: MapMarker[];
  routeLngLats?: [number, number][];
}

const STATUS_COLOR: Record<NonNullable<MapMarker["status"]>, string> = {
  ON_TIME: "#1FAE7A",
  AT_RISK: "#E8A33D",
  BREACHED: "#E5484D",
};

export function MissionMap({ markers, routeLngLats }: MissionMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/dark-v11",
      center: markers[0]?.lngLat ?? [-74.006, 40.7128],
      zoom: 7,
    });
    mapRef.current = map;

    for (const marker of markers) {
      const el = document.createElement("div");
      el.style.width = "12px";
      el.style.height = "12px";
      el.style.borderRadius = "50%";
      el.style.border = "2px solid white";
      el.style.background = marker.status ? STATUS_COLOR[marker.status] : marker.kind === "airport" ? "#3E7BFA" : "#6B7280";

      new mapboxgl.Marker(el)
        .setLngLat(marker.lngLat)
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setText(marker.label))
        .addTo(map);
    }

    if (routeLngLats && routeLngLats.length > 1) {
      map.on("load", () => {
        map.addSource("mission-route", {
          type: "geojson",
          data: { type: "Feature", properties: {}, geometry: { type: "LineString", coordinates: routeLngLats } },
        });
        map.addLayer({
          id: "mission-route-line",
          type: "line",
          source: "mission-route",
          paint: { "line-color": "#3E7BFA", "line-width": 2, "line-dasharray": [2, 1] },
        });
      });
    }

    return () => map.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={containerRef} className="h-full min-h-[320px] w-full rounded-lg" />;
}
