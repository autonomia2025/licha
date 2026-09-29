/* Esqueletos de carga. Cada uno imita la geometría de su página para que, al llegar los datos,
   el contenido ocupe el mismo lugar (sin saltos). */

const Bar = ({ className = "" }: { className?: string }) => <div className={`skeleton rounded-full ${className}`} />;

export function CourseCardSkeleton() {
  return (
    <div className="glass overflow-hidden">
      <div className="skeleton aspect-[16/9] rounded-none" />
      <div className="space-y-3 p-5">
        <Bar className="h-4 w-3/4" />
        <Bar className="h-4 w-1/2" />
        <Bar className="mt-4 h-3 w-2/3" />
        <Bar className="h-1 w-full" />
      </div>
    </div>
  );
}

export function PageHeaderSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div>
      <Bar className="h-3 w-24" />
      <div className={`skeleton mt-5 h-12 rounded-2xl sm:h-16 ${wide ? "w-4/5" : "w-2/3"} max-w-2xl`} />
      <Bar className="mt-5 h-4 w-1/2 max-w-md" />
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8" aria-busy="true" aria-label="Cargando inicio">
      <PageHeaderSkeleton />
      <div className="glass mt-10 grid overflow-hidden md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="skeleton aspect-video rounded-none md:aspect-auto md:min-h-80" />
        <div className="space-y-4 p-6 sm:p-8">
          <Bar className="h-3 w-40" />
          <Bar className="h-4 w-48" />
          <div className="skeleton h-9 w-4/5 rounded-xl" />
          <Bar className="h-7 w-28" />
          <Bar className="h-1 w-full" />
          <Bar className="h-11 w-36" />
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="glass h-56 p-5">
          <Bar className="h-10 w-48" />
        </div>
        <div className="glass h-56 p-5">
          <Bar className="h-10 w-40" />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="glass flex h-[76px] items-center gap-4 p-4 last:col-span-2 sm:h-[84px] sm:last:col-span-1">
            <div className="skeleton size-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Bar className="h-3 w-24" />
              <Bar className="h-5 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CoursesSkeleton() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8" aria-busy="true" aria-label="Cargando cursos">
      <PageHeaderSkeleton wide />
      <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <CourseCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

export function CourseSkeleton() {
  return (
    <div aria-busy="true" aria-label="Cargando curso">
      <div className="mx-auto grid max-w-7xl items-center gap-8 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1fr)_380px] lg:px-8 lg:py-16">
        <div>
          <Bar className="h-7 w-20" />
          <Bar className="mt-6 h-3 w-24" />
          <div className="skeleton mt-4 h-12 w-3/4 rounded-2xl sm:h-16" />
          <div className="mt-5 flex gap-2">
            <Bar className="h-7 w-24" />
            <Bar className="h-7 w-24" />
            <Bar className="h-7 w-20" />
          </div>
          <Bar className="mt-8 h-3 w-full max-w-md" />
          <Bar className="mt-3 h-1 w-full max-w-md" />
          <Bar className="mt-8 h-11 w-44" />
        </div>
        <div className="skeleton hidden aspect-[16/10] rounded-3xl md:block" />
      </div>
      <div className="mx-auto max-w-5xl space-y-3 px-4 py-12 sm:px-6 lg:px-8">
        <div className="skeleton mb-6 h-10 w-52 rounded-2xl" />
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="glass flex h-[82px] items-center gap-4 p-5">
            <div className="skeleton size-11 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Bar className="h-2.5 w-20" />
              <Bar className="h-4 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SearchSkeleton() {
  return (
    <div aria-busy="true" aria-label="Buscando">
      <Bar className="mt-6 h-3.5 w-56" />
      <div className="mt-4 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="glass flex h-[74px] items-center gap-4 p-4">
            <div className="skeleton size-10 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Bar className="h-4 w-2/3" />
              <Bar className="h-3 w-1/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
