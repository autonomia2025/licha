import Link from "next/link";
import { Search } from "lucide-react";
import { KindIcon, StatusChip } from "@/components/ui";
import { searchLessons } from "@/lib/data";
import { formatClock, splitEmoji } from "@/lib/format";

export const metadata = { title: "Buscar" };

export default async function SearchPage({ searchParams }: PageProps<"/buscar">) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").slice(0, 80);
  const results = q ? await searchLessons(q) : [];

  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <form action="/buscar" role="search" className="relative animate-fade-up">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-subtle" aria-hidden />
        <input
          name="q"
          type="search"
          defaultValue={q}
          autoFocus
          placeholder="¿Qué quieres aprender? Ej: ganchos, testing, UGC…"
          aria-label="Buscar clases"
          className="h-14 w-full rounded-2xl border border-line bg-surface pl-12 pr-4 text-base text-ink placeholder:text-subtle outline-none transition focus:border-accent/60"
        />
      </form>

      {q ? (
        <p className="mt-6 text-sm text-muted">
          {results.length ? `${results.length} ${results.length === 1 ? "resultado" : "resultados"} para “${q}”` : `No encontramos clases para “${q}”. Prueba con otra palabra.`}
        </p>
      ) : (
        <p className="mt-6 text-sm text-muted">Busca en todas las clases de todos los cursos, en español o por su título original.</p>
      )}

      <ul className="mt-4 space-y-2">
        {results.slice(0, 60).map(({ course, lesson }) => (
          <li key={lesson.id}>
            <Link href={`/cursos/${course.slug}/${lesson.id}`} className="card flex items-center gap-4 p-4 transition hover:border-line-strong">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-3 text-muted">
                <KindIcon lesson={lesson} className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{lesson.title}</p>
                <p className="mt-0.5 truncate text-xs text-subtle">
                  {splitEmoji(course.title).text} · Clase {lesson.number}
                  {lesson.durationMs ? ` · ${formatClock(lesson.durationMs)}` : ""}
                </p>
              </div>
              <StatusChip lesson={lesson} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
