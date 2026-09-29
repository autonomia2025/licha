/** Esqueleto mientras carga una página (se muestra al instante al navegar). */
export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl animate-fade px-4 py-10 sm:px-6 lg:px-8" aria-busy="true" aria-label="Cargando">
      <div className="skeleton h-3 w-28 rounded-full" />
      <div className="skeleton mt-5 h-14 w-2/3 max-w-xl rounded-2xl" />
      <div className="skeleton mt-4 h-4 w-1/2 max-w-md rounded-full" />
      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="glass overflow-hidden" style={{ animationDelay: `${i * 80}ms` }}>
            <div className="skeleton aspect-[16/9] rounded-none" />
            <div className="space-y-3 p-5">
              <div className="skeleton h-4 w-3/4 rounded-full" />
              <div className="skeleton h-3 w-1/2 rounded-full" />
              <div className="skeleton h-1 w-full rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
