// scripts/seed.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

// This script runs standalone via `tsx` (not through Next.js), so .env.local isn't
// loaded automatically. Node's built-in loader populates process.env without adding
// a dotenv dependency; it's a no-op if the file is absent (e.g. vars set directly in CI).
try {
  process.loadEnvFile(".env.local");
} catch {
  // .env.local not found — fall back to whatever is already in the environment.
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (see .env.local)");
}

const supabase = createClient<Database>(supabaseUrl, serviceRoleKey);

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 3600_000).toISOString();
}
function hoursFromNow(h: number): string {
  return new Date(Date.now() + h * 3600_000).toISOString();
}

async function main() {
  console.log("Seeding Relay dispatch demo data...");

  const { data: opoOrg, error: opoErr } = await supabase
    .from("organization")
    .insert({ name: "Eastern Regional OPO", type: "OPO", dsa_code: "ERO1" })
    .select()
    .single();
  if (opoErr) throw opoErr;

  const { data: operatorOrg, error: opErr } = await supabase
    .from("organization")
    .insert({
      name: "Meridian Air Ambulance",
      type: "OPERATOR",
      part135_certificate_no: "MAA-135-0042",
      statutory_insurance_floor: 2_000_000,
    })
    .select()
    .single();
  if (opErr) throw opErr;

  const { data: airports, error: airportErr } = await supabase
    .from("airport")
    .insert([
      { icao: "KTEB", iata: "TEB", name: "Teterboro Airport", location: "SRID=4326;POINT(-74.0608 40.8501)", is_fbo: true },
      { icao: "KPHL", iata: "PHL", name: "Philadelphia International Airport", location: "SRID=4326;POINT(-75.2411 39.8744)", is_fbo: true },
    ])
    .select();
  if (airportErr) throw airportErr;
  const [teb, phl] = airports;

  const { data: hospitals, error: hospErr } = await supabase
    .from("hospital")
    .insert([
      { name: "NewYork-Presbyterian Hospital", org_id: opoOrg.id, type: "DONOR", address: "525 E 68th St, New York, NY", location: "SRID=4326;POINT(-73.9548 40.7644)", nearest_airport_id: teb.id },
      { name: "Penn Presbyterian Medical Center", org_id: opoOrg.id, type: "RECIPIENT", address: "51 N 39th St, Philadelphia, PA", location: "SRID=4326;POINT(-75.1967 39.9575)", nearest_airport_id: phl.id },
    ])
    .select();
  if (hospErr) throw hospErr;
  const [donorHospital, recipientHospital] = hospitals;

  const { data: contract, error: contractErr } = await supabase
    .from("contract")
    .insert({
      opo_org_id: opoOrg.id,
      operator_org_id: operatorOrg.id,
      required_csl_amount: 20_000_000,
      billing_rate_per_hour: 4500,
      management_override_pct: 15,
      net_terms_days: 30,
      active_from: new Date().toISOString().slice(0, 10),
    })
    .select()
    .single();
  if (contractErr) throw contractErr;

  const { data: aircraft, error: aircraftErr } = await supabase
    .from("aircraft")
    .insert([
      {
        operator_org_id: operatorOrg.id, tail_number: "N42MA", type: "Phenom 300",
        base_airport_id: teb.id, on_d085: true, d085_authorized_at: hoursAgo(24 * 400),
        status: "AVAILABLE", has_perfusion_power: true, liability_csl_amount: 25_000_000,
      },
      {
        operator_org_id: operatorOrg.id, tail_number: "N17MA", type: "CJ3+",
        base_airport_id: teb.id, on_d085: false,
        status: "AVAILABLE", has_perfusion_power: false, liability_csl_amount: 25_000_000,
      },
    ])
    .select();
  if (aircraftErr) throw aircraftErr;
  const [legalAircraft, nonD085Aircraft] = aircraft;

  const { data: pilots, error: pilotErr } = await supabase
    .from("pilot")
    .insert([
      { operator_org_id: operatorOrg.id, name: "J. Alvarez", certificate_no: "P-1001", type_ratings: ["PC-300"], medical_expiry: hoursFromNow(24 * 300).slice(0, 10), currency_status: "CURRENT", base_airport_id: teb.id },
      { operator_org_id: operatorOrg.id, name: "R. Chen", certificate_no: "P-1002", type_ratings: ["PC-300"], medical_expiry: hoursFromNow(24 * 300).slice(0, 10), currency_status: "CURRENT", base_airport_id: teb.id },
      { operator_org_id: operatorOrg.id, name: "M. Osei", certificate_no: "P-1003", type_ratings: ["PC-300"], medical_expiry: hoursFromNow(24 * 300).slice(0, 10), currency_status: "CURRENT", base_airport_id: teb.id },
      { operator_org_id: operatorOrg.id, name: "T. Whitfield", certificate_no: "P-1004", type_ratings: ["PC-300"], medical_expiry: hoursFromNow(24 * 300).slice(0, 10), currency_status: "EXPIRED", base_airport_id: teb.id },
    ])
    .select();
  if (pilotErr) throw pilotErr;
  const [legalPilot1, legalPilot2, legalPilot3, violatingPilot] = pilots;

  const { error: dutyErr } = await supabase.from("duty_record").insert([
    { pilot_id: legalPilot1.id, record_type: "REST", start_at: hoursAgo(20), end_at: hoursAgo(6) },
    { pilot_id: legalPilot1.id, record_type: "ON_CALL", start_at: hoursAgo(6), end_at: hoursFromNow(6) },
    { pilot_id: legalPilot2.id, record_type: "REST", start_at: hoursAgo(18), end_at: hoursAgo(4) },
    { pilot_id: legalPilot2.id, record_type: "ON_CALL", start_at: hoursAgo(4), end_at: hoursFromNow(8) },
    { pilot_id: legalPilot3.id, record_type: "REST", start_at: hoursAgo(30), end_at: hoursAgo(16) },
    { pilot_id: legalPilot3.id, record_type: "ON_CALL", start_at: hoursAgo(16), end_at: hoursFromNow(2) },
    { pilot_id: violatingPilot.id, record_type: "REST", start_at: hoursAgo(3), end_at: hoursAgo(0.1) },
    { pilot_id: violatingPilot.id, record_type: "ON_CALL", start_at: hoursAgo(0.1), end_at: hoursFromNow(10) },
  ]);
  if (dutyErr) throw dutyErr;

  const { data: freshMission, error: freshMissionErr } = await supabase
    .from("mission")
    .insert({
      contract_id: contract.id, opo_org_id: opoOrg.id, operator_org_id: operatorOrg.id,
      donor_hospital_id: donorHospital.id, recipient_hospital_id: recipientHospital.id,
      status: "OfferReceived",
    })
    .select()
    .single();
  if (freshMissionErr) throw freshMissionErr;

  const { data: freshOrgan, error: freshOrganErr } = await supabase
    .from("organ")
    .insert({
      mission_id: freshMission.id, organ_type: "KIDNEY", preservation_method: "MACHINE_PERFUSION",
      ischemic_budget_minutes: 24 * 60,
    })
    .select()
    .single();
  if (freshOrganErr) throw freshOrganErr;

  await supabase.from("mission").update({ organ_id: freshOrgan.id }).eq("id", freshMission.id);

  const { data: activeMission, error: activeMissionErr } = await supabase
    .from("mission")
    .insert({
      contract_id: contract.id, opo_org_id: opoOrg.id, operator_org_id: operatorOrg.id,
      donor_hospital_id: donorHospital.id, recipient_hospital_id: recipientHospital.id,
      status: "InTransitAir", assigned_aircraft_id: legalAircraft.id,
    })
    .select()
    .single();
  if (activeMissionErr) throw activeMissionErr;

  const { data: activeOrgan, error: activeOrganErr } = await supabase
    .from("organ")
    .insert({
      mission_id: activeMission.id, organ_type: "HEART", preservation_method: "STATIC_COLD",
      ischemic_budget_minutes: 6 * 60, cross_clamp_at: hoursAgo(2),
    })
    .select()
    .single();
  if (activeOrganErr) throw activeOrganErr;

  await supabase.from("mission").update({ organ_id: activeOrgan.id }).eq("id", activeMission.id);

  const { data: legs, error: legErr } = await supabase
    .from("leg")
    .insert([
      { mission_id: activeMission.id, sequence_no: 1, mode: "GROUND", from_type: "HOSPITAL", from_id: donorHospital.id, to_type: "AIRPORT", to_id: teb.id, call_sign_category: "MEDEVAC", status: "COMPLETE" },
      { mission_id: activeMission.id, sequence_no: 2, mode: "AIR", from_type: "AIRPORT", from_id: teb.id, to_type: "AIRPORT", to_id: phl.id, call_sign_category: "MEDEVAC", status: "ACTIVE" },
      { mission_id: activeMission.id, sequence_no: 3, mode: "GROUND", from_type: "AIRPORT", from_id: phl.id, to_type: "HOSPITAL", to_id: recipientHospital.id, call_sign_category: "MEDEVAC", status: "PLANNED" },
    ])
    .select();
  if (legErr) throw legErr;
  const groundLeg1 = legs[0];

  const { data: seedUser, error: seedUserErr } = await supabase.auth.admin.createUser({
    email: "seed-courier@relay.demo",
    password: crypto.randomUUID(),
    email_confirm: true,
    user_metadata: { org_id: opoOrg.id, name: "Seed Courier" },
  });
  if (seedUserErr) throw seedUserErr;
  const courierUserId = seedUser.user.id;

  const { error: custodyErr } = await supabase.from("custody_event").insert([
    {
      organ_id: activeOrgan.id, leg_id: groundLeg1.id, event_type: "TAKE",
      custodian_user_id: courierUserId, custodian_role: "COURIER",
      occurred_at: hoursAgo(2), location: "SRID=4326;POINT(-73.9548 40.7644)",
      proof_type: "SIGNATURE", proof_ref: "seed/signature-1.png",
    },
    {
      organ_id: activeOrgan.id, leg_id: groundLeg1.id, event_type: "HANDOFF",
      custodian_user_id: courierUserId, custodian_role: "COURIER",
      occurred_at: hoursAgo(1.5), location: "SRID=4326;POINT(-74.0608 40.8501)",
      proof_type: "SIGNATURE", proof_ref: "seed/signature-2.png",
    },
  ]);
  if (custodyErr) throw custodyErr;

  console.log("Seed complete:");
  console.log(`  OPO org:      ${opoOrg.id}`);
  console.log(`  Operator org: ${operatorOrg.id}`);
  console.log(`  Fresh mission (OfferReceived): ${freshMission.id}`);
  console.log(`  Active mission (InTransitAir):  ${activeMission.id}`);
  console.log(`  Legal aircraft (D085): ${legalAircraft.tail_number} / Blocked aircraft: ${nonD085Aircraft.tail_number}`);
  console.log(`  Violating pilot (insufficient rest): ${violatingPilot.name}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
