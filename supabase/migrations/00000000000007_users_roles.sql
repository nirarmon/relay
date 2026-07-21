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
