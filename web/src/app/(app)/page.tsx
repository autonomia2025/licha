import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Clock, Play } from "lucide-react";
import { ActivityCard } from "@/components/Activity";
import { CourseCard, LessonThumb, ProgressBar, StatusChip } from "@/components/ui";
import { allLessons, courseProgress, getContinue, getLibrary, getProgress, getViewer, signPaths } from "@/lib/data";
import { formatClock, formatDuration, greeting, splitEmoji } from "@/lib/format";

export const metadata = { title: "Inicio" };

export default async function HomePage() {
  const [viewer, library, progress, cont] = await Promise.all([getViewer(), getLibrary(), getProgress(), getContinue()]);
  const signed = await signPaths([...library.map((c) => c.coverPath), cont?.lesson.thumbnailPath]);

  const lessons = library.flatMap(allLessons);
  const completed = lessons.filter((l) => progress.get(l.id)?.completed);
  const watchedMs = completed.reduce((s, l) => s + (l.durationMs ?? 0), 0);
  const inProgress = library.filter((c) => {
    const p = courseProgress(c, progress);
    return p.done > 0 && p.done < p.total;
  }).length;
  const started = completed.length > 0 || [...progress.values()].length > 0;
  const contCourseProgress = cont ? courseProgress(cont.course, progress) : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="animate-fade-up">
        <p className="text-sm font-medium text-muted">{greeting()},</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight sm:text-4xl">{viewer?.name ?? "alumno"} 👋</h1>
      </section>

      {cont ? (
        <section className="mt-8 animate-fade-up [animation-delay:60ms]">
          <Link
            href={`/cursos/${cont.course.slug}/${cont.lesson.id}`}
            className="group card relative grid overflow-hidden transition hover:border-line-strong md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
          >
            <div className="relative">
              <LessonThumb lesson={cont.lesson} src={cont.lesson.thumbnailPath ? signed[cont.lesson.thumbnailPath] : undefined} progress={cont.positionS && cont.lesson.durationMs ? (cont.positionS * 100000) / cont.lesson.durationMs : undefined} className="rounded-none md:h-full md:aspect-auto md:min-h-72" />
              <div className="absolute inset-0 grid place-items-center bg-black/10 transition group-hover:bg-black/30">
                <span className="grid size-16 place-items-center rounded-full bg-white/95 text-bg shadow-2xl transition group-hover:scale-105">
                  <Play className="ml-1 size-7 fill-current" aria-hidden />
                </span>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">{started ? "Continúa donde quedaste" : "Empieza aquí"}</span>
              <div>
                <p className="text-sm text-muted">{splitEmoji(cont.course.title).text} · Clase {cont.lesson.number}</p>
                <h2 className="mt-1.5 text-2xl font-semibold leading-tight tracking-tight">{cont.lesson.title}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {cont.lesson.durationMs ? (
                  <span className="chip">
                    <Clock className="size-3" aria-hidden />
                    {cont.positionS ? `${formatClock(cont.positionS * 1000)} de ${formatClock(cont.lesson.durationMs)}` : formatDuration(cont.lesson.durationMs)}
                  </span>
                ) : null}
                <StatusChip lesson={cont.lesson} />
              </div>
              {contCourseProgress ? (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted">
                    <span>Progreso del curso</span>
                    <span className="tabular-nums">
                      {contCourseProgress.done}/{contCourseProgress.total} clases
                    </span>
                  </div>
                  <ProgressBar pct={contCourseProgress.pct} />
                </div>
              ) : null}
              <span className="btn btn-primary mt-2 w-fit">
                {started ? "Reanudar" : "Comenzar"} <ArrowRight className="size-4" aria-hidden />
              </span>
            </div>
          </Link>
        </section>
      ) : null}

      <section className="mt-6 animate-fade-up [animation-delay:120ms]">
        <ActivityCard progress={progress} />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon={<CheckCircle2 className="size-5" />} label="Clases completadas" value={`${completed.length}`} hint={`de ${lessons.length}`} />
        <Stat icon={<Clock className="size-5" />} label="Tiempo de estudio" value={formatDuration(watchedMs) || "0 min"} hint="" />
        <Stat icon={<BookOpen className="size-5" />} label="Cursos en progreso" value={`${inProgress}`} hint={`de ${library.length}`} />
      </section>

      <section className="mt-14">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Tus cursos</h2>
            <p className="mt-1 text-sm text-muted">Todo el programa Evolve, ordenado para que avances paso a paso.</p>
          </div>
          <Link href="/cursos" className="hidden text-sm font-medium text-muted transition hover:text-ink sm:inline-flex">
            Ver todos →
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {library.slice(0, 6).map((c) => (
            <CourseCard key={c.id} course={c} cover={c.coverPath ? signed[c.coverPath] : undefined} progress={courseProgress(c, progress)} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint: string }) {
  return (
    <div className="card flex items-center gap-4 p-4 sm:p-5 [&:last-child]:col-span-2 sm:[&:last-child]:col-span-1">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-strong">{icon}</span>
      <div>
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="mt-0.5 text-xl font-semibold tabular-nums">
          {value} <span className="text-sm font-normal text-subtle">{hint}</span>
        </p>
      </div>
    </div>
  );
}
