import { createClient } from "@/lib/supabase/server";
import { getCarrierCandidates } from "@/lib/actions/assign-carrier-action";
import { CarrierAssignmentClient } from "./CarrierAssignmentClient";

export default async function CarrierAssignmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: missionId } = await params;
  const supabase = await createClient();

  const { data: mission } = await supabase.from("mission").select("operator_org_id, contract_id").eq("id", missionId).single();
  if (!mission?.contract_id) {
    return <p className="p-6 text-sm text-status-breached">Mission has no governing contract — cannot assign a carrier.</p>;
  }

  const candidates = await getCarrierCandidates(supabase, mission.operator_org_id, mission.contract_id);

  return (
    <CarrierAssignmentClient
      missionId={missionId}
      operatorOrgId={mission.operator_org_id}
      contractId={mission.contract_id}
      candidates={candidates}
    />
  );
}
