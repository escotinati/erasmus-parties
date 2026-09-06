# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Proyecto

**Erasmus Verified** — directorio de grupos de WhatsApp/Telegram para estudiantes Erasmus en 36+ países y 528+ ciudades europeas. También muestra un mapa interactivo con partners (locales nocturnos, alojamientos, etc.) por ciudad.

La misma web sirve **dos marcas** desde un solo código: "Erasmus Verified" (la web completa) y "Erasmus Parties" (solo la parte de fiestas/nightlife, en `erasmusparties.org`). Qué marca se muestra se decide automáticamente según el dominio — ver [Experiencia dual](#experiencia-dual-verified--parties) más abajo.

> **Nomenclatura de marca**: no cambiar las etiquetas de los grupos de WhatsApp/Telegram — son nombres de datos, no de marca.

**Stack**: HTML + CSS + JS vanilla (sin ES Modules, todo con `<script>` clásicos y funciones/objetos globales), más:

- **Vite** como build tool — ya no se abre `index.html` directamente, se usa `npm run dev` para desarrollar y `npm run build` para generar la carpeta `dist/` que se despliega.
- **Supabase** como backend — base de datos (Postgres) + login de administrador. Todas las páginas piden los datos de ciudades y partners a Supabase; no queda ningún dato estático de países/ciudades en el código (ver sección de Backend).
- **React** (`src/react/*`, vía `@vitejs/plugin-react`) — **única excepción** a "sin ES Modules": son islas de React dentro de HTML/scripts clásicos, no una migración completa. Tres islas hoy: el menú compartido de las 8 páginas públicas (ver [Navegación](#navegación)), las tarjetas de partners/eventos del home (ver [Tarjetas de resumen](#tarjetas-de-resumen-summarycard)) — la primera vez que React pintó contenido real de datos, no solo chrome de página — y la lista de categorías/partners del aside en `ciudad.html`/`mapa.html` (ver [Lista de partners](#lista-de-partners-partnercategorylist)).

**Herramientas de desarrollo**: Prettier instalado como devDependency (`npm install` para instalar). Configuración en `.prettierrc`: 4 espacios, comillas simples, semi. Un hook de Claude Code formatea automáticamente JS/CSS/HTML tras cada edición — no hace falta ejecutarlo manualmente.

**Comandos**:

- `npm run dev` — levanta el servidor de desarrollo de Vite (recarga en caliente)
- `npm run build` — genera la versión de producción en `dist/`
- `npm run preview` — sirve `dist/` en local para probar el build final
- `npm run format` — pasa Prettier a mano por todo el proyecto (normalmente no hace falta, ya hay un hook)

**Variables de entorno**: copiar `.env.example` a `.env.local` (este último **nunca se sube al repo**, está en `.gitignore`) y rellenar `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `VITE_CARTO_API_KEY` con los datos del proyecto de Supabase y de CARTO (ver [Tiles del mapa](#tiles-del-mapa)). Vite las inyecta como `window.__SUPABASE_URL__` / `window.__SUPABASE_KEY__` / `window.__CARTO_API_KEY__` en el `<head>` de cada página (ver `vite.config.js`).

## Arquitectura

Todo el JS de páginas y módulos compartidos vive ahora en `src/js/` (antes era `js/`). El CSS vive en `src/css/`. Sigue sin haber ES Modules: todo son `<script>` clásicos con funciones y objetos globales, para mantener coherencia entre archivos — salvo `src/react/` (las tres islas de React, ver Stack arriba, [Navegación](#navegación), [Tarjetas de resumen](#tarjetas-de-resumen-summarycard) y [Lista de partners](#lista-de-partners-partnercategorylist)), la única carpeta con JSX/ES Modules de verdad.

### Páginas y sus scripts

| Página                | Script               | Propósito                                                                                                              |
| --------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `index.html`          | `src/js/index.js`    | Autocomplete de búsqueda, hero con stats animadas, accordion grid de ciudades (con efecto pin & scrub al hacer scroll) |
| `ciudades-todas.html` | inline               | Listado completo de ciudades con filtro alfabético                                                                     |
| `ciudades.html`       | `src/js/ciudades.js` | Grid de ciudades de un país (hero con foto)                                                                            |
| `ciudad.html`         | `src/js/ciudad.js`   | Detalle de ciudad, botones WhatsApp/Telegram, mapa embebido                                                            |
| `mapa.html`           | `src/js/mapa.js`     | Mapa a pantalla completa con lista de partners                                                                         |
| `alojamiento.html`    | inline               | Página de alojamiento para estudiantes Erasmus                                                                         |
| `servicios.html`      | inline               | Servicios verificados: SIM, banca, transporte                                                                          |
| `viajes.html`         | inline               | Viajes en grupo para estudiantes Erasmus                                                                               |
| `admin/index.html`    | `src/js/admin.js`    | Panel de administración (login + gestión de ciudades/partners) — ver sección propia                                    |

### Módulos compartidos (cargados donde se necesitan)

- `src/js/lib/supabaseClient.js` — crea `window.supabaseClient`, el cliente de Supabase que usan todos los demás scripts para hablar con la base de datos.
- `src/js/services/citiesService.js` — funciones `fetchActiveCities()`, `fetchCityById(id)`, `fetchAllCities()` para leer ciudades desde Supabase.
- `src/js/services/partnersService.js` — función `fetchPartnersByCity(cityId)` (trae partners + sus links) y `groupPartnersByCategory(partners)`.
- `src/js/tracking.js` — función `trackEvent(nombre, datos)`; registra clics en links de partners (tabla `cta_clicks` en Supabase) y los imprime en consola para depurar.
- `src/js/experience.js` — decide si la página se muestra como "Verified" o "Parties" según el dominio. Se carga como primer script de cada página. Ver sección [Experiencia dual](#experiencia-dual-verified--parties).
- `src/js/geocoder.js` — cliente Nominatim + caché en localStorage (`erasmus_city_coords_v1`). Solo hace falta si una ciudad no trae ya sus coordenadas guardadas en Supabase.
- `src/js/map-helpers.js` — **único archivo que conoce Leaflet** (variable global `L`); cambiar proveedor de mapas = reescribir solo este archivo. Contiene `CATEGORY_META` con las categorías de partners y sus colores.
- `src/js/cityMap.js` — módulo reutilizable `mountCityMap(containerId, { pais, ciudad, interactive })`; devuelve una Promise con la instancia del mapa. Primero intenta usar coordenadas ya guardadas en Supabase antes de llamar al geocoder.
- `src/js/mapPartners.js` — UI de la lista de partners + sincronización con marcadores del mapa. Los partners ahora vienen de `partnersService.js` (Supabase), no de un array estático. Las cabeceras de categoría + filas de partner las pinta `PartnerCategoryList.jsx` (React) — ver [Lista de partners](#lista-de-partners-partnercategorylist).
- `src/react/Nav.jsx`, `TopbarNav.jsx`, `navShared.jsx` — el menú compartido, en React. Ver [Navegación](#navegación) para el detalle completo (qué página usa cuál, por qué existe, y una regla de arquitectura importante sobre `DOMContentLoaded` que aplica a todo lo que interactúe con estos componentes desde fuera).
- `src/react/SummaryCard.jsx`, `SummaryCardGrid.jsx`, `mount-summary-cards.jsx` — las tarjetas de partners (home) y eventos (fiestas), en React. Ver [Tarjetas de resumen](#tarjetas-de-resumen-summarycard) para el detalle completo y dos bugs reales ya corregidos ahí que conviene no repetir.
- `src/react/PartnerCategoryList.jsx`, `mount-partner-list.jsx` — la lista de categorías/partners del aside en `ciudad.html`/`mapa.html`, en React. Ver [Lista de partners](#lista-de-partners-partnercategorylist).

## Backend (Supabase)

La base de datos y el panel de administración viven en un proyecto de Supabase (Postgres + Auth). Las ciudades y partners **no se añaden editando código** — se hace desde el panel de administración en `/admin` (ver sección siguiente).

### Tablas principales

- `cities` — ciudades: nombre, país, bandera, descripción, imagen, coordenadas, link de WhatsApp, si está activa, prioridad de orden.
- `partners` — partners de una ciudad: nombre, categoría, descripción, imagen, coordenadas, si está activo, prioridad.
- `partner_links` — los enlaces de cada partner (web, entradas, WhatsApp, etc.), ligados a `partners` por `partner_id`.
- `partner_events` — eventos/noches de un partner (título, descripción, imagen, fecha, precio, enlace de entradas), ligados a `partners` por `partner_id`. Alimentan la sección "Trending nights" del home (visible en ambas experiencias, Verified y Parties — no es una página separada).
- `cta_clicks` — un registro por cada clic en un enlace de partner, para saber qué se usa más. Se alimenta desde `tracking.js`.
- `admins` — lista de usuarios (por `user_id` de Supabase Auth) que tienen permiso para escribir en las tablas de arriba. **Esto es lo único que decide quién puede editar datos** — no basta con iniciar sesión, hay que estar en esta tabla.

### Seguridad (importante)

Como esta web no tiene servidor propio, la única cosa que protege los datos es la configuración de Postgres (Row Level Security / RLS):

- Cualquier visitante puede **leer** ciudades y partners activos (son públicos, se ven sin iniciar sesión).
- Solo un usuario que esté en la tabla `admins` puede **crear, editar o borrar** ciudades, partners o sus links.
- La "anon key" que aparece en `.env.local` es pública a propósito (viaja al navegador de cualquier visitante) — nunca hay que poner ahí la "service role key", que sí es secreta.
- Antes de tocar políticas de RLS o la tabla `admins`, revisar bien el cambio: un error aquí puede dejar la web sin protección de escritura.

## Panel de administración (`/admin`)

Herramienta interna (no aparece en la navegación pública) para gestionar ciudades y partners sin tocar código:

- **Login**: email + contraseña (Supabase Auth). Solo entran quienes ya tienen cuenta creada y están en la tabla `admins`.
- **Ciudades**: crear, editar, activar/desactivar. El slug se genera automático a partir del nombre.
- **Partners**: crear, editar, activar/desactivar, gestionar sus links (web, entradas, etc.).
- **Extractor de coordenadas**: pegando una URL de Google Maps se rellenan solos los campos de latitud/longitud (`extractCoordsFromGoogleMapsUrl` en `admin.js`).
- **Reporte de clics**: un resumen de los clics registrados en `cta_clicks` durante los últimos 30 días, agrupados por partner.

Todo el HTML/JS que pinta listas dinámicas en el panel escapa los textos que vienen de la base de datos (función `escapeHtml` en `admin.js`) para evitar que un dato mal formado rompa la página o inyecte código.

## Experiencia dual (Verified / Parties)

`src/js/experience.js` es el primer script que carga cada página. Decide qué "experiencia" mostrar:

- Mirando el dominio (`erasmusparties.org` → experiencia "Parties"; cualquier otro dominio → "Verified", que es la experiencia por defecto).
- Se puede forzar en local añadiendo `?exp=parties` o `?exp=verified` a la URL, sin tener que cambiar de dominio.

El resultado se guarda en `window.ERASMUS_EXPERIENCE` para que el resto de scripts lo puedan leer, y se añade una clase (`theme-verified` o `theme-parties`) al `<html>` para pintar los colores correctos.

En la experiencia "Parties" además se ocultan los enlaces a Servicios/Alojamiento/Viajes y el logo cambia a "Erasmus Parties"; se añade un enlace "Verified ↗" para volver a la web completa. **En el nav** (menú de arriba) esto lo resuelve directamente `Nav.jsx`/`TopbarNav.jsx` leyendo `window.ERASMUS_EXPERIENCE` al renderizar — ver [Navegación](#navegación). Fuera del nav (footer, y cualquier `<a href="servicios.html">` etc. suelto en el HTML) lo sigue haciendo `experience.js` por JS tras `DOMContentLoaded`, como antes.

## Cómo añadir datos

Nueva ciudad o partner: usar el panel de administración en `/admin` (ver sección de arriba) — es la única forma, no hay ninguna página que siga leyendo de un archivo estático. Los datos quedan en Supabase y aparecen automáticamente en home, ciudad, ciudades del país, listado completo y mapa. Ver los skills `/add-city` y `/add-partner` si quieres que Claude te guíe paso a paso con los campos exactos del formulario.

## Mapa interactivo

### `mountCityMap(containerId, { pais, ciudad, interactive })`

- `interactive: true` — usado en **ambas** páginas: `ciudad.html` y `mapa.html`. Ya no hay overlay "toca para interactuar"; el mapa responde directamente al toque/click.

En `ciudad.html` el mapa está dentro de `.city-map-columns` con layout de dos columnas en desktop (75 % mapa / 25 % lista de partners). En móvil el mapa usa `position: sticky` para quedarse visible mientras el usuario hace scroll por la lista.

La variable CSS `--topbar-h` se inyecta dinámicamente en `src/js/ciudad.js` leyendo `header.topbar.offsetHeight`, y la usa tanto el `top` del sticky como el `padding-top` del móvil-nav.

### Geocodificación

`src/js/geocoder.js` llama a la API pública de Nominatim (OpenStreetMap) solo si una ciudad no tiene ya coordenadas guardadas en Supabase, luego las almacena en localStorage. No hay rate limiting implementado — añadir ciudades una a una si se geocodifican en batch.

### Tiles del mapa

CARTO Light (`light_all`) vía CDN. La atribución a OpenStreetMap + CARTO es **obligatoria por licencia** y ya está incluida en `initMap()`.

**Motivo del error "API KEY REQUIRED"**: hasta finales de agosto de 2026, `basemaps.cartocdn.com` servía las tiles ráster de forma anónima y gratuita, sin necesidad de cuenta ni key (así se montó originalmente el proyecto). Ese mes CARTO cambió su política — sin previo aviso al proyecto — y empezó a exigir una API key para ese mismo endpoint; las peticiones sin key pasaron a servirse con una marca de agua "API KEY REQUIRED" sobre el mapa. No fue un cambio de código ni de tráfico del proyecto, sino una decisión de CARTO (confirmado por reportes idénticos de otros proyectos —Home Assistant, openHAB, Grafana— exactamente esas mismas fechas). CARTO además avisa de que este servicio ráster (PNG) se irá retirando a medio plazo en favor de su nuevo servicio de tiles vectoriales.

**Solución aplicada**: pedir una API key gratuita de CARTO (gratis hasta 5M tiles/mes, sin tarjeta — [carto.com/basemaps/apikey](https://carto.com/basemaps/apikey/)), gestionada con la cuenta **suarez91alvaro@gmail.com**. Se configura como `VITE_CARTO_API_KEY` en `.env.local`; `initMap()` la lee de `window.__CARTO_API_KEY__` (inyectada por `vite.config.js`) y la añade como parámetro `?key=` a la URL de tiles, que también pasó a usar la ruta `rastertiles/light_all/...` (formato nuevo exigido junto con la key, sustituye a la ruta antigua `light_all/...`).

**Alternativas consideradas y descartadas** (por si esta key deja de ser viable en el futuro):

- **Proveedor gratuito sin cuenta** (Esri "World Light Gray Base" u OpenStreetMap estándar): sin key ni registro, pero cambia ligeramente el aspecto visual (gris en vez del blanco actual) y depende de las políticas de uso gratuito de ese proveedor, que también podrían cambiar sin aviso.
- **Migrar a Google Maps JavaScript API**: Google no ofrece tiles sueltas compatibles con Leaflet (no hay URL de tiles oficial tipo `.../{z}/{x}/{y}.png`, solo su propia librería `google.maps.Map`) — usar sus tiles con Leaflet requeriría URLs no oficiales que incumplen sus términos de servicio. La vía legítima implicaría sustituir Leaflet por la Google Maps JS API (cambio de código más grande, aunque contenido en `map-helpers.js` por diseño) y una cuenta de Google Cloud con facturación activada (tarjeta), con ~$200/mes gratis y pago por uso después.

## Tarjetas de resumen (SummaryCard)

El grid de partners del home (sección "Descubre partners") y la sección "Trending nights" (fiestas) ya no construyen sus tarjetas a mano con `innerHTML` — usan un componente React compartido. Es la **segunda isla de React** del proyecto (la primera es el menú, ver [Navegación](#navegación) más abajo) y la primera que pinta contenido real de datos, no solo chrome de página.

### Qué hace cada archivo

| Archivo                             | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/react/SummaryCard.jsx`         | Componente presentacional de **una** tarjeta (sin fetch ni estado propio). Prop `variant: 'partner' \| 'event'` decide qué campos mostrar — la variante evento **nunca** muestra descripción, aunque el dato venga relleno desde Supabase — y si el CTA está siempre visible o solo al hacer hover (`ctaAlwaysVisible`, resuelto reutilizando las clases `.partner-card-cta`/`.event-cta-btn` que ya existían en `styles.css`, sin CSS nuevo). Sanea `imageUrl`/`ctaHref` con `sanitizeUrl()` antes de usarlos en `src`/`href`.               |
| `src/react/SummaryCardGrid.jsx`     | Itera una lista de `items` y monta un `<SummaryCard>` por cada uno. No sabe qué es un partner ni un evento — esa traducción la hace `getCardProps(item, index)`, una función que le pasa el padre (`getPartnerCardProps`/`getEventCardProps`, ver abajo).                                                                                                                                                                                                                                                                                     |
| `src/react/mount-summary-cards.jsx` | Expone `window.mountSummaryCards(containerEl)` — el puente para que `index.js`/`nightsSection.js` (scripts clásicos, sin `import`) creen un root de React sobre `#partnerGrid`/`.events-scroll` **una única vez** y vuelvan a pintar sobre ESE MISMO root en cada cambio de filtro, sin destruirlo y recrearlo. Es el primer puente module→script-clásico del proyecto: hizo falta porque, a diferencia del nav (que se monta una vez y no vuelve a renderizarse), estas tarjetas sí necesitan repintarse repetidamente desde código clásico. |

`renderPartnersSection()` (`index.js`) y `renderEventCards()` (`nightsSection.js`) arman las props de cada tarjeta con `getPartnerCardProps()`/`getEventCardProps()` y llaman a `.render(items, variant, getCardProps)` sobre el root creado la primera vez.

### Dos bugs reales ya corregidos aquí — no los repitas en la próxima isla de React

1. **`mountSummaryCards()` vacía el contenedor a mano** (`containerEl.innerHTML = ''`) antes de `createRoot()`. `createRoot()` (React 18) **no** borra los hijos preexistentes del contenedor al montarse — eso solo pasaba con la antigua `ReactDOM.render()` (React ≤17). Sin este vaciado explícito, el esqueleto de carga (`Skeleton.render()`, DOM imperativo pintado ANTES de que exista el root) se quedaba mezclado para siempre con las tarjetas reales.
2. **`initScrollReveal()` se dispara dentro de `SummaryCardGrid.jsx`, en un `useEffect`** — nunca justo después de llamar a `.render()` desde `index.js`/`nightsSection.js`. Un `root.render()` sobre un root **ya montado** es una actualización normal de React, no el mount inicial, y esas actualizaciones no se comprometen al DOM de forma síncrona. Un script clásico que llamara a `initScrollReveal()` en la línea siguiente podía correr antes de que las tarjetas nuevas existieran de verdad — su `querySelectorAll` no encontraba nada que observar, y esas tarjetas se quedaban con la clase `anim-slam`/`anim-fade-up` pero sin `is-visible`, en `opacity: 0` para siempre.

**Regla general para la próxima isla de React que se añada**: cualquier efecto que dependa de que el DOM ya refleje el último render (medirlo, leerlo, engancharle un `IntersectionObserver`...) va DENTRO del componente (`useEffect`/`useLayoutEffect`), nunca en el script clásico que llama a `.render()` justo después. Es el mismo tipo de carrera que la regla de `DOMContentLoaded` del nav (ver más abajo) — misma solución: resolverlo dentro de React, no confiar en que un script externo acierte el timing.

## Lista de partners (PartnerCategoryList)

La cabecera de categoría (pastilla de activar/desactivar, o heading simple si la ciudad solo tiene una categoría con partners) + la lista de partners de esa categoría, en el aside de `ciudad.html`/`mapa.html`, ya no se construyen a mano con DOM imperativo (`buildGroupSection()`) — usan un componente React compartido. Es la **tercera isla de React** del proyecto (ver [Tarjetas de resumen](#tarjetas-de-resumen-summarycard) para la segunda) y la primera con foto de contenido real (miniatura de partner, 28px) en la propia fila, no solo en la tarjeta de resumen.

### Qué hace cada archivo

| Archivo                             | Qué hace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/react/PartnerCategoryList.jsx` | Componente presentacional (sin fetch ni estado propio, como `SummaryCard`). Recibe `{ groups, activeCategories, onToggleCategory, onSelectPartner }` — cada grupo llega con `label`/`icon`/`color` **ya resueltos**, porque `CATEGORY_META` (`map-helpers.js`) es un `const` de script clásico y no vive en `window`: un módulo ES no puede leerlo como identificador suelto. `mapPartners.js` hace esa traducción de dominio una sola vez (`listGroups`), igual que `getPartnerCardProps()`/`getEventCardProps()` para `SummaryCard`. Sanea `partner.image_url` con `sanitizeUrl()` antes de usarlo en `src`; si no hay imagen válida, no renderiza la etiqueta `<img>` en absoluto — sin hueco ni icono roto. |
| `src/react/mount-partner-list.jsx`  | Expone `window.mountPartnerCategoryList(containerEl)` — mismo patrón que `mount-summary-cards.jsx`: vacía el contenedor antes de `createRoot()` y devuelve `{ render(groups, activeCategories, onToggleCategory, onSelectPartner) }` para que `mapPartners.js` repinte sobre ESE MISMO root en cada `toggleCategory()` y en el flujo de deep-link `?partner=`.                                                                                                                                                                                                                                                                                                                                                  |

`renderList()` (`mapPartners.js`) crea el root una única vez (`if (!categoryListRoot) categoryListRoot = mountPartnerCategoryList(listReactHost)`) y llama a `.render(listGroups, state.activeCategories, toggleCategory, selectPartner)` sobre él en cada cambio.

### Tercer caso real de "un root de React necesita su propio contenedor dedicado" — no lo repitas en la próxima isla

Los dos casos ya documentados arriba (`mountSummaryCards()` vaciando su contenedor a mano; `initScrollReveal()` dentro de un `useEffect`) son sobre _cuándo_ React toca el DOM. Este es sobre _qué otro contenido_ puede — o no — convivir en el mismo contenedor que un root de React:

`renderList()` necesitaba seguir mostrando un `<p class="partners-count">` (texto de recuento, solo cuando la ciudad tiene una única categoría con partners — sin control de activar/desactivar, nada que filtrar) **antes** de la lista, como DOM plano fuera de React — ese texto no forma parte de los props que recibe `PartnerCategoryList.jsx`. El primer intento fue montar el root directamente sobre el aside completo (`container`, el mismo que recibía `Skeleton.render()`), igual que hace `mountSummaryCards(grid)` sobre `#partnerGrid`. Eso rompía el texto de recuento: un root de React asume propiedad **exclusiva** de todo lo que hay dentro de su contenedor, así que cualquier nodo que no gestione él (como ese `<p>` añadido a mano) queda en una posición indefinida en cuanto React vuelve a renderizar.

La solución: `mountPartnerCategoryList()` se monta sobre un `<div>` propio (`listReactHost`), creado una vez como hijo de `container` — nunca sobre `container` directamente. El `<p class="partners-count">` sigue viviendo como hermano DOM plano de ese `<div>`, insertado siempre con `container.insertBefore(buildCountText(...), listReactHost)` para conservar el mismo orden visual que tenía antes de la migración (el texto de recuento arriba, la lista debajo) — verificado con Playwright: el `<p>` aparece por delante del primer `.partner-group` tanto en el DOM (`compareDocumentPosition`) como en pantalla (`getBoundingClientRect().top`).

**Regla**: si una isla de React necesita compartir un contenedor con DOM que NO gestiona (un texto, un botón suelto, un `Skeleton.render()` previo que hay que limpiar primero), no montes el root directamente sobre ese contenedor — créale un `<div>` hijo dedicado y usa `insertBefore`/`appendChild` alrededor de él para el resto del contenido. Montar el root sobre un contenedor compartido solo funciona cuando React es dueño de TODO lo que hay dentro (como `#partnerGrid`, que `mountSummaryCards()` sí puede vaciar entero sin perder nada).

## Navegación

El menú de las 8 páginas públicas (todo salvo `/admin`) es **React** (`src/react/Nav.jsx` / `TopbarNav.jsx`, ver más abajo) — antes era HTML duplicado byte a byte en cada página, ahora vive en un único sitio. Sigue habiendo tres estilos visuales de header según la página (heredados del diseño previo a la migración), pero los tres los renderiza el mismo par de componentes.

### Patrones de header y qué los monta

| Patrón CSS             | Páginas                                                                         | Componente                                   | Script de montaje           |
| ---------------------- | ------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------- |
| `.topnav`              | `index.html`, `ciudades-todas.html`                                             | `Nav.jsx`                                    | `mount-nav.jsx`             |
| `header.topbar`        | `ciudad.html`, `mapa.html`, `servicios.html`, `viajes.html`, `alojamiento.html` | `TopbarNav.jsx` (`as="header"`, por defecto) | `mount-topbar-nav.jsx`      |
| `.hero-legacy .topbar` | `ciudades.html`                                                                 | `TopbarNav.jsx` (`as="div"`)                 | `mount-hero-legacy-nav.jsx` |

Cada página tiene un `<div id="nav-root"></div>` seguido de `<script type="module" src="/src/react/mount-*.jsx">` en el sitio donde antes iba el header estático — Vite descubre esos scripts automáticamente por estar referenciados desde un HTML ya registrado en `vite.config.js`, no hace falta añadirlos a mano. `Nav.jsx` incluye además el icono de cuenta (`#authBtn`, placeholder sin login todavía) y `TopbarNav.jsx` acepta un prop `backLink` opcional:

- `ciudad.html` / `mapa.html`: llevan botón de "volver", configurado justo antes del `<script type="module">` con una línea `window.__BACK_LINK__ = { i18nKey, label, href }` — sus propios scripts (`ciudad.js`/`mapa.js`) sobreescriben `href`/texto tras cargar datos de Supabase.
- `ciudades.html`: el back-link va hardcodeado en `mount-hero-legacy-nav.jsx` (siempre "Todos los países" → `index.html`, nunca cambia).
- El resto de páginas del patrón `header.topbar` no pasan `backLink` y `TopbarNav.jsx` no lo renderiza.

Visualmente los tres patrones están **unificados**: mismo truco de grid de 3 columnas (`1fr auto 1fr`) que centra los links en todo el ancho de la barra, mismo icono de cuenta, y el mismo subrayado degradado en hover/foco (antes solo existía en `index.html`, escapado bajo `body.home-page`; ahora vive bajo los selectores `.topnav`/`.topbar` directamente en `src/css/layout.css`, así que aplica a las 8 páginas).

`.mobile-nav` (el overlay del menú móvil) y el toggle de la hamburguesa también los renderiza React (`MobileNavOverlay` en `navShared.jsx`) — no queda ningún bloque `<div class="mobile-nav">` estático en el HTML. En móvil el hamburguesa queda oculto por CSS (`display: none` — la navegación la gestiona el bottom-nav), así que en la práctica solo se ve en desktop.

### Regla de arquitectura: nada de `DOMContentLoaded` para tocar el nav

Todo lo que antes hacían scripts externos "buscando" nodos del nav después de que la página cargara (sombra de scroll al hacer scroll, aplicar el tema Parties, año/idioma del lang-switcher) se movió **dentro** de los componentes React, en su primer render o en un `useEffect`. Motivo, comprobado en la práctica y no solo en teoría: un script clásico enganchado a `DOMContentLoaded` que hace `document.getElementById('topNav')` puede disparar **antes** de que React haya terminado de montar (el commit real al DOM de `createRoot().render()` lo encola el scheduler de React, y en dev con Vite eso puede tardar más que el resto del parseo) — se comprobó con una sombra de scroll que fallaba el 100% de las veces con este patrón.

Por eso:

- `Nav.jsx`/`TopbarNav.jsx` leen `window.ERASMUS_EXPERIENCE` (tema Parties) y `window.I18n` (idioma/traducciones) directamente al renderizar, en vez de depender de que `experience.js`/`applyTranslations()` los mute después.
- Las mutaciones que SÍ siguen en `experience.js` (porque también afectan a HTML estático fuera del nav, como el footer) llevan un guard `if (el.closest('[data-react-nav]')) return;` para no tocar dos veces lo que el componente React ya resolvió. `data-react-nav="true"` está en el `<nav>`/`<header>`/`<div>` raíz y en el overlay móvil de ambos componentes.
- `langSwitcher.js` tiene el mismo guard — el botón `#lang-switcher` dentro del nav lleva su propio `onClick` en React; `langSwitcher.js` solo actúa si el botón que encuentra **no** está dentro de `[data-react-nav]` (páginas fuera de esta migración, si las hubiera en el futuro).

**Si se añade algo nuevo que necesite tocar el nav desde fuera, no uses `DOMContentLoaded` + `querySelector` — o se resuelve dentro del componente React, o se acepta que puede fallar de forma intermitente.**

### Bottom-nav (móvil, `<768px`)

Clase `.app-bottom-nav` — `position: fixed; bottom: 0; height: 60px; z-index: 500`. Sigue siendo HTML estático (no migrado a React) en cada página pública (no en `/admin`). Contenido:

- `index.html`: **4 ítems** — Servicios (`storefront`), Viajes (`flight`), Fiestas (`nightlife`, magenta `#e1147b`, `target="_blank"`), y **Cuenta** (`#authBtnMobile`, placeholder sin login todavía — mismo criterio que `#authBtn` del nav de escritorio, colocado el último a propósito, que es donde apps con bottom-nav suelen poner cuenta/perfil).
- Resto de páginas públicas: **3 ítems** — Servicios, Viajes, Fiestas (sin Cuenta).

El ítem activo se detecta con `window.location.pathname` y recibe `.app-bottom-nav-item--active`; ese trocito de JS sigue siendo un `<script>` inline por página (no se ha migrado, es la única pieza de navegación que no vive en React):

```js
var page =
    (window.location.pathname.split('/').pop() || 'index.html').split('?')[0] || 'index.html';
// app-bottom-nav-item → clase app-bottom-nav-item--active
```

En móvil el cuerpo tiene `padding-bottom: 68px` para compensar la barra.

## CSS

Sistema de diseño basado en Material Design 3 (tokens `--md-*`). Variables clave:

- `--primary: #4648d4`, `--secondary: #a93349`
- `--topbar-h` — altura real del `header.topbar`, inyectada por JS en `src/js/ciudad.js`; usada por `top` del mapa sticky y `padding-top` del mobile-nav dropdown
- Tipografía: Syne (display, `--font-display`) + Inter (body, `--font-body`), cargadas desde Google Fonts
- Iconos: Material Symbols Outlined (CDN)
- Contenedor máximo: `1280px`, gutter `24px`

Los alias legacy (`--bg`, `--text`, `--accent`) existen solo para las páginas más antiguas.

### Estructura de `src/css/`

`styles.css` ya no contiene reglas propias — es solo un manifiesto de `@import` que las 9 páginas públicas siguen cargando con el mismo `<link rel="stylesheet" href="/src/css/styles.css">` de siempre (no hubo que tocar ningún HTML). Vite resuelve esos `@import` tanto en dev (cada archivo se sirve y recarga por separado) como en build (los une en un único CSS por página, igual que cuando era un solo fichero — verificado que el CSS final compilado es byte a byte idéntico al de antes de la separación).

El **orden** de los `@import` en `styles.css` importa: es exactamente el orden en el que vivían estas secciones dentro del monolito original. No lo reordenes sin comprobar antes que ninguna regla dependa de la cascada entre archivos.

| Archivo                    | Contenido                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `base.css`                 | `:root` tokens (`--md-*`), temas `.theme-verified`/`.theme-parties`, reset, utilidades, tipografía base                                                                        |
| `components.css`           | Buttons, badges, cards, forms/inputs, bottom-nav, Sheet, Skeleton                                                                                                              |
| `layout.css`               | Top nav/header (`.topnav`, `.topbar` — el HTML lo renderiza React, ver [Navegación](#navegación), pero las clases y este archivo no cambiaron), footer, hero, section wrappers |
| `pages/home.css`           | Accordion grid de ciudades, nights section, services section, CTA (`index.html`)                                                                                               |
| `pages/ciudades-todas.css` | `.all-cities-hero` — el resto de estilos de esa página (`.filter-bar`, `.city-items-grid`...) siguen en el `<style>` inline de `ciudades-todas.html`                           |
| `pages/ciudad.css`         | Layout de ciudad, mapa embebido, partners list                                                                                                                                 |
| `pages/mapa.css`           | `.map-page-main`, `.map-canvas`, `.erasmus-pin__dot`, map-with-list                                                                                                            |
| `pages/servicios.css`      | `body.servicios-page` (gradiente), `.servicios-category`, `.services-grid--2col`                                                                                               |
| `pages/viajes.css`         | `.event-badge--partner`, `body.viajes-page .event-price`                                                                                                                       |
| `pages/alojamiento.css`    | Estilos propios de `alojamiento.html`                                                                                                                                          |
| `responsive.css`           | Media queries globales que afectan a múltiples archivos                                                                                                                        |
| `transitions.css`          | View Transitions entre páginas                                                                                                                                                 |

El panel de administración tiene su propio archivo separado, `src/css/admin.css` (no se toca en este split), y `animations.css` (scroll-reveal) también sigue siendo su propio archivo — ninguno de los dos pasa por `styles.css`.

`.hamburger-btn` no tiene ningún `display: flex` en ninguna parte del CSS — es `display: none` en todos los anchos (la navegación móvil la gestiona el bottom-nav, ver [Navegación](#navegación)); si algún día se reactiva el menú hamburguesa, vigilar el orden entre `components.css` (bottom-nav) y `layout.css` (top nav/header), que es donde antes vivía este conflicto.

### Estilos específicos de página

Para añadir CSS exclusivo de una página sin contaminar el global, usar una clase en el `<body>`:

- `servicios.html` → `<body class="servicios-page">` → reglas en `pages/servicios.css`
- `viajes.html` → `<body class="viajes-page">` → reglas en `pages/viajes.css`
- `ciudades-todas.html` → bloque `<style>` inline en el `<head>` (excepción deliberada: la mayoría de estilos de esa página son exclusivos suyos y no justifican clase de body — solo `.all-cities-hero` se comparte vía `pages/ciudades-todas.css`)

### Convenciones de componentes

- **Eyebrows de categoría** (`.eyebrow`): usar siempre `eyebrow--primary` (azul `#4648d4`) para categorías de contenido. `eyebrow--secondary` (rojo `#a93349`) queda reservado para destacar la marca o alertas.
- **CTAs de service-card**: usar `<a class="btn-primary-pill">` en lugar de `<a class="service-link">`. `.service-link` con flecha `arrow_forward` queda descartado.

### Zonas responsivas clave

- `@media (min-width: 900px)` — desktop: ciudad-page max-width 1000px; `.city-map-columns` en fila 75/25
- `@media (max-width: 768px)` — móvil: bottom-nav visible, hamburger y mobile-nav ocultos, `body { padding-bottom: 68px }`
- `@media (max-width: 600px)` — móvil pequeño: grids de 2 columnas

## Dependencias externas

Vía CDN, sin instalación:

- Leaflet 1.9.4 — `unpkg.com`
- Supabase JS SDK (versión UMD) — `cdn.jsdelivr.net`, crea el objeto global `supabase` que usa `supabaseClient.js`
- Google Fonts — Syne + Inter
- Material Symbols Outlined — Google
- Nominatim — API pública de OpenStreetMap (geocodificación)
- Unsplash — imágenes de países y ciudades

Instaladas vía npm (ver `package.json`):

- `vite` + `vite-plugin-static-copy` — build tool
- `@vitejs/plugin-react` — transforma el JSX de `src/react/*` (ver [Navegación](#navegación) y [Tarjetas de resumen](#tarjetas-de-resumen-summarycard))
- `react` + `react-dom` — para las dos islas de React del proyecto (menú y tarjetas de resumen), no hay más React fuera de `src/react/`
- `@supabase/supabase-js` — cliente de Supabase (aunque en el navegador se usa la versión CDN cargada como `<script>`, no este paquete)
- `prettier` — formateo de código

## Convenciones de commits y ramas

- Commits con prefijo convencional: `feat:`, `fix:`, `refactor:`, `docs:`
- Ramas de feature: `feature/nombre-descriptivo`
- PRs hacia `main`; `main` se despliega automáticamente vía GitHub Pages / Netlify / Vercel
