// ─────────────────────────────────────────────────────────────
//  CITYMAP.JS — Erasmus Parties
//
//  Módulo único de "mapa de ciudad", usado por ciudad.html (embebido)
//  y mapa.html (pantalla completa). Encapsula geocodificación +
//  inicialización de Leaflet para que ninguna página repita esta lógica.
//
//  API: mountCityMap(containerId, { pais, ciudad, interactive })
//   - containerId: id del <div> donde se monta el mapa
//   - pais, ciudad: para geocodeo y el pin principal
//   - interactive: si es false, el mapa empieza "bloqueado" (sin zoom/pan)
//     y muestra un overlay "Toca para interactuar" — pensado para el
//     mapa EMBEBIDO en ciudad.html, donde el usuario hace scroll por
//     encima. Si es true (mapa.html, pantalla completa), no hay overlay.
//
//  Devuelve una Promise que resuelve cuando el mapa está listo (o null
//  si no se pudo geocodificar la ciudad).
// ─────────────────────────────────────────────────────────────

async function mountCityMap(containerId, { pais, ciudad, lat, lng, interactive = true }) {
    const container = document.getElementById(containerId);

    // Sin forma de card reconocible (es un mapa) — un único bloque
    // relleno del contenedor. El texto "Cargando mapa de {ciudad}…"
    // solo era necesario cuando esto tardaba (geocodeo real vía
    // Nominatim); con lat/lng ya guardados en Supabase (el caso
    // habitual) esta espera es casi siempre instantánea de todas
    // formas.
    Skeleton.render(container, 1, () => Skeleton.block('skeleton--block'));

    let coords = null;

    if (lat && lng) {
        coords = { lat, lng };
    } else {
        coords = await getCityCoords(ciudad, pais);
    }

    if (!coords) {
        Skeleton.clear(container);
        container.innerHTML = `
      <div class="city-map-error">
        <span class="city-map-error__icon">🗺️</span>
        <p>${I18n.t('map.city_not_located_prefix')} ${escapeHtml(ciudad)} ${I18n.t('map.city_not_located_suffix')}</p>
      </div>`;
        return null;
    }

    Skeleton.clear(container);
    container.innerHTML = ''; // Leaflet necesita el contenedor vacío

    const map = initMap(containerId, coords);
    addMarker(coords, { label: ciudad, color: '#e1147b' });

    if (!interactive) {
        // Bloquea gestos que compiten con el scroll de la página.
        // El usuario "activa" el mapa con un tap; a partir de ahí
        // se comporta como un mapa normal.
        map.dragging.disable();
        map.scrollWheelZoom.disable();
        map.doubleClickZoom.disable();
        map.touchZoom.disable();

        const overlay = document.createElement('button');
        overlay.type = 'button';
        overlay.className = 'city-map-activate';
        overlay.textContent = I18n.t('map.tap_to_interact');
        overlay.addEventListener(
            'click',
            () => {
                map.dragging.enable();
                map.scrollWheelZoom.enable();
                map.doubleClickZoom.enable();
                map.touchZoom.enable();
                overlay.remove();
            },
            { once: true }
        );

        // No forzar position:relative aquí: .city-map-embed ya es
        // position:sticky en móvil (styles.css, .city-map-columns
        // .city-map-embed) — sticky es tan válido como relative como
        // contexto de posicionamiento para el overlay absolute de
        // abajo, y forzarlo a mano por encima del sticky vía inline
        // style (mayor especificidad que cualquier regla de la hoja)
        // lo rompía: el mapa se dibujaba desplazado top abajo de su
        // sitio en el flujo normal, tapando el primer bloque de la
        // lista de partners. Bug real, no teórico — confirmado en
        // iPhone 15 Pro (393×852): con interactive:false por fin en
        // uso (antes ninguna página lo activaba), position:relative
        // + el top heredado de la regla sticky desplazaba el mapa
        // ~71px sobre su sitio.
        container.appendChild(overlay);
    }

    // (Fase 2, futuro): aquí se añadirán pines de partners filtrados
    // por `ciudad`, reutilizando addMarker() con color por categoría.

    return map;
}
