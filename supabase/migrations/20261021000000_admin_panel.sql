-- Panel de administración: quién es admin y registro de ingresos.
-- Se ejecuta UNA vez en Supabase → SQL Editor (o con `supabase db push`).

-- Administradores (la dueña del estudio). Se agregan o quitan con SQL.
create table if not exists public.admins (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

drop policy if exists "Admin se ve a sí mismo" on public.admins;
create policy "Admin se ve a sí mismo" on public.admins
  for select to authenticated
  using (email = lower((select auth.jwt()) ->> 'email'));

-- ¿El usuario autenticado es admin? (SECURITY INVOKER: respeta la RLS de admins).
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.admins a
    where a.email = lower((select auth.jwt()) ->> 'email')
  );
$$;

-- Cada ingreso con contraseña queda registrado (lo escribe la app tras un login correcto).
create table if not exists public.login_events (
  id         bigint generated always as identity primary key,
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  email      text not null,
  at         timestamptz not null default now(),
  user_agent text check (user_agent is null or length(user_agent) <= 300)
);
create index if not exists login_events_at_idx on public.login_events (at desc);
create index if not exists login_events_user_idx on public.login_events (user_id, at desc);
alter table public.login_events enable row level security;

-- Cada usuario solo puede registrar SU propio ingreso; nadie lee los eventos desde el navegador
-- (el panel de admin los lee en el servidor con la clave secreta).
drop policy if exists "Usuario registra su ingreso" on public.login_events;
create policy "Usuario registra su ingreso" on public.login_events
  for insert to authenticated
  with check (user_id = (select auth.uid()) and email = lower((select auth.jwt()) ->> 'email'));

-- Admin inicial. Cambia el correo si hace falta.
insert into public.admins (email) values ('licha@gmail.com') on conflict (email) do nothing;
