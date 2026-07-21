// NOTE: deliberately NOT a "use server" file. `transitionMission` below takes an
// injected SupabaseClient so it stays a plain, directly-testable function (see
// mission-actions.test.ts, which passes a fake client). The actual Next.js Server
// Action that client components call lives in ./mission-transition.server.ts and
// creates its own server-side client internally before delegating here — a Server
// Action can only accept plain/serializable arguments from the browser, and a live
// SupabaseClient instance passed across that boundary arrives inert on the server
// (any method call on it throws "Cannot access ... from on the server. You cannot
// dot into a temporary client reference from a server component."). This was
// verified end-to-end: clicking "Report divert" / "Assign Carrier" in the browser
// (which used to call this function directly with a client-created supabase
// instance) reproduced exactly that error and a 500 response.

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyMissionTransition,
  type MissionEventType,
  type MissionStatus,
  type CarrierAssignmentCheck,
} from "@/lib/engines/state-machine";

export interface TransitionMissionInput {
  missionId: string;
  event: MissionEventType;
  note?: string;
  metadata?: Record<string, unknown>;
  carrierAssignmentCheck?: CarrierAssignmentCheck;
}

export type TransitionMissionResult = { ok: true } | { ok: false; error: string };

export async function transitionMission(
  supabase: SupabaseClient,
  input: TransitionMissionInput
): Promise<TransitionMissionResult> {
  const { data: mission, error: fetchError } = await supabase
    .from("mission")
    .select("status")
    .eq("id", input.missionId)
    .single();

  if (fetchError || !mission) {
    return { ok: false, error: fetchError?.message ?? "Mission not found" };
  }

  const guardResult = applyMissionTransition({
    currentStatus: mission.status as MissionStatus,
    event: input.event,
    carrierAssignmentCheck: input.carrierAssignmentCheck,
  });

  if (!guardResult.ok) {
    return { ok: false, error: guardResult.error };
  }

  const { error: rpcError } = await supabase.rpc("record_mission_transition", {
    p_mission_id: input.missionId,
    p_from_status: guardResult.from,
    p_to_status: guardResult.to,
    p_event_type: input.event,
    p_note: input.note ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (rpcError) {
    return { ok: false, error: rpcError.message };
  }

  return { ok: true };
}
