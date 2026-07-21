"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Re-fires onChange whenever this mission's row, its events, or its custody events change. */
export function useRealtimeMission(missionId: string, onChange: () => void) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`mission-detail-${missionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "mission", filter: `id=eq.${missionId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "mission_event", filter: `mission_id=eq.${missionId}` }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "custody_event" }, onChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);
}
