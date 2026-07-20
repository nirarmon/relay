-- 00000000000004_legs_and_custody.sql
create table public.leg (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.mission(id),
  sequence_no int not null,
  mode leg_mode not null,
  from_type leg_endpoint_type not null,
  from_id uuid not null,
  to_type leg_endpoint_type not null,
  to_id uuid not null,
  call_sign_category call_sign_category not null default 'NONE',
  planned_depart_at timestamptz,
  planned_arrive_at timestamptz,
  actual_off_block_at timestamptz,
  actual_wheels_up_at timestamptz,
  actual_wheels_down_at timestamptz,
  actual_on_block_at timestamptz,
  status leg_status not null default 'PLANNED',
  unique (mission_id, sequence_no)
);

create table public.custody_event (
  id uuid primary key default gen_random_uuid(),
  organ_id uuid not null references public.organ(id),
  leg_id uuid references public.leg(id),
  event_type custody_event_type not null,
  custodian_user_id uuid not null references auth.users(id),
  custodian_role text not null,
  from_custodian_id uuid references auth.users(id),
  to_custodian_id uuid references auth.users(id),
  occurred_at timestamptz not null default now(),
  location geography(point, 4326),
  proof_type proof_type,
  proof_ref text,
  prev_event_hash text,
  event_hash text not null,
  synced_offline boolean not null default false
);

create or replace function public.custody_event_hash_chain()
returns trigger
language plpgsql
as $$
declare
  v_prev_hash text;
begin
  select ce.event_hash into v_prev_hash
  from public.custody_event ce
  where ce.organ_id = new.organ_id
  order by ce.occurred_at desc, ce.id desc
  limit 1;

  new.prev_event_hash := v_prev_hash;
  new.event_hash := encode(
    digest(
      coalesce(v_prev_hash, '') || '|' || new.organ_id::text || '|' ||
      new.event_type::text || '|' || new.occurred_at::text || '|' ||
      new.custodian_user_id::text,
      'sha256'
    ),
    'hex'
  );
  return new;
end;
$$;

create trigger custody_event_hash_chain_trigger
  before insert on public.custody_event
  for each row execute function public.custody_event_hash_chain();

-- Append-only: no UPDATE/DELETE/TRUNCATE for anyone except the table owner (migrations
-- run as owner). TRUNCATE must be revoked explicitly: Supabase grants it by default on
-- every new table, and it bypasses RLS entirely, so leaving it in place would let any
-- authenticated connection wipe the whole audit trail in one statement.
revoke update, delete, truncate on public.custody_event from public, anon, authenticated, service_role;
