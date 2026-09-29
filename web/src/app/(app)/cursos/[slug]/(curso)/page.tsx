import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, ChevronDown, Clock, Layers, PlayCircle } from "lucide-react";
import { LinkPending } from "@/components/LinkPending";
import { CourseCover, DoneBadge, SerifTail, KindIcon, LessonThumb, ProgressBar, StatusChip } from "@/components/ui";
import { allLessons, courseProgress, getCourse, getProgress, signPaths } from "@/lib/data";
import { formatClock, formatDuration, plural, splitEmoji } from "@/lib/format";

export async function generateMetadata({ params }: PageProps<"/cursos/[slug]">) {
  const course = await getCourse((await params).slug);
  return { title: course ? splitEmoji(course.title).text : "Curso" };
}

export default async function CoursePage({ params }: PageProps<"/cursos/[slug]">) {
  const { slug } = await params;
  const [course, progress] = await Promise.all([getCourse(slug), getProgress()]);
  if (!course) notFound();

  const lessons = allLessons(course);
  const signed = await signPaths([course.coverPath, ...lessons.map((l) => l.thumbnailPath)]);
  const p = courseProgress(course, progress);
  const next = lessons.find((l) => !progress.get(l.id)?.completed) ?? lessons[0];
  const { emoji, text } = splitEmoji(course.title);
  const readyCount = lessons.filter((l) => l.kind !== "video" || l.videoReady).length;

  return (
    <div>
      {/* Portada */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 scale-110 opacity-50 blur-3xl" aria-hidden>
          <CourseCover course={course} src={course.coverPath ? signed[course.coverPath] : undefined} className="size-full" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-bg/20 via-bg/70 to-bg/0" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1fr)_380px] lg:px-8 lg:py-16">
          <div className="animate-fade-up">
            <Link href="/cursos" className="chip transition hover:border-white/30 hover:text-ink">
              ← Cursos
            </Link>
            <p className="eyebrow mt-6">
              Curso <span className="serif text-sm normal-case tracking-normal text-ink">n.º {String(course.position).padStart(2, "0")}</span>
            </p>
            <h1 className="display mt-3 text-4xl sm:text-6xl">
              {emoji ? <span className="mr-3 inline-block align-[0.05em] text-[0.8em]">{emoji}</span> : null}
              <SerifTail text={text} />
            </h1>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="chip">
                <Layers className="size-3" aria-hidden /> {plural(course.modules.length, "módulo", "módulos")}
              </span>
              <span className="chip">
                <PlayCircle className="size-3" aria-hidden /> {plural(course.lessonCount, "clase", "clases")}
              </span>
              {course.durationMs ? (
                <span className="chip">
                  <Clock className="size-3" aria-hidden /> {formatDuration(course.durationMs)}
                </span>
              ) : null}
            </div>
            <div className="mt-8 max-w-md space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Tu progreso</span>
                <span className="font-medium tabular-nums">
                  {p.done}/{p.total} · {p.pct}%
                </span>
              </div>
              <ProgressBar pct={p.pct} />
            </div>
            {next ? (
              <Link href={`/cursos/${course.slug}/${next.id}`} className="btn btn-primary mt-8">
                {p.done === 0 ? "Comenzar curso" : p.done === p.total ? "Repasar desde el inicio" : `Continuar: clase ${next.number}`}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            ) : null}
          </div>
          <CourseCover course={course} src={course.coverPath ? signed[course.coverPath] : undefined} large className="group hidden aspect-[16/10] rounded-3xl border border-white/10 shadow-[0_40px_100px_-30px_#000] md:block animate-fade-up [animation-delay:60ms]" />
        </div>
      </section>

      {/* Temario */}
      <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="display text-4xl">
            El <em>temario</em>
          </h2>
          {readyCount < lessons.length ? (
            <p className="text-xs text-subtle">
              {readyCount} de {lessons.length} clases disponibles · el resto se está publicando
            </p>
          ) : null}
        </div>
        <div className="mt-6 space-y-3">
          {course.modules.map((m, mi) => {
            const done = m.lessons.filter((l) => progress.get(l.id)?.completed).length;
            const ms = m.lessons.reduce((s, l) => s + (l.durationMs ?? 0), 0);
            const open = m.lessons.some((l) => l.id === next?.id) || (mi === 0 && p.done === 0);
            const { emoji: me, text: mt } = splitEmoji(m.title);
            return (
              <details key={m.id} open={open} className="reveal group card overflow-hidden">
                <summary className="row flex cursor-pointer list-none items-center gap-4 p-5 [&::-webkit-details-marker]:hidden">
                  <span className="grid size-11 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.06] text-lg shadow-[inset_0_1px_0_#ffffff1f]">{me ?? <span className="serif text-lg text-muted">{mi + 1}</span>}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-subtle">
                      Módulo <span className="serif text-sm text-muted">{String(mi + 1).padStart(2, "0")}</span>
                    </p>
                    <h3 className="truncate font-semibold">{mt}</h3>
                  </div>
                  <div className="hidden shrink-0 text-right text-xs text-muted sm:block">
                    <p className="tabular-nums">
                      {done}/{m.lessons.length} clases
                    </p>
                    {ms ? <p className="mt-0.5 text-subtle">{formatDuration(ms)}</p> : null}
                  </div>
                  <ChevronDown className="size-5 shrink-0 text-subtle transition-transform duration-200 ease-[var(--ease-out)] group-open:rotate-180" aria-hidden />
                </summary>
                <ol className="border-t border-line">
                  {m.lessons.map((l) => {
                    const entry = progress.get(l.id);
                    const isNext = l.id === next?.id;
                    return (
                      <li key={l.id} className="border-b border-line/60 last:border-0">
                        <Link
                          href={`/cursos/${course.slug}/${l.id}`}
                          className={`row group/row flex items-center gap-4 px-5 py-3.5 ${isNext ? "bg-white/[0.06]" : ""}`}
                        >
                          <DoneBadge entry={entry} />
                          <LessonThumb lesson={l} src={l.thumbnailPath ? signed[l.thumbnailPath] : undefined} progress={!entry?.completed && entry?.positionS && l.durationMs ? (entry.positionS * 100000) / l.durationMs : undefined} className="hidden w-28 shrink-0 sm:block" />
                          <div className="min-w-0 flex-1">
                            <p className={`line-clamp-2 text-[15px] leading-snug ${entry?.completed ? "text-muted" : "text-ink"}`}>
                              <span className="mr-2 font-mono text-xs text-subtle">{String(l.number).padStart(2, "0")}</span>
                              {l.title}
                            </p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-subtle">
                              <KindIcon lesson={l} className="size-3.5" />
                              {l.durationMs ? <span className="tabular-nums">{formatClock(l.durationMs)}</span> : null}
                              {isNext && p.done > 0 ? <span className="serif text-sm text-ink">— siguiente</span> : null}
                            </div>
                          </div>
                          <div className="hidden sm:block">
                            <StatusChip lesson={l} />
                          </div>
                          <LinkPending />
                        </Link>
                      </li>
                    );
                  })}
                </ol>
              </details>
            );
          })}
        </div>
      </section>
    </div>
  );
}

