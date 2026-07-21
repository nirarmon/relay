"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-fires onChange whenever this mission's row, its events, or its custody events change.
 *
 * Subscribing must wait for the client's session to finish restoring from cookies first.
 * @supabase/ssr's createBrowserClient() resolves its session asynchronously (parsing it out
 * of cookies via GoTrueClient's _initialize()), and only THEN does it call
 * this.realtime.setAuth(accessToken) to give the Realtime socket the signed-in user's JWT.
 * If .channel(...).subscribe() fires before that finishes, the channel joins successfully
 * (the anon apikey alone is enough for the join handshake) but with no per-user access
 * token -- and Postgres Changes evaluates each table's RLS policies per subscriber using
 * that token, so every change event silently fails that check and is never forwarded. The
 * join looks fully healthy ("Subscribed to PostgreSQL"); it just never delivers anything.
 * Verified end-to-end: without this await, two real browser sessions on the same mission,
 * both showing "SUBSCRIBED", never saw a live update no matter how the other side's
 * transition was triggered (server action, raw RPC, or even a superuser SQL UPDATE) --
 * while a plain script that awaited auth before subscribing received every event
 * immediately. Awaiting getSession() first forces that auth handshake to complete (and
 * setAuth() to fire with the real token) before we ever join the channel.
 */
export function useRealtimeMission(missionId: string, onChange: () => void) {
  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    supabase.auth.getSession().then(() => {
      if (cancelled) return;
      channel = supabase
        .channel(`mission-detail-${missionId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "mission", filter: `id=eq.${missionId}` }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "mission_event", filter: `mission_id=eq.${missionId}` }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "custody_event" }, onChange)
        .subscribe();
    });

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missionId]);
}
