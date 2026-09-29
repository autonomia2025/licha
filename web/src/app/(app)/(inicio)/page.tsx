import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Clock, Play } from "lucide-react";
import { ActivityCard } from "@/components/Activity";
import { CountUp } from "@/components/CountUp";
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
        <p className="eyebrow flex items-center gap-2">
          <span className="size-1.5 rounded-full bg-white" aria-hidden />
          {greeting()}
        </p>
        <h1 className="display mt-4 text-5xl sm:text-7xl">
          Hola, <em className="shine">{viewer?.name ?? "alumno"}</em>.
        </h1>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Cada clase te acerca a <em className="serif text-[1.15em] text-ink">anuncios que venden</em> y a una marca que escala.
        </p>
      </section>

      {cont ? (
        <section className="mt-10 animate-fade-up [animation-delay:40ms]">
          <Link
            href={`/cursos/${cont.course.slug}/${cont.lesson.id}`}
            className="group card lift relative grid overflow-hidden md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]"
          >
            <div className="relative">
              <LessonThumb lesson={cont.lesson} src={cont.lesson.thumbnailPath ? signed[cont.lesson.thumbnailPath] : undefined} progress={cont.positionS && cont.lesson.durationMs ? (cont.positionS * 100000) / cont.lesson.durationMs : undefined} className="rounded-none transition-[scale] duration-300 ease-[var(--ease-out)] group-hover:scale-[1.02] md:h-full md:aspect-auto md:min-h-80" />
              <div className="absolute inset-0 grid place-items-center bg-gradient-to-r from-transparent via-transparent to-black/40 transition-colors duration-200 group-hover:bg-black/20">
                <span className="relative grid size-20 place-items-center rounded-full border border-white/25 bg-white/10 text-white shadow-[inset_0_1px_0_#ffffff40,0_20px_50px_-10px_#000] backdrop-blur-xl transition-[scale,background-color,color] duration-200 ease-[var(--ease-out)] group-hover:scale-105 group-hover:bg-white group-hover:text-black">
                  <Play className="ml-1 size-7 fill-current" aria-hidden />
                </span>
              </div>
            </div>
            <div className="flex flex-col justify-center gap-4 p-6 sm:p-8">
              <span className="eyebrow">{started ? "Continúa donde quedaste" : "Empieza aquí"}</span>
              <div>
                <p className="text-sm text-muted">{splitEmoji(cont.course.title).text} · Clase {cont.lesson.number}</p>
                <h2 className="mt-2 text-3xl font-semibold leading-[1.1] tracking-[-0.03em]">{cont.lesson.title}</h2>
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

      <section className="mt-4 animate-fade-up [animation-delay:80ms]">
        <ActivityCard progress={progress} />
      </section>

      <section className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 animate-fade-up [animation-delay:120ms]">
        <Stat icon={<CheckCircle2 className="size-5" />} label="Clases completadas" value={<CountUp value={completed.length} />} hint={`de ${lessons.length}`} />
        <Stat icon={<Clock className="size-5" />} label="Tiempo de estudio" value={formatDuration(watchedMs) || "0 min"} hint="" />
        <Stat icon={<BookOpen className="size-5" />} label="Cursos en progreso" value={<CountUp value={inProgress} />} hint={`de ${library.length}`} />
      </section>

      <section className="mt-24">
        <div className="reveal flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">Biblioteca</p>
            <h2 className="display mt-3 text-4xl sm:text-5xl">
              Tus <em>cursos</em>
            </h2>
            <p className="mt-1 text-sm text-muted">Todo el programa Evolve, ordenado para que avances paso a paso.</p>
          </div>
          <Link href="/cursos" className="btn btn-ghost hidden h-10 text-sm sm:inline-flex">
            Ver todos <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {library.slice(0, 6).map((c) => (
            <div key={c.id} className="reveal">
              <CourseCard course={c} cover={c.coverPath ? signed[c.coverPath] : undefined} progress={courseProgress(c, progress)} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: React.ReactNode; hint: string }) {
  return (
    <div className="card lift flex items-center gap-4 p-4 sm:p-5 [&:last-child]:col-span-2 sm:[&:last-child]:col-span-1">
      <span className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/[0.07] text-white shadow-[inset_0_1px_0_#ffffff26]">{icon}</span>
      <div>
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className="mt-0.5 text-2xl font-semibold tracking-[-0.03em] tabular-nums">
          {value} <span className="text-sm font-normal text-subtle">{hint}</span>
        </p>
      </div>
    </div>
  );
}

