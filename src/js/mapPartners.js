// ─────────────────────────────────────────────────────────────
//  MAPPARTNERS.JS — Erasmus Parties
//
//  Listado de categorías/partners sincronizado con pines en el mapa.
//  Estado local simple: qué categoría está desplegada y qué partner
//  está expandido (acordeón: solo uno a la vez).
//
//  Depende de: PARTNERS/getPartnersByCity/groupPartnersByCategory
//  (partners.js), createPartnerMarker/setMarkerExpanded/CATEGORY_META
//  (map-helpers.js), y recibe el `map` de Leaflet ya inicializado
//  (cityMap.js / mapa.js).
// ─────────────────────────────────────────────────────────────

/**
 * Monta el listado de categorías/partners en `listContainerId`,
 * y gestiona sus pines sobre `map`. `ciudad` filtra qué partners
 * se muestran.
 */
// Etiqueta de categoría traducida, con fallback al label hardcodeado de
// CATEGORY_META si no existe clave en translations.js (las categorías
// fuera del CHECK de partners.category en Supabase, ej. "restaurants",
// nunca llegan aquí con datos reales, así que no todas tienen traducción).
function categoryLabel(category, fallbackLabel) {
    const key = 'map.category_' + category;
    const translated = I18n.t(key);
    return translated !== key ? translated : fallbackLabel;
}

async function mountPartnersList(listContainerId, map, cityId, defaultCategory = null) {
    const container = document.getElementById(listContainerId);
    container.innerHTML = `<p class="partners-list-loading">${I18n.t('map.loading_partners')}</p>`;

    const partners = await fetchPartnersByCity(cityId);
    const groups = groupPartnersByCategory(partners);

    if (groups.length === 0) {
        container.innerHTML = `<p class="partners-list-empty">${I18n.t('map.no_partners')}</p>`;
        return;
    }

    // Estado local: qué categoría está desplegada, qué partner expandido,
    // y un registro de los markers ya creados (para no recrearlos).
    const state = {
        expandedCategory: null,
        selectedPartnerId: null,
    };
    const markersByPartnerId = {};

    // Crea TODOS los markers al cargar (pocos partners, sin coste real),
    // pero no los añade al mapa todavía — se añaden al expandir su categoría.
    for (const { partners } of groups) {
        for (const partner of partners) {
            markersByPartnerId[partner.id] = createPartnerMarker(partner, { expanded: false });
            markersByPartnerId[partner.id].on('click', () => selectPartner(partner.id));
        }
    }

    renderList();

    // Expande la categoría por defecto si la experiencia activa lo requiere
    // (ej. theme-parties abre nightlife automáticamente).
    // El setTimeout da tiempo a que el mapa esté listo para recibir markers.
    if (defaultCategory) {
        setTimeout(() => toggleCategory(defaultCategory), 100);
    }

    function renderList() {
        container.innerHTML = '';
        for (const { category, partners } of groups) {
            const meta = CATEGORY_META[category] || {
                label: category,
                color: '#64748b',
                icon: 'place',
            };
            // meta.label normalmente viene de CATEGORY_META (constante hardcodeada
            // en map-helpers.js), pero si `category` no es una de sus claves, el
            // fallback de más arriba usa el propio `category` —dato de Supabase
            // (partners.category), editable desde /admin— como label. Hoy el
            // <select> de /admin solo ofrece las 5 categorías que sí están en
            // CATEGORY_META, así que esta rama no es alcanzable desde la UI, pero
            // son dos listas mantenidas por separado (ver docs/tech-debt.md) y un
            // valor insertado por otra vía (edición directa en Supabase) no debe
            // acabar sin escapar. Se deja `label` sin escapar aquí (se usa también
            // vía textContent más abajo, donde escaparlo lo dejaría doblemente
            // escapado) y se escapa solo en el punto de uso dentro de innerHTML.
            const label = categoryLabel(category, meta.label);
            const isExpanded = state.expandedCategory === category;
            const isEmpty = partners.length === 0;

            const categoryBtn = document.createElement('button');
            categoryBtn.type = 'button';
            categoryBtn.className =
                'category-toggle' +
                (isExpanded ? ' is-expanded' : '') +
                (isEmpty ? ' is-empty' : '');
            categoryBtn.innerHTML = `
      <span class="material-symbols-outlined category-toggle__icon" style="--pin-color:${meta.color}">${meta.icon}</span>
      <span class="category-toggle__label">${escapeHtml(label)}</span>
    `;
            categoryBtn.addEventListener('click', () => toggleCategory(category));
            container.appendChild(categoryBtn);

            if (!isExpanded) continue;

            if (isEmpty) {
                // Coherente con el patrón .coming-soon que ya usas en ciudad.js
                const comingSoon = document.createElement('p');
                comingSoon.className = 'category-coming-soon';
                comingSoon.textContent = `${I18n.t('map.no_partners_category_prefix')} ${label} ${I18n.t('map.no_partners_category_suffix')}`;
                container.appendChild(comingSoon);
                continue;
            }

            const partnerList = document.createElement('div');
            partnerList.className = 'partner-list';

            for (const partner of partners) {
                const isSelected = state.selectedPartnerId === partner.id;

                const partnerBtn = document.createElement('button');
                partnerBtn.type = 'button';
                partnerBtn.className = 'partner-toggle' + (isSelected ? ' is-selected' : '');
                partnerBtn.textContent = partner.name;
                partnerBtn.addEventListener('click', () => selectPartner(partner.id));
                partnerList.appendChild(partnerBtn);

                if (isSelected) {
                    partnerList.appendChild(buildPartnerDetail(partner));
                }
            }
            container.appendChild(partnerList);
        }
    }

    function toggleCategory(category) {
        const wasExpanded = state.expandedCategory === category;
        state.expandedCategory = wasExpanded ? null : category;
        state.selectedPartnerId = null;

        for (const { category: cat, partners } of groups) {
            const shouldShow = state.expandedCategory === cat;
            for (const partner of partners) {
                // si partners está vacío, este for no hace nada — ya es seguro
                const marker = markersByPartnerId[partner.id];
                if (shouldShow) {
                    marker.addTo(map);
                } else {
                    map.removeLayer(marker);
                }
            }
        }

        renderList();
        requestAnimationFrame(() => map.invalidateSize());
    }

    function selectPartner(partnerId) {
        const wasSelected = state.selectedPartnerId === partnerId;
        const previousId = state.selectedPartnerId;
        state.selectedPartnerId = wasSelected ? null : partnerId;

        // Desinfla el partner anterior, si había uno distinto
        if (previousId && previousId !== partnerId) {
            const prevPartner = findPartnerById(previousId);
            setMarkerExpanded(markersByPartnerId[previousId], prevPartner, false);
        }

        // Infla/desinfla el partner actual según el nuevo estado
        const partner = findPartnerById(partnerId);
        setMarkerExpanded(markersByPartnerId[partnerId], partner, !wasSelected);

        renderList();

        requestAnimationFrame(() => map.invalidateSize());
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
 * enlaces (web, entradas, fiesta propia si existe).
 * Diseño visual pendiente de afinar más adelante (acordado).
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
