import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { createClient } from "@/lib/supabase/server";
import { getMissionList } from "@/lib/queries/missions";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  // Cast: @supabase/ssr's createServerClient<Database> return type predates the
  // generic signature of the installed @supabase/supabase-js SupabaseClient class
  // (dependency version skew), producing a spurious structural type mismatch even
  // though the runtime client is identical. Safe to cast.
  const missions = await getMissionList(supabase as unknown as SupabaseClient<Database>);

  async function refreshMissions() {
    "use server";
    const client = await createClient();
    return getMissionList(client as unknown as SupabaseClient<Database>);
  }

  return <DashboardClient initialMissions={missions} refreshMissions={refreshMissions} />;
}
