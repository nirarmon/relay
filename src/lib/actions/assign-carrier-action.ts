// NOTE: deliberately NOT a "use server" file -- see the identical note atop
// mission-actions.ts. Both getCarrierCandidates and assignCarrier here take an
// injected SupabaseClient so they stay plain, directly-testable functions (see
// assign-carrier-action.test.ts). getCarrierCandidates is also called directly
// from carrier/page.tsx (a Server Component), which is a plain in-process
// function call and never crosses the client/server RPC boundary, so it's fine
// there. The actual Next.js Server Action client components call for the mutating
// path lives in ./assign-carrier.server.ts and creates its own server-side
// client internally before delegating to assignCarrier here -- a live
// SupabaseClient instance passed as a Server Action argument from the browser
// arrives inert on the server (verified end-to-end: clicking "Assign Carrier"
// used to reproduce "Cannot access ... from on the server. You cannot dot into a
// temporary client reference from a server component." and a 500 response).

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { computeCrewAssignmentLegality, type CrewAssignmentLegalityResult, type DutyRecord } from "@/lib/engines/duty-legality";

export interface CarrierCandidate {
  aircraft: { id: string; tailNumber: string; type: string };
  aircraftLegal: boolean;
  aircraftReasons: string[];
  pilots: Array<{ id: string; name: string; legality: CrewAssignmentLegalityResult }>;
}

export async function getCarrierCandidates(
  supabase: SupabaseClient<Database>,
  operatorOrgId: string,
  contractId: string
): Promise<CarrierCandidate[]> {
  const { data: contract, error: contractError } = await supabase
    .from("contract")
    .select("required_csl_amount")
    .eq("id", contractId)
    .single();
  if (contractError || !contract) throw contractError ?? new Error("Contract not found");

  const { data: aircraftRows, error: aircraftError } = await supabase
    .from("aircraft")
    .select("id, tail_number, type, on_d085, liability_csl_amount, status")
    .eq("operator_org_id", operatorOrgId);
  if (aircraftError) throw aircraftError;

  const { data: pilotRows, error: pilotError } = await supabase
    .from("pilot")
    .select("id, name, currency_status")
    .eq("operator_org_id", operatorOrgId);
  if (pilotError) throw pilotError;

  const now = new Date();
  const pilotsWithLegality = await Promise.all(
    (pilotRows ?? []).map(async (pilot: any) => {
      const { data: dutyRows, error: dutyError } = await supabase
        .from("duty_record")
        .select("record_type, start_at, end_at")
        .eq("pilot_id", pilot.id);
      if (dutyError) throw dutyError;

      const legality = computeCrewAssignmentLegality(
        { currencyStatus: pilot.currency_status },
        (dutyRows ?? []) as DutyRecord[],
        now
      );
      return { id: pilot.id, name: pilot.name, legality };
    })
  );

  return (aircraftRows ?? []).map((aircraft: any) => {
    const reasons: string[] = [];
    if (!aircraft.on_d085) reasons.push("Aircraft is not authorized on D085 — cannot fly revenue.");
    if (aircraft.liability_csl_amount < contract.required_csl_amount) {
      reasons.push(`Liability coverage ($${aircraft.liability_csl_amount.toLocaleString()}) is below the contract's required CSL ($${contract.required_csl_amount.toLocaleString()}).`);
    }
    if (aircraft.status !== "AVAILABLE") reasons.push(`Aircraft status is ${aircraft.status}, not AVAILABLE.`);

    return {
      aircraft: { id: aircraft.id, tailNumber: aircraft.tail_number, type: aircraft.type },
      aircraftLegal: reasons.length === 0,
      aircraftReasons: reasons,
      pilots: pilotsWithLegality,
    };
  });
}

export interface AssignCarrierInput {
  missionId: string;
  aircraftId: string;
  crew: Array<{ pilotId: string; role: "PIC" | "SIC" }>;
}

export type AssignCarrierResult = { ok: true } | { ok: false; error: string };

export async function assignCarrier(
  supabase: SupabaseClient<Database>,
  operatorOrgId: string,
  contractId: string,
  input: AssignCarrierInput
): Promise<AssignCarrierResult> {
  const candidates = await getCarrierCandidates(supabase, operatorOrgId, contractId);
  const candidate = candidates.find((c) => c.aircraft.id === input.aircraftId);
  if (!candidate || !candidate.aircraftLegal) {
    return { ok: false, error: candidate?.aircraftReasons.join(" ") ?? "Aircraft not found" };
  }

  const crewWithSnapshots = input.crew.map((c) => {
    const pilot = candidate.pilots.find((p) => p.id === c.pilotId);
    if (!pilot || !pilot.legality.legal) {
      return null;
    }
    return { pilot_id: c.pilotId, role: c.role, legality_snapshot: pilot.legality };
  });

  if (crewWithSnapshots.some((c) => c === null)) {
    return { ok: false, error: "One or more selected crew members are not duty-legal for this assignment." };
  }

  const { error } = await supabase.rpc("assign_carrier_and_transition", {
    p_mission_id: input.missionId,
    p_aircraft_id: input.aircraftId,
    p_crew: crewWithSnapshots as any,
  });
  if (error) return { ok: false, error: error.message };

  return { ok: true };
}
