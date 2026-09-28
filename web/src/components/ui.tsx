import Link from "next/link";
import { Check, Clock, FileText, Lock, PlayCircle, ExternalLink, Sparkles } from "lucide-react";
import { formatClock, formatDuration, gradientFor, plural, splitEmoji } from "@/lib/format";
import type { Course, Lesson, ProgressEntry } from "@/lib/types";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-semibold tracking-[0.18em] text-ink ${className}`}>
      <span className="grid size-8 place-items-center rounded-lg bg-ink text-[10px] font-black tracking-[0.12em] text-bg">EV</span>
      <span className="text-sm">EVOLVE</span>
    </span>
  );
}

export function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-surface-3 ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full bg-gradient-to-r from-accent to-accent-strong transition-[width] duration-500" style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }} />
    </div>
  );
}

/** Portada del curso: imagen si existe; si no, degradado de la marca con el emoji del curso. */
export function CourseCover({ course, src, className = "", large = false }: { course: Course; src?: string; className?: string; large?: boolean }) {
  const { emoji } = splitEmoji(course.title);
  return (
    <div className={`relative overflow-hidden bg-surface-2 ${className}`} style={src ? undefined : { background: gradientFor(course.id) }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
      ) : (
        <>
          <div className="absolute inset-0 opacity-[0.06] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:32px_32px]" aria-hidden />
          <div className="absolute inset-0 grid place-items-center">
            <span className={`drop-shadow-[0_8px_24px_rgba(0,0,0,0.5)] ${large ? "text-7xl" : "text-6xl"}`} aria-hidden>
              {emoji ?? "✦"}
            </span>
          </div>
          <span className="absolute bottom-4 left-5 text-[10px] font-semibold tracking-[0.3em] text-white/50">EVOLVE · CURSO {String(course.position).padStart(2, "0")}</span>
        </>
      )}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
    </div>
  );
}

/** Miniatura de lección con duración; si no hay imagen, un degradado con el número de clase. */
export function LessonThumb({ lesson, src, className = "", icon = true }: { lesson: Lesson; src?: string; className?: string; icon?: boolean }) {
  return (
    <div className={`relative aspect-video overflow-hidden rounded-lg bg-surface-2 ${className}`} style={src ? undefined : { background: gradientFor(lesson.moduleId) }}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
      ) : icon ? (
        <div className="absolute inset-0 grid place-items-center">
          <KindIcon lesson={lesson} className="size-6 text-white/70" />
        </div>
      ) : null}
      {lesson.durationMs ? (
        <span className="absolute bottom-1.5 right-1.5 rounded-md bg-black/75 px-1.5 py-0.5 font-mono text-[11px] font-medium text-white">{formatClock(lesson.durationMs)}</span>
      ) : null}
    </div>
  );
}

export function KindIcon({ lesson, className = "size-4" }: { lesson: Lesson; className?: string }) {
  if (lesson.kind === "texto") return <FileText className={className} aria-hidden />;
  if (lesson.kind === "externo") return <ExternalLink className={className} aria-hidden />;
  return <PlayCircle className={className} aria-hidden />;
}

/** Estado de disponibilidad de una lección (para chips). */
export function lessonStatus(lesson: Lesson): { label: string; tone: "ok" | "soon" | "muted" } | null {
  if (lesson.kind === "video" && !lesson.videoReady) return { label: "Próximamente", tone: "soon" };
  if (lesson.kind === "texto") return { label: "Lectura", tone: "muted" };
  if (lesson.kind === "externo") return { label: providerName(lesson.provider), tone: "muted" };
  return null;
}

export function providerName(p: Lesson["provider"]) {
  return p === "loom" ? "Loom" : p === "youtube" ? "YouTube" : p === "vimeo" ? "Vimeo" : "Video externo";
}

export function StatusChip({ lesson }: { lesson: Lesson }) {
  const s = lessonStatus(lesson);
  if (!s) return null;
  const tone = s.tone === "soon" ? "border-warning/25 bg-warning/10 text-warning" : "";
  return (
    <span className={`chip ${tone}`}>
      {s.tone === "soon" ? <Sparkles className="size-3" aria-hidden /> : null}
      {s.label}
    </span>
  );
}

export function CourseCard({ course, cover, progress }: { course: Course; cover?: string; progress: { done: number; total: number; pct: number } }) {
  const started = progress.done > 0;
  return (
    <Link href={`/cursos/${course.slug}`} className="group card block overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-glow">
      <CourseCover course={course} src={cover} className="aspect-[16/9] transition duration-300 group-hover:brightness-110" />
      <div className="space-y-3 p-5">
        <h3 className="line-clamp-2 min-h-[2.75rem] text-[15px] font-semibold leading-snug text-ink">{splitEmoji(course.title).text}</h3>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span>{plural(course.modules.length, "módulo", "módulos")}</span>
          <span className="text-line-strong">•</span>
          <span>{plural(course.lessonCount, "clase", "clases")}</span>
          {course.durationMs ? (
            <>
              <span className="text-line-strong">•</span>
              <span className="inline-flex items-center gap-1">
                <Clock className="size-3" aria-hidden />
                {formatDuration(course.durationMs)}
              </span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-3">
          <ProgressBar pct={progress.pct} />
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted">{started ? `${progress.pct}%` : "Nuevo"}</span>
        </div>
      </div>
    </Link>
  );
}

export function DoneBadge({ entry }: { entry?: ProgressEntry }) {
  if (entry?.completed)
    return (
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success/15 text-success" title="Completada">
        <Check className="size-3.5" strokeWidth={3} aria-label="Completada" />
      </span>
    );
  return <span className="size-6 shrink-0 rounded-full border border-line-strong" aria-hidden />;
}

export function LockedNote() {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-subtle">
      <Lock className="size-3" aria-hidden /> Sin acceso
    </span>
  );
}
