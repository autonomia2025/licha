import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, BookOpen, Clock, ExternalLink, FileDown, Sparkles } from "lucide-react";
import { CompleteButton } from "@/components/CompleteButton";
import { RichText, hasBody } from "@/components/RichText";
import { VideoPlayer } from "@/components/VideoPlayer";
import { ScrollToCurrent } from "@/components/ScrollToCurrent";
import { LessonShell, PlayerProvider } from "@/components/lesson/PlayerContext";
import { LessonTabs } from "@/components/lesson/LessonTabs";
import { Notes } from "@/components/lesson/Notes";
import { Transcript } from "@/components/lesson/Transcript";
import { DoneBadge, LessonThumb, ProgressBar, providerName } from "@/components/ui";
import { allLessons, courseProgress, getLessonDetail, getNotes, getProgress, signPaths } from "@/lib/data";
import { embedUrl } from "@/lib/embed";
import { formatClock, formatDuration, splitEmoji } from "@/lib/format";
import type { Lesson } from "@/lib/types";

export async function generateMetadata({ params }: PageProps<"/cursos/[slug]/[leccion]">) {
  const { slug, leccion } = await params;
  const d = await getLessonDetail(slug, leccion);
  return { title: d ? d.lesson.title : "Clase" };
}

export default async function LessonPage({ params }: PageProps<"/cursos/[slug]/[leccion]">) {
  const { slug, leccion } = await params;
  const [d, progress, notes] = await Promise.all([getLessonDetail(slug, leccion), getProgress(), getNotes(leccion)]);
  if (!d) notFound();
  const { lesson, course, module } = d;

  const signed = await signPaths([d.videoPath, lesson.thumbnailPath, ...d.subtitles.map((s) => s.path)]);
  const entry = progress.get(lesson.id);
  const p = courseProgress(course, progress);
  const path = `/cursos/${course.slug}/${lesson.id}`;
  const hrefOf = (l: Lesson) => `/cursos/${course.slug}/${l.id}`;
  const embed = lesson.kind === "externo" ? embedUrl(lesson.externalUrl) : null;
  const moduleIndex = course.modules.findIndex((m) => m.id === module.id) + 1;
  const videoSrc = lesson.kind === "video" && d.videoPath ? signed[d.videoPath] : undefined;
  const subs = d.subtitles.filter((s) => signed[s.path]).map((s) => ({ src: signed[s.path], language: s.language, label: s.label }));
  const finishesCourse = allLessons(course).every((l) => l.id === lesson.id || progress.get(l.id)?.completed);

  const media = videoSrc ? (
    <VideoPlayer
      lessonId={lesson.id}
      src={videoSrc}
      poster={lesson.thumbnailPath ? signed[lesson.thumbnailPath] : undefined}
      subtitles={subs}
      startAt={entry?.completed ? 0 : entry?.positionS ?? 0}
      path={path}
      next={d.next ? { href: hrefOf(d.next), title: d.next.title } : null}
    />
  ) : lesson.kind === "externo" && embed ? (
    <div className="overflow-hidden rounded-2xl bg-black shadow-2xl ring-1 ring-line">
      <iframe src={embed} className="aspect-video w-full" allow="autoplay; fullscreen; picture-in-picture; encrypted-media" allowFullScreen title={lesson.title} loading="lazy" />
    </div>
  ) : lesson.kind === "texto" ? (
    <div className="card flex items-center gap-4 p-6">
      <span className="grid size-12 place-items-center rounded-xl bg-accent-soft text-accent-strong">
        <BookOpen className="size-6" aria-hidden />
      </span>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">Clase de lectura</p>
        <p className="mt-1 text-sm text-muted">Esta clase no tiene video: el contenido está aquí abajo.</p>
      </div>
    </div>
  ) : (
    <ComingSoon lesson={lesson} thumb={lesson.thumbnailPath ? signed[lesson.thumbnailPath] : undefined} external={lesson.kind === "externo" ? lesson.externalUrl : null} />
  );

  const main = (
    <>
      {/* Encabezado */}
      <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <nav className="flex flex-wrap items-center gap-1.5 text-sm text-muted" aria-label="Ruta">
            <Link href={`/cursos/${course.slug}`} className="transition hover:text-ink">
              {splitEmoji(course.title).text}
            </Link>
            <span className="text-line-strong">/</span>
            <span>Módulo {moduleIndex}</span>
          </nav>
          <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">{lesson.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="chip">
              Clase {lesson.number} de {course.lessonCount}
            </span>
            {lesson.durationMs ? (
              <span className="chip">
                <Clock className="size-3" aria-hidden /> {formatDuration(lesson.durationMs)}
              </span>
            ) : null}
            {lesson.kind === "externo" ? <span className="chip">{providerName(lesson.provider)}</span> : null}
            {lesson.originalTitle !== lesson.title ? <span className="text-xs text-subtle">Original: {lesson.originalTitle}</span> : null}
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <CompleteButton lessonId={lesson.id} completed={Boolean(entry?.completed)} finishesCourse={finishesCourse} />
        </div>
      </div>

      <LessonTabs
        description={hasBody(d.bodyRaw) ? <div className="max-w-3xl"><RichText raw={d.bodyRaw} /></div> : null}
        transcript={videoSrc && subs[0] ? <Transcript src={subs[0].src} /> : null}
        notes={<Notes lessonId={lesson.id} initial={notes} />}
        notesCount={notes.length}
        resources={
          d.attachments.length ? (
            <ul className="grid max-w-3xl gap-2 sm:grid-cols-2">
              {d.attachments.map((a, i) => (
                <li key={i}>
                  <a href={a.url ?? "#"} target="_blank" rel="noopener noreferrer" className="card flex items-center gap-3 p-4 transition hover:border-line-strong">
                    <FileDown className="size-5 text-accent-strong" aria-hidden />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : null
        }
        resourcesCount={d.attachments.length}
      />

      {/* Anterior / siguiente */}
      <div className="mt-12 grid gap-3 sm:grid-cols-2">
        {d.prev ? (
          <Link href={hrefOf(d.prev)} className="card group flex items-center gap-3 p-4 transition hover:border-line-strong">
            <ArrowLeft className="size-5 shrink-0 text-subtle transition group-hover:-translate-x-0.5 group-hover:text-ink" aria-hidden />
            <div className="min-w-0">
              <p className="text-xs text-subtle">Anterior</p>
              <p className="truncate text-sm font-medium">{d.prev.title}</p>
            </div>
          </Link>
        ) : (
          <span />
        )}
        {d.next ? (
          <Link href={hrefOf(d.next)} className="card group flex items-center justify-end gap-3 p-4 text-right transition hover:border-line-strong">
            <div className="min-w-0">
              <p className="text-xs text-subtle">Siguiente</p>
              <p className="truncate text-sm font-medium">{d.next.title}</p>
            </div>
            <ArrowRight className="size-5 shrink-0 text-subtle transition group-hover:translate-x-0.5 group-hover:text-ink" aria-hidden />
          </Link>
        ) : null}
      </div>
    </>
  );

  const sidebar = (
    <div className="card overflow-hidden">
      <div className="border-b border-line p-5">
        <Link href={`/cursos/${course.slug}`} className="line-clamp-2 font-semibold leading-snug transition hover:text-accent-strong">
          {course.title}
        </Link>
        <div className="mt-3 flex items-center gap-3">
          <ProgressBar pct={p.pct} />
          <span className="shrink-0 text-xs tabular-nums text-muted">{p.pct}%</span>
        </div>
      </div>
      <div id="temario" className="scroll-thin max-h-[calc(100vh-15rem)] overflow-y-auto">
        <ScrollToCurrent containerId="temario" />
        {course.modules.map((m, mi) => (
          <div key={m.id}>
            <p className="sticky top-0 z-10 border-b border-line/60 bg-surface/95 px-5 py-2.5 text-xs font-semibold text-muted backdrop-blur">
              {mi + 1}. {m.title}
            </p>
            <ol>
              {m.lessons.map((l) => {
                const current = l.id === lesson.id;
                return (
                  <li key={l.id}>
                    <Link
                      href={hrefOf(l)}
                      aria-current={current ? "page" : undefined}
                      className={`flex items-start gap-3 px-5 py-3 text-sm transition ${current ? "bg-accent-soft text-ink" : "text-muted hover:bg-surface-2 hover:text-ink"}`}
                    >
                      <DoneBadge entry={progress.get(l.id)} />
                      <span className="min-w-0 flex-1">
                        <span className={`line-clamp-2 leading-snug ${current ? "font-medium" : ""}`}>{l.title}</span>
                        <span className="mt-1 flex items-center gap-2 text-xs text-subtle">
                          {l.durationMs ? <span className="tabular-nums">{formatClock(l.durationMs)}</span> : null}
                          {l.kind === "video" && !l.videoReady ? <span className="text-warning/80">Próximamente</span> : null}
                          {l.kind === "texto" ? <span>Lectura</span> : null}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <PlayerProvider>
      <LessonShell media={media} main={main} sidebar={sidebar} />
    </PlayerProvider>
  );
}

function ComingSoon({ lesson, thumb, external }: { lesson: Lesson; thumb?: string; external: string | null }) {
  return (
    <div className="relative overflow-hidden rounded-2xl ring-1 ring-line">
      <LessonThumb lesson={lesson} src={thumb} icon={false} className="rounded-none opacity-60 blur-[1px]" />
      <div className="absolute inset-0 grid place-items-center bg-gradient-to-t from-bg via-bg/70 to-bg/30 p-6">
        <div className="max-w-md text-center">
          <span className="mx-auto grid size-12 place-items-center rounded-full bg-warning/15 text-warning">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <p className="mt-4 text-lg font-semibold">{external ? "Video externo" : "Este video estará disponible pronto"}</p>
          <p className="mt-2 text-sm text-muted">
            {external ? "Este video está alojado fuera de la plataforma." : "Estamos publicando las clases en orden. Mientras tanto puedes leer la descripción y tomar notas."}
          </p>
          {external ? (
            <a href={external} target="_blank" rel="noopener noreferrer" className="btn btn-ghost mt-5">
              Abrir video <ExternalLink className="size-4" aria-hidden />
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}
