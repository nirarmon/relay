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
