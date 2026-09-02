# Censo de `<link>`/`<script>` — las 8 páginas públicas

Inventario completo de qué hoja de estilos o script carga cada una de las 8 páginas públicas (todo salvo `/admin`), en qué orden, y por qué falta donde falta. Nace de que `alojamiento.html`, `servicios.html` y `viajes.html` se crearon desde una plantilla incompleta y se les ha olvidado la misma pieza tres veces seguidas (`tokens.css`, luego `typography.css`, luego `utils/sanitize.js`) — este documento existe para que la cuarta vez no vuelva a pasar desapercibida.

## Qué añadir cuando una página estática pasa a usar Supabase

`alojamiento.html`, `servicios.html` y `viajes.html` son hoy 100% estáticas (su contenido está hardcodeado en el HTML, cero llamadas a Supabase) — por eso no cargan ninguna de las 5 piezas de abajo, y así debe quedarse mientras siga siendo así (cargarlas sin usarlas es peso muerto en 3G). En cuanto una de esas páginas empiece a leer datos reales de Supabase para cualquier sección, añadir **las 5 piezas juntas, en este orden**, no una suelta:

1. `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js"></script>` — el cliente de Supabase en sí.
2. `<script src="/src/js/lib/supabaseClient.js"></script>` — crea `window.supabaseClient` a partir de (1); nada más funciona sin esto.
3. `services/citiesService.js` y/o `services/partnersService.js` (el que aplique) — usan `window.supabaseClient` de (2) para pedir los datos.
4. `tracking.js` — si la sección pinta enlaces de partners con clic rastreable (`cta_clicks`); si no, se omite.
5. **`utils/sanitize.js`** — sanea lo que (3)/(4) devuelven antes de tocar el DOM (`escapeHtml`/`sanitizeUrl`). Va el último de la cadena pero es la pieza que más veces se ha olvidado — sin ella, cualquier campo editable desde `/admin` (nombre, descripción, URL de un link) llega crudo al `innerHTML`/`href`.

Van juntas porque son una cadena de dependencia real: (1)→(2)→(3)→(4), y (5) sanea lo que (3)/(4) acaban de traer. Añadir (5) sin el resto no sirve de nada (no hay nada que sanear); añadir (1)-(4) sin (5) es exactamente el bug de seguridad que ya apareció en `mapPartners.js` (ver `fix/sanitize-partner-link-url`).

## Tabla completa

`✔`=presente, orden correcto · `—`=ausente, INTENCIONAL (justificado abajo) · `⚠`=ausente, HUECO real.

IDX=index · CDD=ciudad · CDS=ciudades · TOD=ciudades-todas · MAP=mapa · ALO=alojamiento · SRV=servicios · VJE=viajes.

| #   | Tag                                                                      | IDX        | CDD         | CDS           | TOD      | MAP       | ALO      | SRV      | VJE      |
| --- | ------------------------------------------------------------------------ | ---------- | ----------- | ------------- | -------- | --------- | -------- | -------- | -------- |
| 1   | `preconnect fonts.googleapis.com`                                        | ✔          | ✔           | ✔             | ✔        | ✔         | ✔        | ✔        | ✔        |
| 2   | `preconnect fonts.gstatic.com`                                           | ✔          | ✔           | ✔             | ✔        | —         | —        | —        | —        |
| 4   | **`tokens.css`**                                                         | ✔          | ✔           | ✔             | ✔        | ✔         | ✔        | ✔        | ✔        |
| 5   | **`typography.css`**                                                     | ✔          | ✔           | ✔             | ✔        | ✔         | ✔        | ✔        | ✔        |
| 6   | Font Syne 400/600/700/800 + Inter 400/500/600/700                        | ✔          | ✔           | ✔             | ✔        | ✔         | ✔        | ✔        | ✔        |
| 7   | Font Material Symbols Outlined                                           | ✔          | ✔           | ✔             | ✔        | ✔         | ✔        | ✔        | ✔        |
| 8   | Font Archivo Black                                                       | ✔          | —           | —             | —        | —         | —        | —        | —        |
| 9   | `leaflet.css` (unpkg)                                                    | —          | ✔           | —             | —        | ✔         | —        | —        | —        |
| 10  | `styles.css`                                                             | ✔          | ✔           | ✔             | ✔        | ✔         | ✔        | ✔        | ✔        |
| 11  | `animations.css`                                                         | ✔          | —           | ✔             | ✔        | —         | —        | —        | —        |
| 12  | `experience.js` (head)                                                   | ✔          | ✔           | ✔             | ✔        | ✔         | ✔        | ✔        | ✔        |
| 13  | Nav React (mount-\*.jsx)                                                 | ✔ nav      | ✔ topbar    | ✔ hero-legacy | ✔ nav    | ✔ topbar  | ✔ topbar | ✔ topbar | ✔ topbar |
| 14  | Footer React (`mount-footer.jsx`)                                        | ✔          | ✔           | ✔             | ✔        | ✔         | ✔        | ✔        | ✔        |
| 15  | `leaflet.js` (unpkg)                                                     | —          | ✔           | —             | —        | ✔         | —        | —        | —        |
| 16  | `@supabase/supabase-js` (UMD)                                            | ✔          | ✔           | ✔             | ✔        | ✔         | ⚠\*      | ⚠\*      | ⚠\*      |
| 17  | `supabaseClient.js`                                                      | ✔          | ✔           | ✔             | ✔        | ✔         | ⚠\*      | ⚠\*      | ⚠\*      |
| 18  | `utils/i18n.js`                                                          | ✔          | ✔           | ✔             | ✔        | ✔         | ✔        | ✔        | ✔        |
| 19  | `utils/translations.js`                                                  | ✔          | ✔           | ✔             | ✔        | ✔         | ✔        | ✔        | ✔        |
| 20  | `langSwitcher.js`                                                        | ✔          | ✔           | ✔             | ✔        | ✔         | ✔        | ✔        | ✔        |
| 21  | `services/citiesService.js`                                              | ✔          | ✔           | ✔             | ✔        | —         | —        | —        | —        |
| 22  | `services/partnersService.js`                                            | ✔          | ✔           | —             | —        | ✔         | ⚠\*      | ⚠\*      | ⚠\*      |
| 23  | `tracking.js`                                                            | ✔          | ✔           | —             | —        | ✔         | ⚠\*      | ⚠\*      | ⚠\*      |
| 24  | `utils/animations.js`                                                    | ✔          | —           | ✔             | ✔        | —         | —        | —        | —        |
| 25  | **`utils/sanitize.js`**                                                  | ✔          | ✔           | ✔             | ✔        | ✔         | ⚠\*      | ⚠\*      | ⚠\*      |
| 26  | `geocoder.js`                                                            | —          | ✔           | —             | —        | ✔         | —        | —        | —        |
| 27  | `map-helpers.js`                                                         | —          | ✔           | —             | —        | ✔         | —        | —        | —        |
| 28  | `mapPartners.js`                                                         | —          | ✔           | —             | —        | ✔         | —        | —        | —        |
| 29  | `cityMap.js`                                                             | —          | ✔           | —             | —        | ✔         | —        | —        | —        |
| 30  | Script de página (`index.js`/`ciudad.js`/`ciudades.js`/`mapa.js`/inline) | ✔ index.js | ✔ ciudad.js | ✔ ciudades.js | ✔ inline | ✔ mapa.js | —        | —        | —        |
| 31  | `nightsSection.js`                                                       | ✔          | —           | —             | —        | —         | —        | —        | —        |
| 32  | Bottom-nav activo (inline)                                               | ✔          | ✔           | ✔             | ✔        | ✔         | ✔        | ✔        | ✔        |
| 33  | `applyTranslations()` (inline)                                           | ✔          | ✔           | ✔             | ✔        | ✔         | ✔        | ✔        | ✔        |

`\*` en ALO/SRV/VJE: decisión explícita (ver `fix/page-boilerplate-parity`) de **no** añadir las 5 piezas de la cadena Supabase mientras estas 3 páginas sigan siendo 100% estáticas — cargarlas sin usarlas es peso muerto en 3G. Se añaden juntas, en el orden de la sección de arriba, el día que cualquiera de las tres empiece a leer datos reales.

**Orden verificado, no solo presencia**: los únicos scripts que llaman de verdad a `escapeHtml`/`sanitizeUrl` son `admin.js`, `cityMap.js`, `ciudad.js`, `ciudades.js`, `index.js`, `mapPartners.js` y `nightsSection.js`. En las 5 páginas donde `utils/sanitize.js` está presente, carga antes que todos ellos, sin excepción. Ninguno de `citiesService.js`/`partnersService.js`/`tracking.js`/`geocoder.js`/`map-helpers.js`/`langSwitcher.js` usa esas funciones, así que su posición relativa a `sanitize.js` no importa.

## Justificación de cada INTENCIONAL

- **Filas 2, 6** (preconnect gstatic + fuente Syne/Inter): las 4 páginas con fila 2 activa (IDX/CDD/CDS/TOD) son las que ya cargaban `tokens.css`/`typography.css` desde antes del primer fix. `fonts.gstatic.com` sirve los ficheros `.woff2` de **todas** las hojas de Google Fonts (no solo una en concreto), así que el preconnect sigue haciendo falta ahí mientras quede cualquier fuente de Google en la página — no es huérfano.
- **Fila 8** (Archivo Black): solo el H1 del hero y los números de stats de `index.html` (`.font-slab`, comentado en el propio archivo) — ningún otro sitio usa esa fuente.
- **Filas 9, 15, 26-29** (Leaflet + geocoder/map-helpers/mapPartners/cityMap): solo tienen sentido donde hay un mapa real — `ciudad.html` (mapa embebido) y `mapa.html` (pantalla completa). Ninguna otra página renderiza un `<div id="map">`.
- **Filas 11, 24** (`animations.css` + `utils/animations.js`): solo las páginas con elementos `.anim-fade-up`/`.anim-slam`/scroll-reveal — `index.html`, `ciudades.html`, `ciudades-todas.html`. `ciudad.html`/`mapa.html` no usan esas clases; `alojamiento`/`servicios`/`viajes` tampoco.
- **Fila 21** (`citiesService.js`): `mapa.js` consulta `cities` directamente vía `window.supabaseClient.from('cities')...` sin pasar por el wrapper del servicio — no le falta, simplemente no lo usa.
- **Filas 22-23 en CDS/TOD** (`partnersService.js`/`tracking.js`): ninguna de las dos páginas de listado de ciudades muestra partners ni tiene enlaces con clic rastreable.
- **Filas 30-31**: `alojamiento`/`servicios`/`viajes` no tienen script de página propio porque su contenido es 100% estático (cero llamadas a Supabase). `nightsSection.js` solo en `index.html`, la única página con la sección "Noches en tendencia".

## Historial de fixes de este censo

- `fix/design-tokens-link` — añadió `tokens.css`/`typography.css` a mapa/alojamiento/servicios/viajes (filas 4-5).
- `fix/sanitize-partner-link-url` — añadió `utils/sanitize.js` a mapa.html donde faltaba, y saneó `link.url` en `mapPartners.js` (fila 25 en MAP).
- `fix/page-boilerplate-parity` — este documento, más la limpieza de la petición de fuentes duplicada (ver más abajo).

## Petición de fuentes duplicada — eliminada

`index.html`, `ciudad.html`, `ciudades.html` y `ciudades-todas.html` cargaban dos hojas de Google Fonts que se solapaban:

- `?family=Inter:wght@400;500;600&family=Syne:wght@700;800` (eliminada) — resto de una plantilla anterior a `tokens.css`/`typography.css`.
- `?family=Syne:wght@400;600;700;800&family=Inter:wght@400;500;600;700` (se queda) — cubre todos los pesos de la anterior y más (Syne 400/600 e Inter 700, que la primera no tenía).

Verificado antes de borrar: los únicos `font-weight` usados en todo el proyecto son 400/500/600/700/800, todos cubiertos por la hoja que se queda — ningún peso quedaba huérfano.

**Impacto medido en `index.html`** (Resource Timing API, `encodedBodySize`, primera carga):

|                                          | Antes                                            | Después          |
| ---------------------------------------- | ------------------------------------------------ | ---------------- |
| Peticiones de fuentes (CSS + `.woff2`)   | 8                                                | 7                |
| Bytes de la hoja duplicada (comprimidos) | 784 B                                            | —                |
| Ficheros `.woff2` descargados            | 4 (Inter, Syne, Material Symbols, Archivo Black) | **los mismos 4** |

El ahorro real es modesto: **1 petición HTTP y ~784 B menos**, nada de peso en fuentes `.woff2` (que es donde está el grueso — el propio Material Symbols pesa ~3,9 MB). Esto es así porque ambas hojas ya apuntaban a los mismos ficheros `.woff2` subyacentes para los pesos que compartían — el navegador ya los deduplicaba antes de este cambio; lo único que sobraba de verdad era la propia hoja CSS duplicada y la petición para traerla.

**Verificación visual**: capturas de página completa de las 4 páginas, ambos temas, a 390px y 1280px, antes y después. Diff de píxeles (recorte a la región común, `pixelmatch`): `ciudad.html`, `ciudades.html` y `ciudades-todas.html` dan **0 píxeles de diferencia** en las 8 comparaciones. `index.html` muestra un 0.04-0.09% de diferencia, localizado en una franja horizontal fina cerca del ticker de marca — es la animación `ticker-scroll` (`26s linear infinite`, `styles.css`), que sigue corriendo entre una captura y la otra al ser dos cargas de página separadas en el tiempo; no tiene relación con las fuentes. Ni un glifo cambia.
