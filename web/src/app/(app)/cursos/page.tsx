import { CourseCard } from "@/components/ui";
import { courseProgress, getLibrary, getProgress, signPaths } from "@/lib/data";
import { formatDuration, plural } from "@/lib/format";

export const metadata = { title: "Cursos" };

export default async function CoursesPage() {
  const [library, progress] = await Promise.all([getLibrary(), getProgress()]);
  const signed = await signPaths(library.map((c) => c.coverPath));
  const totalLessons = library.reduce((s, c) => s + c.lessonCount, 0);
  const totalMs = library.reduce((s, c) => s + c.durationMs, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <header className="animate-fade-up">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-strong">Biblioteca</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">Cursos</h1>
        <p className="mt-3 max-w-2xl text-muted">
          {plural(library.length, "curso", "cursos")} · {plural(totalLessons, "clase", "clases")}
          {totalMs ? ` · ${formatDuration(totalMs)} de contenido` : ""}. Empieza por el primero y avanza en orden: cada curso construye sobre el anterior.
        </p>
      </header>
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {library.map((c, i) => (
          <div key={c.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
            <CourseCard course={c} cover={c.coverPath ? signed[c.coverPath] : undefined} progress={courseProgress(c, progress)} />
          </div>
        ))}
      </div>
    </div>
  );
}
