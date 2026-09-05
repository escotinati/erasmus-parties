// ─────────────────────────────────────────────────────────────
//  MAP-HELPERS.JS — Erasmus Parties
//
//  ÚNICO archivo del proyecto que conoce Leaflet (variable global L,
//  cargada por <script> en mapa.html). El resto de la app habla con
//  estas funciones. Cambiar de proveedor de mapas = reescribir solo
//  este archivo.
//
//  Expuesto como funciones globales (sin export/import) para mantener
//  consistencia con el resto del proyecto: son scripts clásicos, no ES
//  Modules (salvo las dos islas de React en src/react/, ver CLAUDE.md).
// ─────────────────────────────────────────────────────────────

let map = null;

/**
 * Inicializa el mapa centrado en `center` ({lat, lng}) con el zoom dado.
 * Añade la capa de tiles CARTO (gratis, atribución obligatoria por licencia).
 */
function initMap(containerId, center, zoom = 14) {
    map = L.map(containerId, { center: [center.lat, center.lng], zoom });

    const cartoKey = window.__CARTO_API_KEY__ || '';
    L.tileLayer(
        `https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}{r}.png?key=${cartoKey}`,
        {
            attribution:
                '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19,
        }
    ).addTo(map);

    return map;
}

/**
 * Añade un pin en `{lat, lng}`. `label` es el tooltip nativo (accesibilidad
 * y hover). `color` define el color del pin vía CSS custom property.
 * Devuelve el marker de Leaflet por si se necesita más adelante
 * (p. ej. para asociarle un popup en la Fase C).
 */
function addMarker({ lat, lng }, { label, color = '#4648d4' } = {}) {
    const icon = L.divIcon({
        className: 'erasmus-pin',
        html: `<span class="material-symbols-outlined erasmus-pin__icon" style="--pin-color:${color}">location_on</span>`,
        iconSize: [32, 32],
        iconAnchor: [16, 32], // la punta del pin marca la coordenada exacta
    });

    const marker = L.marker([lat, lng], { icon, title: label || '' });
    marker.addTo(map);
    return marker;
}

/**
 * Metadatos visuales por categoría. nightlife en azul, según lo acordado.
 * Las demás categorías quedan definidas para cuando tengan partners reales.
 */
const CATEGORY_META = {
    nightlife: { label: 'Nightlife', color: '#2563eb', icon: 'nightlife' },
    housing: { label: 'Alojamiento', color: '#0e7490', icon: 'home' },
    services: { label: 'Bar', color: '#ca8a04', icon: 'local_bar' },
    community: { label: 'Comunidad', color: '#16a34a', icon: 'groups' },
    travel: { label: 'Viajes', color: '#7c3aed', icon: 'flight' },
    restaurants: { label: 'Restaurantes', color: '#dc2626', icon: 'restaurant' },
    sports: { label: 'Deporte', color: '#ea580c', icon: 'sports_soccer' },
    culture: { label: 'Cultura', color: '#db2777', icon: 'theater_comedy' },
    shopping: { label: 'Compras', color: '#9333ea', icon: 'shopping_bag' },
    wellness: { label: 'Bienestar', color: '#059669', icon: 'spa' },
    events: { label: 'Eventos', color: '#d97706', icon: 'event' },
    education: { label: 'Formación', color: '#0284c7', icon: 'school' },
    transport: { label: 'Transporte', color: '#64748b', icon: 'directions_bus' },
    food: { label: 'Comida rápida', color: '#f59e0b', icon: 'fastfood' },
    coworking: { label: 'Coworking', color: '#0891b2', icon: 'business_center' },
    healthcare: { label: 'Salud', color: '#16a34a', icon: 'medical_services' },
    language: { label: 'Idiomas', color: '#7c3aed', icon: 'translate' },
    volunteering: { label: 'Voluntariado', color: '#be185d', icon: 'volunteer_activism' },
    music: { label: 'Música', color: '#1d4ed8', icon: 'music_note' },
    photography: { label: 'Fotografía', color: '#92400e', icon: 'photo_camera' },
};

/**
 * Crea (sin añadir al mapa) un marker de partner, con icono de categoría.
 * `expanded` controla el tamaño (acordeón: solo uno expandido a la vez).
 * Devuelve el marker de Leaflet para que mapPartners.js controle
 * cuándo añadirlo/quitarlo del mapa y cuándo cambiar su tamaño.
 */
function createPartnerMarker(partner, { expanded = false } = {}) {
    const meta = CATEGORY_META[partner.category] || { color: '#64748b' };
    const size = expanded ? 34 : 24;

    const icon = L.divIcon({
        className: 'partner-pin' + (expanded ? ' partner-pin--expanded' : ''),
        html: `<span class="material-symbols-outlined partner-pin__icon" style="--pin-color:${meta.color};font-size:${size}px">location_on</span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
    });

    return L.marker([partner.lat, partner.lng], { icon, title: partner.name });
}

/**
 * Cambia el tamaño de un marker ya creado, sin recrearlo desde cero.
 * Se usa al expandir/contraer un partner (acordeón).
 */
function setMarkerExpanded(marker, partner, expanded) {
    const meta = CATEGORY_META[partner.category] || { color: '#64748b' };
    const size = expanded ? 34 : 24;

    marker.setIcon(
        L.divIcon({
            className: 'partner-pin' + (expanded ? ' partner-pin--expanded' : ''),
            html: `<span class="material-symbols-outlined partner-pin__icon" style="--pin-color:${meta.color};font-size:${size}px">location_on</span>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size],
        })
    );
}
