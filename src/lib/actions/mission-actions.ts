"use server";

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
