// ─────────────────────────────────────────────────────────────
//  NIGHTSSECTION.JS — Erasmus Verified / Erasmus Parties
//
//  Renderiza la nights-section del home con EVENTOS reales
//  (partner_events), no con partners directamente. Un partner es
//  el local físico (fijo); un evento es lo que ese local organiza,
//  con su fecha, hora, precio y temática — ver fetchUpcomingEvents()
//  en services/partnersService.js.
//
//  Transversal a todas las ciudades: no filtra por ciudad, es el
//  "visibilizador" de fiesta del home. RLS ya garantiza en el
//  servidor que solo llegan eventos activos y no vencidos.
// ─────────────────────────────────────────────────────────────

function formatEventDate(isoString) {
    const date = new Date(isoString);
    const dayLabel = new Intl.DateTimeFormat('es-ES', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
    }).format(date);
    const timeLabel = new Intl.DateTimeFormat('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
    }).format(date);
    const capitalized = dayLabel.charAt(0).toUpperCase() + dayLabel.slice(1);
    return `${capitalized} · ${timeLabel}h`;
}

// Root de React (SummaryCardGrid) sobre .events-scroll — se crea una
// única vez (ver renderEventCards) y se reutiliza en cada cambio de
// filtro con .render(), nunca se destruye/recrea.
let eventCardsRoot = null;

// Filtros activos de la barra — se combinan entre sí, cada cambio
// dispara una nueva consulta a Supabase (sin cacheo en cliente).
const currentFilters = { cityId: null, theme: null, dateRange: null, partnerId: null };

function hasActiveFilters() {
    return Boolean(
        currentFilters.cityId ||
        currentFilters.theme ||
        currentFilters.dateRange ||
        currentFilters.partnerId
    );
}

// Extrae ciudades, temas y partners ÚNICOS de los eventos ya cargados
// (fetch inicial sin filtrar) para poblar los <select> — no hace falta
// una query aparte solo para listar opciones. Como este fetch ya pasa
// por RLS (solo eventos activos y no vencidos, de partners activos vía
// el !inner), un partner desactivado o borrado deja de tener eventos
// aquí y por tanto desaparece solo de las opciones del filtro.
function extractFilterOptions(events) {
    const cities = new Map();
    const themes = new Set();
    const partners = new Map();
    events.forEach((event) => {
        if (event.city)
            cities.set(event.city.id, `${event.city.flag || ''} ${event.city.name}`.trim());
        if (event.theme) themes.add(event.theme);
        if (event.partner) partners.set(event.partner.id, event.partner.name);
    });
    return { cities, themes, partners };
}

// Envuelve un <select> de filtro con su icono (Material Symbols, misma
// fuente que ya usa .event-venue) en un wrapper .nights-filter — el
// icono es puramente decorativo (aria-hidden), el aria-label sigue en
// el propio <select> porque es la única etiqueta accesible que tiene.
function buildFilterSelect(iconName, ariaLabel) {
    const wrap = document.createElement('div');
    wrap.className = 'nights-filter';

    const icon = document.createElement('span');
    icon.className = 'material-symbols-outlined nights-filter__icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = iconName;

    const select = document.createElement('select');
    select.className = 'nights-filter-select';
    select.setAttribute('aria-label', ariaLabel);

    wrap.append(icon, select);
    return { wrap, select };
}

function buildFilterBar(cities, themes, partners) {
    const bar = document.createElement('div');
    bar.className = 'nights-filters';

    const { wrap: cityWrap, select: citySelect } = buildFilterSelect(
        'location_on',
        I18n.t('nights.filter_by_city_aria')
    );
    citySelect.innerHTML = `<option value="">${I18n.t('nights.filter_all_cities')}</option>`;
    for (const [id, label] of cities) {
        const opt = document.createElement('option');
        opt.value = String(id);
        opt.textContent = label;
        citySelect.appendChild(opt);
    }

    const { wrap: themeWrap, select: themeSelect } = buildFilterSelect(
        'local_activity',
        I18n.t('nights.filter_by_theme_aria')
    );
    themeSelect.innerHTML = `<option value="">${I18n.t('nights.filter_all_themes')}</option>`;
    for (const theme of themes) {
        const opt = document.createElement('option');
        opt.value = theme;
        opt.textContent = theme;
        themeSelect.appendChild(opt);
    }

    const { wrap: dateWrap, select: dateSelect } = buildFilterSelect(
        'calendar_today',
        I18n.t('nights.filter_by_date_aria')
    );
    dateSelect.innerHTML = `
        <option value="">${I18n.t('nights.filter_any_date')}</option>
        <option value="today">${I18n.t('nights.filter_today')}</option>
        <option value="week">${I18n.t('nights.filter_this_week')}</option>
        <option value="month">${I18n.t('nights.filter_this_month')}</option>
    `;

    const { wrap: partnerWrap, select: partnerSelect } = buildFilterSelect(
        'storefront',
        I18n.t('nights.filter_by_partner_aria')
    );
    partnerSelect.innerHTML = `<option value="">${I18n.t('nights.filter_all_partners')}</option>`;
    for (const [id, name] of partners) {
        const opt = document.createElement('option');
        opt.value = String(id);
        opt.textContent = name;
        partnerSelect.appendChild(opt);
    }

    const clearBtn = document.createElement('button');
    clearBtn.type = 'button';
    clearBtn.className = 'nights-filter-clear';
    clearBtn.textContent = I18n.t('nights.clear_filters');
    clearBtn.hidden = !hasActiveFilters();

    // hasActiveFilters() y applyFilters() ya existen — no se toca su
    // lógica, solo se llaman aquí tras cada cambio para reflejar el
    // botón y disparar la nueva consulta, respectivamente.
    function refreshClearButton() {
        clearBtn.hidden = !hasActiveFilters();
    }

    citySelect.addEventListener('change', () => {
        currentFilters.cityId = citySelect.value ? Number(citySelect.value) : null;
        refreshClearButton();
        applyFilters();
    });
    themeSelect.addEventListener('change', () => {
        currentFilters.theme = themeSelect.value || null;
        refreshClearButton();
        applyFilters();
    });
    dateSelect.addEventListener('change', () => {
        currentFilters.dateRange = dateSelect.value || null;
        refreshClearButton();
        applyFilters();
    });
    partnerSelect.addEventListener('change', () => {
        currentFilters.partnerId = partnerSelect.value ? Number(partnerSelect.value) : null;
        refreshClearButton();
        applyFilters();
    });

    clearBtn.addEventListener('click', () => {
        citySelect.value = '';
        themeSelect.value = '';
        dateSelect.value = '';
        partnerSelect.value = '';
        currentFilters.cityId = null;
        currentFilters.theme = null;
        currentFilters.dateRange = null;
        currentFilters.partnerId = null;
        refreshClearButton();
        applyFilters();
    });

    bar.append(cityWrap, themeWrap, dateWrap, partnerWrap, clearBtn);
    return bar;
}

// Pinta las tarjetas (o el estado vacío) a partir de una lista de
// eventos ya obtenida — no hace fetch, solo renderiza. Compartida
// entre la carga inicial y cada cambio de filtro.
function renderEventCards(events) {
    const scroll = document.querySelector('.nights-section .events-scroll');
    // #nightsEmpty es un <p> hermano de .events-scroll (mismo patrón que
    // #partnersEmpty junto a #partnerGrid en index.html): desde que
    // .events-scroll tiene un root de React montado encima, ya no se
    // puede seguir inyectando el mensaje de "sin resultados" como hijo
    // suyo con DOM imperativo — React es dueño de esos hijos.
    const empty = document.getElementById('nightsEmpty');
    if (!scroll || !empty) return;

    // Root de SummaryCardGrid — se crea una única vez sobre .events-scroll.
    // mountSummaryCards() vacía scroll antes de crear el root (createRoot
    // NO borra el skeleton de renderEventsSkeleton por sí solo, a
    // diferencia de la antigua ReactDOM.render() — ver el comentario de
    // mount-summary-cards.jsx), así que no hace falta repetirlo aquí.
    if (!eventCardsRoot) eventCardsRoot = mountSummaryCards(scroll);

    Skeleton.clear(scroll);

    if (events.length === 0) {
        scroll.hidden = true;
        empty.hidden = false;
        empty.textContent = hasActiveFilters()
            ? I18n.t('nights.no_results_filtered')
            : I18n.t('nights.no_results_empty');
        eventCardsRoot.render([], 'event', getEventCardProps);
        return;
    }

    scroll.hidden = false;
    empty.hidden = true;

    // Solo destaca si hay una prioridad editorial real (> 0); en empate
    // a máximo, gana el primero del array (ya viene ordenado por
    // starts_at ascendente desde fetchUpcomingEvents, no es un desempate
    // arbitrario). Se recalcula sobre cada resultado filtrado, no solo
    // sobre la carga inicial.
    const maxPriority = Math.max(...events.map((event) => event.priority || 0));
    const featuredEvent =
        maxPriority > 0 ? events.find((event) => event.priority === maxPriority) : null;

    // Cierra sobre featuredEvent (se recalcula en cada llamada) para poder
    // seguir marcando la card destacada con event-card--featured sin que
    // SummaryCard/SummaryCardGrid necesiten saber qué es un "evento
    // destacado" — es la misma clase que ya existía, solo se añade al
    // animClassName que ya se calcula fuera del componente.
    function getEventCardProps(event, index) {
        const cityLabel = event.city ? `${event.city.flag || ''} ${event.city.name}`.trim() : '';
        const venueLabel = event.partner ? event.partner.name : '';
        const metaLine = [venueLabel, cityLabel].filter(Boolean).join(' — ');
        const anim = `anim-fade-up anim-delay-${(index % 8) + 1}`;

        return {
            imageUrl: event.image_url,
            badgeText: event.theme || 'Fiesta',
            name: I18n.tField(event.title),
            metaLine,
            dateLine: formatEventDate(event.starts_at),
            priceLabel: I18n.tField(event.price_label) || '',
            ctaLabel: I18n.t('nights.view_event_cta'),
            ctaHref: event.ticket_url,
            onCtaClick: () =>
                trackEvent('event_ticket_click', {
                    eventId: event.id,
                    eventTitle: I18n.tField(event.title),
                    partnerId: event.partner?.id,
                    ticketUrl: event.ticket_url,
                }),
            animClassName: event === featuredEvent ? `${anim} event-card--featured` : anim,
        };
    }

    // El propio SummaryCardGrid dispara initScrollReveal() en un
    // useEffect tras cada render suyo (ver SummaryCardGrid.jsx) —
    // llamarlo aquí también corría antes de que React comprometiera
    // las tarjetas nuevas al DOM, dejándolas en opacity:0 para siempre.
    eventCardsRoot.render(events, 'event', getEventCardProps);
}

// Vuelve a consultar Supabase con los filtros activos actuales y
// re-renderiza — se llama en cada cambio de cualquier <select>.
async function applyFilters() {
    const events = await fetchUpcomingEvents(currentFilters);
    renderEventCards(events);
}

// Misma forma que .event-card real: imagen 4:3 + título + venue + fecha.
function renderEventsSkeleton(scroll) {
    Skeleton.render(scroll, 3, () => {
        const card = document.createElement('div');
        card.className = 'event-card';
        const imgWrap = document.createElement('div');
        imgWrap.className = 'event-img-wrap';
        imgWrap.appendChild(Skeleton.block('skeleton--fill'));
        const body = document.createElement('div');
        body.className = 'event-body';
        body.appendChild(Skeleton.block('skeleton--text skeleton--text-title'));
        body.appendChild(Skeleton.block('skeleton--text-sm'));
        body.appendChild(Skeleton.block('skeleton--text-sm'));
        card.append(imgWrap, body);
        return card;
    });
}

async function initNightsSection() {
    const scroll = document.querySelector('.nights-section .events-scroll');
    const header = document.querySelector('.nights-section .nights-header');
    if (!scroll || !header) return;

    renderEventsSkeleton(scroll);

    // Única query inicial, sin filtros: sirve tanto para poblar las
    // opciones de los selects como para el primer render.
    const events = await fetchUpcomingEvents();

    const { cities, themes, partners } = extractFilterOptions(events);
    header.appendChild(buildFilterBar(cities, themes, partners));

    renderEventCards(events);
}

document.addEventListener('DOMContentLoaded', initNightsSection);
