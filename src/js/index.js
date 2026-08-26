// ─────────────────────────────────────────────────────────────
//  INDEX.JS — Erasmus Verified · Home
//  - Autocomplete en search bar (ciudades desde Supabase) + chip
//    de ciudad activa
//  - Bento grid con rotación aleatoria cada 30s
//  - Ticker de marca
//  - Grid de partners de la ciudad activa, con pills de categoría
//  - Stats animados (ciudades activas / partners de la ciudad activa)
//  - Animación de entrada del H1 (palabra a palabra)
// ─────────────────────────────────────────────────────────────

// ── ESTADO ───────────────────────────────────────────────────
// Nada de esto se comparte con otras páginas — vive solo aquí,
// scoped a index.html, como el resto de scripts del proyecto.

let allCitiesCache = [];
let selectedCity = null;
let cityPartnersCache = new Map(); // cityId -> partners (fetchPartnersByCity)
let activeCategory = null; // null = "Todo"

// Categorías reales que existen hoy en partners.category, mapeadas a
// las etiquetas que pide cada experiencia. "Comunidad"/"Grupos" y
// "Viajes" quedan fuera: no hay categoría/datos que los respalden en
// Supabase todavía (ver CLAUDE.md / decisión de la rama).
const HOME_CATEGORIES_VERIFIED = [
    {
        key: 'housing',
        pillKey: 'home.filter_housing',
        eyebrowKey: 'home.partners_eyebrow_housing',
        titlePrefixKey: 'home.partners_title_housing_prefix',
    },
    {
        key: 'services',
        pillKey: 'home.filter_services',
        eyebrowKey: 'home.partners_eyebrow_services',
        titleFixedKey: 'home.partners_title_services',
    },
];

const HOME_CATEGORIES_PARTIES = [
    {
        key: 'nightlife',
        pillKey: 'home.filter_nightlife',
        eyebrowKey: 'home.partners_eyebrow_nightlife',
        titlePrefixKey: 'home.partners_title_nightlife_prefix',
    },
];

function isPartiesExperience() {
    return window.ERASMUS_EXPERIENCE && window.ERASMUS_EXPERIENCE.theme === 'theme-parties';
}

function getHomeCategories() {
    return isPartiesExperience() ? HOME_CATEGORIES_PARTIES : HOME_CATEGORIES_VERIFIED;
}

function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// ── 1. AUTOCOMPLETE + SELECCIÓN DE CIUDAD ───────────────────

function normalize(str) {
    return str.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

async function buildSearchIndex() {
    // fetchAllCities() (sin filtro active) para que el buscador sugiera
    // también ciudades sin grupo activo todavía — el resto de la home
    // (bento, stats de ciudades) sigue usando solo activas.
    allCitiesCache = await fetchAllCities();
    return allCitiesCache.map((city) => ({
        id: city.id,
        label: city.name,
        name: city.name,
        sub: city.country,
        flag: city.flag,
        url: `ciudad.html?ciudad=${encodeURIComponent(city.id)}`,
    }));
}

async function initAutocomplete(index) {
    const input = document.getElementById('citySearch');
    const searchBar = input && input.closest('.search-bar');
    if (!input || !searchBar) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'search-dropdown';
    dropdown.setAttribute('role', 'listbox');
    searchBar.style.position = 'relative';
    searchBar.appendChild(dropdown);

    let activeIdx = -1;

    function renderDropdown(results) {
        dropdown.innerHTML = '';
        activeIdx = -1;
        if (!results.length) {
            dropdown.classList.remove('is-open');
            return;
        }

        results.slice(0, 8).forEach((item) => {
            const el = document.createElement('button');
            el.type = 'button';
            el.className = 'search-dropdown-item';
            el.setAttribute('role', 'option');
            el.innerHTML = `
        <span class="sdi-icon">${escapeHtml(item.flag || '')}</span>
        <span class="sdi-text">
          <span class="sdi-name">${escapeHtml(item.name)}</span>
          <span class="sdi-sub">${escapeHtml(item.sub)}</span>
        </span>
        <span class="sdi-type">${I18n.t('home.search_result_type_city')}</span>`;
            el.addEventListener('click', () => {
                const city = allCitiesCache.find((c) => c.id === item.id);
                if (city) selectCity(city);
                input.value = item.name;
                dropdown.classList.remove('is-open');
            });
            dropdown.appendChild(el);
        });
        dropdown.classList.add('is-open');
    }

    function setActive(idx) {
        const items = dropdown.querySelectorAll('.search-dropdown-item');
        items.forEach((el) => el.classList.remove('is-active'));
        activeIdx = Math.max(-1, Math.min(idx, items.length - 1));
        if (activeIdx >= 0) items[activeIdx].classList.add('is-active');
    }

    input.addEventListener('input', () => {
        const q = input.value.trim();
        if (q.length < 1) {
            dropdown.classList.remove('is-open');
            return;
        }
        const nq = normalize(q);
        const results = index.filter((item) => normalize(item.name).includes(nq));
        results.sort((a, b) => {
            const an = normalize(a.name),
                bn = normalize(b.name);
            const aStarts = an.startsWith(nq),
                bStarts = bn.startsWith(nq);
            if (aStarts !== bStarts) return aStarts ? -1 : 1;
            return an.localeCompare(bn);
        });
        renderDropdown(results);
    });

    input.addEventListener('keydown', (e) => {
        const items = dropdown.querySelectorAll('.search-dropdown-item');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive(activeIdx + 1);
        }
        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive(activeIdx - 1);
        }
        if (e.key === 'Enter') {
            e.preventDefault();
            if (activeIdx >= 0 && items[activeIdx]) {
                items[activeIdx].click();
            } else {
                goToBestMatch(index, input.value.trim());
            }
        }
        if (e.key === 'Escape') {
            dropdown.classList.remove('is-open');
        }
    });

    document.addEventListener('click', (e) => {
        if (!searchBar.contains(e.target)) dropdown.classList.remove('is-open');
    });

    const exploreBtn = document.getElementById('searchExploreBtn');
    if (exploreBtn) {
        exploreBtn.addEventListener('click', () => {
            // Con ciudad ya seleccionada (chip activo), "Explorar" lleva a
            // su ficha completa; si no, intenta resolver el texto escrito.
            if (selectedCity) {
                window.location.href = `ciudad.html?ciudad=${encodeURIComponent(selectedCity.id)}`;
                return;
            }
            goToBestMatch(index, input.value.trim());
        });
    }

    function goToBestMatch(searchIndex, q) {
        if (!q) return;
        const nq = normalize(q);
        const match = searchIndex.find((item) => normalize(item.name).startsWith(nq));
        if (match) window.location.href = match.url;
        else
            alert(
                `${I18n.t('home.search_not_found_prefix')} "${q}". ${I18n.t('home.search_not_found_suffix')}`
            );
    }
}

// ── 2. CHIP DE CIUDAD ACTIVA + CAMBIO DE CIUDAD ─────────────

function renderCityChip(city) {
    const chip = document.getElementById('cityChip');
    if (!chip) return;

    chip.innerHTML = `
        <span>${escapeHtml(city.flag || '')} ${escapeHtml(city.name)}</span>
        <a class="city-chip-view" href="ciudad.html?ciudad=${encodeURIComponent(city.id)}">
            <span data-i18n-skip>${escapeHtml(I18n.t('home.city_chip_view_cta'))}</span>
            <span class="material-symbols-outlined" style="font-size:16px">arrow_forward</span>
        </a>
        <button type="button" class="city-chip-clear" id="cityChipClear" aria-label="${escapeHtml(I18n.t('home.city_chip_clear_aria'))}">
            <span class="material-symbols-outlined" style="font-size:16px">close</span>
        </button>
    `;
    chip.hidden = false;

    const clearBtn = document.getElementById('cityChipClear');
    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            const fallback = allCitiesCache.find((c) => c.active) || allCitiesCache[0];
            if (fallback) selectCity(fallback);
        });
    }
}

async function getPartnersForCity(cityId) {
    if (cityPartnersCache.has(cityId)) return cityPartnersCache.get(cityId);
    const partners = await fetchPartnersByCity(cityId);
    cityPartnersCache.set(cityId, partners);
    return partners;
}

async function selectCity(city) {
    selectedCity = city;
    renderCityChip(city);

    const input = document.getElementById('citySearch');
    if (input) input.value = '';

    const partners = await getPartnersForCity(city.id);
    renderCategoryPills();
    renderPartnersSection(partners);
    updatePartnersStat(city, partners);
}

// ── 3. PILLS DE CATEGORÍA ────────────────────────────────────

function renderCategoryPills() {
    const container = document.getElementById('categoryPills');
    if (!container) return;

    const categories = getHomeCategories();
    container.innerHTML = '';

    const allPill = document.createElement('button');
    allPill.type = 'button';
    allPill.className = 'category-pill' + (activeCategory === null ? ' is-active' : '');
    allPill.textContent = I18n.t('home.filter_all');
    allPill.addEventListener('click', () => {
        activeCategory = null;
        renderCategoryPills();
        renderPartnersSection(cityPartnersCache.get(selectedCity.id) || []);
    });
    container.appendChild(allPill);

    categories.forEach((cat) => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'category-pill' + (activeCategory === cat.key ? ' is-active' : '');
        pill.textContent = I18n.t(cat.pillKey);
        pill.addEventListener('click', () => {
            activeCategory = cat.key;
            renderCategoryPills();
            renderPartnersSection(cityPartnersCache.get(selectedCity.id) || []);
        });
        container.appendChild(pill);
    });
}

// ── 4. GRID DE PARTNERS ──────────────────────────────────────

function buildPartnerCard(partner, index) {
    const categories = getHomeCategories();
    const catMeta = categories.find((c) => c.key === partner.category);

    const card = document.createElement('div');
    card.className = `partner-card anim-slam anim-delay-${(index % 8) + 1}`;

    const safeImageUrl = sanitizeUrl(partner.image_url);
    const primaryLink = partner.links && partner.links[0];
    const safeLinkUrl = primaryLink ? sanitizeUrl(primaryLink.url) : '';

    card.innerHTML = `
        <div class="partner-card-img-wrap">
            ${
                safeImageUrl
                    ? `<img src="${safeImageUrl}" alt="" loading="lazy" />`
                    : `<div class="bento-card-placeholder"></div>`
            }
            ${catMeta ? `<span class="partner-card-category">${escapeHtml(I18n.t(catMeta.pillKey))}</span>` : ''}
        </div>
        <div class="partner-card-body">
            <h3 class="partner-card-name"></h3>
            <p class="partner-card-desc"></p>
        </div>
    `;

    card.querySelector('.partner-card-name').textContent = partner.name;
    card.querySelector('.partner-card-desc').textContent = partner.description || '';

    if (safeLinkUrl) {
        const cta = document.createElement('a');
        cta.className = 'partner-card-cta';
        cta.href = safeLinkUrl;
        cta.target = '_blank';
        cta.rel = 'noopener noreferrer';
        cta.textContent = primaryLink.label || I18n.t('home.partners_cta_default');
        cta.addEventListener('click', (e) => {
            e.stopPropagation();
            trackEvent('partner_card_click', {
                partnerId: partner.id,
                partnerName: partner.name,
                category: partner.category,
                url: primaryLink.url,
            });
        });
        card.querySelector('.partner-card-body').appendChild(cta);
    }

    return card;
}

function updatePartnersHeader() {
    const eyebrowEl = document.getElementById('partnersEyebrow');
    const titleEl = document.getElementById('partnersTitle');
    if (!eyebrowEl || !titleEl || !selectedCity) return;

    const categories = getHomeCategories();
    const activeMeta = categories.find((c) => c.key === activeCategory);

    if (!activeMeta) {
        eyebrowEl.textContent = I18n.t('home.partners_eyebrow_default');
        titleEl.textContent = `${I18n.t('home.partners_title_default_prefix')} ${selectedCity.name}`;
        return;
    }

    eyebrowEl.textContent = I18n.t(activeMeta.eyebrowKey);
    titleEl.textContent = activeMeta.titleFixedKey
        ? I18n.t(activeMeta.titleFixedKey)
        : `${I18n.t(activeMeta.titlePrefixKey)} ${selectedCity.name}`;
}

function renderPartnersSection(allPartnersForCity) {
    const grid = document.getElementById('partnerGrid');
    const empty = document.getElementById('partnersEmpty');
    if (!grid || !empty) return;

    updatePartnersHeader();

    const availableKeys = getHomeCategories().map((c) => c.key);
    const inScope = allPartnersForCity.filter((p) => availableKeys.includes(p.category));
    const filtered = activeCategory ? inScope.filter((p) => p.category === activeCategory) : inScope;

    grid.innerHTML = '';

    if (filtered.length === 0) {
        grid.hidden = true;
        empty.hidden = false;
        empty.textContent =
            inScope.length === 0 ? I18n.t('home.partners_empty_city') : I18n.t('home.partners_empty_category');
        return;
    }

    grid.hidden = false;
    empty.hidden = true;
    filtered.forEach((partner, i) => grid.appendChild(buildPartnerCard(partner, i)));

    if (window.initScrollReveal) window.initScrollReveal();
}

// ── 5. TICKER ─────────────────────────────────────────────────

function initTicker() {
    const track = document.getElementById('tickerTrack');
    if (!track) return;

    const items = [
        I18n.t('home.ticker_1'),
        I18n.t('home.ticker_2'),
        I18n.t('home.ticker_3'),
        I18n.t('home.ticker_4'),
    ];
    const html = items.map((text) => `<span class="ticker-item">${escapeHtml(text)}</span>`).join('');
    // Contenido duplicado una vez: @keyframes ticker-scroll anima hasta
    // -50%, momento en el que la segunda copia ya ocupa exactamente el
    // sitio de la primera → loop sin salto visible.
    track.innerHTML = html + html;
}

// ── 6. STATS ANIMADOS ───────────────────────────────────────

function animateCount(el, target, duration = 1200) {
    if (!el) return;
    if (prefersReducedMotion() || target === 0) {
        el.textContent = target;
        return;
    }

    const start = performance.now();
    function tick(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        el.textContent = Math.round(eased * target);
        if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function initCitiesStat(activeCities) {
    animateCount(document.getElementById('statCiudades'), activeCities.length);
}

function updatePartnersStat(city, allPartnersForCity) {
    const availableKeys = getHomeCategories().map((c) => c.key);
    const count = allPartnersForCity.filter((p) => availableKeys.includes(p.category)).length;

    const label = document.getElementById('statPartnersLabel');
    if (label) label.textContent = `${I18n.t('home.stats_partners_prefix')} ${city.name}`;

    animateCount(document.getElementById('statPartners'), count);
}

// ── 7. ANIMACIÓN DEL H1 (palabra a palabra) ─────────────────

function initHeroTitleAnim() {
    // Se asegura de que el texto ya esté traducido antes de trocearlo en
    // palabras — no se puede confiar en el orden de los listeners de
    // DOMContentLoaded entre scripts (ver nota en el PR de esta rama).
    if (window.I18n && window.I18n.applyTranslations) window.I18n.applyTranslations();

    const spans = document.querySelectorAll('.hero-title [data-i18n]');
    const reduced = prefersReducedMotion();

    spans.forEach((el) => {
        const text = el.textContent;
        // Se quita data-i18n para que un applyTranslations() posterior
        // (el del script inline al final del body) no vuelva a
        // sobrescribir el innerHTML y borre las palabras ya envueltas.
        el.removeAttribute('data-i18n');
        el.innerHTML = text
            .split(' ')
            .filter(Boolean)
            .map((word, i) => {
                const delay = reduced ? '' : ` style="transition-delay:${i * 70}ms"`;
                return `<span class="word-anim"${delay}>${escapeHtml(word)}</span>`;
            })
            .join(' ');
    });

    const words = document.querySelectorAll('.hero-title .word-anim');
    if (reduced) {
        words.forEach((w) => w.classList.add('is-visible'));
    } else {
        requestAnimationFrame(() => {
            requestAnimationFrame(() => words.forEach((w) => w.classList.add('is-visible')));
        });
    }
}

// ── 8. BENTO GRID ROTATIVO ───────────────────────────────────

const BENTO_LAYOUTS = [
    // Layout A: main=0, wide=3
    (pool) => [
        { ...pool[0], main: true, wide: false },
        { ...pool[1], main: false, wide: false },
        { ...pool[2], main: false, wide: false },
        { ...pool[3], main: false, wide: true },
    ],
    // Layout B: main=0, wide=2
    (pool) => [
        { ...pool[0], main: true, wide: false },
        { ...pool[1], main: false, wide: false },
        { ...pool[2], main: false, wide: true },
        { ...pool[3], main: false, wide: false },
    ],
    // Layout C: main=1, wide=0
    (pool) => [
        { ...pool[0], main: false, wide: true },
        { ...pool[1], main: true, wide: false },
        { ...pool[2], main: false, wide: false },
        { ...pool[3], main: false, wide: false },
    ],
];

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function pickBentoSet(cities) {
    const shuffled = shuffle(cities);
    const pool = shuffled.slice(0, 4);
    const layout = BENTO_LAYOUTS[Math.floor(Math.random() * BENTO_LAYOUTS.length)];
    return layout(pool);
}

function renderBento(grid, cards, animate = false) {
    if (animate) grid.classList.add('bento-exit');

    setTimeout(
        () => {
            grid.innerHTML = cards
                .map((item, i) => {
                    const mainCls = item.main ? 'bento-card--main' : '';
                    const wideCls = item.wide ? 'bento-card--wide' : '';
                    const href = `ciudad.html?ciudad=${encodeURIComponent(item.id)}`;
                    const delayCls = `anim-delay-${(i % 8) + 1}`;
                    const safeImageUrl = sanitizeUrl(item.image_url);

                    return `
        <a class="bento-card ${mainCls} ${wideCls} anim-fade-up card-hoverable ${delayCls}" href="${href}">
          ${
              safeImageUrl
                  ? `<img src="${safeImageUrl}" alt="${escapeHtml(item.name)}" loading="lazy"/>`
                  : `<div class="bento-card-placeholder"></div>`
          }
          <div class="bento-card-overlay"></div>
          <div class="bento-card-body">
            <h3>${escapeHtml(item.flag)} ${escapeHtml(item.name)}</h3>
            ${I18n.tField(item.description) ? `<p>${escapeHtml(I18n.tField(item.description))}</p>` : ''}
          </div>
        </a>`;
                })
                .join('');

            grid.classList.remove('bento-exit');
            grid.classList.add('bento-enter');
            requestAnimationFrame(() => {
                requestAnimationFrame(() => grid.classList.remove('bento-enter'));
            });

            // Las cards se regeneran por completo en cada rotación (cada 30s)
            // y en la carga inicial — hay que volver a observarlas cada vez,
            // si no las nuevas quedarían con opacity:0 para siempre.
            if (window.initScrollReveal) window.initScrollReveal();
        },
        animate ? 400 : 0
    );
}

async function initBento(cities) {
    const grid = document.getElementById('bentoGrid');
    if (!grid) return;

    grid.innerHTML = `<p style="color:var(--text-muted);padding:40px;text-align:center">${I18n.t('home.loading_cities')}</p>`;

    if (cities.length === 0) {
        grid.innerHTML = `<p style="color:var(--text-muted);padding:40px;text-align:center">${I18n.t('home.more_cities_coming_soon')}</p>`;
        return;
    }

    // Si hay menos de 4 ciudades, repetir para completar el layout
    let pool = cities;
    while (pool.length < 4) {
        pool = [...pool, ...cities];
    }

    renderBento(grid, pickBentoSet(pool), false);

    if (cities.length > 4) {
        setInterval(() => {
            renderBento(grid, pickBentoSet(pool), true);
        }, 30000);
    }
}

// ── 9. NAV SCROLL SHADOW ─────────────────────────────────────
function initNavScroll() {
    const nav = document.getElementById('topNav');
    if (!nav) return;
    window.addEventListener(
        'scroll',
        () => {
            nav.classList.toggle('scrolled', window.scrollY > 20);
        },
        { passive: true }
    );
}

// ── 10. BOTTOM NAV ────────────────────────────────────────────
function initBottomNav() {
    document.querySelectorAll('.bottom-nav-item').forEach((item) => {
        item.addEventListener('click', () => {
            document
                .querySelectorAll('.bottom-nav-item')
                .forEach((i) => i.classList.remove('bottom-nav-item--active'));
            item.classList.add('bottom-nav-item--active');
        });
    });
}

// ── INIT ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    initHeroTitleAnim();
    initTicker();
    initNavScroll();
    initBottomNav();

    const [activeCities, searchIndex] = await Promise.all([fetchActiveCities(), buildSearchIndex()]);

    await Promise.all([initCitiesStat(activeCities), initBento(activeCities)]);
    await initAutocomplete(searchIndex);

    // Ciudad activa por defecto: la de mayor prioridad entre las activas
    // (mismo orden que ya usa el bento grid) — así la sección de
    // partners y los stats no arrancan vacíos.
    const defaultCity = activeCities[0] || allCitiesCache[0];
    if (defaultCity) await selectCity(defaultCity);
});
