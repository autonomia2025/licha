# skool-migrator: piloto (máx. 5 lecciones)

Migra de punta a punta unas pocas lecciones para validar el flujo antes de procesar todo el curso.
**Requiere la autorización del propietario del curso** (ver `docs/auditoria-skool.md` §10.1).

Por lección: token fresco desde la página de la lección → descarga de la mejor variante y su audio →
remux a MP4 sin recodificar → unión de los subtítulos WebVTT → verificación → Supabase Storage
(bucket privado `course-media`) y tablas → borrado del temporal.

## Preparación (una vez, en el Mac)

1. Aplica `supabase/migrations/20260928000000_course_migration_pilot.sql` en el proyecto de Supabase.
2. Crea una **clave secreta nueva** en Supabase: *Project Settings → API Keys → Publishable and secret API keys →*
   *New secret key* (empieza con `sb_secret_`). Luego, en `tools/skool-migrator`, ejecuta esto y **pega la clave
   cuando lo pida**. No se ve al escribir y no queda en el historial de la terminal:
   ```bash
   read -s "?Pega la clave sb_secret y presiona Enter: " K; echo; printf 'SUPABASE_URL=https://<ref>.supabase.co\nSUPABASE_SECRET_KEY=%s\n' "$K" > .env; unset K
   ```
   `.env` está en `.gitignore`. **Nunca la compartas ni la pegues en un chat.**
3. `npm install`. Si `ffmpeg` falla, instala el del sistema: `brew install ffmpeg`. El script usa primero
   `FFMPEG_PATH`, luego el `ffmpeg` del sistema y, por último, el binario de npm.
4. Debe existir `../skool-audit/out/full-inventory.json` (lo genera `inventory.mjs`) y la sesión de Skool
   en `.skool-profile/`.

## Uso

```bash
# 1) En seco: descarga y procesa, pero NO sube. Deja los archivos en out/ para revisarlos.
node pilot.mjs --url "https://www.skool.com/<grupo>/classroom" --auto 3 --no-upload

# 2) Piloto real: sube a Supabase y genera out/pilot-player.html con enlaces firmados (1 h).
node --env-file=.env pilot.mjs --url "https://www.skool.com/<grupo>/classroom" --auto 3
```

`--auto N` elige N lecciones cortas y variadas (una ≥1060p, una 720p y una de otro curso);
`--lessons id1,id2` fija las lecciones. Otras opciones: `--keep-temp`, `--headless`.

## Estructura completa (sin videos)

Sube los 14 cursos, módulos y lecciones (en orden, con su texto, tipo y enlaces externos) y copia portadas
y miniaturas a Storage. Pesa muy poco: cabe sin problema en el plan gratuito.

```bash
node --env-file=.env import-structure.mjs --url "https://www.skool.com/<grupo>/classroom"
```

## Migración de videos en orden, con presupuesto

Sube los videos **en el orden del classroom** (curso → módulo → lección), salta los que ya están subidos
y **se detiene antes de pasarse** del presupuesto de almacenamiento. Para continuar más adelante (por ejemplo,
después de subir de plan), basta con volver a ejecutarlo con un presupuesto mayor.

```bash
node --env-file=.env pilot.mjs --url "https://www.skool.com/<grupo>/classroom" --all --budget-gb 0.9
# Plan gratuito: salta videos de más de 50 MB (se suben después). Con plan Pro: --max-file-mb 0 --budget-gb 90
```

- El tamaño se estima con el stream **antes** de descargar; si tras unir el MP4 pesa más del límite, se salta
  y queda como `skipped` en `lesson_videos` (las siguientes pasadas no lo vuelven a descargar).
- Los temporales (`tmp/`) se borran siempre, también cuando una lección falla, y al empezar cada ejecución.
- La duración se valida contra el propio stream; si el `videoLenMs` de Skool no coincide, solo se avisa.
- Si un video no cabe en el presupuesto, sigue probando con los siguientes (más cortos) hasta llenarlo.

## Videos en Cloudflare R2 (recomendado)

Supabase queda solo para usuarios, tablas y progreso (plan gratis). Los videos, subtítulos e imágenes van a
un bucket privado de **Cloudflare R2**: 10 GB gratis, luego ~US$0,015/GB al mes, y **sin costo por
reproducciones**. Sin límite de 50 MB por archivo.

1. Agrega a `.env` (además de las de Supabase):
   ```
   R2_ACCOUNT_ID=…
   R2_ACCESS_KEY_ID=…
   R2_SECRET_ACCESS_KEY=…
   R2_BUCKET=estudio-de-licha-media
   ```
2. Copia a R2 lo que ya estaba en Supabase (mismas rutas; se puede repetir, salta lo ya copiado; también
   configura CORS del bucket):
   ```bash
   node --env-file=.env move-to-r2.mjs
   ```
3. Configura las mismas 4 variables `R2_*` en Vercel y vuelve a desplegar: la app firma las URLs en R2.
4. Revisa que los videos se vean en la app y luego libera Supabase:
   ```bash
   node --env-file=.env move-to-r2.mjs --delete
   ```
5. Sigue migrando: con `R2_*` en `.env`, `pilot.mjs --all` sube a R2 sin límite por archivo ni presupuesto de 1 GB:
   ```bash
   node --env-file=.env pilot.mjs --url "https://www.skool.com/<grupo>/classroom" --all
   ```

## Pruebas

`npm test`: parsers HLS y unión de WebVTT. `test/e2e-mock.mjs`: prueba de punta a punta contra un HLS
generado localmente (necesita ffmpeg funcional).
