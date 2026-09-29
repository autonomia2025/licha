import { Loader2 } from "lucide-react";

/**
 * Contenido de un botón con estado de carga: la etiqueta se desvanece y aparece un spinner en su
 * lugar, sin cambiar el tamaño del botón. El botón padre debe llevar aria-busy={loading}.
 */
export function BtnContent({ children, spinner = "size-4" }: { children: React.ReactNode; spinner?: string }) {
  return (
    <>
      <span className="btn-label">{children}</span>
      <span className="btn-spinner" aria-hidden>
        <Loader2 className={`${spinner} animate-spin`} />
      </span>
    </>
  );
}

/**
 * Alterna entre etiquetas reservando el ancho de la más larga (evita que el botón "salte").
 * Solo se ve la etiqueta activa; el cambio es un fundido corto.
 */
export function SwapLabel({ active, labels }: { active: number; labels: React.ReactNode[] }) {
  return (
    <span className="inline-grid">
      {labels.map((l, i) => (
        <span
          key={i}
          aria-hidden={i !== active}
          className={`col-start-1 row-start-1 inline-flex items-center justify-center gap-2 transition-[opacity,transform] duration-200 ease-[var(--ease-out)] ${
            i === active ? "opacity-100" : "pointer-events-none translate-y-1 opacity-0"
          }`}
        >
          {l}
        </span>
      ))}
    </span>
  );
}
