import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

async function main() {
  const { data: opoOrg, error: opoErr } = await supabase
    .from("organization")
    .select("id")
    .eq("type", "OPO")
    .limit(1)
    .single();
  if (opoErr) throw opoErr;

  const { data, error } = await supabase.auth.admin.createUser({
    email: "coordinator@relay.demo",
    password: "relay-demo-pw",
    email_confirm: true,
    user_metadata: { org_id: opoOrg.id, name: "Demo Coordinator" },
  });
  if (error) throw error;
  console.log("Created:", data.user.id);
}

main();
