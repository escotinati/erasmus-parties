// ─────────────────────────────────────────────────────────────
//  MAPPARTNERS.JS — Erasmus Verified / Erasmus Parties
//
//  Listado de categorías/partners sincronizado con pines en el mapa.
//  Modelo de multi-selección (chips), no acordeón: un Set de
//  categorías activas decide qué grupos aparecen en la lista y qué
//  pines en el mapa — no hay "una categoría desplegada a la vez"
//  como en la versión anterior. Abrir un partner ya no expande su
//  fila inline: abre el detalle en un Sheet (src/js/ui/sheet.js).
//
//  Depende de: fetchPartnersByCity/groupPartnersByCategory
//  (partnersService.js), createPartnerMarker/setMarkerExpanded/
//  CATEGORY_META (map-helpers.js), window.Sheet (sheet.js), y recibe
//  `map` (Leaflet, ya inicializado por cityMap.js) y `city` (el
//  objeto completo de Supabase, no solo su id — lo pasan ciudad.js y
//  mapa.js, que ya lo tienen en su propio scope antes de llamar).
// ─────────────────────────────────────────────────────────────

// Copia local idéntica a la de src/react/navShared.jsx (isPartiesExperience,
// la usa AppShell.jsx) y a la de src/js/index.js: mapPartners.js es
// vanilla y no puede importar el módulo ES de navShared.jsx, así que
// replica el mismo patrón ya establecido en el proyecto para este
// problema exacto — cada script clásico que lo necesita lleva su
// propia copia idéntica. No es una duplicación accidental ni hay que
// "unificarla": es el patrón ya asentado, no un descuido.
function isPartiesExperience() {
    return window.ERASMUS_EXPERIENCE && window.ERASMUS_EXPERIENCE.theme === 'theme-parties';
}

// Etiqueta de categoría traducida, con fallback al label hardcodeado de
// CATEGORY_META si no existe clave en translations.js (las categorías
// fuera del CHECK de partners.category en Supabase, ej. "restaurants",
// nunca llegan aquí con datos reales, así que no todas tienen traducción).
function categoryLabel(category, fallbackLabel) {
    const key = 'map.category_' + category;
    const translated = I18n.t(key);
    return translated !== key ? translated : fallbackLabel;
}

async function mountPartnersList(listContainerId, map, city) {
    const container = document.getElementById(listContainerId);
    container.innerHTML = `<p class="partners-list-loading">${I18n.t('map.loading_partners')}</p>`;

    const partners = await fetchPartnersByCity(city.id);
    const groups = groupPartnersByCategory(partners); // ya filtra categorías sin partners (regla 3)

    if (groups.length === 0) {
        renderNoPartnersState();
        return;
    }

    // Estado local: qué categorías están activas (Set, multi-selección)
    // y un registro de los markers ya creados (para no recrearlos).
    const state = {
        activeCategories: initialActiveCategories(),
    };
    const markersByPartnerId = {};

    // Crea TODOS los markers al cargar (pocos partners, sin coste real),
    // pero no los añade al mapa todavía — eso lo decide syncMarkers().
    for (const { partners } of groups) {
        for (const partner of partners) {
            const marker = createPartnerMarker(partner, { expanded: false });
            marker.on('click', () => selectPartner(partner.id, marker));
            markersByPartnerId[partner.id] = marker;
        }
    }

    syncMarkers();
    renderList();

    // ── Arranque por marca (regla 1) ──────────────────────────────
    function initialActiveCategories() {
        if (isPartiesExperience()) {
            const hasNightlife = groups.some((g) => g.category === 'nightlife');
            return new Set(hasNightlife ? ['nightlife'] : []);
        }
        return new Set(groups.map((g) => g.category));
    }

    // Con una sola categoría en la ciudad no hay chips que decidan nada
    // (regla 4): esa categoría se muestra siempre, entera.
    function isCategoryVisible(category) {
        return groups.length === 1 || state.activeCategories.has(category);
    }

    function syncMarkers() {
        for (const { category, partners } of groups) {
            const shouldShow = isCategoryVisible(category);
            for (const partner of partners) {
                const marker = markersByPartnerId[partner.id];
                if (shouldShow) {
                    marker.addTo(map);
                } else {
                    map.removeLayer(marker);
                }
            }
        }
    }

    function toggleCategory(category) {
        if (state.activeCategories.has(category)) {
            state.activeCategories.delete(category);
        } else {
            state.activeCategories.add(category);
        }
        syncMarkers();
        renderList();
        requestAnimationFrame(() => map.invalidateSize());
    }

    // Reactiva todas las categorías con partners — recuperación de la
    // regla 6 (todos los chips apagados a mano).
    function showAllCategories() {
        state.activeCategories = new Set(groups.map((g) => g.category));
        syncMarkers();
        renderList();
        requestAnimationFrame(() => map.invalidateSize());
    }

    function renderList() {
        container.innerHTML = '';

        const singleCategory = groups.length === 1;
        const allOff = !singleCategory && state.activeCategories.size === 0;

        if (singleCategory) {
            container.appendChild(buildCountText(groups[0]));
        } else {
            container.appendChild(buildChipBar());
        }

        if (allOff) {
            container.appendChild(buildAllFiltersOffState());
            return;
        }

        for (const group of groups) {
            if (!isCategoryVisible(group.category)) continue;
            container.appendChild(buildGroupSection(group));
        }
    }

    // ── Regla 4: una sola categoría con partners → sin barra de chips ──
    function buildCountText(group) {
        const p = document.createElement('p');
        p.className = 'partners-count';
        p.textContent = `${group.partners.length} ${I18n.t('map.partners_count_label')} ${city.name}`;
        return p;
    }

    // ── Barra de chips (multi-selección) ──────────────────────────
    function buildChipBar() {
        const bar = document.createElement('div');
        bar.className = 'partner-filters';

        for (const { category, partners } of groups) {
            const meta = CATEGORY_META[category] || {
                label: category,
                color: '#64748b',
                icon: 'place',
            };
            const label = categoryLabel(category, meta.label);
            const isActive = state.activeCategories.has(category);

            const chip = document.createElement('button');
            chip.type = 'button';
            chip.className = 'category-chip' + (isActive ? ' is-active' : '');
            chip.setAttribute('aria-pressed', String(isActive));
            chip.style.setProperty('--pin-color', meta.color);

            const icon = document.createElement('span');
            icon.className = 'material-symbols-outlined category-chip__icon';
            icon.setAttribute('aria-hidden', 'true');
            icon.textContent = meta.icon;

            const labelEl = document.createElement('span');
            labelEl.className = 'category-chip__label';
            labelEl.textContent = label;

            chip.appendChild(icon);
            chip.appendChild(labelEl);
            chip.addEventListener('click', () => toggleCategory(category));
            bar.appendChild(chip);
        }

        // Regla 6: chip de reinicio al final de la barra mientras todo
        // esté apagado — equivalente al botón "ver todo" del estado
        // vacío, no lo sustituye.
        if (state.activeCategories.size === 0) {
            const reset = document.createElement('button');
            reset.type = 'button';
            reset.className = 'category-chip category-chip--reset';
            reset.textContent = I18n.t('map.show_all_cta');
            reset.addEventListener('click', showAllCategories);
            bar.appendChild(reset);
        }

        return bar;
    }

    // ── Regla 6: todos los chips apagados a mano ───────────────────
    function buildAllFiltersOffState() {
        const wrap = document.createElement('div');
        wrap.className = 'partners-empty-state';

        const msg = document.createElement('p');
        msg.textContent = I18n.t('map.all_filters_off');
        wrap.appendChild(msg);

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-primary-pill';
        btn.textContent = I18n.t('map.show_all_cta');
        btn.addEventListener('click', showAllCategories);
        wrap.appendChild(btn);

        return wrap;
    }

    // ── Regla 5: la ciudad no tiene ningún partner activo ──────────
    // Sin mapa de pines (no hay ninguno que crear) ni chips — mensaje
    // + botón al grupo de WhatsApp de la ciudad, solo si existe una
    // URL válida (sanitizeUrl(), mismo criterio que ciudad.js). Si no
    // hay whatsapp_url, o no es válida, el botón no se renderiza: se
    // deja solo el mensaje, nunca un enlace muerto.
    function renderNoPartnersState() {
        container.innerHTML = '';

        const wrap = document.createElement('div');
        wrap.className = 'partners-empty-state';

        const msg = document.createElement('p');
        msg.textContent = I18n.t('map.no_partners');
        wrap.appendChild(msg);

        const safeWhatsapp = sanitizeUrl(city.whatsapp_url);
        if (safeWhatsapp) {
            const btn = document.createElement('a');
            btn.href = safeWhatsapp;
            btn.target = '_blank';
            btn.rel = 'noopener noreferrer';
            btn.className = 'btn-primary-pill';
            btn.textContent = I18n.t('city.join_whatsapp_group');
            wrap.appendChild(btn);
        }

        container.appendChild(wrap);
    }

    // ── Grupo de una categoría activa: cabecera + lista de partners ──
    function buildGroupSection(group) {
        const { category, partners } = group;
        const meta = CATEGORY_META[category] || {
            label: category,
            color: '#64748b',
            icon: 'place',
        };
        const label = categoryLabel(category, meta.label);

        const section = document.createElement('div');
        section.className = 'partner-group';

        const heading = document.createElement('h3');
        heading.className = 'partner-group__title';
        heading.style.setProperty('--pin-color', meta.color);

        const headingIcon = document.createElement('span');
        headingIcon.className = 'material-symbols-outlined partner-group__icon';
        headingIcon.setAttribute('aria-hidden', 'true');
        headingIcon.textContent = meta.icon;
        heading.appendChild(headingIcon);
        heading.appendChild(document.createTextNode(label));
        section.appendChild(heading);

        const list = document.createElement('div');
        list.className = 'partner-list';
        for (const partner of partners) {
            const partnerBtn = document.createElement('button');
            partnerBtn.type = 'button';
            partnerBtn.className = 'partner-toggle';
            partnerBtn.textContent = partner.name;
            partnerBtn.addEventListener('click', (e) => selectPartner(partner.id, e.currentTarget));
            list.appendChild(partnerBtn);
        }
        section.appendChild(list);

        return section;
    }

    // ── Regla 7: abrir un partner → Sheet, no expansión inline ─────
    function selectPartner(partnerId, triggerElement) {
        const partner = findPartnerById(partnerId);
        if (!partner) return;

        const marker = markersByPartnerId[partnerId];
        setMarkerExpanded(marker, partner, true);

        const sheet = Sheet.create({
            title: partner.name,
            content: buildPartnerDetail(partner),
            closeLabel: I18n.t('common.close'),
            onClose: () => {
                setMarkerExpanded(marker, partner, false);
            },
        });
        sheet.open(triggerElement);
    }

    function findPartnerById(id) {
        for (const { partners } of groups) {
            const found = partners.find((p) => p.id === id);
            if (found) return found;
        }
        return null;
    }
}

/**
 * Construye el bloque de detalle de un partner: descripción + sus
 * enlaces (web, entradas, fiesta propia si existe). Nodo del DOM, no
 * HTML — lo consume Sheet.create({ content }) directamente.
 */
function buildPartnerDetail(partner) {
    const detail = document.createElement('div');
    detail.className = 'partner-detail';

    const desc = document.createElement('p');
    desc.className = 'partner-detail__description';
    desc.textContent = I18n.tField(partner.description);
    detail.appendChild(desc);

    // partner.links viene de partner_links (Supabase), editable desde /admin
    // por cualquier admin — no es contenido que controlemos nosotros. Sin
    // sanitizeUrl aquí, un `javascript:` guardado en ese campo se ejecutaría
    // en el navegador del estudiante al hacer clic. Ya es la tercera vez que
    // este patrón se escapa de un archivo (index.js y nightsSection.js ya lo
    // hacen bien): cualquier .href/.src que venga de Supabase pasa SIEMPRE
    // por sanitizeUrl, sin excepciones "por ahora".
    for (const link of partner.links) {
        const safeUrl = sanitizeUrl(link.url);
        if (!safeUrl) continue; // sin URL válida, no hay enlace — nunca un <a> muerto

        const a = document.createElement('a');
        a.href = safeUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'partner-detail__link';
        a.textContent = I18n.tField(link.label);
        a.addEventListener('click', () => {
            trackEvent('partner_link_click', {
                partnerId: partner.id,
                partnerName: partner.name,
                linkType: link.type,
                linkUrl: safeUrl, // el valor saneado, no el original — mismo criterio que el href
            });
        });
        detail.appendChild(a);
    }

    // Botón "Cómo llegar" — Google Maps universal, según lo acordado.
    const directions = document.createElement('a');
    directions.href = `https://www.google.com/maps/dir/?api=1&destination=${partner.lat},${partner.lng}`;
    directions.target = '_blank';
    directions.rel = 'noopener noreferrer';
    directions.className = 'partner-detail__directions';
    directions.textContent = I18n.t('map.directions');
    directions.addEventListener('click', () => {
        trackEvent('partner_directions_click', {
            partnerId: partner.id,
            partnerName: partner.name,
        });
    });
    detail.appendChild(directions);

    return detail;
}
