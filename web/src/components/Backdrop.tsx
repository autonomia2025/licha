/**
 * Fondo de la app: luces suaves, cuadrícula y grano. Es ESTÁTICO a propósito: un fondo animado o que
 * sigue al cursor obliga al navegador a recalcular cada frame todos los desenfoques (backdrop-filter)
 * que hay encima, y en Windows/GPU integradas eso se siente como mouse lento.
 */
export function Backdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      <div className="backdrop-lights" />
      <div className="backdrop-grid" />
      <div className="backdrop-grain" />
    </div>
  );
}
