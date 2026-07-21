import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type OrganType = "HEART" | "LUNG" | "LIVER" | "PANCREAS" | "KIDNEY";
type PreservationMethod = "STATIC_COLD" | "MACHINE_PERFUSION";

// Default windows (minutes) — editable per-mission in the UI. Static-cold values follow
// conservative clinical practice; machine-perfusion values extend the window per the
// plan's R5/Q5 assumption. Confirm with a transplant coordinator before relying on these
// clinically (see open-questions.md Q5) — these are POC defaults, not medical advice.
const STATIC_COLD_MINUTES: Record<OrganType, number> = {
  HEART: 4 * 60,
  LUNG: 6 * 60,
  LIVER: 12 * 60,
  PANCREAS: 12 * 60,
  KIDNEY: 24 * 60,
};
const MACHINE_PERFUSION_MULTIPLIER = 1.5;

export function suggestIschemicBudgetMinutes(organType: OrganType, preservationMethod: PreservationMethod): number {
  const base = STATIC_COLD_MINUTES[organType];
  return preservationMethod === "MACHINE_PERFUSION" ? Math.round(base * MACHINE_PERFUSION_MULTIPLIER) : base;
}

export interface CreateMissionInput {
  organType: OrganType;
  preservationMethod: PreservationMethod;
  ischemicBudgetMinutes: number;
  donorHospitalId: string;
  recipientHospitalId: string;
  contractId: string;
  opoOrgId: string;
  operatorOrgId: string;
}

export type CreateMissionResult = { ok: true; missionId: string } | { ok: false; error: string };

export async function createMission(
  supabase: SupabaseClient<Database>,
  input: CreateMissionInput
): Promise<CreateMissionResult> {
  const { data: mission, error: missionError } = await supabase
    .from("mission")
    .insert({
      contract_id: input.contractId,
      opo_org_id: input.opoOrgId,
      operator_org_id: input.operatorOrgId,
      donor_hospital_id: input.donorHospitalId,
      recipient_hospital_id: input.recipientHospitalId,
      status: "OfferReceived",
    })
    .select()
    .single();
  if (missionError || !mission) return { ok: false, error: missionError?.message ?? "Failed to create mission" };

  const { data: organ, error: organError } = await supabase
    .from("organ")
    .insert({
      mission_id: mission.id,
      organ_type: input.organType,
      preservation_method: input.preservationMethod,
      ischemic_budget_minutes: input.ischemicBudgetMinutes,
    })
    .select()
    .single();
  if (organError || !organ) return { ok: false, error: organError?.message ?? "Failed to create organ record" };

  const { error: linkError } = await supabase.from("mission").update({ organ_id: organ.id }).eq("id", mission.id);
  if (linkError) return { ok: false, error: linkError.message };

  return { ok: true, missionId: mission.id };
}
