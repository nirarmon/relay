-- 00000000000010_carrier_assignment_rls.sql
-- Bug fix (UI Task 17 end-to-end verification): the Carrier Assignment screen
-- (1.4) must show an OPO coordinator the full fleet/crew roster of the
-- operator contracted for a given mission -- both legal AND blocked
-- candidates, per the design spec's definition of done ("the non-authorized
-- aircraft and the pilot with a duty violation are visibly blocked with a
-- reason, not just hidden").
--
-- The RLS policies added in migration 8 only granted an OPO coordinator
-- visibility into an aircraft/pilot once it was ALREADY assigned to one of
-- their missions (aircraft_select_via_assigned_mission /
-- pilot_select_via_crew_assignment). That's necessary but not sufficient: on
-- a fresh mission with nothing assigned yet -- the exact scenario Carrier
-- Assignment exists for -- getCarrierCandidates()
-- (src/lib/actions/assign-carrier-action.ts) queries ALL of the operator's
-- aircraft/pilots/duty_records, and under RLS every pilot row (and any
-- never-yet-assigned aircraft) came back empty: neither aircraft_select_own_org
-- / pilot_select_own_org applied (org mismatch -- the coordinator's org_id is
-- the OPO, not the operator) nor the assigned-mission/crew_assignment fallback
-- applied (nothing assigned yet). Verified end-to-end with a real coordinator
-- session: /missions/:id/carrier for a freshly-created mission rendered only
-- the one aircraft that happened to already be assigned to a DIFFERENT, older
-- mission, and zero pilots at all -- the pilot-selection UI was entirely empty.
--
-- Fix: grant visibility into an operator's aircraft/pilot/duty_record rows to
-- any OPO coordinator whose org holds a Contract with that operator. This is
-- the same authorization boundary getCarrierCandidates already assumes (it's
-- parameterized by contractId + operatorOrgId) and mirrors the existing
-- contract_select_own_org policy. Additive: existing policies are untouched,
-- and Postgres RLS ORs all permissive policies together.

create policy aircraft_select_via_contracted_operator on public.aircraft
  for select to authenticated using (
    exists (
      select 1 from public.contract c
      where c.operator_org_id = aircraft.operator_org_id
        and c.opo_org_id = public.auth_org_id()
    )
  );

create policy pilot_select_via_contracted_operator on public.pilot
  for select to authenticated using (
    exists (
      select 1 from public.contract c
      where c.operator_org_id = pilot.operator_org_id
        and c.opo_org_id = public.auth_org_id()
    )
  );

create policy duty_record_select_via_contracted_operator on public.duty_record
  for select to authenticated using (
    exists (
      select 1 from public.pilot p
      join public.contract c on c.operator_org_id = p.operator_org_id
      where p.id = duty_record.pilot_id
        and c.opo_org_id = public.auth_org_id()
    )
  );
