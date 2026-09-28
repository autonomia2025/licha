# skool-migrator: piloto (máx. 5 lecciones)

Migra de punta a punta unas pocas lecciones para validar el flujo antes de procesar todo el curso.
**Requiere la autorización del propietario del curso** (ver `docs/auditoria-skool.md` §10.1).

Por lección: token fresco desde la página de la lección → descarga de la mejor variante y su audio →
remux a MP4 sin recodificar → unión de los subtítulos WebVTT → verificación → Supabase Storage
(bucket privado `course-media`) y tablas → borrado del temporal.

## Preparación (una vez, en el Mac)

1. Aplica `supabase/migrations/20260928000000_course_migration_pilot.sql` en el proyecto de Supabase.
2. Crea `tools/skool-migrator/.env` (está en `.gitignore`; **nunca lo compartas ni lo pegues en un chat**):
   ```
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=<clave service_role: Project Settings → API>
   ```
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

## Pruebas

`npm test`: parsers HLS y unión de WebVTT. `test/e2e-mock.mjs`: prueba de punta a punta contra un HLS
generado localmente (necesita ffmpeg funcional).
