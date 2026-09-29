# Sistema de motion y estados de la UI

Principio: **cada animación orienta, confirma, anticipa o suaviza un cambio**. Si no cumple ninguna de
esas funciones, no se agrega. Todo con `opacity` y `transform`; nada de rebotes ni blur en animaciones.

## Tiempos y curvas (`src/app/globals.css`, `@theme`)

| Token      | Valor  | Uso |
|------------|--------|-----|
| `--dur-1`  | 120 ms | hover, press, toggles, filas de lista |
| `--dur-2`  | 200 ms | cambios de estado (colores, iconos, pestañas, spinner en botón, menús) |
| `--dur-3`  | 260 ms | entrada de elementos (alertas, toasts, contenido nuevo, filas, `<details>`) |
| `--dur-4`  | 320 ms | modales y overlays |

- Entradas: `--ease-out` · Salidas: `--ease-in` y ~60 % de la duración de entrada.
- Transición de página (View Transitions): sale en 140 ms, entra en 260 ms con 8 px de desplazamiento.
  La cabecera no se anima.
- `prefers-reduced-motion`: se eliminan desplazamientos y animaciones decorativas; los cambios de estado
  ocurren al instante y los spinners siguen girando.

## Patrones (usar estos, no inventar otros)

| Necesito… | Usar |
|-----------|------|
| Botón | `.btn` + `.btn-primary` / `.btn-ghost` (`.btn-sm` compacto). Hover solo cambia fondo; press = `scale(.97)` |
| Botón con acción async | `aria-busy={pending}` en el botón + `<BtnContent>` adentro (spinner sobre la etiqueta; no cambia el tamaño) |
| Etiqueta que cambia ("Guardar" → "Guardada") | `<SwapLabel active labels>` (reserva el ancho de la más larga) |
| Botón de icono | `.icon-btn` |
| Tarjeta clicable | `.card .lift` (sube 2 px solo con mouse; se hunde al presionar) |
| Fila de lista clicable | `.row` |
| Menú / popover | `usePresence(open)` + `data-state` + clase `.surface` |
| Modal | `usePresence(open)` + `.overlay` (fondo) + `.modal` (panel) |
| Aviso tras una acción | `toast("Nota eliminada")`, `toast.error("…", { label: "Reintentar", onClick })` |
| Error en formulario | `aria-invalid` en el input + `<p role="alert" className="alert alert-error">` |
| Éxito en formulario | `<p role="status" className="alert alert-ok">` |
| Lista/página cargando | `loading.tsx` con esqueletos de `src/components/skeletons` (misma geometría que el contenido) |
| Link a página no precargada | `<LinkPending />` dentro del `<Link>` (spinner mientras navega) |
| Sin datos | `<EmptyState icon title action>` |
| Error de carga | `error.tsx` → `<ErrorView>` con "Reintentar" |
| Imagen | `<FadeImg>` dentro de un contenedor con tamaño reservado |
| Entrada de sección | `animate-fade-up` (máx. 120 ms de retraso acumulado); listas: 30 ms por ítem, máx. 6 |
