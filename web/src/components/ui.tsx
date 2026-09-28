import Link from "next/link";
import { Check, Clock, FileText, Lock, PlayCircle, ExternalLink, Sparkles } from "lucide-react";
import { formatClock, formatDuration, gradientFor, plural, splitEmoji } from "@/lib/format";
import type { Course, Lesson, ProgressEntry } from "@/lib/types";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`group/logo inline-flex items-center gap-2.5 text-ink ${className}`}>
      <span className="grid size-8 place-items-center rounded-full bg-ink text-bg shadow-[0_0_24px_-4px_#ffffff80] transition duration-500 group-hover/logo:rotate-[18deg]">
        <span className="serif text-lg leading-none">e</span>
      </span>
      <span className="text-[15px] font-semibold tracking-[-0.02em]">
        Evolve<span className="serif ml-1 font-normal text-muted">academy</span>
      </span>
    </span>
  );
}

export function ProgressBar({ pct, className = "" }: { pct: number; className?: string }) {
  return (
    <div className={`h-1 w-full overflow-hidden rounded-full bg-white/10 ${className}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="bar-fill h-full rounded-full bg-gradient-to-r from-white/60 to-white shadow-[0_0_12px_#ffffffaa] transition-[width] duration-700" style={{ width: `${Math.max(pct, pct > 0 ? 3 : 0)}%` }} />
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
          <div className="absolute inset-0 opacity-[0.05] [background-image:linear-gradient(#fff_1px,transparent_1px),linear-gradient(90deg,#fff_1px,transparent_1px)] [background-size:32px_32px]" aria-hidden />
          <span className={`serif absolute -right-2 -top-6 select-none leading-none text-white/[0.07] ${large ? "text-[12rem]" : "text-[9rem]"}`} aria-hidden>
            {String(course.position).padStart(2, "0")}
          </span>
          <div className="absolute inset-0 grid place-items-center">
            <span className={`grid place-items-center rounded-full border border-white/15 bg-white/[0.06] shadow-[inset_0_1px_0_#ffffff26,0_20px_40px_-12px_#000] backdrop-blur-xl transition duration-700 [transition-timing-function:var(--ease-out-expo)] group-hover:scale-110 ${large ? "size-28 text-5xl" : "size-20 text-4xl"}`} aria-hidden>
              <span className="grayscale-[35%]">{emoji ?? "✦"}</span>
            </span>
          </div>
          <span className="absolute bottom-4 left-5 text-[10px] font-medium tracking-[0.3em] text-white/45">
            EVOLVE · <span className="serif text-[13px] tracking-normal text-white/70">curso {String(course.position).padStart(2, "0")}</span>
          </span>
        </>
      )}
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/5" />
    </div>
  );
}

/** Miniatura de lección con duración; si no hay imagen, un degradado con el número de clase. */
export function LessonThumb({ lesson, src, className = "", icon = true, progress }: { lesson: Lesson; src?: string; className?: string; icon?: boolean; progress?: number }) {
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
        <span className="absolute bottom-1.5 right-1.5 rounded-full border border-white/10 bg-black/55 px-2 py-0.5 font-mono text-[10.5px] font-medium text-white backdrop-blur-md">{formatClock(lesson.durationMs)}</span>
      ) : null}
      {progress && progress > 0 ? (
        <span className="absolute inset-x-0 bottom-0 h-[3px] bg-white/15" aria-label={`Visto ${Math.round(progress)}%`}>
          <span className="bar-fill block h-full bg-white shadow-[0_0_10px_#fff]" style={{ width: `${Math.min(100, progress)}%` }} />
        </span>
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
  const tone = s.tone === "soon" ? "border-white/20 text-ink" : "";
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
    <Link href={`/cursos/${course.slug}`} className="group card lift block overflow-hidden">
      <CourseCover course={course} src={cover} className="aspect-[16/9] transition duration-700 group-hover:brightness-125" />
      <div className="space-y-3 p-5">
        <h3 className="line-clamp-2 min-h-[2.75rem] text-[15px] font-semibold leading-snug tracking-[-0.01em] text-ink">{splitEmoji(course.title).text}</h3>
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
      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white text-black shadow-[0_0_14px_-2px_#ffffffaa]" title="Completada">
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

/** Pone la última palabra del título en serif cursiva, para mezclar tipografías. */
export function SerifTail({ text }: { text: string }) {
  const i = text.lastIndexOf(" ");
  if (i < 0) return <em>{text}</em>;
  return (
    <>
      {text.slice(0, i + 1)}
      <em>{text.slice(i + 1)}</em>
    </>
  );
}
