# Auditoría técnica: migración autorizada de un curso de Skool

> Etapa 1: **auditoría y descubrimiento**. No se ha descargado ningún video ni archivo, ni se ha migrado nada.

## 0. Estado real de esta auditoría (léelo primero)

**No se pudo inspeccionar tu curso desde el entorno cloud de esta sesión**, por dos motivos:

1. La política de red del contenedor bloquea `skool.com` (el proxy devuelve 403).
2. El contenedor no tiene tu sesión de Skool. Tampoco sería correcto pedirte que pegues cookies aquí.

Por eso **no invento un "ejemplo real"**. En su lugar entrego:

- **`tools/skool-audit/`**: una sonda de solo lectura que ejecutas en tu Mac con tu sesión. Verifica automáticamente cada punto de esta auditoría y genera `out/report.md`. Está probada de punta a punta contra un servidor simulado: 0 bytes de video recibidos, segmentos bloqueados y ningún token en la salida.
- Este documento, con cada afirmación etiquetada:

| Etiqueta | Significado |
|---|---|
| ✅ **CONFIRMADO** | Lo observaste tú manualmente en este curso. |
| 🔶 **HIPÓTESIS** | Conocimiento previo de cómo suele funcionar Skool o sus proveedores. **No verificado en ESTE curso.** |
| 🔍 **LO VERIFICA LA SONDA** | Campo concreto del informe que lo confirmará o refutará. |

---

## 1. Estructura

```
Grupo Skool (/<grupo>)
└─ Classroom (/<grupo>/classroom)                      → lista de cursos
   └─ Curso      unitType "course"  (/<grupo>/classroom/<slug-curso>)
      └─ Módulo  unitType "set"      (carpeta/sección)
         └─ Lección unitType "module" (?md=<lessonId>)   ← ojo: Skool llama "module" a la lección
            ├─ metadata.title / metadata.desc
            ├─ Video: nativo (HLS firmado) | videoLink externo (YouTube/Vimeo/Loom/Wistia…)
            │   ├─ variantes 1080p / 720p / 480p / 270p
            │   ├─ audio separado
            │   └─ subtítulos: subtitles.m3u8 → segmentos WebVTT
            └─ Recursos/adjuntos: metadata.resources (JSON: archivo o enlace)
```

| Punto | Estado | Detalle |
|---|---|---|
| Skool es una app Next.js que embebe los datos de la página en `<script id="__NEXT_DATA__">` | 🔶 | 🔍 `classroom.next_data_present`, `courses[].tree_json_path` |
| El árbol del curso completo viene en `pageProps` de la página del curso (sin paginación) | 🔶 | 🔍 `courses[].counts` vs `order_check.dom_ids` |
| Nodos con la forma `{ course: {id, name, unitType, metadata}, children: [...] }` | 🔶 | 🔍 `courses[].key_frequency` (claves reales por `unitType`, sin valores) |
| `unitType`: `course` → `set` (módulo) → `module` (lección) | 🔶 | 🔍 `key_frequency` |
| Lecciones sueltas directamente bajo el curso, sin módulo | 🔶 posible | La sonda las agrupa como "(lecciones sin módulo)" y conserva `course_position`. |
| **Orden** = posición en el arreglo `children` | 🔶 | 🔍 `structure.order_fields_seen` (si aparece un campo `position`/`order`…) y `order_check.same_relative_order` (JSON vs sidebar del DOM) |
| IDs: `id` hexadecimal de 32 caracteres (estable); el `name` del curso es el slug corto de la URL | 🔶 | 🔍 `samples[].lesson.id`, `courses[].course` |
| URL estable de la lección: `/<grupo>/classroom/<slug>?md=<lessonId>` | 🔶 | 🔍 `samples[].lesson.title_visible_in_page` confirma que esa URL abre la lección correcta. |
| Bloqueos por nivel o drip (`hasAccess`, `locked`, `minTier`…) | 🔶 | 🔍 `access_flags` por curso/módulo/lección |

**Fuente de verdad propuesta para el orden:** el JSON del árbol del curso que la propia página entrega (orden de `children`), **validado** contra el orden del sidebar del DOM. La sonda hace esa comparación automáticamente. No habrá que introducir el orden a mano si `same_relative_order = true` en todos los cursos.

## 2. Información por lección

| Campo | Fuente probable | Estado |
|---|---|---|
| title | `metadata.title` | 🔶 / 🔍 |
| description | `metadata.desc` (texto enriquecido; posiblemente un formato propio con prefijo `[v2]`, o markdown/HTML) | 🔶 · 🔍 `description.format`, `link_count`, `image_count` |
| position | índice en `children` | 🔶 · 🔍 |
| lesson_id / lesson_url | `id` / `?md=` | 🔶 · 🔍 |
| video (externo) | `metadata.videoLink` | 🔶 · 🔍 `video.video_link_provider` |
| video (nativo) | campo tipo `videoId`/`videoLenMs`/`videoThumbnail` + llamada adicional para la URL firmada | 🔶 · 🔍 `video.fields`, `hls.manifest_url_source` |
| adjuntos | `metadata.resources` (string JSON con `title`, `file_id`/`file_name`/`file_content_type` o `link`) | 🔶 · 🔍 `attachments_in_tree`, `dom.file_links` |
| imágenes | dentro de la descripción y como miniatura del video | 🔶 · 🔍 `description.image_count`, `dom.large_images` |
| enlaces externos | descripción y recursos de tipo enlace | 🔍 `dom.external_links` |

Además, la sonda compara el JSON de la página de **cada lección** con el árbol del curso (`lesson_page_extra_metadata_keys`) para detectar si la lección trae campos que el árbol no incluye.

## 3. Videos

| Pregunta | Estado |
|---|---|
| Video nativo servido por HLS: 1080p/720p/480p/270p, audio separado, subtítulos "English CC" en playlist aparte, URLs firmadas | ✅ **CONFIRMADO** (tu inspección manual de una clase) |
| Esa escalera exacta (incluido el 270p) con audio y subtítulos como grupos separados coincide con la que genera **Mux**; las firmas suelen ser un JWT en `?token=` con `exp` | 🔶 hipótesis fuerte, no verificada · 🔍 `hls.master_host`, `master_signature.jwt:token.aud` (`"v"` sería típico de Mux) |
| ¿El manifest aparece en el HTML inicial? | 🔍 `manifest_in_initial_html`, `media_refs_in_next_data` |
| ¿Se obtiene con una llamada adicional a la API? | 🔍 `hls.manifest_url_source` (endpoint cuya respuesta contiene la URL del master) y `api_calls[].json_shape` |
| ¿Hay un identificador estable del video? | 🔍 `master_path_id_hash` (hash del path; si se repite entre ejecuciones, el ID es estable) y `manifest_id_matches_metadata_keys` (qué campo de metadata contiene ese ID) |
| ¿Cuánto viven las URLs firmadas? | 🔍 `master_signature.*.ttl_s` / `expires_in_s` |
| ¿Hace falta sesión para leer el manifest una vez firmado? | 🔍 `master_status_without_cookies`: 200 significa que la URL firmada basta y un worker en cloud solo la necesita a ella; 401/403 significa que hacen falta cookies. |
| ¿Hace falta pulsar play? | 🔍 `play_click` (`null` significa que el manifest se cargó solo) |
| ¿Todos los videos son nativos? | 🔍 `courses[].counts.video_providers` sobre **todas** las lecciones |

## 4. Subtítulos

| Pregunta | Estado |
|---|---|
| Referencia a `subtitles.m3u8` como `#EXT-X-MEDIA:TYPE=SUBTITLES` dentro del master | ✅ confirmado en una clase · 🔍 en cada lección de la muestra |
| Idiomas | 🔍 `hls.subtitles[].language` / `name` (`DEFAULT`, `AUTOSELECT`, `FORCED` y `CHARACTERISTICS` también se registran) |
| ¿Se obtienen sin descargar el video? | Sí, son playlists independientes. 🔍 `subtitles[].playlist_status`, `segments.segment_count` |
| Formato final | 🔶 WebVTT · 🔍 `first_segment_check.is_webvtt`, `has_timestamp_map` |
| Subtítulos CEA-608 incrustados en el video | 🔍 `closed_captions_608` (si existieran, no se podrían extraer sin procesar el video) |
| ¿Se pueden guardar como archivo en Supabase Storage? | Sí. Se concatenan los segmentos `.vtt` en un solo archivo por idioma, se normalizan con `X-TIMESTAMP-MAP` y se guardan como `lessons/<id>/subtitles/<lang>.vtt`. Nuestro reproductor los carga con `<track kind="subtitles">` o como pista del HLS, y así se puede activar o desactivar el CC. |

## 5. Documentos y archivos

🔶 Las lecciones de Skool pueden tener "recursos" de dos tipos: **archivo subido** (PDF, ZIP, imágenes, documentos) y **enlace**. La sonda:

- lee `metadata.resources` (o cualquier clave `resource|attach|file|download`) y registra título, tipo, nombre de archivo, content-type y host (🔍 `attachments_in_tree`);
- escanea el DOM de la lección en busca de enlaces a archivos (`download`, extensiones `.pdf/.zip/.docx/…`) y enlaces externos (🔍 `dom.file_links`, `dom.external_links`);
- **no** descarga nada. Pendiente: si los archivos subidos se resuelven con otra llamada firmada (p. ej. `file_id` → URL temporal). Se verá en `api_calls` al abrir una lección con adjuntos.

## 6. Autenticación

| Pregunta | Estado |
|---|---|
| ¿Depende de cookies? | 🔶 Sí: cookie de sesión HttpOnly en `.skool.com`, probablemente un JWT · 🔍 `auth.cookies` (solo nombre, flags, caducidad y si parece JWT) |
| ¿Hay tokens o headers extra en las APIs? | 🔍 `network-summary.json → request_header_names` (solo nombres: `cookie`, `authorization`, `x-…`) |
| ¿Hay un endpoint JSON aprovechable sin navegador? | 🔍 `next_data_endpoint`: prueba `/_next/data/<buildId>/…json` con sesión y sin cookies |
| ¿El proceso puede correr en cloud? | Probablemente sí, con una sesión exportada (ver §8). El login en sí no se automatiza: puede haber código por email o captcha, y no los vamos a evadir. |

---

## 7. Esquema conceptual de inventario (no son tablas definitivas)

```
course         id, slug, title, description, cover_image, source_group, access_flags, position
module         id, course_id, position, title, access_flags
lesson         id, module_id, course_id, position, title, description_raw, description_format,
               lesson_url, access_flags, source_metadata_keys[]
video          lesson_id, provider (skool-native|youtube|vimeo|loom|wistia|…),
               source_video_id (estable), external_url (si es externo), duration_ms, thumbnail_url,
               available_qualities[], has_separate_audio, manifest_source_endpoint,
               signed_url_ttl_s, status (discovered|processing|stored|failed), checksum, storage_path
subtitle_track lesson_id, language, name, is_default, is_autoselect, is_forced, format (webvtt),
               segment_count, duration_s, storage_path, status
attachment     lesson_id, kind (file|link), title, file_name, content_type, source_file_id,
               external_url, size_bytes (cuando se conozca), storage_path, status
asset          lesson_id, kind (image|thumbnail), source_url_redacted, storage_path, status
audit_run      id, started_at, tool_version, counts, safety (media_bytes_received), notes
```

Principios: los IDs de Skool se usan como claves de idempotencia, `position` se guarda explícitamente, cada pieza tiene su propio `status` para reintentar, y nunca se persisten URLs firmadas.

## 8. Flujo técnico propuesto (solo arquitectura)

```
[1] Sesión autorizada
    Login manual una vez (navegador local) → exportar storageState de Playwright
    → guardarlo cifrado como secreto del worker (nunca en el repo) → caduca y se renueva a mano.
[2] Descubrimiento (barato; sin video)
    Por curso: cargar página → JSON del árbol → course/module/lesson + position
    → validar orden contra el DOM → upsert en inventario (status = discovered).
[3] Metadata por lección
    Abrir ?md=<id> → descripción, recursos, proveedor de video, ID estable del video.
[4] Resolver manifest (justo antes de procesar)
    Llamar al mismo endpoint que usa la página → URL firmada fresca (TTL medido por la sonda).
[5] Procesar video (por lección; fuera del Mac)
    ffmpeg -i master.m3u8 -map de la variante elegida (p. ej. 1080p + audio) -c copy → MP4,
    o conservar HLS (todas las variantes) según cómo queramos servirlo.
    Directorio temporal por lección; ejecución en worker con disco efímero.
[6] Subtítulos
    subtitles.m3u8 → concatenar segmentos .vtt → <lang>.vtt único → validar (WEBVTT, nº de cues, duración ≈ video).
[7] Subir a Supabase Storage
    lessons/<lessonId>/video/…, lessons/<lessonId>/subtitles/<lang>.vtt, lessons/<lessonId>/files/…
[8] Guardar metadata en Supabase (status = stored, checksum, duración, tamaño)
[9] Verificar
    Duración del video ≈ videoLenMs, variantes presentes, VTT parseable, adjuntos con tamaño > 0, conteos vs inventario.
[10] Limpiar el temporal y marcar la lección como completa. Reanudable por lección.
```

Decisión pendiente para el paso [5] o [7]: **Supabase Storage no transcodifica ni es un CDN de video**. Servir HLS desde Storage exige firmar muchos segmentos pequeños, y servir un MP4 grande obliga a revisar el límite de tamaño por archivo del plan. Hay que decidir entre MP4 progresivo en Storage o HLS en Storage/otro servicio de video, antes de construir el migrador.

## 9. Riesgos e incógnitas

1. **Nada de este curso está verificado todavía, salvo tu inspección manual.** Toda la estructura de §1 es hipótesis hasta ejecutar la sonda.
2. **Mezcla de proveedores**: algunas lecciones pueden usar YouTube, Vimeo, Loom o Wistia en lugar de video nativo. Cada una exige otro tratamiento (y otros derechos).
3. **Lecciones sin video** (solo texto o recursos) y **lecciones sin subtítulos**: la sonda da conteos, pero los subtítulos solo se ven al abrir cada lección. Hacerlo para las ~500 exige una pasada de "solo manifests", que es barata porque no descarga video.
4. **Idiomas**: se confirmó English CC en una clase; no sabemos si hay otros idiomas ni si todos los videos tienen subtítulos.
5. **Paginación o carga perezosa**: si un curso muy grande no trae el árbol completo en el JSON inicial, lo detectaremos con `order_check.dom_ids` ≠ número de lecciones en JSON.
6. **Drip o niveles**: algunas lecciones pueden estar bloqueadas para tu cuenta. La migración solo cubre lo que tu cuenta ve legítimamente.
7. **Caducidad de URLs firmadas**: por eso el manifest debe resolverse justo antes de procesar cada video.
8. **Sesión desde cloud**: la cookie puede caducar, invalidarse por IP o dispositivo, o exigir revalidación. Hay que medir la caducidad (`auth.cookies[].expires_in_days`) y probar si una sesión exportada funciona desde otra IP.
9. **Rate limiting o detección de automatización** en Skool: el ritmo debe ser humano y secuencial.
10. **Formato del texto enriquecido** de las descripciones: hará falta un conversor a HTML o Markdown para nuestra app.
11. **Adjuntos subidos**: aún no sabemos si se resuelven con una URL firmada adicional.
12. **Legal / Términos de Skool**: tener acceso como alumno no equivale automáticamente a tener derecho a extraer y rehospedar el contenido. Conviene tener por escrito la autorización del propietario del curso antes de la etapa de migración.
13. **Selectores del DOM** (botón de play, sidebar): son heurísticos y pueden cambiar. La fuente principal debe ser el JSON, no el DOM.

## 10. Conclusión

| # | Pregunta | Respuesta basada en la evidencia disponible |
|---|---|---|
| 1 | ¿Detectar automáticamente el primer módulo? | **Muy probablemente sí** (primer `set` del árbol JSON). Pendiente de confirmar con la sonda (`structure.modules[0]`). |
| 2 | ¿Detectar automáticamente la primera lección? | **Muy probablemente sí** (primer hijo del primer módulo; URL `?md=<id>`). La sonda confirma que esa URL abre la lección (`title_visible_in_page`). |
| 3 | ¿Orden completo automático? | **Probable**: orden de `children` validado contra el sidebar. Se confirma cuando `same_relative_order = true` y `dom_ids_in_json = dom_ids` en todos los cursos. |
| 4 | ¿Detectar videos automáticamente? | **Sí para detectar y clasificar** (metadata + manifest capturado de la red). ✅ HLS nativo confirmado en una clase. Falta saber qué endpoint entrega la URL firmada y si todas las lecciones usan el mismo sistema. |
| 5 | ¿Detectar subtítulos automáticamente? | **Sí, si el video es HLS nativo**: vienen declarados en el master (`TYPE=SUBTITLES`) y se pueden leer sin tocar el video. Falta saber cuántos videos los tienen y en qué idiomas. |
| 6 | ¿Detectar documentos o archivos automáticamente? | **Probable** (metadata de recursos + DOM). Falta ver cómo se resuelve la URL de descarga de un archivo subido. |
| 7 | ¿Qué falta investigar? | Ejecutar la sonda en este curso y revisar: la forma real del JSON, el endpoint del manifest, el TTL de las firmas, si el manifest funciona sin cookies, los proveedores de video, los idiomas de subtítulos, cómo se resuelven los adjuntos, la caducidad de la sesión y el formato de las descripciones. Después, una pasada de **solo manifests** sobre las ~500 lecciones para tener conteos exactos de video, subtítulos e idiomas. Y confirmar la autorización del propietario del curso. |
| 8 | ¿Siguiente paso técnico? | **Ejecutar `tools/skool-audit` en tu Mac** (ver su README), empezando por `--modules 2 --lessons 5`, y compartir `out/report.md` y `out/inventory.json`. No contienen secretos, pero sí títulos del curso. Con eso reescribo este documento con evidencia real y un ejemplo real, y decidimos el esquema definitivo y la estrategia de almacenamiento de video. |
