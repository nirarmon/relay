-- 00000000000009_transition_rpcs.sql
create or replace function public.record_mission_transition(
  p_mission_id uuid,
  p_from_status mission_status,
  p_to_status mission_status,
  p_event_type text,
  p_note text default null,
  p_metadata jsonb default '{}'::jsonb
) returns void
language plpgsql
security invoker
as $$
declare
  v_actor_role text;
begin
  -- Unlike assign_carrier_and_transition (whose from/to statuses are fixed literals,
  -- so it can only ever perform the one legal CarrierRequested->CarrierAssigned edge),
  -- this function takes both statuses as caller-supplied parameters. The WHERE clause
  -- below only guards concurrency (has the row moved since the caller last read it),
  -- not legality — without this check, any authenticated org member could call this
  -- RPC directly (Postgres grants EXECUTE to PUBLIC by default) with an arbitrary
  -- from/to pair, bypassing the TypeScript state-machine's transition graph entirely.
  -- Mirrors src/lib/engines/state-machine.ts's TRANSITIONS table exactly — keep in sync.
  if not exists (
    select 1 from (values
      ('OfferReceived','MissionCreated'),
      ('MissionCreated','CarrierRequested'),
      ('CarrierRequested','CarrierAssigned'),
      ('CarrierRequested','MissionCreated'),
      ('CarrierAssigned','Positioning'),
      ('Positioning','TeamAtDonor'),
      ('TeamAtDonor','CustodyStarted'),
      ('CustodyStarted','InTransitGround1'),
      ('InTransitGround1','InTransitAir'),
      ('InTransitAir','InTransitGround2'),
      ('InTransitGround2','Delivered'),
      ('Delivered','Closed'),
      ('CarrierAssigned','Exception_Delay'),
      ('InTransitAir','Exception_Divert'),
      ('Positioning','Exception_Declined'),
      ('CustodyStarted','Exception_MissedWindow'),
      ('Exception_Delay','Positioning'),
      ('Exception_Divert','InTransitAir'),
      ('Exception_Divert','Exception_MissedWindow'),
      ('Exception_Declined','Closed'),
      ('Exception_MissedWindow','Delivered'),
      ('Exception_MissedWindow','Closed')
    ) as edges(from_status, to_status)
    where edges.from_status = p_from_status::text and edges.to_status = p_to_status::text
  ) then
    raise exception 'Illegal transition: % -> % is not a valid mission state transition', p_from_status, p_to_status;
  end if;

  select r.name into v_actor_role
  from public.user_role ur
  join public.role r on r.id = ur.role_id
  where ur.user_id = auth.uid()
  limit 1;

  update public.mission
  set status = p_to_status,
      closed_at = case when p_to_status = 'Closed' then now() else closed_at end
  where id = p_mission_id and status = p_from_status;

  if not found then
    raise exception 'Mission % is not in expected state % (concurrent update?)', p_mission_id, p_from_status;
  end if;

  insert into public.mission_event (mission_id, from_status, to_status, event_type, actor_user_id, actor_role, note, metadata)
  values (p_mission_id, p_from_status, p_to_status, p_event_type, auth.uid(), v_actor_role, p_note, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

-- Carrier assignment additionally binds aircraft + crew rows in the same transaction
-- as the state transition. Legality is computed in TypeScript (duty-legality engine)
-- and passed in as pre-validated crew rows; this function trusts the caller has already
-- gated on legal:true (enforced by the server action, see Task 16) and persists the
-- legality_snapshot for audit.
create or replace function public.assign_carrier_and_transition(
  p_mission_id uuid,
  p_aircraft_id uuid,
  p_crew jsonb, -- [{ "pilot_id": uuid, "role": "PIC"|"SIC", "legality_snapshot": jsonb }, ...]
  p_note text default null
) returns void
language plpgsql
security invoker
as $$
declare
  v_actor_role text;
  v_crew_row jsonb;
begin
  if coalesce(jsonb_array_length(p_crew), 0) = 0 then
    raise exception 'p_crew must contain at least one crew member';
  end if;

  select r.name into v_actor_role
  from public.user_role ur
  join public.role r on r.id = ur.role_id
  where ur.user_id = auth.uid()
  limit 1;

  update public.mission
  set status = 'CarrierAssigned', assigned_aircraft_id = p_aircraft_id
  where id = p_mission_id and status = 'CarrierRequested';

  if not found then
    raise exception 'Mission % is not in expected state CarrierRequested (concurrent update?)', p_mission_id;
  end if;

  for v_crew_row in select * from jsonb_array_elements(p_crew)
  loop
    insert into public.crew_assignment (mission_id, aircraft_id, pilot_id, role, legality_snapshot)
    values (
      p_mission_id,
      p_aircraft_id,
      (v_crew_row->>'pilot_id')::uuid,
      (v_crew_row->>'role')::crew_role,
      v_crew_row->'legality_snapshot'
    );
  end loop;

  insert into public.mission_event (mission_id, from_status, to_status, event_type, actor_user_id, actor_role, note, metadata)
  values (
    p_mission_id, 'CarrierRequested', 'CarrierAssigned', 'ASSIGN_CARRIER', auth.uid(), v_actor_role, p_note,
    jsonb_build_object('aircraft_id', p_aircraft_id, 'crew', p_crew)
  );
end;
$$;
