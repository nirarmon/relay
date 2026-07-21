import { createClient } from "@/lib/supabase/server";
import { NewMissionForm } from "./NewMissionForm";

export default async function NewMissionPage() {
  const supabase = await createClient();
  const { data: hospitals } = await supabase.from("hospital").select("id, name, type");
  const { data: contract } = await supabase.from("contract").select("id, opo_org_id, operator_org_id").limit(1).single();

  return (
    <div>
      <h1 className="p-6 pb-0 font-mono text-xl font-bold text-slate-100">New Mission</h1>
      <NewMissionForm
        hospitals={hospitals ?? []}
        contractId={contract?.id ?? ""}
        opoOrgId={contract?.opo_org_id ?? ""}
        operatorOrgId={contract?.operator_org_id ?? ""}
      />
    </div>
  );
}
