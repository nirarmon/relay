# Relay Dispatch App — Backend Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Next.js 15 + Supabase project, the full Relay data model (schema + RLS), and the three compliance-critical pure-function engines (duty-legality, SLA, mission state machine) plus the atomic RPCs and server actions that drive them, seeded with synthetic demo data — all testable without any UI.

**Architecture:** Next.js 15 (App Router, TypeScript) as a modular monolith. Supabase (local dev via CLI/Docker) for Postgres + PostGIS + Auth + RLS. Business rules (duty legality, SLA math, state-machine transition graph + guards) live as pure, unit-tested TypeScript functions in `src/lib/engines/`, called from Next.js Server Actions. Persistence of guarded, multi-row writes (mission status + audit event; carrier assignment + crew rows) goes through Postgres RPC functions so each transition is atomic. `MissionEvent` and `CustodyEvent` are append-only at the grant level (`REVOKE UPDATE, DELETE`), not just by convention.

**Tech Stack:** Next.js 15, TypeScript, Supabase (Postgres 15 + PostGIS, Auth, CLI for local dev), Vitest for unit tests, `@supabase/supabase-js` + `@supabase/ssr`.

**Source docs:** `../../../../OPO/plan/data-model.md`, `personas-and-workflows.md`, `functional-modules.md`, `architecture-and-stack.md`, `roadmap.md`; scoped by `../specs/2026-07-20-dispatch-app-design.md`.

---

## Task 1: Project scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `postcss.config.mjs`
- Create: `tailwind.config.ts`
- Create: `.gitignore`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/globals.css`
- Create: `vitest.config.ts`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "relay-dispatch",
  "private": true,
  "version": "0.1.0",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "test": "vitest run",
    "test:watch": "vitest",
    "seed": "tsx scripts/seed.ts",
    "supabase:start": "supabase start",
    "supabase:stop": "supabase stop",
    "supabase:reset": "supabase db reset",
    "gen:types": "supabase gen types typescript --local > src/types/database.ts"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.45.4",
    "@supabase/ssr": "^0.5.1",
    "next": "^15.0.3",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "autoprefixer": "^10.4.20",
    "eslint": "^8.57.0",
    "eslint-config-next": "^15.0.3",
    "postcss": "^8.4.47",
    "supabase": "^1.219.2",
    "tailwindcss": "^3.4.13",
    "tsx": "^4.19.1",
    "typescript": "^5.6.3",
    "vitest": "^2.1.3"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: Write `next.config.mjs`**

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {};
export default nextConfig;
```

- [ ] **Step 4: Write `postcss.config.mjs`**

```javascript
export default {
  plugins: { tailwindcss: {}, autoprefixer: {} },
};
```

- [ ] **Step 5: Write `tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        status: {
          ontime: "#1FAE7A",
          atrisk: "#E8A33D",
          breached: "#E5484D",
          idle: "#6B7280",
          info: "#3E7BFA",
        },
      },
    },
  },
  plugins: [],
};
export default config;
```

- [ ] **Step 6: Write `.gitignore`**

```
node_modules
.next
.env
.env.local
supabase/.branches
supabase/.temp
dist
coverage
```

- [ ] **Step 7: Write `src/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html {
  color-scheme: dark;
}
```

- [ ] **Step 8: Write `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Relay — Dispatch",
  description: "Time-critical organ transport dispatch console",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
```

- [ ] **Step 9: Write `src/app/page.tsx`**

```tsx
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="font-mono text-sm text-slate-400">Relay dispatch — backend foundation running.</p>
    </main>
  );
}
```

- [ ] **Step 10: Write `vitest.config.ts`**

```typescript
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
```

- [ ] **Step 11: Install dependencies**

Run: `cd /Users/nirarmon/Dev/relay && npm install`
Expected: installs without error, creates `package-lock.json`.

- [ ] **Step 12: Verify the app builds**

Run: `npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "Scaffold Next.js 15 + TypeScript + Tailwind + Vitest project"
```

---

## Task 2: Supabase local project init

**Files:**
- Create: `supabase/config.toml` (generated by CLI)
- Create: `.env.local.example`

- [ ] **Step 1: Initialize Supabase project files**

Run: `npx supabase init`
Expected: creates `supabase/config.toml` and `supabase/migrations/` (empty).

- [ ] **Step 2: Start the local Supabase stack**

Run: `npx supabase start`
Expected: pulls Docker images and prints local `API URL`, `anon key`, `service_role key`, `DB URL`. Requires Docker Desktop running — if it isn't, start it first.

- [ ] **Step 3: Write `.env.local.example`**

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=replace-with-anon-key-from-supabase-start
SUPABASE_SERVICE_ROLE_KEY=replace-with-service-role-key-from-supabase-start
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

- [ ] **Step 4: Copy to a real local `.env.local` with the printed keys**

Run: `cp .env.local.example .env.local` then edit `.env.local`, pasting the `anon key`, `service_role key`, and `DB URL` printed by `supabase start`. `.env.local` is gitignored — never commit real keys.

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml .env.local.example .gitignore
git commit -m "Initialize local Supabase project"
```

---

## Task 3: Migration — extensions and enums

**Files:**
- Create: `supabase/migrations/00000000000001_extensions_and_enums.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 00000000000001_extensions_and_enums.sql
create extension if not exists "uuid-ossp";
create extension if not exists postgis;
create extension if not exists pgcrypto;

create type org_type as enum ('OPO', 'OPERATOR', 'TRANSPLANT_CENTER');
create type hospital_type as enum ('DONOR', 'RECIPIENT', 'BOTH');

create type organ_type as enum ('HEART', 'LUNG', 'LIVER', 'PANCREAS', 'KIDNEY');
create type preservation_method as enum ('STATIC_COLD', 'MACHINE_PERFUSION');
create type organ_status as enum ('VIABLE', 'DELIVERED', 'NON_VIABLE', 'LOST');

create type mission_status as enum (
  'OfferReceived', 'MissionCreated', 'CarrierRequested', 'CarrierAssigned',
  'Positioning', 'TeamAtDonor', 'CustodyStarted',
  'InTransitGround1', 'InTransitAir', 'InTransitGround2',
  'Delivered', 'Closed',
  'Exception_Delay', 'Exception_Divert', 'Exception_Declined', 'Exception_MissedWindow'
);
create type sla_state as enum ('ON_TIME', 'AT_RISK', 'BREACHED');

create type leg_mode as enum ('GROUND', 'AIR');
create type leg_endpoint_type as enum ('HOSPITAL', 'AIRPORT');
create type call_sign_category as enum ('MEDEVAC', 'COMPASSION', 'NONE');
create type leg_status as enum ('PLANNED', 'ACTIVE', 'COMPLETE');

create type custody_event_type as enum ('TAKE', 'HANDOFF', 'PACKAGE_SCAN', 'INSPECT');
create type proof_type as enum ('SIGNATURE', 'PHOTO', 'BARCODE');

create type aircraft_status as enum ('AVAILABLE', 'ON_MISSION', 'IN_MAINTENANCE', 'AOG');
create type source_system as enum ('NATIVE', 'FL3XX', 'LEON', 'FLIGHTDOCS', 'VERYON');
create type pilot_currency_status as enum ('CURRENT', 'EXPIRING', 'EXPIRED');
create type duty_record_type as enum ('ON_CALL', 'DUTY', 'FLIGHT', 'REST');
create type duty_record_source as enum ('MANUAL', 'SYSTEM');
create type crew_role as enum ('PIC', 'SIC');
create type maintenance_type as enum ('100_HOUR', 'ANNUAL', 'AOG', 'UNSCHEDULED');
create type maintenance_status as enum ('OPEN', 'CLOSED');
create type invoice_status as enum ('DRAFT', 'SENT', 'PAID', 'OVERDUE');
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`
Expected: `Applying migration 00000000000001_extensions_and_enums.sql...` then `Finished supabase db reset`.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00000000000001_extensions_and_enums.sql
git commit -m "Add Postgres extensions and domain enums"
```

---

## Task 4: Migration — reference tables (organization, airport, hospital, contract)

**Files:**
- Create: `supabase/migrations/00000000000002_reference_tables.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`
Expected: all four tables created without error.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00000000000002_reference_tables.sql
git commit -m "Add organization, airport, hospital, contract tables"
```

---

## Task 5: Migration — mission core (mission, organ, mission_event)

**Files:**
- Create: `supabase/migrations/00000000000003_mission_core.sql`

- [ ] **Step 1: Write the migration**

Note the two-step FK: `mission.organ_id` is added by `alter table` *after* `organ` exists, because `organ.mission_id` and `mission.organ_id` reference each other.

```sql
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
  sla_state sla_state not null default 'ON_TIME',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create table public.organ (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.mission(id),
  organ_type organ_type not null,
  preservation_method preservation_method not null,
  ischemic_budget_minutes int not null check (ischemic_budget_minutes > 0),
  cross_clamp_at timestamptz,
  viability_deadline_at timestamptz generated always as
    (cross_clamp_at + (ischemic_budget_minutes * interval '1 minute')) stored,
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

-- Append-only: no UPDATE/DELETE for anyone except the table owner (migrations run as owner).
revoke update, delete, truncate on public.mission_event from public, anon, authenticated, service_role;
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`
Expected: `mission`, `organ`, `mission_event` created; `mission_organ_id_fkey` constraint present.

- [ ] **Step 3: Verify append-only grants**

Run: `psql "$SUPABASE_DB_URL" -c "\dp mission_event"` (or open Supabase Studio at `http://127.0.0.1:54323` → Table Editor → `mission_event` → check no update/delete privilege for `authenticated`).
Expected: only `INSERT`/`SELECT` privileges show for non-owner roles.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000003_mission_core.sql
git commit -m "Add mission, organ, append-only mission_event tables"
```

---

## Task 6: Migration — legs and custody ledger

**Files:**
- Create: `supabase/migrations/00000000000004_legs_and_custody.sql`

- [ ] **Step 1: Write the migration**

The custody-event hash chain (`prev_event_hash` → `event_hash`) is computed by a `BEFORE INSERT` trigger so the application never has to (and can't forget to) chain it correctly.

```sql
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

revoke update, delete, truncate on public.custody_event from public, anon, authenticated, service_role;
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`
Expected: tables + trigger created without error.

- [ ] **Step 3: Manually verify the hash chain**

Run in Supabase Studio SQL editor (`http://127.0.0.1:54323`) after seeding a fake organ/user (or defer to Task 17's seed script and revisit): insert two custody events for the same `organ_id` and confirm the second row's `prev_event_hash` equals the first row's `event_hash`.
Expected: hashes chain correctly; can be re-verified after Task 17.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000004_legs_and_custody.sql
git commit -m "Add leg table and hash-chained append-only custody_event ledger"
```

---

## Task 7: Migration — aviation side (aircraft, pilot, duty_record, crew_assignment, maintenance_record)

**Files:**
- Create: `supabase/migrations/00000000000005_aviation.sql`

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`
Expected: all five tables created, `mission_assigned_aircraft_id_fkey` present.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00000000000005_aviation.sql
git commit -m "Add aircraft, pilot, duty_record, crew_assignment, maintenance_record tables"
```

---

## Task 8: Migration — invoice

**Files:**
- Create: `supabase/migrations/00000000000006_invoice.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 00000000000006_invoice.sql
create table public.invoice (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.mission(id),
  contract_id uuid not null references public.contract(id),
  flight_hours numeric,
  gross_amount numeric,
  override_amount numeric,
  net_amount numeric,
  positioning_amount numeric,
  status invoice_status not null default 'DRAFT',
  net_due_at date
);
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`
Expected: `invoice` table created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00000000000006_invoice.sql
git commit -m "Add invoice table"
```

---

## Task 9: Migration — users and roles

**Files:**
- Create: `supabase/migrations/00000000000007_users_roles.sql`

- [ ] **Step 1: Write the migration**

`user_profile` mirrors `auth.users` (Supabase-managed) with the org/role fields the spec needs; a trigger auto-creates the row on signup so app code never has to remember to.

```sql
-- 00000000000007_users_roles.sql
create table public.role (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

insert into public.role (name) values
  ('OPO_COORDINATOR'), ('OPS_DISPATCHER'), ('PILOT'), ('COURIER'),
  ('EXECUTIVE'), ('MAINT'), ('HR_ADMIN'), ('SUPERADMIN');

create table public.user_profile (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organization(id),
  email text not null,
  name text,
  last_login_at timestamptz
);

create table public.user_role (
  user_id uuid not null references public.user_profile(id) on delete cascade,
  role_id uuid not null references public.role(id),
  primary key (user_id, role_id)
);

-- New auth.users rows must carry org_id + name in raw_user_meta_data (set at signup)
-- so this trigger can provision the matching user_profile row.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profile (id, org_id, email, name)
  values (
    new.id,
    (new.raw_user_meta_data->>'org_id')::uuid,
    new.email,
    new.raw_user_meta_data->>'name'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_auth_user();
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`
Expected: `role` seeded with 8 rows; `user_profile`/`user_role` created; trigger installed.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00000000000007_users_roles.sql
git commit -m "Add role, user_profile, user_role tables and auto-provisioning trigger"
```

---

## Task 10: Migration — RLS by org

**Files:**
- Create: `supabase/migrations/00000000000008_rls.sql`

- [ ] **Step 1: Write the migration**

`auth_org_id()` is the single helper every policy uses — it reads the caller's org from `user_profile`. PHI-bearing tables (`hospital`, `mission`, `organ`, `mission_event`, `leg`, `custody_event`, `pilot`, `duty_record`, `crew_assignment`, `invoice`) are scoped so a user only sees rows where their org is the OPO or the operator on that row (directly, or via the parent `mission`). `organization` and `airport` are non-PHI reference data, readable by any authenticated user for the POC's single-OPO/single-operator scope.

`auth_org_id()` must be `security definer` with a locked `search_path` — `user_profile` itself has an RLS policy that calls `auth_org_id()`, so a plain `stable`/invoker-rights function recurses infinitely (confirmed empirically: `stack depth limit exceeded`) the moment any policy on `user_profile` evaluates it. `security definer` makes the function's internal lookup run as its (superuser) owner, bypassing RLS for that one query, without changing what any policy actually checks.

```sql
-- 00000000000008_rls.sql
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
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`
Expected: no errors; every table listed above shows `Row Level Security: enabled` in Supabase Studio's Table Editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00000000000008_rls.sql
git commit -m "Enable RLS and add org-scoped policies across all tables"
```

---

## Task 11: Supabase client helpers and generated types

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Modify: `package.json` (already has `gen:types` script from Task 1)

- [ ] **Step 1: Generate types from the local database**

Run: `npm run gen:types`
Expected: writes `src/types/database.ts` with a `Database` type covering every table/enum from Tasks 3–9.

- [ ] **Step 2: Write `src/lib/supabase/client.ts`** (browser client, for Client Components)

```typescript
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
```

- [ ] **Step 3: Write `src/lib/supabase/server.ts`** (server client, for Server Components/Actions — respects RLS via the caller's session)

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Called from a Server Component with no response to write to — ignore.
          }
        },
      },
    }
  );
}
```

- [ ] **Step 4: Verify the project still builds with the generated types in place**

Run: `npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase src/types/database.ts
git commit -m "Add Supabase browser/server client helpers and generated types"
```

---

## Task 12: Duty-legality engine (pure function, unit-tested) — the R2 risk, build first

**Files:**
- Create: `src/lib/engines/duty-legality.ts`
- Test: `src/lib/engines/duty-legality.test.ts`

Implements `functional-modules.md` B2: §135.267 (≤14h duty in the trailing 14h window, ≤10h flight time in that window, ≥10h rest immediately prior), Masterson (`ON_CALL` counts as duty), and §135.293 currency.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/engines/duty-legality.test.ts
import { describe, it, expect } from "vitest";
import { computeDutyLegality, computeCrewAssignmentLegality, type DutyRecord } from "./duty-legality";

const hoursAgo = (asOf: Date, h: number) => new Date(asOf.getTime() - h * 3600_000);

describe("computeDutyLegality", () => {
  it("is legal with a full rest period and duty well under limits", () => {
    const asOf = new Date("2026-07-20T12:00:00Z");
    const records: DutyRecord[] = [
      { record_type: "REST", start_at: hoursAgo(asOf, 20).toISOString(), end_at: hoursAgo(asOf, 6).toISOString() },
      { record_type: "DUTY", start_at: hoursAgo(asOf, 6).toISOString(), end_at: asOf.toISOString() },
    ];
    const result = computeDutyLegality(records, asOf, 3);
    expect(result.legal).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("blocks when the trailing-14h duty limit would be exceeded (Masterson: on-call counts as duty)", () => {
    const asOf = new Date("2026-07-20T12:00:00Z");
    const records: DutyRecord[] = [
      { record_type: "REST", start_at: hoursAgo(asOf, 26).toISOString(), end_at: hoursAgo(asOf, 13).toISOString() },
      { record_type: "ON_CALL", start_at: hoursAgo(asOf, 13).toISOString(), end_at: asOf.toISOString() },
    ];
    const result = computeDutyLegality(records, asOf, 2);
    expect(result.legal).toBe(false);
    expect(result.reasons.some((r) => r.includes("Duty limit exceeded"))).toBe(true);
  });

  it("blocks when proposed flight time would exceed the 10h flight-time limit", () => {
    const asOf = new Date("2026-07-20T12:00:00Z");
    const records: DutyRecord[] = [
      { record_type: "REST", start_at: hoursAgo(asOf, 20).toISOString(), end_at: hoursAgo(asOf, 9).toISOString() },
      { record_type: "FLIGHT", start_at: hoursAgo(asOf, 9).toISOString(), end_at: asOf.toISOString() },
    ];
    const result = computeDutyLegality(records, asOf, 2);
    expect(result.legal).toBe(false);
    expect(result.reasons.some((r) => r.includes("Flight-time limit exceeded"))).toBe(true);
  });

  it("blocks when the immediately preceding rest period is under 10 hours", () => {
    const asOf = new Date("2026-07-20T12:00:00Z");
    const records: DutyRecord[] = [
      { record_type: "REST", start_at: hoursAgo(asOf, 4).toISOString(), end_at: hoursAgo(asOf, 0.5).toISOString() },
    ];
    const result = computeDutyLegality(records, asOf, 2);
    expect(result.legal).toBe(false);
    expect(result.reasons.some((r) => r.includes("Insufficient rest"))).toBe(true);
  });
});

describe("computeCrewAssignmentLegality", () => {
  it("blocks an otherwise-legal pilot whose currency has expired (§135.293)", () => {
    const asOf = new Date("2026-07-20T12:00:00Z");
    const records: DutyRecord[] = [
      { record_type: "REST", start_at: hoursAgo(asOf, 20).toISOString(), end_at: hoursAgo(asOf, 6).toISOString() },
    ];
    const result = computeCrewAssignmentLegality({ currencyStatus: "EXPIRED" }, records, asOf, 2);
    expect(result.legal).toBe(false);
    expect(result.reasons.some((r) => r.includes("currency expired"))).toBe(true);
  });

  it("is legal for a current pilot with adequate rest and duty margin", () => {
    const asOf = new Date("2026-07-20T12:00:00Z");
    const records: DutyRecord[] = [
      { record_type: "REST", start_at: hoursAgo(asOf, 20).toISOString(), end_at: hoursAgo(asOf, 6).toISOString() },
    ];
    const result = computeCrewAssignmentLegality({ currencyStatus: "CURRENT" }, records, asOf, 2);
    expect(result.legal).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- duty-legality`
Expected: FAIL — `Cannot find module './duty-legality'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/engines/duty-legality.ts
export type DutyRecordType = "ON_CALL" | "DUTY" | "FLIGHT" | "REST";
export type PilotCurrencyStatus = "CURRENT" | "EXPIRING" | "EXPIRED";

export interface DutyRecord {
  record_type: DutyRecordType;
  start_at: string;
  end_at: string;
}

export interface DutyLegalityResult {
  legal: boolean;
  reasons: string[];
  dutyHoursUsed: number;
  dutyHoursLimit: 14;
  flightHoursUsed: number;
  flightHoursLimit: 10;
  lastRestHours: number;
  requiredRestHours: 10;
}

export interface CrewAssignmentLegalityResult extends DutyLegalityResult {
  currencyStatus: PilotCurrencyStatus;
}

const DUTY_WINDOW_HOURS = 14;
const FLIGHT_TIME_LIMIT_HOURS = 10;
const REQUIRED_REST_HOURS = 10;
const DUTY_COUNTING_TYPES = new Set<DutyRecordType>(["ON_CALL", "DUTY", "FLIGHT"]);

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function overlapMs(recStart: number, recEnd: number, winStart: number, winEnd: number): number {
  const start = Math.max(recStart, winStart);
  const end = Math.min(recEnd, winEnd);
  return Math.max(0, end - start);
}

/**
 * Pure §135.267 + Masterson calculator. `asOf` is the moment the proposed
 * assignment would begin; `proposedFlightHours` is the estimated duration
 * of the leg being considered (0 to just check current standing).
 */
export function computeDutyLegality(
  records: DutyRecord[],
  asOf: Date,
  proposedFlightHours: number = 0
): DutyLegalityResult {
  const windowStartMs = asOf.getTime() - DUTY_WINDOW_HOURS * 3_600_000;
  const asOfMs = asOf.getTime();

  let dutyMs = 0;
  let flightMs = 0;

  for (const record of records) {
    const startMs = new Date(record.start_at).getTime();
    const endMs = new Date(record.end_at).getTime();
    if (DUTY_COUNTING_TYPES.has(record.record_type)) {
      dutyMs += overlapMs(startMs, endMs, windowStartMs, asOfMs);
    }
    if (record.record_type === "FLIGHT") {
      flightMs += overlapMs(startMs, endMs, windowStartMs, asOfMs);
    }
  }

  const dutyHoursUsed = dutyMs / 3_600_000;
  const flightHoursUsed = flightMs / 3_600_000;
  const projectedDutyHours = dutyHoursUsed + proposedFlightHours;
  const projectedFlightHours = flightHoursUsed + proposedFlightHours;

  const lastRest = records
    .filter((r) => r.record_type === "REST" && new Date(r.end_at).getTime() <= asOfMs)
    .sort((a, b) => new Date(b.end_at).getTime() - new Date(a.end_at).getTime())[0];
  const lastRestHours = lastRest
    ? (new Date(lastRest.end_at).getTime() - new Date(lastRest.start_at).getTime()) / 3_600_000
    : 0;

  const reasons: string[] = [];
  if (projectedDutyHours > DUTY_WINDOW_HOURS) {
    reasons.push(
      `Duty limit exceeded: ${round1(projectedDutyHours)}h of ${DUTY_WINDOW_HOURS}h max in the trailing 14h window (§135.267)`
    );
  }
  if (projectedFlightHours > FLIGHT_TIME_LIMIT_HOURS) {
    reasons.push(
      `Flight-time limit exceeded: ${round1(projectedFlightHours)}h of ${FLIGHT_TIME_LIMIT_HOURS}h max (§135.267)`
    );
  }
  if (lastRestHours < REQUIRED_REST_HOURS) {
    reasons.push(
      `Insufficient rest: last rest period was ${round1(lastRestHours)}h, ${REQUIRED_REST_HOURS}h required (§135.267; on-call counts as duty per Masterson)`
    );
  }

  return {
    legal: reasons.length === 0,
    reasons,
    dutyHoursUsed: round1(dutyHoursUsed),
    dutyHoursLimit: DUTY_WINDOW_HOURS,
    flightHoursUsed: round1(flightHoursUsed),
    flightHoursLimit: FLIGHT_TIME_LIMIT_HOURS,
    lastRestHours: round1(lastRestHours),
    requiredRestHours: REQUIRED_REST_HOURS,
  };
}

/** Folds in §135.293 currency on top of the duty/rest calculation. */
export function computeCrewAssignmentLegality(
  pilot: { currencyStatus: PilotCurrencyStatus },
  records: DutyRecord[],
  asOf: Date,
  proposedFlightHours: number = 0
): CrewAssignmentLegalityResult {
  const dutyResult = computeDutyLegality(records, asOf, proposedFlightHours);
  const reasons = [...dutyResult.reasons];
  if (pilot.currencyStatus === "EXPIRED") {
    reasons.push("Pilot currency expired (§135.293) — not assignable");
  }
  return {
    ...dutyResult,
    legal: dutyResult.legal && pilot.currencyStatus !== "EXPIRED",
    reasons,
    currencyStatus: pilot.currencyStatus,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- duty-legality`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engines/duty-legality.ts src/lib/engines/duty-legality.test.ts
git commit -m "Add duty-legality engine (§135.267, Masterson, §135.293)"
```

---

## Task 13: SLA / ischemic-countdown engine

**Files:**
- Create: `src/lib/engines/sla.ts`
- Test: `src/lib/engines/sla.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/engines/sla.test.ts
import { describe, it, expect } from "vitest";
import { computeViabilityDeadline, computeSlaState } from "./sla";

describe("computeViabilityDeadline", () => {
  it("returns null when the ischemic clock hasn't started", () => {
    expect(computeViabilityDeadline(null, 240)).toBeNull();
  });

  it("adds the ischemic budget in minutes to cross-clamp time", () => {
    const crossClampAt = new Date("2026-07-20T10:00:00Z");
    const deadline = computeViabilityDeadline(crossClampAt, 240);
    expect(deadline?.toISOString()).toBe("2026-07-20T14:00:00.000Z");
  });
});

describe("computeSlaState", () => {
  it("is ON_TIME when the countdown hasn't started", () => {
    expect(computeSlaState(new Date("2026-07-20T10:00:00Z"), null)).toBe("ON_TIME");
  });

  it("is ON_TIME well before the deadline", () => {
    const now = new Date("2026-07-20T10:00:00Z");
    const deadline = new Date("2026-07-20T12:00:00Z");
    expect(computeSlaState(now, deadline)).toBe("ON_TIME");
  });

  it("is AT_RISK inside the at-risk threshold", () => {
    const now = new Date("2026-07-20T10:00:00Z");
    const deadline = new Date("2026-07-20T10:20:00Z");
    expect(computeSlaState(now, deadline, 30)).toBe("AT_RISK");
  });

  it("is BREACHED once the deadline has passed", () => {
    const now = new Date("2026-07-20T10:00:01Z");
    const deadline = new Date("2026-07-20T10:00:00Z");
    expect(computeSlaState(now, deadline)).toBe("BREACHED");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- sla`
Expected: FAIL — `Cannot find module './sla'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/engines/sla.ts
export type SlaState = "ON_TIME" | "AT_RISK" | "BREACHED";

const DEFAULT_AT_RISK_THRESHOLD_MINUTES = 30;

/** viability_deadline_at = cross_clamp_at + ischemic_budget_minutes (data-model.md §4.3). */
export function computeViabilityDeadline(
  crossClampAt: Date | null,
  ischemicBudgetMinutes: number
): Date | null {
  if (!crossClampAt) return null;
  return new Date(crossClampAt.getTime() + ischemicBudgetMinutes * 60_000);
}

/** sla_state is derived from now vs. deadline at render/read time, never hand-edited. */
export function computeSlaState(
  now: Date,
  viabilityDeadlineAt: Date | null,
  atRiskThresholdMinutes: number = DEFAULT_AT_RISK_THRESHOLD_MINUTES
): SlaState {
  if (!viabilityDeadlineAt) return "ON_TIME";
  const msRemaining = viabilityDeadlineAt.getTime() - now.getTime();
  if (msRemaining <= 0) return "BREACHED";
  if (msRemaining <= atRiskThresholdMinutes * 60_000) return "AT_RISK";
  return "ON_TIME";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- sla`
Expected: PASS — 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engines/sla.ts src/lib/engines/sla.test.ts
git commit -m "Add ischemic SLA/countdown engine"
```

---

## Task 14: Mission state-machine engine

**Files:**
- Create: `src/lib/engines/state-machine.ts`
- Test: `src/lib/engines/state-machine.test.ts`

Encodes the transition graph from `personas-and-workflows.md` §2.2 verbatim (happy path + the 4 exception branches) and the `CarrierAssigned` gate from `data-model.md` ("cannot enter `CarrierAssigned` without a valid Aircraft (D085) + legal Crew").

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/engines/state-machine.test.ts
import { describe, it, expect } from "vitest";
import { getValidTransition, applyMissionTransition } from "./state-machine";

describe("getValidTransition", () => {
  it("finds the happy-path transition for a known event", () => {
    expect(getValidTransition("OfferReceived", "ACCEPT_OFFER")).toEqual({
      from: "OfferReceived",
      to: "MissionCreated",
      event: "ACCEPT_OFFER",
    });
  });

  it("returns null for an event not valid from the current state", () => {
    expect(getValidTransition("OfferReceived", "WHEELS_UP")).toBeNull();
  });

  it("finds the exception branch: CarrierAssigned -> Exception_Delay -> Positioning", () => {
    expect(getValidTransition("CarrierAssigned", "DELAY")?.to).toBe("Exception_Delay");
    expect(getValidTransition("Exception_Delay", "RESUME")?.to).toBe("Positioning");
  });

  it("finds both Exception_MissedWindow exits", () => {
    expect(getValidTransition("Exception_MissedWindow", "DELIVER_NON_VIABLE")?.to).toBe("Delivered");
    expect(getValidTransition("Exception_MissedWindow", "ORGAN_LOST")?.to).toBe("Closed");
  });
});

describe("applyMissionTransition", () => {
  it("rejects an event with no matching transition", () => {
    const result = applyMissionTransition({ currentStatus: "OfferReceived", event: "WHEELS_UP" });
    expect(result.ok).toBe(false);
  });

  it("allows a non-gated transition unconditionally", () => {
    const result = applyMissionTransition({ currentStatus: "MissionCreated", event: "REQUEST_CARRIER" });
    expect(result).toEqual({ ok: true, from: "MissionCreated", to: "CarrierRequested" });
  });

  it("blocks CarrierAssigned when the carrier-assignment check is not legal", () => {
    const result = applyMissionTransition({
      currentStatus: "CarrierRequested",
      event: "ASSIGN_CARRIER",
      carrierAssignmentCheck: { legal: false, reason: "Aircraft not on D085" },
    });
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.error).toBe("Aircraft not on D085");
  });

  it("blocks CarrierAssigned when no carrier-assignment check is provided at all", () => {
    const result = applyMissionTransition({ currentStatus: "CarrierRequested", event: "ASSIGN_CARRIER" });
    expect(result.ok).toBe(false);
  });

  it("allows CarrierAssigned when the carrier-assignment check is legal", () => {
    const result = applyMissionTransition({
      currentStatus: "CarrierRequested",
      event: "ASSIGN_CARRIER",
      carrierAssignmentCheck: { legal: true },
    });
    expect(result).toEqual({ ok: true, from: "CarrierRequested", to: "CarrierAssigned" });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- state-machine`
Expected: FAIL — `Cannot find module './state-machine'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/engines/state-machine.ts
export type MissionStatus =
  | "OfferReceived" | "MissionCreated" | "CarrierRequested" | "CarrierAssigned"
  | "Positioning" | "TeamAtDonor" | "CustodyStarted"
  | "InTransitGround1" | "InTransitAir" | "InTransitGround2"
  | "Delivered" | "Closed"
  | "Exception_Delay" | "Exception_Divert" | "Exception_Declined" | "Exception_MissedWindow";

export type MissionEventType =
  | "ACCEPT_OFFER" | "REQUEST_CARRIER" | "ASSIGN_CARRIER" | "ALL_DECLINED"
  | "DISPATCH_AIRCRAFT" | "TEAM_ON_SITE" | "CROSS_CLAMP"
  | "DEPART_DONOR_GROUND" | "WHEELS_UP" | "WHEELS_DOWN" | "CONFIRM_DELIVERY" | "CLOSE_MISSION"
  | "DELAY" | "DIVERT" | "DECLINE_ORGAN" | "BREACH_SLA"
  | "RESUME" | "WINDOW_BLOWN" | "STAND_DOWN" | "DELIVER_NON_VIABLE" | "ORGAN_LOST";

export interface Transition {
  from: MissionStatus;
  to: MissionStatus;
  event: MissionEventType;
}

/** Verbatim from personas-and-workflows.md §2.2's mission state diagram. */
export const TRANSITIONS: Transition[] = [
  { from: "OfferReceived", to: "MissionCreated", event: "ACCEPT_OFFER" },
  { from: "MissionCreated", to: "CarrierRequested", event: "REQUEST_CARRIER" },
  { from: "CarrierRequested", to: "CarrierAssigned", event: "ASSIGN_CARRIER" },
  { from: "CarrierRequested", to: "MissionCreated", event: "ALL_DECLINED" },
  { from: "CarrierAssigned", to: "Positioning", event: "DISPATCH_AIRCRAFT" },
  { from: "Positioning", to: "TeamAtDonor", event: "TEAM_ON_SITE" },
  { from: "TeamAtDonor", to: "CustodyStarted", event: "CROSS_CLAMP" },
  { from: "CustodyStarted", to: "InTransitGround1", event: "DEPART_DONOR_GROUND" },
  { from: "InTransitGround1", to: "InTransitAir", event: "WHEELS_UP" },
  { from: "InTransitAir", to: "InTransitGround2", event: "WHEELS_DOWN" },
  { from: "InTransitGround2", to: "Delivered", event: "CONFIRM_DELIVERY" },
  { from: "Delivered", to: "Closed", event: "CLOSE_MISSION" },
  { from: "CarrierAssigned", to: "Exception_Delay", event: "DELAY" },
  { from: "InTransitAir", to: "Exception_Divert", event: "DIVERT" },
  { from: "Positioning", to: "Exception_Declined", event: "DECLINE_ORGAN" },
  { from: "CustodyStarted", to: "Exception_MissedWindow", event: "BREACH_SLA" },
  { from: "Exception_Delay", to: "Positioning", event: "RESUME" },
  { from: "Exception_Divert", to: "InTransitAir", event: "RESUME" },
  { from: "Exception_Divert", to: "Exception_MissedWindow", event: "WINDOW_BLOWN" },
  { from: "Exception_Declined", to: "Closed", event: "STAND_DOWN" },
  { from: "Exception_MissedWindow", to: "Delivered", event: "DELIVER_NON_VIABLE" },
  { from: "Exception_MissedWindow", to: "Closed", event: "ORGAN_LOST" },
];

export function getValidTransition(
  currentStatus: MissionStatus,
  event: MissionEventType
): Transition | null {
  return TRANSITIONS.find((t) => t.from === currentStatus && t.event === event) ?? null;
}

export interface CarrierAssignmentCheck {
  legal: boolean;
  reason?: string;
}

export interface ApplyTransitionInput {
  currentStatus: MissionStatus;
  event: MissionEventType;
  /** Required and must be legal:true for the ASSIGN_CARRIER event — the D085/duty-legal gate. */
  carrierAssignmentCheck?: CarrierAssignmentCheck;
}

export type ApplyTransitionResult =
  | { ok: true; from: MissionStatus; to: MissionStatus }
  | { ok: false; error: string };

const GATED_TARGET: MissionStatus = "CarrierAssigned";

export function applyMissionTransition(input: ApplyTransitionInput): ApplyTransitionResult {
  const transition = getValidTransition(input.currentStatus, input.event);
  if (!transition) {
    return {
      ok: false,
      error: `No transition for event "${input.event}" from state "${input.currentStatus}"`,
    };
  }

  if (transition.to === GATED_TARGET) {
    if (!input.carrierAssignmentCheck || !input.carrierAssignmentCheck.legal) {
      return {
        ok: false,
        error:
          input.carrierAssignmentCheck?.reason ??
          "Carrier assignment blocked: aircraft must be D085-valid and crew duty-legal",
      };
    }
  }

  return { ok: true, from: transition.from, to: transition.to };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- state-machine`
Expected: PASS — 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/engines/state-machine.ts src/lib/engines/state-machine.test.ts
git commit -m "Add mission state-machine engine with CarrierAssigned legality gate"
```

---

## Task 15: Atomic transition RPCs

**Files:**
- Create: `supabase/migrations/00000000000009_transition_rpcs.sql`

Guards and the transition graph live in TypeScript (Task 14, unit-tested); persistence of the guarded write must still be atomic, so it happens via a single Postgres function call per transition. The `where status = p_from_status` clause double-checks no concurrent transition raced ahead.

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Apply and verify**

Run: `npx supabase db reset`
Expected: both functions created without error.

- [ ] **Step 3: Regenerate types (RPCs are part of the typed client surface)**

Run: `npm run gen:types`
Expected: `src/types/database.ts` now includes `record_mission_transition` and `assign_carrier_and_transition` under `Database["public"]["Functions"]`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00000000000009_transition_rpcs.sql src/types/database.ts
git commit -m "Add atomic RPCs for mission transitions and carrier assignment"
```

---

## Task 16: Server actions wrapping the engines

**Files:**
- Create: `src/lib/actions/mission-actions.ts`
- Test: `src/lib/actions/mission-actions.test.ts`

The server action is the one place that: reads current state, runs the pure-function guard, and — only if the guard passes — calls the atomic RPC. It's kept testable by accepting an injected Supabase client, so the guard logic can be exercised with a fake client in unit tests without a live database.

- [ ] **Step 1: Write the failing test**

```typescript
// src/lib/actions/mission-actions.test.ts
import { describe, it, expect, vi } from "vitest";
import { transitionMission } from "./mission-actions";

function fakeClient(missionStatus: string) {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  return {
    rpc,
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: { status: missionStatus }, error: null }),
        }),
      }),
    }),
  } as any;
}

describe("transitionMission", () => {
  it("calls record_mission_transition for a valid, ungated transition", async () => {
    const client = fakeClient("MissionCreated");
    const result = await transitionMission(client, {
      missionId: "11111111-1111-1111-1111-111111111111",
      event: "REQUEST_CARRIER",
    });
    expect(result.ok).toBe(true);
    expect(client.rpc).toHaveBeenCalledWith("record_mission_transition", expect.objectContaining({
      p_mission_id: "11111111-1111-1111-1111-111111111111",
      p_from_status: "MissionCreated",
      p_to_status: "CarrierRequested",
      p_event_type: "REQUEST_CARRIER",
    }));
  });

  it("rejects an invalid transition without calling the RPC", async () => {
    const client = fakeClient("OfferReceived");
    const result = await transitionMission(client, {
      missionId: "11111111-1111-1111-1111-111111111111",
      event: "WHEELS_UP",
    });
    expect(result.ok).toBe(false);
    expect(client.rpc).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- mission-actions`
Expected: FAIL — `Cannot find module './mission-actions'`.

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/actions/mission-actions.ts
"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyMissionTransition,
  type MissionEventType,
  type MissionStatus,
  type CarrierAssignmentCheck,
} from "@/lib/engines/state-machine";

export interface TransitionMissionInput {
  missionId: string;
  event: MissionEventType;
  note?: string;
  metadata?: Record<string, unknown>;
  carrierAssignmentCheck?: CarrierAssignmentCheck;
}

export type TransitionMissionResult = { ok: true } | { ok: false; error: string };

export async function transitionMission(
  supabase: SupabaseClient,
  input: TransitionMissionInput
): Promise<TransitionMissionResult> {
  const { data: mission, error: fetchError } = await supabase
    .from("mission")
    .select("status")
    .eq("id", input.missionId)
    .single();

  if (fetchError || !mission) {
    return { ok: false, error: fetchError?.message ?? "Mission not found" };
  }

  const guardResult = applyMissionTransition({
    currentStatus: mission.status as MissionStatus,
    event: input.event,
    carrierAssignmentCheck: input.carrierAssignmentCheck,
  });

  if (!guardResult.ok) {
    return { ok: false, error: guardResult.error };
  }

  const { error: rpcError } = await supabase.rpc("record_mission_transition", {
    p_mission_id: input.missionId,
    p_from_status: guardResult.from,
    p_to_status: guardResult.to,
    p_event_type: input.event,
    p_note: input.note ?? null,
    p_metadata: input.metadata ?? {},
  });

  if (rpcError) {
    return { ok: false, error: rpcError.message };
  }

  return { ok: true };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- mission-actions`
Expected: PASS — 2 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/mission-actions.ts src/lib/actions/mission-actions.test.ts
git commit -m "Add transitionMission server action wrapping the state-machine guard"
```

---

## Task 17: Seed script (synthetic demo data)

**Files:**
- Create: `scripts/seed.ts`
- Modify: `package.json` (already has `seed` script from Task 1)

Per the design spec §7: 1 OPO org + 1 operator org, 2–3 hospitals, 2 airports, 2–3 aircraft (one D085-authorized + available, one deliberately not on D085), 4 pilots with duty histories (one deliberately in violation), 1 active contract, 2 seeded missions (one fresh `OfferReceived`, one mid-flight `InTransitAir` with custody chain + ticking countdown). Uses the `service_role` key so it bypasses RLS to write reference data directly.

- [ ] **Step 1: Write `scripts/seed.ts`**

```typescript
// scripts/seed.ts
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/types/database";

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
    // Deliberate violation: only 3h rest before a long on-call stretch (needs 10h).
    { pilot_id: violatingPilot.id, record_type: "REST", start_at: hoursAgo(3), end_at: hoursAgo(0.1) },
    { pilot_id: violatingPilot.id, record_type: "ON_CALL", start_at: hoursAgo(0.1), end_at: hoursFromNow(10) },
  ]);
  if (dutyErr) throw dutyErr;

  // Mission 1: fresh offer, nothing dispatched.
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

  // Mission 2: mid-flight, custody chain partially populated, countdown ticking.
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

  // A synthetic "system" custodian user id is fine for POC seed data — custody_event.custodian_user_id
  // just needs to reference a real auth.users row; create one minimal service account for seeding.
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
```

- [ ] **Step 2: Run the seed script**

Run: `npm run seed`
Expected: prints `Seed complete:` with the org/mission IDs and no errors.

- [ ] **Step 3: Verify in Supabase Studio**

Open `http://127.0.0.1:54323` → Table Editor → `mission`: two rows, one `OfferReceived`, one `InTransitAir`. Check `aircraft`: one row `on_d085 = true`, one `false`. Check `duty_record` for the fourth pilot: only a 3h `REST` record before a 10h `ON_CALL` block.
Expected: matches the design spec §7 requirements (one D085-authorized aircraft, one violating pilot, two missions).

- [ ] **Step 4: Commit**

```bash
git add scripts/seed.ts
git commit -m "Add synthetic seed data script for the demo mission set"
```

---

## Task 18: Backend verification pass

**Files:**
- No new files — this task runs the full suite and documents the outcome.

- [ ] **Step 1: Run all unit tests**

Run: `npm test`
Expected: all tests from Tasks 12, 13, 14, 16 pass (23 tests total).

- [ ] **Step 2: Reset the database and re-seed from a clean state, end to end**

Run: `npx supabase db reset && npm run gen:types && npm run seed`
Expected: migrations 1–9 apply cleanly in order, types regenerate, seed completes without error — proves the full migration chain and seed script work together on a fresh database.

- [ ] **Step 3: Confirm the project builds**

Run: `npm run build`
Expected: `Compiled successfully`.

- [ ] **Step 4: Commit** (only if any fixups were needed in the prior steps; otherwise skip)

```bash
git add -A
git commit -m "Fix backend verification issues" --allow-empty
```

---

## Handoff to the UI plan

Once this plan is complete, the next plan (`2026-07-20-dispatch-app-ui.md`) builds the component kit and the four Dispatch-app screens on top of: the generated `Database` types, `transitionMission` server action, `duty-legality`/`sla` engines, and the two seeded missions.

Two things the UI plan must account for:

1. **`assign_carrier_and_transition` (Task 15) has no server-action wrapper yet.** Unlike the generic `transitionMission` action, carrier assignment needs UI-supplied aircraft/crew selections combined with `computeCrewAssignmentLegality` per candidate pilot *before* calling the RPC. The Carrier Assignment screen (1.4) task in the UI plan must add an `assignCarrier` server action that: fetches candidate aircraft + their pilots' duty records, runs the legality engine per candidate, filters to legal-only options for display, and — on submit — re-verifies legality for the selected aircraft/crew and only then calls `supabase.rpc("assign_carrier_and_transition", ...)` with the computed `legality_snapshot` per pilot.
2. **`mission.sla_state` is a stored snapshot column, not the live source of truth.** No cron/Inngest timer updates it in this pass (by design — see architecture-and-stack.md §7.3). UI code must compute the *displayed* SLA state client-side via `computeSlaState(new Date(), organ.viability_deadline_at)` (Task 13) on every render/tick, not read `mission.sla_state` for color-coding or sort order.
