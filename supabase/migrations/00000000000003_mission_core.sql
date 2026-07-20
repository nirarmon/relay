-- 00000000000003_mission_core.sql
create table public.mission (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid references public.contract(id),
  opo_org_id uuid not null references public.organization(id),
  operator_org_id uuid not null references public.organization(id),
  organ_id uuid,
  external_offer_ref text,
  donor_hospital_id uuid not null references public.hospital(id),
  recipient_hospital_id uuid not null references public.hospital(id),
  status mission_status not null default 'OfferReceived',
  assigned_aircraft_id uuid,
  -- Stored snapshot only; never the source of truth. UI/engines must derive live SLA
  -- state from organ.viability_deadline_at via computeSlaState(), not read this column.
  sla_state sla_state not null default 'ON_TIME',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.organ (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null unique references public.mission(id),
  organ_type organ_type not null,
  preservation_method preservation_method not null,
  ischemic_budget_minutes int not null check (ischemic_budget_minutes > 0),
  cross_clamp_at timestamptz,
  -- timestamptz + interval is only STABLE (not IMMUTABLE) in Postgres, which
  -- generated columns require. timezone('UTC', ...) round-tripping through
  -- timestamp without time zone is IMMUTABLE and gives the same instant.
  viability_deadline_at timestamptz generated always as
    (timezone('UTC', timezone('UTC', cross_clamp_at) + (ischemic_budget_minutes * interval '1 minute'))) stored,
  unos_organ_id text,
  status organ_status not null default 'VIABLE'
);

alter table public.mission
  add constraint mission_organ_id_fkey foreign key (organ_id) references public.organ(id),
  add constraint mission_organ_id_unique unique (organ_id);

create table public.mission_event (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.mission(id),
  from_status mission_status,
  to_status mission_status not null,
  event_type text not null,
  actor_user_id uuid references auth.users(id),
  actor_role text,
  occurred_at timestamptz not null default now(),
  note text,
  metadata jsonb not null default '{}'::jsonb
);

-- Append-only: no UPDATE/DELETE/TRUNCATE for anyone except the table owner (migrations
-- run as owner). TRUNCATE must be revoked explicitly: Supabase grants it by default on
-- every new table, and it bypasses RLS entirely, so leaving it in place would let any
-- authenticated connection wipe the whole audit trail in one statement.
revoke update, delete, truncate on public.mission_event from public, anon, authenticated, service_role;
