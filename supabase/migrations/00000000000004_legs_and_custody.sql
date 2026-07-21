-- 00000000000004_legs_and_custody.sql
create table public.leg (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.mission(id),
  sequence_no int not null,
  mode leg_mode not null,
  -- Polymorphic: from_type/to_type (HOSPITAL|AIRPORT) determine which table from_id/to_id
  -- refers to, so no single FK target is possible for these two columns.
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
  -- Server-assigned monotonic sequence, independent of client-suppliable occurred_at.
  -- The hash chain links by insertion order (chain_seq), which is what's tamper-evident;
  -- occurred_at remains descriptive metadata about when the physical event happened and
  -- may arrive out of order for offline-synced events (see synced_offline).
  --
  -- NOT a `generated always as identity` column: identity's nextval() is resolved as an
  -- ordinary column default, which Postgres evaluates before BEFORE ROW triggers fire —
  -- i.e. before this table's trigger acquires its per-organ pg_advisory_xact_lock below.
  -- nextval() itself never blocks, so two concurrent inserts for the same organ can be
  -- issued identity values in one order while completing their lock-protected critical
  -- section (where prev_event_hash/event_hash actually get linked) in the *opposite*
  -- order — inverting chain_seq relative to true hash-chain order. Reproduced empirically:
  -- it can make a later insert compute a prev_event_hash that duplicates an existing row's,
  -- permanently blocking further inserts for that organ via the uniqueness constraint below.
  -- Instead, chain_seq is assigned by the trigger itself, from inside the advisory-locked
  -- critical section, so its value is provably consistent with true serialization order.
  chain_seq bigint not null,
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
  prev_event_hash text check (prev_event_hash is null or prev_event_hash ~ '^[0-9a-f]{64}$'),
  event_hash text not null check (event_hash ~ '^[0-9a-f]{64}$'),
  synced_offline boolean not null default false,
  unique nulls not distinct (organ_id, prev_event_hash),
  unique (organ_id, chain_seq)
);

create or replace function public.custody_event_hash_chain()
returns trigger
language plpgsql
as $$
declare
  v_prev_hash text;
  v_prev_seq bigint;
begin
  -- Serialize concurrent inserts for the same organ so two racing transactions can't
  -- both read the same "previous" event and fork the chain.
  perform pg_advisory_xact_lock(hashtext(new.organ_id::text));

  select ce.chain_seq, ce.event_hash into v_prev_seq, v_prev_hash
  from public.custody_event ce
  where ce.organ_id = new.organ_id
  order by ce.chain_seq desc
  limit 1;

  new.chain_seq := coalesce(v_prev_seq, 0) + 1;
  new.prev_event_hash := v_prev_hash;
  new.event_hash := encode(
    digest(
      coalesce(v_prev_hash, '') || '|' || new.organ_id::text || '|' ||
      new.event_type::text || '|' || new.occurred_at::text || '|' ||
      new.custodian_user_id::text || '|' ||
      coalesce(new.leg_id::text, '') || '|' ||
      coalesce(new.location::text, '') || '|' ||
      coalesce(new.proof_type::text, '') || '|' ||
      coalesce(new.proof_ref, '') || '|' ||
      coalesce(new.from_custodian_id::text, '') || '|' ||
      coalesce(new.to_custodian_id::text, '') || '|' ||
      new.custodian_role,
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

-- Supabase's default grants include TRUNCATE for anon/authenticated/service_role, which
-- would bypass RLS entirely and let any authenticated caller wipe the audit trail in one
-- statement — so it must be revoked alongside UPDATE/DELETE, not just those two.
revoke update, delete, truncate on public.custody_event from public, anon, authenticated, service_role;
