import Link from "next/link";
import { Search, SearchX } from "lucide-react";
import { EmptyState } from "@/components/States";
import { KindIcon, StatusChip } from "@/components/ui";
import { searchLessons } from "@/lib/data";
import { formatClock, splitEmoji } from "@/lib/format";

export const metadata = { title: "Buscar" };

const SUGGESTIONS = ["ganchos", "testing", "UGC", "copy", "ofertas", "escalar"];

export default async function SearchPage({ searchParams }: PageProps<"/buscar">) {
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw ?? "").slice(0, 80);
  const results = q ? await searchLessons(q) : [];

  return (
    <div>
      {q && results.length ? (
        <p className="mt-6 text-sm text-muted" role="status">
          {results.length} {results.length === 1 ? "resultado" : "resultados"} para “{q}”
        </p>
      ) : null}
      {q && !results.length ? (
        <EmptyState
          icon={SearchX}
          title={`No encontramos clases para “${q}”`}
          className="mt-4"
          action={SUGGESTIONS.map((s) => (
            <Link key={s} href={`/buscar?q=${encodeURIComponent(s)}`} className="chip transition-colors duration-150 hover:border-white/30 hover:text-ink active:scale-95">
              {s}
            </Link>
          ))}
        >
          Prueba con otra palabra, con menos palabras o con el título original en inglés. Algunas ideas:
        </EmptyState>
      ) : null}
      {!q ? (
        <EmptyState
          icon={Search}
          title="Busca en todo el programa"
          className="mt-4"
          action={SUGGESTIONS.map((s) => (
            <Link key={s} href={`/buscar?q=${encodeURIComponent(s)}`} className="chip transition-colors duration-150 hover:border-white/30 hover:text-ink active:scale-95">
              {s}
            </Link>
          ))}
        >
          Todas las clases de todos los cursos, en español o por su título original.
        </EmptyState>
      ) : null}

      <ul className="mt-4 space-y-2">
        {results.slice(0, 60).map(({ course, lesson }, i) => (
          <li key={lesson.id} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 6) * 30}ms` }}>
            <Link href={`/cursos/${course.slug}/${lesson.id}`} className="card lift flex items-center gap-4 p-4">
              <span className="grid size-10 shrink-0 place-items-center rounded-full border border-white/10 bg-white/[0.05] text-muted">
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
