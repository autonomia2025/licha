-- Área de alumnos: títulos en español, metadatos de lección para la interfaz, acceso por lista de
-- alumnos, progreso por usuario y lectura de medios solo para alumnos activos.

-- Títulos traducidos (se conserva el original en title) y datos para la interfaz.
alter table public.courses
  add column if not exists title_es       text,
  add column if not exists description_es text,
  add column if not exists cover_path     text;          -- portada copiada a Storage (course-media)

alter table public.course_modules
  add column if not exists title_es text;

alter table public.lessons
  add column if not exists title_es       text,
  add column if not exists kind           text not null default 'video'
                                          check (kind in ('video', 'texto', 'externo')),
  add column if not exists duration_ms    integer,       -- videoLenMs de Skool
  add column if not exists thumbnail_path text;          -- miniatura copiada a Storage (course-media)

-- Lista de alumnos con acceso (el alta se hace desde el panel o por SQL).
create table if not exists public.student_access (
  email      text primary key check (email = lower(email)),
  full_name  text,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
alter table public.student_access enable row level security;

drop policy if exists "Alumno ve su propio acceso" on public.student_access;
create policy "Alumno ve su propio acceso" on public.student_access
  for select to authenticated
  using (email = lower((select auth.jwt()) ->> 'email'));

-- ¿El usuario autenticado es alumno activo? (SECURITY INVOKER: respeta la RLS de student_access).
create or replace function public.is_student()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select exists (
    select 1 from public.student_access s
    where s.email = lower((select auth.jwt()) ->> 'email') and s.active
  );
$$;

-- Lectura del contenido: solo alumnos activos.
do $$
declare t text;
begin
  foreach t in array array['courses', 'course_modules', 'lessons', 'lesson_videos', 'lesson_subtitles', 'lesson_attachments']
  loop
    execute format('drop policy if exists "Alumnos leen contenido" on public.%I', t);
    execute format('create policy "Alumnos leen contenido" on public.%I for select to authenticated using ((select public.is_student()))', t);
  end loop;
end $$;

-- Progreso de cada alumno.
create table if not exists public.lesson_progress (
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id    text not null references public.lessons (id) on delete cascade,
  position_s   integer not null default 0,
  completed_at timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (user_id, lesson_id)
);
create index if not exists lesson_progress_user_updated_idx on public.lesson_progress (user_id, updated_at desc);
alter table public.lesson_progress enable row level security;

drop policy if exists "Alumno lee su progreso" on public.lesson_progress;
create policy "Alumno lee su progreso" on public.lesson_progress
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Alumno crea su progreso" on public.lesson_progress;
create policy "Alumno crea su progreso" on public.lesson_progress
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_student()));
drop policy if exists "Alumno actualiza su progreso" on public.lesson_progress;
create policy "Alumno actualiza su progreso" on public.lesson_progress
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Videos, subtítulos y miniaturas: los alumnos activos pueden generar URLs firmadas.
drop policy if exists "Alumnos leen medios del curso" on storage.objects;
create policy "Alumnos leen medios del curso" on storage.objects
  for select to authenticated
  using (bucket_id = 'course-media' and (select public.is_student()));
