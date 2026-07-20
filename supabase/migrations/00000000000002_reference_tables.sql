-- 00000000000002_reference_tables.sql
create table public.organization (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type org_type not null,
  dsa_code text,
  part135_certificate_no text,
  statutory_insurance_floor numeric,
  created_at timestamptz not null default now()
);

create table public.airport (
  id uuid primary key default gen_random_uuid(),
  icao text not null unique,
  iata text,
  name text not null,
  location geography(point, 4326) not null,
  is_fbo boolean not null default false
);

create table public.hospital (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  org_id uuid references public.organization(id),
  type hospital_type not null,
  address text,
  location geography(point, 4326),
  nearest_airport_id uuid references public.airport(id),
  contacts jsonb
);

create table public.contract (
  id uuid primary key default gen_random_uuid(),
  opo_org_id uuid not null references public.organization(id),
  operator_org_id uuid not null references public.organization(id),
  required_csl_amount numeric not null,
  billing_rate_per_hour numeric not null,
  positioning_billable boolean not null default true,
  management_override_pct numeric not null default 15,
  net_terms_days int not null default 30,
  active_from date not null,
  active_to date,
  created_at timestamptz not null default now()
);
