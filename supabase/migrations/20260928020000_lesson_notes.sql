-- Notas personales por clase, opcionalmente ancladas a un segundo del video.
create table if not exists public.lesson_notes (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  lesson_id  text not null references public.lessons (id) on delete cascade,
  at_s       integer check (at_s is null or at_s >= 0),
  body       text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index if not exists lesson_notes_user_lesson_idx on public.lesson_notes (user_id, lesson_id, at_s);
alter table public.lesson_notes enable row level security;

drop policy if exists "Alumno lee sus notas" on public.lesson_notes;
create policy "Alumno lee sus notas" on public.lesson_notes
  for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists "Alumno crea sus notas" on public.lesson_notes;
create policy "Alumno crea sus notas" on public.lesson_notes
  for insert to authenticated with check (user_id = (select auth.uid()) and (select public.is_student()));
drop policy if exists "Alumno borra sus notas" on public.lesson_notes;
create policy "Alumno borra sus notas" on public.lesson_notes
  for delete to authenticated using (user_id = (select auth.uid()));
