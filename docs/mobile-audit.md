# Auditoría móvil — feature/mobile-breakpoints

Paso 0 del refactor de breakpoints. Cobertura: los 26 `@media` de ancho en `src/css/styles.css` (25) + `ciudades-todas.html` (2) — 27 en total, uno más de los "26" del encargo porque conté por separado dos bloques que comparten el mismo `max-width: 768px` pero vivían en sitios distintos del archivo (línea 962 y línea 4132) y no me constaba que ya los tuvierais fusionados en el recuento previo. `src/styles/tokens.css` confirmado sin `@media`. `animations.css`/`typography.css` confirmado: solo `prefers-reduced-motion`, no tocados.

**Hallazgo que condiciona todo lo demás**: los tres breakpoints nuevos (600/900/1200) no coinciden con la mayoría de los anchos actuales (767, 768, 1000, 1024). Sección (a) marca cada caso, pero el resumen ejecutivo es: de los 27 `@media`, **11 caen exactos** en un breakpoint nuevo (migración segura) y **16 no** (requieren mover el corte numérico, lo que cambia el comportamiento en el rango intermedio para algún ancho de viewport real). Ver "Requiere decisión de producto" al final.

---

## a) Breakpoints

| # | Línea | Query actual | Selectores | Bp propuesto | ¿Migrable sin cambio visual? |
|---|-------|---------------|------------|---------------|-------------------------------|
| 1 | 497 | `min-width: 768px` | `.event-card` (min-width:400px) | `--bp-md` (900) | ⚠️ No exacto — 768→900 quita el `min-width:400px` a los viewports 768-899px que hoy lo tienen |
| 2 | 962 | `max-width: 768px` | `.app-bottom-nav`, `.hamburger-btn`, `.mobile-nav`, `.bottom-nav`, `body`/`body.home-page` padding | `--bp-md` (900) | ⚠️ No exacto. **Crítico**: es la mitad del swap bottom-nav↔desktop-nav — debe migrar junto con la fila 24 (línea 4132), que es la otra mitad del mismo swap. Si se mueven a breakpoints distintos, hay un rango con navegación rota (ninguna barra visible, o las dos a la vez) |
| 3 | 1472 | `max-width: 768px` | `.mobile-nav` (dropdown compacto), `.mobile-nav-close`, `.mobile-nav-links` y variantes | `--bp-md` (900) | ⚠️ No exacto. Mismo breakpoint familiar que #2. Impacto real bajo hoy: ver nota sobre `.hamburger-btn` en la sección (c) — el trigger que abre este dropdown está oculto en todos los anchos actualmente, así que este bloque no se ve en la práctica, pero conviene migrarlo igual que #2/#24 por coherencia |
| 4 | 1719 | `max-width: 768px` | `.footer-inner`, `.footer-brand`, `.footer-tagline`, `.footer-bottom` | `--bp-md` (900) | ⚠️ No exacto — footer en 1 columna aparece 132px antes de lo que aparece hoy |
| 5 | 2498 | `max-width: 900px` | `.partner-grid` (2 col), `.home-stats` (gap) | `--bp-md` (900) | ✅ Exacto |
| 6 | 2507 | `max-width: 768px` | `.home-stats` (justify-content, gap) | `--bp-md` (900) | ⚠️ No exacto. **Ojo**: refina a `.home-stats` dentro del rango que ya cubre #5 (900px) — si ambos acaban en el mismo breakpoint hay que fusionar las dos reglas en un único bloque `--bp-md`, no dejarlas duplicadas |
| 7 | 2523 | `max-width: 600px` | `.partner-grid` (1 col), `.category-pills`, `.category-pill` (36px compacto) | `--bp-sm` (600) | ✅ Exacto |
| 8 | 2567 | `min-width: 1000px` | `.cities-scroll-stage`, `.cities-pin`, `.cities-pin .section-title`, `.cities-pin .accordion-grid` | **NO MIGRAR** | 🚫 Excepción explícita del encargo — scroll-scrub, depende de `100vh` a propósito (ver sección b) |
| 9 | 2880 | `max-width: 1000px` | `.accordion-grid` (stack vertical), `.accordion-card--main` | **NO MIGRAR (ligado a #8)** | 🚫 Es la mitad "apilado" del mismo efecto — por debajo de 1000px no hay scroll-scrub porque el grid se apila. Migrarla sola sin mover #8 rompe la coordinación entre ambas en el rango 1000-1199px (o el que sea el nuevo corte) |
| 10 | 2922 | `max-width: 767px` | `.nights-filters` (grid 1 col) | `--bp-md` (900) | ⚠️ No exacto |
| 11 | 3021 | `min-width: 768px` | `.events-scroll` (grid 2 col) | `--bp-md` (900) | ⚠️ No exacto. **Crítico**: pareja con #13 (767, la versión carrusel móvil) — mismo corte visual, deben migrar juntas |
| 12 | 3029 | `min-width: 900px` | `.events-scroll` (grid 3 col) | `--bp-md` (900) | ✅ Exacto en valor, pero ⚠️ si #11 también migra a 900, ambas reglas (2 col y 3 col) caen en el mismo breakpoint — hay que revisar el orden en cascada para que 3 col siga ganando |
| 13 | 3158 | `max-width: 767px` | `.events-scroll` (carrusel horizontal móvil), scrollbar, `.event-card` (flex 82%) | `--bp-md` (900) | ⚠️ No exacto. Pareja de #11, ver nota ahí |
| 14 | 3194 | `min-width: 768px` | `.events-scroll .event-card` (min-width:0), `.event-card--featured` (span 2) | `--bp-md` (900) | ⚠️ No exacto. Ligada a la misma familia 767/768 de events-scroll |
| 15 | 3351 | `max-width: 900px` | `.all-cities-hero` (padding) | `--bp-md` (900) | ✅ Exacto |
| 16 | 3380 | `min-width: 900px` | `.city-page` (max-width:1000px) | `--bp-md` (900) | ✅ Exacto |
| 17 | 3708 | `min-width: 900px` | `.city-map-columns` (layout fila 75/25) | `--bp-md` (900) | ✅ Exacto |
| 18 | 3893 | `max-width: 768px` | `.map-canvas` (`calc(100dvh - 65px)`) | `--bp-md` (900) | ⚠️ No exacto — y además mezcla con el hallazgo de alturas (sección b): 65px es un valor real distinto de los 73px del resto de `header.topbar` |
| 19 | 3919 | `min-width: 900px` | `.map-with-list` (layout fila, alturas `calc(100dvh - 73px)`) | `--bp-md` (900) | ✅ Exacto en el corte. Contiene la declaración doble vh+dvh a limpiar en el paso 3 |
| 20 | 3958 | `max-width: 768px` | `.services-grid--2col` (1 col) | `--bp-md` (900) | ⚠️ No exacto |
| 21 | 4070 | `max-width: 768px` | `.collab-grid` (2 col), `.collab-card`, `.collab-name`, `.collab-contact` | `--bp-md` (900) | ⚠️ No exacto. Es además la causa raíz del overflow horizontal de `index.html` a 320px (ver sección e) — no es objeto de arreglo en este refactor, pero quede anotado |
| 22 | 4093 | `max-width: 1024px` | `.section`, `.cta-section`, `.nights-header`, `.events-scroll`, `.hero-content-legacy`, `.section-header`, `.hero-stats`, `.countries-grid`, `.cities-grid`, `.services-grid`, `.cta-card` (paddings) | Ninguno exacto — 900 se queda corto, 1200 se pasa mucho | 🔴 Alto riesgo. 1024 es un valor aislado sin pareja entre los tres cortes nuevos; el rango 900-1199px (o el que se elija) cambia de padding respecto a hoy sí o sí |
| 23 | 4123 | `max-width: 900px` | `.countries-grid`, `.cities-grid` (3 col) | `--bp-md` (900) | ✅ Exacto |
| 24 | 4132 | `max-width: 768px` | `.bottom-nav`, `.topnav-links`, `.icon-btn`, `.topnav-inner`, `.section-head`, `.services-grid`, `.cta-card`, `.hero-legacy .topbar`, `header.topbar`, `.topbar-nav`, `.breadcrumb` | `--bp-md` (900) | ⚠️ No exacto. **Crítico**: otra mitad del swap nav junto con #2 (ver esa nota) |
| 25 | 4179 | `max-width: 600px` | `.countries-grid`/`.cities-grid` (2 col), `.hero`, `.hero-title`, `.hero-sub`, `.search-bar` y su input/botón, `.home-stats`, `.section`, `.cta-card`, `main.city-main` | `--bp-sm` (600) | ✅ Exacto |
| 26 | ciudades-todas.html:195 | `max-width: 900px` | `.filter-bar`, `.cities-container` (padding) | `--bp-md` (900) | ✅ Exacto |
| 27 | ciudades-todas.html:209 | `max-width: 600px` | `.city-items-grid` (2 col forzado) | `--bp-sm` (600) | ✅ Exacto |

**Grupos que deben migrar juntos** (romperlos por separado genera un rango de viewport con comportamiento inconsistente):
- **Swap nav móvil/desktop**: #2 + #3 + #24 (los tres a 768px hoy)
- **Layout de `.events-scroll`**: #10 + #11 + #12 + #13 + #14 (767/768/900 hoy, tres reglas coordinadas)
- **Scroll-scrub del accordion**: #8 + #9 (1000px hoy) — excepción, no migrar ninguna de las dos
- **`.home-stats`**: #5 + #6 (900/768 hoy) — si ambas acaban en 900, fusionar en un solo bloque

---

## b) Alturas de viewport

| Selector / línea | Valor actual | Nota |
|---|---|---|
| `body` (línea 160) | `min-height: 100dvh` | Ya usa `dvh`, no requiere cambio |
| `.hero` (línea 4191, dentro de `max-width:600px`) | `min-height: 100svh` | Ya usa `svh` (evita que la barra de URL de iOS mueva el hero) — no tocar, es una unidad distinta a propósito, no una que falte por migrar |
| `.cities-scroll-stage` / `.cities-pin` (líneas 2570-2581) | `height: 150vh;` y `height: calc(100vh - 80px);` | 🚫 **Excepción justificada** — scroll-scrub. El JS (`src/js/index.js` ~línea 604-626) lee la posición de scroll relativa a `.cities-scroll-stage` para calcular `--cities-progress`; ese cálculo asume `100vh` estático. Cambiar a `dvh` (que varía al aparecer/ocultarse la barra de Safari) desincronizaría la animación del scroll real. **No tocar en el paso 3** |
| `.map-canvas` (líneas 3872-3874) | `height: calc(100vh - 73px); height: calc(100dvh - 73px);` | Declaración doble a limpiar (paso 3) — quedarse solo con `dvh` |
| `.map-with-list .map-canvas` (líneas 3925-3927, dentro de `min-width:900px`) | `height: calc(100vh - 73px); height: calc(100dvh - 73px);` | Segunda (y última) declaración doble a limpiar — son las "al menos dos" que mencionaba el encargo |
| `.map-with-list` (línea 3904, base/móvil) | `height: calc(100dvh - 64px)` | Ya usa solo `dvh`, no es doble — pero el literal (64px) no coincide con ningún otro (ver hallazgo de abajo) |
| `.map-canvas` (línea 3895, dentro de `max-width:768px`) | `height: calc(100dvh - 65px)` | Ya usa solo `dvh` — literal 65px |
| `body` (línea 992, dentro de `max-width:768px`) | `padding-bottom: 68px;` | 60px (altura real del bottom-nav) + 8px de margen de seguridad — **no es igual a `--nav-bottom-h`**, ver hallazgo |
| `body.home-page` (línea 992) | `padding-bottom: calc(68px + env(safe-area-inset-bottom, 0px));` | Mismo 68px + safe-area |
| `.home-page .app-bottom-nav` (línea 2127) | `height: calc(60px + env(safe-area-inset-bottom, 0px));` | Este sí coincide exacto con `--nav-bottom-h`(60) + safe-area = `--nav-bottom-total` |
| `.mobile-nav` (línea 1483) | `padding: var(--topbar-h, 80px) 0 20px;` | Usa la custom property `--topbar-h` que **solo `ciudad.js` inyecta** (mide `header.topbar.offsetHeight` en tiempo real). En el resto de páginas la variable no existe y cae al fallback `80px` |
| `.city-map-columns .city-map-embed` (línea 3696) | `top: var(--topbar-h, 65px);` | Mismo `--topbar-h`, pero fallback **65px**, no 80px — inconsistente con el de arriba |

**Hallazgo importante — no hay UNA sola "altura real de header", hay tres**, y el token único que pide el encargo (`--header-h: 73px`, comentado como "altura REAL del topnav actual") no cubre ninguna de las tres con exactitud salvo una:

1. **`.topnav`** (index.html, ciudades-todas.html): `height: 80px` fijo por CSS, constante en todos los anchos. Es el valor que usa el scroll-scrub (excepción, no tocar) y el fallback de `.mobile-nav`. **No es 73px** — el comentario del encargo dice "topnav" pero el valor 73 en realidad coincide con `header.topbar`, no con `.topnav`.
2. **`header.topbar` en escritorio** (ciudad, mapa, servicios, viajes, alojamiento): no tiene `height` fijo, se mide por JS (`offsetHeight`) porque depende del padding. El valor real observado en los `calc()` es **73px** — este sí coincide con el token propuesto.
3. **`header.topbar` en móvil** (`max-width:768px`, mismo grupo que el header cambia de padding): **65px** (visto en `.map-canvas` y en el fallback de `--topbar-h` de `.city-map-columns`) — y una variante más, **64px**, en `.map-with-list` base, un píxel distinto sin explicación aparente en el CSS (podría ser una inconsistencia preexistente de un píxel, no algo introducido por este refactor).

Aplicar `var(--header-h)` (73px) sin más a los literales 65px, 64px u 80px cambiaría el alto real del mapa/dropdown en esos contextos — visible, no es un refactor neutro. Recomiendo (para decidir en el paso 1, no lo hago sin tu OK): mantener `--header-h: 73px` solo para el caso desktop de `header.topbar` tal como está especificado, y **no** intentar unificar 65px/64px/80px bajo el mismo token — dejarlos como excepciones documentadas o, si se quiere ir más allá, crear un segundo token (`--header-h-mobile`) en un paso posterior fuera de este refactor (sería un cambio de valor, no de nombre, y el encargo prohíbe cambiar valores).

---

## c) Áreas táctiles < 44×44px

Medido con Playwright a 320px de ancho, elementos `<a>`/`<button>` visibles (excluye los que están dentro de una tarjeta/enlace más grande donde son puramente decorativos).

| Selector | Tamaño real | Páginas | Nota |
|---|---|---|---|
| `.lang-switcher` | 21×19px | Las 8 | El botón ES/EN — el más pequeño de todos con diferencia |
| `.search-bar-btn` | 36×36px | index.html | Ya documentado como excepción deliberada en el propio CSS (target táctil secundario) |
| `.category-pill` | 36px alto | index.html | Ídem — comentario en el CSS ya justifica el 36px como aceptable para un filtro secundario |
| `.leaflet-control-zoom-in` / `-out` | 30×30px | ciudad.html, mapa.html | Controles por defecto de Leaflet (librería de terceros) — fuera de alcance, no es código del proyecto |
| Enlaces de texto inline (footer, nav) | Alto 14-27px, ancho holgado (43-220px) | Todas | Enlaces de texto en línea — el criterio WCAG de tamaño de objetivo tiene excepción explícita para enlaces inline dentro de texto corrido; no es la misma categoría de problema que un botón/icono aislado |

**Nota al margen, no es un hallazgo de esta tabla pero apareció al medir**: `.hamburger-btn` tiene `display: none` tanto en la regla base como en la única regla que lo toca dentro de `@media (max-width: 768px)` — es decir, **no se muestra en ningún ancho actualmente**. El menú móvil que abre (`.mobile-nav`, líneas 1472-1532) es por tanto inalcanzable hoy en cualquier viewport (la navegación real la resuelve el bottom-nav). No es parte del refactor de breakpoints, pero lo anoto porque afecta a si merece la pena migrar los bloques #3 (línea 1472) de la tabla (a) con la misma prioridad que el resto.

---

## d) Estados solo-hover sin `:focus-visible`/`:active`

No hay ningún `outline: none` global — el foco por defecto del navegador sigue funcionando salvo donde se sustituye explícitamente por un anillo propio (`.btn-primary-pill`, `.nights-filter-select`, ambos correctos). El hallazgo es que el **tratamiento visual diseñado para hover** (zoom de imagen, cambio de borde/color, sombra) no se replica en foco por teclado en estos componentes — el usuario de teclado solo ve el contorno de foco por defecto del navegador, no el mismo feedback que un usuario de ratón:

| Componente | Efecto en hover | Cubierto por `:focus-visible`/`:active` |
|---|---|---|
| `.city-card` / `.country-card` | Zoom + oscurecido de imagen, cambio de borde, aparece flecha | No |
| `.partner-card` | — (revisar tratamiento) | No |
| `.collab-card` | Cambio de fondo/borde | No |
| `.service-card` | — | No |
| `.events-scroll .event-card` | — | No |
| `.events-scroll .event-cta-btn` | — | No |
| `.icon-btn` (incluye `#authBtn`) | Cambio de color | No |
| `.back-btn` | Cambio de fondo | No |
| `.mobile-nav-close` | — | No |
| `.nav-link`, `.section-link`, `.link-btn`, `.breadcrumb a` | Cambio de color/subrayado | No |
| `.category-pill` | — | No |
| `.nights-filter-clear` | — | No — inconsistente con `.nights-filter-select`, su vecino directo en el mismo filtro, que sí lo tiene |
| `.btn-ghost-pill` | — | Solo `:active`, no `:focus-visible` |

Componentes que **sí** están bien cubiertos (para referencia, no requieren cambio): `.btn-primary-pill`, `.footer-col ul a`, `.nights-filter-select`, `.topbar .lang-switcher`/`.topnav .lang-switcher`, `.topbar .topbar-nav a`/`.topnav .topbar-nav a`.

Esto es un hallazgo de accesibilidad preexistente, no algo que este refactor de breakpoints deba arreglar (está fuera del ámbito "sin cambio visual" — añadir estados de foco SÍ es un cambio visual, aunque sea uno deseable). Lo dejo documentado por si se quiere abrir una rama aparte.

---

## e) Overflow horizontal a 320px

Medido como `document.documentElement.scrollWidth - window.innerWidth` en Playwright, con el causante real localizado descartando contenedores con scroll interno propio (carruseles con `overflow-x:auto`, el ticker con `overflow:hidden`, ambos por diseño).

| Página | Overflow | Causa |
|---|---|---|
| `index.html` | **+12px** | `.collab-card` dentro de `.collab-grid` (2 columnas a `max-width:768px`) — el contenido de la tarjeta (nombre/texto) no cabe en el ancho de columna disponible; síntoma típico de grid-track con `min-width:auto` implícito |
| `ciudades-todas.html` | **+25px** | `.search-bar-input` / el `<input>` de búsqueda — no se contrae al ancho disponible a 320px |
| `ciudades.html` | Sin overflow (-15px de margen) | — |
| `ciudad.html` | **+14px** | `.topbar-right` — el grupo botón-volver + selector de idioma + icono de cuenta no cabe en 320px |
| `mapa.html` | **+24px** | Misma causa que `ciudad.html` — mismo `.topbar-right`, mismo patrón `header.topbar` con `backLink` |
| `alojamiento.html` | Sin overflow (-8px de margen) | — |
| `servicios.html` | Sin overflow (-15px de margen) | — |
| `viajes.html` | Sin overflow (-15px de margen) | — |

Los 4 casos con overflow son bugs preexistentes, no introducidos por este refactor — pero quedan fuera de su alcance arreglarlos ("no rediseñes nada", "sin cambio visual"). Los anoto para que quede constancia; si se quieren arreglar sería un fix aparte, no parte de esta rama.

---

## Requiere decisión de producto (resumen para el paso 2)

Casos donde forzar la migración cambiaría el aspecto en algún ancho real, por orden de riesgo:

1. **`max-width: 1024px` (fila 22, línea 4093)** — el más aislado, sin pareja en 900 ni 1200. Afecta a 10+ selectores de padding general (`.section`, `.cta-card`, etc.). El rango 900-1199px (o donde se decida el corte) cambiará de padding sí o sí.
2. **Grupo swap nav (filas 2, 3, 24)** — deben migrar juntas al mismo breakpoint nuevo o la navegación se rompe en el rango intermedio.
3. **Grupo `.events-scroll` (filas 10-14)** — cinco reglas coordinadas (767/768/900 hoy) que deben migrar como unidad.
4. **Scroll-scrub + su pareja de stacking (filas 8-9, línea 2567/2880)** — no migrar ninguna de las dos, es la excepción explícita del encargo.
5. **Resto de bloques a 767/768px sin pareja obvia** (filas 1, 4, 6, 10, 18, 20, 21) — cada uno migra a `--bp-md`(900) individualmente, cambiando el comportamiento en el rango 768-899px para ese selector concreto. Ninguno es tan grave como el 1024 o los grupos de arriba, pero son 7 cambios de comportamiento reales, no cosméticos.
6. **Alturas de header no unificables en un solo token** (sección b) — `--header-h: 73px` cubre bien `header.topbar` en escritorio, pero no `.topnav`(80px, protegido porque lo usa el scroll-scrub) ni `header.topbar` en móvil (65px/64px).

De los 27 `@media`, **11 migran limpio** (filas 5, 7, 12, 15, 16, 17, 19, 23, 25, 26, 27). Las otras **16** (filas 1, 2, 3, 4, 6, 8, 9, 10, 11, 13, 14, 18, 20, 21, 22, 24) necesitaban decisión sobre si aceptar el cambio de rango o dejarlas como excepción documentada.

## Decisión final (post paso 0)

- **Grupo swap nav (filas 2, 3, 24)** → **migrar a `--bp-md` (900)**. Se acepta que tablets 769-899px vean el bottom-nav de móvil en vez del menú de escritorio.
- **Grupo `.events-scroll` (filas 10, 11, 13, 14)** → **migrar a `--bp-md` (900)**. Se acepta que tablets 769-899px vean el carrusel horizontal en vez del grid de eventos.
- **`max-width: 1024px` (fila 22, línea 4093)** → **migrar a `--bp-lg` (1200)**. Se acepta que el rango 1024-1199px pierda el padding-mobile que tiene hoy (pasa a padding de escritorio antes de lo que debería).
- **Resto de sueltos a 767/768px (filas 1, 4, 6, 18, 20, 21)** → **migrar a `--bp-md` (900)**, mismo criterio que los grupos de arriba. Se acepta el cambio de comportamiento en el rango 768-899px para cada selector.
- **Scroll-scrub + su pareja de stacking (filas 8, 9, línea 2567/2880)** → **excepción, no se tocan**. Confirmado desde el encargo original.

Resultado: de los 27 `@media`, **25 pasan al sistema mobile-first de tres cortes** (11 ya exactos + 14 migrados por decisión) y **2 quedan como excepción documentada** (el par del scroll-scrub) — el balance que se buscaba desde el principio ("3 breakpoints limpios + excepciones documentadas, no regresiones invisibles").
