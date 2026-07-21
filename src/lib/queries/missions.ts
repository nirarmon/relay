import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { computeSlaState, type SlaState } from "@/lib/engines/sla";

export interface MissionListRow {
  id: string;
  status: string;
  organType: string | null;
  preservationMethod: string | null;
  donorHospitalName: string;
  recipientHospitalName: string;
  viabilityDeadlineAt: string | null;
  slaState: SlaState;
}

export async function getMissionList(
  supabase: SupabaseClient<Database>
): Promise<MissionListRow[]> {
  const { data, error } = await supabase
    .from("mission")
    .select(
      `id, status,
       donor_hospital:hospital!mission_donor_hospital_id_fkey(name),
       recipient_hospital:hospital!mission_recipient_hospital_id_fkey(name),
       organ:organ!mission_organ_id_fkey(organ_type, preservation_method, viability_deadline_at)`
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  const now = new Date();
  const rows: MissionListRow[] = (data ?? []).map((row: any) => {
    const viabilityDeadlineAt: string | null = row.organ?.viability_deadline_at ?? null;
    return {
      id: row.id,
      status: row.status,
      organType: row.organ?.organ_type ?? null,
      preservationMethod: row.organ?.preservation_method ?? null,
      donorHospitalName: row.donor_hospital?.name ?? "Unknown",
      recipientHospitalName: row.recipient_hospital?.name ?? "Unknown",
      viabilityDeadlineAt,
      slaState: computeSlaState(now, viabilityDeadlineAt ? new Date(viabilityDeadlineAt) : null),
    };
  });

  return rows.sort((a, b) => {
    if (!a.viabilityDeadlineAt && !b.viabilityDeadlineAt) return 0;
    if (!a.viabilityDeadlineAt) return 1;
    if (!b.viabilityDeadlineAt) return -1;
    return new Date(a.viabilityDeadlineAt).getTime() - new Date(b.viabilityDeadlineAt).getTime();
  });
}

export interface MissionDetail {
  id: string;
  status: string;
  donorHospital: { id: string; name: string };
  recipientHospital: { id: string; name: string };
  organ: {
    id: string;
    organType: string;
    preservationMethod: string;
    ischemicBudgetMinutes: number;
    crossClampAt: string | null;
    viabilityDeadlineAt: string | null;
  } | null;
  legs: Array<{ id: string; sequenceNo: number; mode: string; callSignCategory: string; status: string }>;
  custodyEvents: Array<{ id: string; eventType: string; occurredAt: string; custodianRole: string; proofType: string | null }>;
  assignedAircraft: { id: string; tailNumber: string; type: string } | null;
  crew: Array<{ pilotId: string; pilotName: string; role: string }>;
  auditLog: Array<{ id: string; fromStatus: string | null; toStatus: string; eventType: string; occurredAt: string; note: string | null }>;
}

export async function getMissionDetail(
  supabase: SupabaseClient<Database>,
  missionId: string
): Promise<MissionDetail> {
  const { data: mission, error: missionError } = await supabase
    .from("mission")
    .select(
      `id, status,
       donor_hospital:hospital!mission_donor_hospital_id_fkey(id, name),
       recipient_hospital:hospital!mission_recipient_hospital_id_fkey(id, name),
       organ:organ!mission_organ_id_fkey(id, organ_type, preservation_method, ischemic_budget_minutes, cross_clamp_at, viability_deadline_at),
       assigned_aircraft:aircraft(id, tail_number, type)`
    )
    .eq("id", missionId)
    .single();
  if (missionError) throw missionError;
  const m: any = mission;

  const [{ data: legs, error: legErr }, { data: crew, error: crewErr }, { data: events, error: eventErr }] =
    await Promise.all([
      supabase.from("leg").select("id, sequence_no, mode, call_sign_category, status").eq("mission_id", missionId).order("sequence_no"),
      supabase.from("crew_assignment").select("pilot_id, role, pilot:pilot(name)").eq("mission_id", missionId),
      supabase.from("mission_event").select("id, from_status, to_status, event_type, occurred_at, note").eq("mission_id", missionId).order("occurred_at", { ascending: false }),
    ]);
  if (legErr) throw legErr;
  if (crewErr) throw crewErr;
  if (eventErr) throw eventErr;

  let custodyEvents: MissionDetail["custodyEvents"] = [];
  if (m.organ?.id) {
    const { data: custody, error: custodyErr } = await supabase
      .from("custody_event")
      .select("id, event_type, occurred_at, custodian_role, proof_type")
      .eq("organ_id", m.organ.id)
      .order("occurred_at");
    if (custodyErr) throw custodyErr;
    custodyEvents = (custody ?? []).map((c: any) => ({
      id: c.id, eventType: c.event_type, occurredAt: c.occurred_at, custodianRole: c.custodian_role, proofType: c.proof_type,
    }));
  }

  return {
    id: m.id,
    status: m.status,
    donorHospital: { id: m.donor_hospital.id, name: m.donor_hospital.name },
    recipientHospital: { id: m.recipient_hospital.id, name: m.recipient_hospital.name },
    organ: m.organ
      ? {
          id: m.organ.id,
          organType: m.organ.organ_type,
          preservationMethod: m.organ.preservation_method,
          ischemicBudgetMinutes: m.organ.ischemic_budget_minutes,
          crossClampAt: m.organ.cross_clamp_at,
          viabilityDeadlineAt: m.organ.viability_deadline_at,
        }
      : null,
    legs: (legs ?? []).map((l: any) => ({ id: l.id, sequenceNo: l.sequence_no, mode: l.mode, callSignCategory: l.call_sign_category, status: l.status })),
    custodyEvents,
    assignedAircraft: m.assigned_aircraft ? { id: m.assigned_aircraft.id, tailNumber: m.assigned_aircraft.tail_number, type: m.assigned_aircraft.type } : null,
    crew: (crew ?? []).map((c: any) => ({ pilotId: c.pilot_id, pilotName: c.pilot?.name ?? "Unknown", role: c.role })),
    auditLog: (events ?? []).map((e: any) => ({ id: e.id, fromStatus: e.from_status, toStatus: e.to_status, eventType: e.event_type, occurredAt: e.occurred_at, note: e.note })),
  };
}
