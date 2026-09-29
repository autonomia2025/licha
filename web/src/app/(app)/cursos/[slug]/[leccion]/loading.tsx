/** Esqueleto de la página de clase: video, título y temario lateral. */
export default function Loading() {
  return (
    <div className="mx-auto grid max-w-7xl animate-fade gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8 lg:py-8" aria-busy="true" aria-label="Cargando clase">
      <div>
        <div className="skeleton aspect-video w-full rounded-3xl" />
        <div className="skeleton mt-8 h-3 w-40 rounded-full" />
        <div className="skeleton mt-4 h-10 w-3/4 rounded-2xl" />
        <div className="mt-4 flex gap-2">
          <div className="skeleton h-7 w-24 rounded-full" />
          <div className="skeleton h-7 w-20 rounded-full" />
        </div>
        <div className="skeleton mt-8 h-11 w-72 rounded-full" />
      </div>
      <div className="glass hidden space-y-4 p-5 lg:block">
        <div className="skeleton h-4 w-2/3 rounded-full" />
        <div className="skeleton h-1 w-full rounded-full" />
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-3 pt-2">
            <div className="skeleton size-6 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-5/6 rounded-full" />
              <div className="skeleton h-2.5 w-1/4 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
