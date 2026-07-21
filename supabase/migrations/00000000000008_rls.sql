-- 00000000000008_rls.sql
-- security definer + fixed search_path: user_profile itself has an RLS policy
-- (user_profile_select_own_org) that calls this function to compute org_id. Without
-- security definer, evaluating that policy would re-invoke auth_org_id(), which queries
-- user_profile again, re-triggering the same policy — infinite recursion (observed as
-- "stack depth limit exceeded" when tested end-to-end as an authenticated role). Running
-- as the (superuser) function owner bypasses RLS for this internal lookup and breaks the
-- cycle; every other policy in this file still enforces org scoping normally.
create or replace function public.auth_org_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select org_id from public.user_profile where id = auth.uid()
$$;

alter table public.organization enable row level security;
create policy organization_select_all on public.organization
  for select to authenticated using (true);

alter table public.airport enable row level security;
create policy airport_select_all on public.airport
  for select to authenticated using (true);

alter table public.hospital enable row level security;
create policy hospital_select_own_org on public.hospital
  for select to authenticated using (org_id is null or org_id = public.auth_org_id());

alter table public.contract enable row level security;
create policy contract_select_own_org on public.contract
  for select to authenticated using (
    opo_org_id = public.auth_org_id() or operator_org_id = public.auth_org_id()
  );

alter table public.mission enable row level security;
create policy mission_select_own_org on public.mission
  for select to authenticated using (
    opo_org_id = public.auth_org_id() or operator_org_id = public.auth_org_id()
  );
create policy mission_insert_own_org on public.mission
  for insert to authenticated with check (
    opo_org_id = public.auth_org_id() or operator_org_id = public.auth_org_id()
  );
create policy mission_update_own_org on public.mission
  for update to authenticated using (
    opo_org_id = public.auth_org_id() or operator_org_id = public.auth_org_id()
  );

alter table public.organ enable row level security;
create policy organ_select_via_mission on public.organ
  for select to authenticated using (
    exists (
      select 1 from public.mission m
      where m.id = organ.mission_id
        and (m.opo_org_id = public.auth_org_id() or m.operator_org_id = public.auth_org_id())
    )
  );
create policy organ_insert_via_mission on public.organ
  for insert to authenticated with check (
    exists (
      select 1 from public.mission m
      where m.id = organ.mission_id
        and (m.opo_org_id = public.auth_org_id() or m.operator_org_id = public.auth_org_id())
    )
  );
create policy organ_update_via_mission on public.organ
  for update to authenticated using (
    exists (
      select 1 from public.mission m
      where m.id = organ.mission_id
        and (m.opo_org_id = public.auth_org_id() or m.operator_org_id = public.auth_org_id())
    )
  );

alter table public.mission_event enable row level security;
create policy mission_event_select_via_mission on public.mission_event
  for select to authenticated using (
    exists (
      select 1 from public.mission m
      where m.id = mission_event.mission_id
        and (m.opo_org_id = public.auth_org_id() or m.operator_org_id = public.auth_org_id())
    )
  );
create policy mission_event_insert_via_mission on public.mission_event
  for insert to authenticated with check (
    exists (
      select 1 from public.mission m
      where m.id = mission_event.mission_id
        and (m.opo_org_id = public.auth_org_id() or m.operator_org_id = public.auth_org_id())
    )
  );

alter table public.leg enable row level security;
create policy leg_select_via_mission on public.leg
  for select to authenticated using (
    exists (
      select 1 from public.mission m
      where m.id = leg.mission_id
        and (m.opo_org_id = public.auth_org_id() or m.operator_org_id = public.auth_org_id())
    )
  );
create policy leg_write_via_mission on public.leg
  for all to authenticated using (
    exists (
      select 1 from public.mission m
      where m.id = leg.mission_id
        and (m.opo_org_id = public.auth_org_id() or m.operator_org_id = public.auth_org_id())
    )
  );

alter table public.custody_event enable row level security;
create policy custody_event_select_via_organ on public.custody_event
  for select to authenticated using (
    exists (
      select 1 from public.organ o
      join public.mission m on m.id = o.mission_id
      where o.id = custody_event.organ_id
        and (m.opo_org_id = public.auth_org_id() or m.operator_org_id = public.auth_org_id())
    )
  );
create policy custody_event_insert_via_organ on public.custody_event
  for insert to authenticated with check (
    exists (
      select 1 from public.organ o
      join public.mission m on m.id = o.mission_id
      where o.id = custody_event.organ_id
        and (m.opo_org_id = public.auth_org_id() or m.operator_org_id = public.auth_org_id())
    )
  );

alter table public.aircraft enable row level security;
create policy aircraft_select_own_org on public.aircraft
  for select to authenticated using (operator_org_id = public.auth_org_id());
create policy aircraft_write_own_org on public.aircraft
  for all to authenticated using (operator_org_id = public.auth_org_id());

alter table public.pilot enable row level security;
create policy pilot_select_own_org on public.pilot
  for select to authenticated using (operator_org_id = public.auth_org_id());

alter table public.duty_record enable row level security;
create policy duty_record_select_own_org on public.duty_record
  for select to authenticated using (
    exists (select 1 from public.pilot p where p.id = duty_record.pilot_id and p.operator_org_id = public.auth_org_id())
  );

alter table public.crew_assignment enable row level security;
create policy crew_assignment_select_via_mission on public.crew_assignment
  for select to authenticated using (
    exists (
      select 1 from public.mission m
      where m.id = crew_assignment.mission_id
        and (m.opo_org_id = public.auth_org_id() or m.operator_org_id = public.auth_org_id())
    )
  );
-- Needed for assign_carrier_and_transition (Task 15's RPC) to insert crew rows as a
-- real authenticated caller — RLS default-denies INSERT with no explicit policy, which
-- would otherwise only let service_role/superuser callers ever call that RPC.
create policy crew_assignment_insert_via_mission on public.crew_assignment
  for insert to authenticated with check (
    exists (
      select 1 from public.mission m
      where m.id = crew_assignment.mission_id
        and (m.opo_org_id = public.auth_org_id() or m.operator_org_id = public.auth_org_id())
    )
  );

alter table public.maintenance_record enable row level security;
create policy maintenance_record_select_own_org on public.maintenance_record
  for select to authenticated using (
    exists (select 1 from public.aircraft a where a.id = maintenance_record.aircraft_id and a.operator_org_id = public.auth_org_id())
  );

alter table public.invoice enable row level security;
create policy invoice_select_via_mission on public.invoice
  for select to authenticated using (
    exists (
      select 1 from public.mission m
      where m.id = invoice.mission_id
        and (m.opo_org_id = public.auth_org_id() or m.operator_org_id = public.auth_org_id())
    )
  );

alter table public.user_profile enable row level security;
create policy user_profile_select_own_org on public.user_profile
  for select to authenticated using (org_id = public.auth_org_id());

alter table public.user_role enable row level security;
create policy user_role_select_own_org on public.user_role
  for select to authenticated using (
    exists (select 1 from public.user_profile up where up.id = user_role.user_id and up.org_id = public.auth_org_id())
  );

-- Global lookup table, same treatment as organization/airport: readable by any
-- authenticated user, no write policy (RLS default-denies writes with none defined).
alter table public.role enable row level security;
create policy role_select_all on public.role
  for select to authenticated using (true);
