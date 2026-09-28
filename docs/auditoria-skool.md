# Auditoría técnica: migración autorizada del Skool `evolve-8484`

> Etapa 1: **auditoría y descubrimiento**. No se ha descargado ningún video ni archivo, ni se ha migrado nada.
> Evidencia: ejecución de `tools/skool-audit` en el Mac del usuario, con su sesión (28-09-2026).
> **Bytes de video/audio recibidos: 0.** Hubo 41 peticiones de segmentos y reproductores externos, todas bloqueadas antes de salir.

Leyenda: ✅ verificado con la sonda en este Skool · 🔶 inferencia razonable, aún no verificada · ❓ desconocido.

---

## 1. Estructura detectada ✅

```
Grupo "evolve-8484"
└─ Classroom: 14 cursos                     pageProps.allCourses
   └─ Curso      unitType "course"           /evolve-8484/classroom/<name: 8 hex>   (p. ej. fc758841)
      └─ Módulo  unitType "set"              79 en total
         └─ Lección unitType "module"        763 en total · /…/<curso>?md=<id: 32 hex>
            ├─ metadata.title
            ├─ metadata.desc                 formato Skool "[v2]" (solo 9 lecciones)
            ├─ metadata.videoId              → video nativo Skool (Mux)
            ├─ metadata.videoLink            → Loom / YouTube / Vimeo cuando es externo
            ├─ metadata.videoLenMs, videoThumbnail
            └─ metadata.resources            string JSON (casi siempre vacío)
               Video nativo → master HLS en stream.video.skool.com (firmado, ~24 h)
                  ├─ variantes (varían por video): 1080/720/480/270, 1080/480/270 o 1078/480/270
                  ├─ audio separado (grupo AUDIO)
                  └─ subtítulos "English CC" [en] → subtitles.m3u8 → N segmentos .vtt (WebVTT)
```

- **Fuente de verdad del contenido y del orden**: `__NEXT_DATA__ → props.pageProps.course` en la página de cada curso. Es un árbol `{ course: {...}, children: [...] }` con **todo** el curso en una sola carga, sin paginación.
- **Orden**: no existe ningún campo `position` u `order`; el orden es **la posición en el arreglo `children`**. Se validó contra la barra lateral en los 14 cursos (`same_relative_order = true` en todos).
- **Campos de cada nodo**: `id, name, unitType, parentId, rootId, groupId, userId, state, public, createdAt, updatedAt, metadata`. `parentId` y `rootId` permiten reconstruir el árbol sin depender del anidamiento.
- **Cursos de un solo nivel**: `992407ee`, `02e27f05` y `70956291` no tienen `set`; sus lecciones cuelgan directamente del curso. El inventario los trata como un "módulo implícito".
- **Control de acceso** (en metadata): `hasAccess`, `lockFreeTrial`, `privacy`, `minTier`, `minAccessLevel`, `dripConfig`/`dripDays`, y `amount`/`currency`/`billingProductId` en cursos de pago aparte.
- La URL `/_next/data/<buildId>/…json` responde 200, pero **no** contiene el árbol. No sirve como API; hay que usar la página.

## 2. Ejemplo real (curso `fc758841` "👣 Evolve (Start Here)", 14 módulos / 177 lecciones)

**Módulo 1: 👋 Start Here**
1. 🆕 Start Here: Overview Of Evolve · descripción: no · video: nativo (Mux) · HLS: sí, 1080/720/480/270 + audio · subtítulos: English (44 segmentos WebVTT) · archivos: 0
2. 🆕 Win The $100k/Day Award · descripción: no · video: tiene `videoId` y `videoLink` · **HLS: no detectado** ❓ · archivos: 0
3. 90 Seconds Tip to Hit $1m/Month · descripción: no · video: nativo · HLS: sí, 1080/480/270 · subtítulos: English (3) · archivos: 0
4. 📌 100+ Winning Ads Document · descripción: no · video: nativo · HLS: sí, 1080/480/270 · subtítulos: English (20) · archivos: 0 · 1 enlace externo
5. 📌 100+ Hook Templates (From Ads Doc) · descripción: no · video: nativo · HLS: sí, 1080/720/480/270 · subtítulos: English (5) · archivos: 0 · 1 enlace externo

**Módulo 2: 🧠 Why Ads Work (Psychology)**
1. Overview Of Psychology · video: nativo · HLS: 1078/480/270 · subtítulos: English (4)
2. Market Desires · video: nativo · HLS: 1078/480/270 · subtítulos: English (35)
3. Market Awareness · **descripción: sí** (formato `[v2]`, 414 caracteres, 2 enlaces) · video: nativo · HLS: 1078/480/270 · subtítulos: English (37)
4. Understanding Unaware + Awareness Levels · **HLS: no detectado** ❓
5. Market Sophistication · video: nativo · HLS: 1078/480/270 · subtítulos: English (39)

Resultado de la muestra: **8 de 10 con HLS; los 8 tienen subtítulos English CC en WebVTT.**

## 3. Inventario global (14 cursos)

| Curso | Módulos | Lecciones | Nativo (`videoId`) | Loom | YouTube | Vimeo | Sin video en metadata | Nota |
|---|---|---|---|---|---|---|---|---|
| fc758841 Evolve (Start Here) | 14 | 177 | 130 | 4 | 1 | – | 42 | |
| 9917539c Copywriting | 13 | 72 | 58 | 1 | – | – | 13 | |
| cf68fcb8 Finance | 4 | 7 | 6 | 1 | – | – | – | |
| 8327c8c9 Q4 (2026) | 2 | 24 | 14 | 6 | 1 | – | 3 | 15 lecciones con `lockFreeTrial` |
| 67ce5630 Call Recordings | 4 | 124 | 22 | – | – | – | 102 | `dripConfig`: 102 lecciones solo con título → **drip, aún no liberadas** 🔶 |
| 7eccf232 CRO | 9 | 120 | 10 | – | – | – | 110 | curso **de pago aparte** (`amount`); 110 solo con título y miniatura → **sin acceso** 🔶 |
| 992407ee Supply Chain | 1 | 15 | 13 | – | – | – | 2 | |
| 0d8aaebd Origins Program | 13 | 115 | 86 | – | 2 | 3 | 24 | |
| 48adf39c Agency Edition | 1 | 17 | – | – | – | – | 17 | **de pago aparte**; solo título y miniatura → **sin acceso** 🔶 |
| 894b4b75 Marrakesh 2026 | 2 | 7 | 6 | – | – | – | 1 | `minAccessLevel` |
| 02e27f05 $100k/Day Podcast | 1 | 1 | 1 | – | – | – | – | |
| 70956291 Mastermind Record | 1 | 1 | 1 | – | – | – | – | |
| 6619b66c Archive | 8 | 50 | 45 | 4 | – | – | 1 | `minTier` |
| 3992cc1b Evolve AI | 6 | 33 | 4 | – | – | – | 29 | 29 solo con título y miniatura → **sin acceso** 🔶 |
| **Total** | **79** | **763** | **396** | **16** | **4** | **3** | **344** | |

Lectura:
- **~396 videos nativos de Skool** son los que realmente hay que migrar. De las 344 lecciones "sin video en metadata", unas **258** están bloqueadas para esta cuenta (drip, pago aparte o nivel) y el resto parecen ser de texto o recursos.
- **23 videos externos** (Loom, YouTube, Vimeo): no están alojados en Skool. Cada uno requiere su propia decisión (enlazar o pedir el archivo original).
- **Descripciones**: solo en 9 lecciones. **Adjuntos**: solo en 3 (`resources` existe en casi todas, pero vacío).

## 4. Videos ✅

| Pregunta | Respuesta |
|---|---|
| Proveedor | **Mux**, detrás de dominios de Skool: etiqueta `<mux-player>`, analítica `inferred.litix.io` (Mux Data), master en `stream.video.skool.com/<playbackId>.m3u8`, renditions en `manifest-*.fastly.video.skool.com` y segmentos en `chunk-*.fastly.video.skool.com`. |
| ¿Aparece en el HTML o en el JSON? | El `videoId` sí está en el JSON. La URL del master **no** aparece literal en ninguna respuesta capturada. ❓ Falta saber si el `playbackId` o el token vienen en el HTML en otro formato; la sonda v3 lo mide. |
| ¿Requiere interacción? | **Sí**: el reproductor solo pide el manifest tras hacer clic en la miniatura. |
| ¿Hay un ID estable? | El `playbackId` en el path del master es estable por video (según el modelo de Mux) 🔶. Falta confirmar si coincide con `metadata.videoId`. |
| Firma | `?token=<JWT>` con claims `aud="v"`, `sub`, `exp`, `kid` y **`playback_restriction_id`**. |
| Duración de la URL firmada | **~24 h** (`exp` ≈ 86 000–87 700 s tras cargar la página). |
| ¿Funciona sin la sesión? | **No con una petición "desnuda": 403.** El claim `playback_restriction_id` indica restricciones de reproducción de Mux (típicamente por dominio de origen o por user agent) 🔶. La v3 de la sonda distingue el caso sin cookies, sin cookies con Referer de skool.com, y con sesión. |
| Calidades | Varían por video (`1080/720/480/270`, `1080/480/270`, `1078/480/270`); se guardan por video. |
| CDN | Varias regiones y proveedores (`oci-us-phoenix`, `oci-us-ashburn`, `gcp-us-east1`). No se debe fijar ningún host. |

## 5. Subtítulos ✅

- Declarados en el master como `#EXT-X-MEDIA:TYPE=SUBTITLES,NAME="English CC",LANGUAGE="en"`, en su propia playlist (`subtitles.m3u8`).
- Idioma: **solo inglés** en los 8 videos de la muestra.
- La playlist tiene **3 a 44 segmentos `.vtt`**; el primero se verificó como **WebVTT** sin tocar el video.
- Se obtienen **sin descargar video** y con el mismo token del master.
- Almacenamiento: concatenar los segmentos en **un único `en.vtt` por lección**, respetando `X-TIMESTAMP-MAP`, y guardarlo en Supabase Storage (`lessons/<lessonId>/subtitles/en.vtt`). Nuestro reproductor lo carga como `<track kind="subtitles" srclang="en">`, lo que permite activar o desactivar el CC.
- ❓ No sabemos si **todos** los ~396 videos tienen subtítulos. Una pasada de "solo manifests" lo cuantifica.

## 6. Documentos y archivos

- ✅ `metadata.resources` existe en la mayoría de las lecciones, pero **solo 3 lo tienen con contenido**.
- ✅ En la muestra no hubo enlaces a archivos en el DOM. Hay enlaces externos en algunas lecciones y dentro de las descripciones `[v2]`.
- ❓ Falta ver la forma exacta de los 3 recursos y cómo se obtiene su URL de descarga. La corrida `--smart` los incluye.
- Imágenes: portada de cada curso (`coverImage`/`coverImageFile`) y miniatura de cada lección (`videoThumbnail`).

## 7. Autenticación ✅ (solo nombres y atributos)

| Cookie | Tipo | Caducidad | Papel |
|---|---|---|---|
| `auth_token` | HttpOnly, JWT, `.skool.com` | **365 días** | sesión de Skool |
| `aws-waf-token` | `.skool.com` | **4 días** | token del **AWS WAF** (anti-bots); se obtiene ejecutando el JavaScript del WAF |
| `AWSALB*` | `www.skool.com` | 7 días | afinidad del balanceador de carga |
| `client_id`, `locale` | `.skool.com` | 365 días | identificador de cliente e idioma |

Implicaciones para un proceso en cloud:
- La sesión en sí dura mucho (365 días), así que un login manual único es viable.
- **AWS WAF** exige un navegador real que ejecute su JavaScript cada pocos días. Además, puede bloquear IPs de datacenter. No lo vamos a evadir. Si bloquea al servidor, la parte que usa la sesión (descubrimiento y obtención de manifests) se ejecuta en una máquina del usuario.
- Las URLs firmadas duran ~24 h, pero tienen restricciones de reproducción: está por confirmar si un worker en otro servidor puede usarlas.

---

## 8. Esquema conceptual de inventario (no son tablas definitivas)

```
course         skool_id, slug(name), title, desc_raw, cover_image, access{privacy,minTier,amount…}, position
module         skool_id, course_id, parent_id, position, title, access{hasAccess,lockFreeTrial}, is_implicit
lesson         skool_id, module_id, course_id, position, title, desc_raw, desc_format("v2"),
               lesson_url, access{hasAccess,lockFreeTrial,drip}, accessible(bool), created_at, updated_at
video          lesson_id, provider(skool-mux|loom|youtube|vimeo), skool_video_id, playback_id,
               external_url, duration_ms, thumbnail_url, qualities[], has_separate_audio,
               status(discovered|resolved|processing|stored|failed|skipped), storage_path, checksum
subtitle_track lesson_id, language("en"), name("English CC"), default, autoselect,
               segment_count, format("webvtt"), storage_path, status
attachment     lesson_id, kind(file|link), title, file_name, content_type, source_file_id,
               external_url, size_bytes, storage_path, status
audit_run      id, run_at, tool_version, totals, media_bytes_received
```

Reglas: los IDs de Skool son la clave de idempotencia; `position` se guarda siempre de forma explícita; **nunca** se persisten tokens ni URLs firmadas; las lecciones no accesibles se registran con `accessible = false` y no se migran.

## 9. Flujo técnico propuesto (solo arquitectura)

```
[A] Máquina con sesión (el Mac del usuario, o un host propio si el WAF lo permite)
    1. Playwright con perfil persistente (login manual una vez).
    2. Descubrimiento: 14 páginas de curso → árbol JSON → upsert en course/module/lesson.
    3. Por cada lección accesible con videoId: abrir ?md=, clic en la miniatura,
       capturar el master, las calidades y los subtítulos (sin segmentos) → video/subtitle_track.
       Ritmo humano (~15 s por lección; ~400 lecciones ≈ 1,5–2 h).
[B] Procesamiento (dónde depende de la prueba de restricciones de reproducción, ver §10)
    4. Resolver una URL firmada fresca (TTL ~24 h) justo antes de procesar.
    5. ffmpeg: master → mejor variante + audio → MP4 (remux -c copy, sin recodificar), en un temporal.
    6. Subtítulos: segmentos .vtt → un solo en.vtt validado.
    7. Subir a Supabase Storage: lessons/<id>/video.mp4, lessons/<id>/subtitles/en.vtt, files/…
    8. Guardar metadata y checksums; status = stored.
    9. Verificar: duración ≈ videoLenMs, VTT parseable, conteos iguales al inventario.
   10. Borrar el temporal. Reanudable por lección.
```

Decisión pendiente: **Supabase Storage no es una plataforma de video** (no transcodifica ni sirve HLS de forma nativa). Para ~396 videos hay que elegir entre MP4 progresivo en Storage (y revisar el límite de tamaño por archivo del plan) o un servicio de video para servirlos.

## 10. Riesgos e incógnitas

1. ❓ **Restricciones de reproducción de Mux** (`playback_restriction_id` y el 403 fuera del navegador). Es la incógnita que más condiciona la arquitectura. Si solo funcionan desde el navegador de la sesión, el procesamiento debe hacerse en esa misma máquina o en ese mismo contexto de navegador.
2. ⚠️ **AWS WAF**: riesgo de bloqueo desde cloud o headless. No se evade; si bloquea, el paso [A] se queda en local.
3. ❓ **2 de 10 lecciones sin HLS** (1.2 y 2.4) aunque tienen `videoId`. La v3 reintenta el clic y guarda una captura local de la pantalla.
4. ❓ Cobertura de subtítulos e idiomas en los ~396 videos (solo tenemos la muestra de 8).
5. ❓ Formato y descarga de los 3 adjuntos.
6. ❓ Convertir las descripciones `[v2]` a HTML o Markdown.
7. 🔶 **258 lecciones no accesibles** para esta cuenta (drip, cursos de pago aparte, niveles). No se migran; si hacen falta, se necesita el acceso correspondiente o el material del propietario.
8. **Videos externos** (Loom ×16, YouTube ×4, Vimeo ×3): otro tratamiento y otros derechos.
9. **Legal**: "tengo acceso" como alumno no implica derecho a descargar y rehospedar. Hace falta **autorización escrita del propietario del curso**. La alternativa más limpia es que el propietario exporte los originales desde su panel o su cuenta de Mux, lo que evitaría los puntos 1 y 2.

## 11. Conclusión

| # | Pregunta | Respuesta |
|---|---|---|
| 1 | ¿Primer módulo automático? | **Sí** ✅: primer `set` de `pageProps.course.children` (por ejemplo, "👋 Start Here"). |
| 2 | ¿Primera lección automática? | **Sí** ✅: primer hijo del primer módulo, con URL `?md=<id>` (por ejemplo, "🆕 Start Here: Overview Of Evolve"). |
| 3 | ¿Orden completo automático? | **Sí** ✅: orden de `children`, validado contra la barra lateral en los 14 cursos. |
| 4 | ¿Videos automáticos? | **Sí** ✅: `videoId` en el JSON y master HLS (Mux) capturado al pulsar play, con calidades por video. Falta explicar 2 lecciones sin HLS. |
| 5 | ¿Subtítulos automáticos? | **Sí** ✅: `TYPE=SUBTITLES` en el master → segmentos WebVTT legibles sin tocar el video. Inglés en toda la muestra. |
| 6 | ¿Documentos o archivos automáticos? | **Parcial**: se detectan (`resources`, 3 lecciones), pero falta ver cómo se descargan. |
| 7 | ¿Qué falta? | (a) Qué exigen las restricciones de reproducción de Mux; (b) de dónde sale el token; (c) las 2 lecciones sin HLS; (d) los 3 adjuntos; (e) la cobertura de subtítulos en todos los videos; (f) la autorización del propietario; (g) la decisión de almacenamiento o servicio de video. |
| 8 | ¿Siguiente paso? | Ejecutar la sonda v3: `node audit.mjs --url https://www.skool.com/evolve-8484/classroom --smart`. Resuelve (a)–(d). Después, si todo cuadra, una pasada de **solo manifests** sobre los ~396 videos nativos, sin descargar nada, para cerrar (e) y tener el inventario completo antes de escribir el migrador. |
