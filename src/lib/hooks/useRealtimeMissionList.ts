"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-fires onChange whenever any mission or mission_event row changes, for dashboard list
 * refresh.
 *
 * See the identical, more detailed comment in useRealtimeMission.ts for why we must await
 * supabase.auth.getSession() before subscribing: subscribing before the client's session
 * finishes restoring from cookies joins the channel with no per-user access token, and
 * Postgres Changes then silently drops every event for that subscriber (RLS is evaluated
 * per-event using that token) even though the join itself reports success.
 */
export function useRealtimeMissionList(onChange: () => void) {
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel("dashboard-missions")
        .on("postgres_changes", { event: "*", schema: "public", table: "mission" }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "mission_event" }, onChange)
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
