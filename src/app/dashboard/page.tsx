import { createClient } from "@/lib/supabase/server";
import { getMissionList } from "@/lib/queries/missions";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const missions = await getMissionList(supabase);

  async function refreshMissions() {
    "use server";
    const client = await createClient();
    return getMissionList(client);
  }

  return <DashboardClient initialMissions={missions} refreshMissions={refreshMissions} />;
}
