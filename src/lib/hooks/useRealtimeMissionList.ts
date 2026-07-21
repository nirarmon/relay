"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/** Re-fires onChange whenever any mission or mission_event row changes, for dashboard list refresh. */
export function useRealtimeMissionList(onChange: () => void) {
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel("dashboard-missions")
      .on("postgres_changes", { event: "*", schema: "public", table: "mission" }, onChange)
      .on("postgres_changes", { event: "*", schema: "public", table: "mission_event" }, onChange)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
