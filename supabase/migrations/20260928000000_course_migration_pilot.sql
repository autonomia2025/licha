-- Piloto de migración Skool → Supabase.
-- Estructura mínima para validar el flujo con 2–3 lecciones. Puede ajustarse antes de migrar todo.
-- Los ids son los de Skool (hex de 32 caracteres) para que la migración sea idempotente.
-- RLS activado sin políticas: solo el service role (el migrador) puede leer/escribir por ahora;
-- las políticas de lectura para alumnos se definirán con la app.

create table if not exists public.courses (
  id              text primary key,                 -- id Skool del curso
  slug            text not null unique,             -- "name" de Skool (8 hex), usado en la URL original
  title           text not null,
  description     text,
  cover_image_url text,
  position        integer not null,
  source          jsonb not null default '{}'::jsonb, -- flags de acceso originales (privacy, minTier…)
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.course_modules (
  id          text primary key,                     -- id Skool del "set"; "<courseId>:root" si el curso no tiene módulos
  course_id   text not null references public.courses (id) on delete cascade,
  position    integer not null,
  title       text not null,
  is_implicit boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (course_id, position)
);

create table if not exists public.lessons (
  id           text primary key,                    -- id Skool de la lección (?md=)
  course_id    text not null references public.courses (id) on delete cascade,
  module_id    text not null references public.course_modules (id) on delete cascade,
  position     integer not null,
  title        text not null,
  body_raw     text,                                -- metadata.desc original (formato Skool "[v2]")
  body_format  text,                                -- p. ej. "skool-rich:v2"
  source_url   text not null,
  accessible   boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (module_id, position)
);

create table if not exists public.lesson_videos (
  lesson_id        text primary key references public.lessons (id) on delete cascade,
  provider         text not null check (provider in ('skool-mux', 'loom', 'youtube', 'vimeo', 'other')),
  source_video_id  text,                            -- metadata.videoId de Skool
  playback_id      text,                            -- playbackId de Mux (sin token)
  external_url     text,                            -- para Loom/YouTube/Vimeo
  duration_ms      integer,
  width            integer,
  height           integer,
  video_codec      text,
  audio_codec      text,
  size_bytes       bigint,
  checksum_sha256  text,
  storage_path     text,                            -- bucket course-media
  status           text not null default 'discovered'
                   check (status in ('discovered', 'processing', 'stored', 'failed', 'skipped')),
  error            text,
  migrated_at      timestamptz,
  updated_at       timestamptz not null default now()
);

create table if not exists public.lesson_subtitles (
  id            uuid primary key default gen_random_uuid(),
  lesson_id     text not null references public.lessons (id) on delete cascade,
  language      text not null,                      -- BCP 47, p. ej. "en"
  label         text not null,                      -- p. ej. "English CC"
  is_default    boolean not null default false,
  format        text not null default 'webvtt',
  cue_count     integer,
  storage_path  text,
  status        text not null default 'discovered'
                check (status in ('discovered', 'stored', 'failed')),
  updated_at    timestamptz not null default now(),
  unique (lesson_id, language)
);

create table if not exists public.lesson_attachments (
  id              uuid primary key default gen_random_uuid(),
  lesson_id       text not null references public.lessons (id) on delete cascade,
  position        integer not null,
  kind            text not null check (kind in ('file', 'link')),
  title           text,
  file_name       text,
  content_type    text,
  source_file_id  text,
  external_url    text,
  size_bytes      bigint,
  storage_path    text,
  status          text not null default 'discovered'
                  check (status in ('discovered', 'stored', 'failed', 'skipped')),
  updated_at      timestamptz not null default now(),
  unique (lesson_id, position)
);

create index if not exists course_modules_course_idx on public.course_modules (course_id, position);
create index if not exists lessons_module_idx on public.lessons (module_id, position);
create index if not exists lessons_course_idx on public.lessons (course_id);
create index if not exists lesson_subtitles_lesson_idx on public.lesson_subtitles (lesson_id);
create index if not exists lesson_attachments_lesson_idx on public.lesson_attachments (lesson_id);

alter table public.courses            enable row level security;
alter table public.course_modules     enable row level security;
alter table public.lessons            enable row level security;
alter table public.lesson_videos      enable row level security;
alter table public.lesson_subtitles   enable row level security;
alter table public.lesson_attachments enable row level security;

-- Bucket privado para videos, subtítulos y adjuntos. Sin límite propio: aplica el límite global del proyecto.
insert into storage.buckets (id, name, public)
values ('course-media', 'course-media', false)
on conflict (id) do nothing;
