-- 00000000000005_aviation.sql
create table public.aircraft (
  id uuid primary key default gen_random_uuid(),
  operator_org_id uuid not null references public.organization(id),
  tail_number text not null unique,
  type text not null,
  base_airport_id uuid references public.airport(id),
  on_d085 boolean not null default false,
  d085_authorized_at timestamptz,
  status aircraft_status not null default 'AVAILABLE',
  has_perfusion_power boolean not null default false,
  hull_policy_ref text,
  liability_csl_amount numeric,
  current_location geography(point, 4326),
  source_system source_system not null default 'NATIVE',
  external_ref text,
  last_synced_at timestamptz
);

alter table public.mission
  add constraint mission_assigned_aircraft_id_fkey
  foreign key (assigned_aircraft_id) references public.aircraft(id);

create table public.pilot (
  id uuid primary key default gen_random_uuid(),
  operator_org_id uuid not null references public.organization(id),
  user_id uuid references auth.users(id),
  name text not null,
  certificate_no text,
  type_ratings text[] not null default '{}',
  medical_expiry date,
  currency_status pilot_currency_status not null default 'CURRENT',
  base_airport_id uuid references public.airport(id)
);

create table public.duty_record (
  id uuid primary key default gen_random_uuid(),
  pilot_id uuid not null references public.pilot(id),
  record_type duty_record_type not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  mission_id uuid references public.mission(id),
  leg_id uuid references public.leg(id),
  source duty_record_source not null default 'MANUAL',
  check (end_at > start_at)
);

create table public.crew_assignment (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.mission(id),
  aircraft_id uuid not null references public.aircraft(id),
  pilot_id uuid not null references public.pilot(id),
  role crew_role not null,
  leg_id uuid references public.leg(id),
  assigned_at timestamptz not null default now(),
  legality_snapshot jsonb not null
);

create table public.maintenance_record (
  id uuid primary key default gen_random_uuid(),
  aircraft_id uuid not null references public.aircraft(id),
  type maintenance_type not null,
  status maintenance_status not null default 'OPEN',
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  next_due_at timestamptz
);
