-- 00000000000012_cross_clamp_sets_organ_timestamp.sql
-- CROSS_CLAMP (TeamAtDonor -> CustodyStarted) is the moment the organ is physically
-- cross-clamped at the donor hospital. viability_deadline_at is a generated column off
-- organ.cross_clamp_at (migration 3), so the SLA/ischemic countdown never starts unless
-- this transition also stamps it — record_mission_transition previously only updated
-- mission.status, leaving cross_clamp_at null for every mission progressed through the
-- app (the seed script's demo mission only "worked" because it set cross_clamp_at directly).
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

  if p_event_type = 'CROSS_CLAMP' then
    update public.organ
    set cross_clamp_at = now()
    where id = (select organ_id from public.mission where id = p_mission_id);
  end if;

  insert into public.mission_event (mission_id, from_status, to_status, event_type, actor_user_id, actor_role, note, metadata)
  values (p_mission_id, p_from_status, p_to_status, p_event_type, auth.uid(), v_actor_role, p_note, coalesce(p_metadata, '{}'::jsonb));
end;
$$;
