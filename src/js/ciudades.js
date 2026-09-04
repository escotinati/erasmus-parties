// ─────────────────────────────────────────────────────────────
//  CIUDADES.JS — Erasmus Verified / Erasmus Parties
//
//  Grid de ciudades de un país. Antes leía del objeto estático
//  COUNTRIES (data.js); ahora pide el directorio completo a Supabase
//  vía fetchAllCities() (citiesService.js) y filtra en cliente por
//  país — así se ven TODAS las ciudades del país, tengan o no grupo
//  activo todavía (directorio completo, no solo active=true).
// ─────────────────────────────────────────────────────────────

const ARROW_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M7 17L17 7M17 7H7M17 7v10"/></svg>`;

// escapeHtml() vive ahora en src/js/utils/sanitize.js (window.escapeHtml),
// cargado antes que este script en ciudades.html — no se duplica aquí.

async function initCiudadesPage() {
    const params = new URLSearchParams(window.location.search);
    const paisName = params.get('pais') || '';

    // Skeleton antes del fetch — no se sabe todavía cuántas ciudades
    // tendrá el país, 6 es una aproximación razonable. Si el resultado
    // acaba siendo el caso de error de más abajo, el propio
    // document.body.innerHTML lo sustituye entero, sin dejar rastro.
    const gridEl = document.getElementById('citiesGrid');
    if (gridEl) {
        Skeleton.render(gridEl, 6, () => {
            const card = document.createElement('div');
            card.className = 'city-card';
            card.appendChild(Skeleton.block('skeleton--fill'));
            return card;
        });
    }

    const allCities = await fetchAllCities();
    const cities = allCities
        .filter((c) => c.country === paisName)
        .sort((a, b) => a.name.localeCompare(b.name, 'es'));

    if (!paisName || cities.length === 0) {
        document.body.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;height:100vh;
                color:var(--on-surface-variant);font-family:'Inter',sans-serif;font-size:15px;">
      ${I18n.t('errors.country_not_found')}&nbsp;
      <a href="index.html" style="color:var(--primary);">${I18n.t('nav.back_to_home')}</a>
    </div>`;
        return;
    }

    document.title = `${paisName} — Erasmus Verified`;

    // No hay ya un "hero image" propio del país (data.js lo tenía como
    // country.heroImg, un campo que no existe en la tabla cities) — se
    // usa la imagen de la primera ciudad (orden alfabético) como fondo,
    // mejor que dejarlo vacío.
    // cities[0].image_url es de Supabase, editable desde /admin. Hacen falta
    // DOS comprobaciones distintas, no una: sanitizeUrl valida el ESQUEMA
    // (rechaza javascript:/data:/etc.), pero el valor sigue viajando dentro
    // de url('...') en CSS, donde una comilla o un paréntesis en la URL
    // rompen la cadena y permiten inyectar CSS arbitrario aunque el esquema
    // sea http/https válido. JSON.stringify() sobre la URL ya validada la
    // devuelve entrecomillada y con esos caracteres escapados — soluciona el
    // problema de entrecomillado, no el de esquema, por eso van las dos.
    const heroBg = document.getElementById('heroBg');
    const safeImageUrl = sanitizeUrl(cities[0].image_url);
    if (heroBg && safeImageUrl) {
        heroBg.style.backgroundImage = `url(${JSON.stringify(safeImageUrl)})`;
    }

    const heroFlag = document.getElementById('heroFlag');
    const heroTitle = document.getElementById('heroTitle');
    const heroCityCount = document.getElementById('heroCityCount');
    const sectionCount = document.getElementById('sectionCount');

    if (heroFlag) heroFlag.textContent = cities[0].flag || '';
    if (heroTitle) heroTitle.textContent = paisName;
    if (heroCityCount)
        heroCityCount.textContent = `${cities.length} ${I18n.t('cities.count_available_suffix')}`;
    if (sectionCount)
        sectionCount.textContent = `${cities.length} ${I18n.t('cities.count_suffix_plural')}`;

    const grid = document.getElementById('citiesGrid');
    const count = cities.length;
    if (count <= 3) grid.classList.add('cols-3');
    if (count === 2) grid.classList.add('cols-2');

    Skeleton.clear(grid);
    grid.innerHTML = cities
        .map(
            (city, i) => `
    <a class="city-card anim-fade-up anim-delay-${(i % 8) + 1}" href="ciudad.html?ciudad=${city.id}">
      <img class="card-img" src="${escapeHtml(city.image_url)}" alt="${escapeHtml(city.name)}" loading="lazy"/>
      <div class="card-overlay"></div>
      <div class="card-arrow">${ARROW_SVG}</div>
      <div class="card-body">
        <div class="card-name">${escapeHtml(city.name)}</div>
        <span class="card-tag">${I18n.t('cities.active_groups_tag')}</span>
      </div>
    </a>
  `
        )
        .join('');

    if (window.initScrollReveal) window.initScrollReveal();
}

document.addEventListener('DOMContentLoaded', initCiudadesPage);
