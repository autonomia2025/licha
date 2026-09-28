# skool-audit: sonda de descubrimiento de solo lectura

Descubre cómo está estructurado **realmente** tu curso de Skool usando **tu propia sesión**, sin descargar video.

## Garantías

| Qué | Cómo se garantiza |
|---|---|
| No descarga video/audio | Todas las peticiones `media`, `.ts/.m4s/.mp4/.aac/…`, y las peticiones a CDNs de video que no sean `.m3u8`/`.vtt` se **abortan** antes de salir. El informe cuenta los bytes `video/*`/`audio/*` recibidos (deberían ser 0). |
| No carga reproductores externos | Los iframes de YouTube/Vimeo/Loom/Wistia se bloquean y solo se registra su URL. |
| No descarga adjuntos | Solo se leen sus metadatos (nombre, tipo, host) desde el JSON y el DOM. |
| No filtra credenciales | Cookies: solo nombre, dominio, flags y caducidad. URLs: sin valores de query. Los JWT se decodifican **solo** para saber claims y tiempo de vida, y nunca se guardan. |
| No evade controles | Solo visita páginas que tu sesión ya puede ver, al ritmo de un humano (unos 10 s por lección). |

Lo único que se lee por red, aparte de las páginas, son playlists `.m3u8` (texto de pocos KB) y el **primer** segmento `.vtt` de cada pista de subtítulos, para confirmar que es WebVTT. Solo se guardan conteos, no el texto de los subtítulos.

## Uso (en tu Mac)

```bash
cd tools/skool-audit
npm install
npx playwright install chromium    # solo la primera vez (~150 MB, no son videos)

# 1ª vez: se abre una ventana; inicia sesión en Skool y presiona Enter en la terminal
node audit.mjs --url "https://www.skool.com/<grupo>/classroom"

# o un curso concreto, con una muestra de 2 módulos × 5 lecciones (valor por defecto)
node audit.mjs --url "https://www.skool.com/<grupo>/classroom/<curso>" --modules 2 --lessons 5
```

Opciones: `--headless` (una vez que ya existe la sesión), `--no-play` (no intenta pulsar play), `--max-courses N`, `--out dir`, `--profile dir`, `--chromium /ruta/al/chrome`.

La sesión se guarda en `.skool-profile/` en la raíz del repo, y los resultados en `tools/skool-audit/out/`. **Ambos están en `.gitignore`: no los subas nunca.**

## Resultados

- `out/report.md`: informe legible (estructura, muestra de lecciones, HLS, subtítulos, adjuntos, autenticación).
- `out/inventory.json`: todo lo anterior en JSON, con la *forma* (claves y tipos, sin valores) de cada API JSON observada.
- `out/network-summary.json`: endpoints agrupados (`api2.skool.com/…/:hex32`) con los nombres de headers usados.

Revisa `report.md` antes de compartirlo: contiene títulos y fragmentos de descripciones del curso, pero no secretos.

## Pruebas

```bash
npm test                                        # parsers HLS/árbol/redacción
node test/mock-skool-server.mjs 4599 &          # classroom SIMULADO (no es la API real de Skool)
node audit.mjs --url http://127.0.0.1:4599/grp/classroom --headless --profile /tmp/p --out /tmp/o
```
