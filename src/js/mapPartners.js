// ─────────────────────────────────────────────────────────────
//  MAPPARTNERS.JS — Erasmus Verified / Erasmus Parties
//
//  Listado de categorías/partners sincronizado con pines en el mapa.
//  Modelo de multi-selección, no acordeón: un Set de categorías
//  activas decide qué grupos se ven en la lista y qué pines en el
//  mapa — no hay "una categoría desplegada a la vez" como en la
//  versión anterior. El control de activar/desactivar cada categoría
//  vive DENTRO del propio <h3> del grupo (icono toggle_on/toggle_off
//  junto al icono+etiqueta de la categoría) — no hay una barra de
//  chips separada como hubo en una rama anterior: chip y título
//  mostraban lo mismo dos veces, y en el aside estrecho de escritorio
//  (~226-340px) la barra se envolvía en líneas sueltas por encima de
//  esa misma información repetida. Al fusionarlos, ese problema de
//  maquetación desaparece por construcción, sin parche de CSS aparte.
//  Categoría desactivada: su sección se queda en el DOM colapsada
//  (icono+etiqueta atenuados, sin la lista de partners debajo), nunca
//  desaparece del todo — el título sigue ahí para poder reactivarla.
//  Abrir un partner no expande su fila inline: abre el detalle en un
//  Sheet (src/js/ui/sheet.js).
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
    // No se sabe todavía cuántas categorías/partners habrá (eso lo
    // decide la respuesta), así que el skeleton es genérico: unas
    // pocas filas sueltas, misma forma que .partner-toggle sin
    // cabeceras de grupo encima (esas sí dependen del resultado).
    Skeleton.render(container, 4, () => Skeleton.block('skeleton--row'));

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

    // Con una sola categoría en la ciudad no hay nada que decida
    // filtrarla (regla 4): esa categoría se muestra siempre, entera —
    // buildGroupSection() tampoco le pone control de activar/desactivar.
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

    function renderList() {
        Skeleton.clear(container);
        container.innerHTML = '';

        const singleCategory = groups.length === 1;

        if (singleCategory) {
            container.appendChild(buildCountText(groups[0]));
        }

        // Regla 6 (todo apagado a mano): ya no hace falta un botón
        // "ver todo" aparte — con el título siempre visible aunque
        // colapsado (ver buildGroupSection), cada grupo apagado ya es
        // su propia salida. Un botón de reinicio flotante habría sido
        // OTRO control separado repitiendo lo que el propio título ya
        // resuelve, justo el problema que motivó esta fusión.
        for (const group of groups) {
            container.appendChild(buildGroupSection(group));
        }
    }

    // ── Regla 4: una sola categoría con partners → sin control de activar/desactivar ──
    function buildCountText(group) {
        const p = document.createElement('p');
        p.className = 'partners-count';
        p.textContent = `${group.partners.length} ${I18n.t('map.partners_count_label')} ${city.name}`;
        return p;
    }

    // ── Regla 5: la ciudad no tiene ningún partner activo ──────────
    // Sin mapa de pines (no hay ninguno que crear) ni chips — mensaje
    // + botón al grupo de WhatsApp de la ciudad, solo si existe una
    // URL válida (sanitizeUrl(), mismo criterio que ciudad.js). Si no
    // hay whatsapp_url, o no es válida, el botón no se renderiza: se
    // deja solo el mensaje, nunca un enlace muerto.
    function renderNoPartnersState() {
        Skeleton.clear(container);
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

    // ── Grupo de una categoría: cabecera fusionada (icono + etiqueta +
    // control de activar/desactivar) + lista de partners debajo. La
    // sección SIEMPRE está en el DOM, activa o no — cuando está apagada
    // se queda colapsada (clase .partner-group--collapsed: oculta
    // .partner-list, atenúa icono+etiqueta) en vez de desaparecer, así
    // el propio título sigue siendo la forma de reactivarla. Con una
    // sola categoría en la ciudad (regla 4) no lleva control: nada que
    // filtrar, y apagar la única categoría dejaría la lista vacía sin
    // otra visible que sirviera de salida. ──
    function buildGroupSection(group) {
        const { category, partners } = group;
        const meta = CATEGORY_META[category] || {
            label: category,
            color: '#64748b',
            icon: 'place',
        };
        const label = categoryLabel(category, meta.label);
        const singleCategory = groups.length === 1;
        const isActive = state.activeCategories.has(category);

        const section = document.createElement('div');
        section.className =
            'partner-group' + (!singleCategory && !isActive ? ' partner-group--collapsed' : '');

        const heading = document.createElement('h3');
        heading.className = 'partner-group__title';
        heading.style.setProperty('--pin-color', meta.color);

        const headingIcon = document.createElement('span');
        headingIcon.className = 'material-symbols-outlined partner-group__icon';
        headingIcon.setAttribute('aria-hidden', 'true');
        headingIcon.textContent = meta.icon;
        heading.appendChild(headingIcon);

        const labelEl = document.createElement('span');
        labelEl.className = 'partner-group__label';
        labelEl.textContent = label;
        heading.appendChild(labelEl);

        if (!singleCategory) {
            // toggle_on/toggle_off (no un simple check): la FORMA del
            // icono cambia entera entre estados, no solo su color — se
            // lee como "esto es un interruptor" antes de tocarlo,
            // incluso sin distinguir color. El color activo sigue
            // siendo --pin-color, igual que antes en el chip.
            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'partner-group__toggle';
            toggle.setAttribute('aria-pressed', String(isActive));
            toggle.setAttribute(
                'aria-label',
                `${I18n.t(isActive ? 'map.category_hide' : 'map.category_show')} ${label}`
            );

            const toggleIcon = document.createElement('span');
            toggleIcon.className = 'material-symbols-outlined partner-group__toggle-icon';
            toggleIcon.setAttribute('aria-hidden', 'true');
            toggleIcon.textContent = isActive ? 'toggle_on' : 'toggle_off';
            toggle.appendChild(toggleIcon);

            toggle.addEventListener('click', () => toggleCategory(category));
            heading.appendChild(toggle);
        }

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
