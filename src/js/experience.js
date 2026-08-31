// ─────────────────────────────────────────────────────────────
//  EXPERIENCE.JS — Erasmus Verified / Erasmus Parties
//
//  Detecta el dominio activo y aplica la experiencia correcta
//  (tema visual, menú, comportamiento de categorías).
//
//  Override para desarrollo local: ?exp=parties o ?exp=verified
//  en la URL, para probar ambas experiencias sin cambiar DNS.
//
//  Se carga como PRIMER script en el <head> de todas las páginas.
// ─────────────────────────────────────────────────────────────

const EXPERIENCES = {
    verified: {
        name: 'Erasmus Verified',
        theme: 'theme-verified',
        defaultCategory: null,
        showServices: true,
        showAlojamiento: true,
        showViajes: true,
    },
    parties: {
        name: 'Erasmus Parties',
        theme: 'theme-parties',
        defaultCategory: 'nightlife',
        showServices: false,
        showAlojamiento: false,
        showViajes: false,
    },
};

function resolveExperience() {
    // Override manual para desarrollo local
    const params = new URLSearchParams(window.location.search);
    const override = params.get('exp');
    if (override && EXPERIENCES[override]) return EXPERIENCES[override];

    // Detección por hostname (quitando www.)
    const hostname = window.location.hostname.replace(/^www\./, '');
    if (hostname === 'erasmusparties.org') return EXPERIENCES.parties;
    return EXPERIENCES.verified; // fallback: Verified
}

// La experiencia se expone globalmente para que otros scripts
// la lean sin necesidad de recalcularla
window.ERASMUS_EXPERIENCE = resolveExperience();

// Aplica el tema en <html> inmediatamente (antes del resto del JS)
// para evitar flash de tema incorrecto
document.documentElement.classList.add(window.ERASMUS_EXPERIENCE.theme);

// ── Modificaciones de navegación ─────────────────────────────
// Se ejecutan tras DOMContentLoaded para que los elementos del
// menú ya existan en el DOM.
document.addEventListener('DOMContentLoaded', function () {
    // Activar brand Parties en <body> en sincronía con .theme-parties en <html>
    // (line 50): mismo criterio (window.ERASMUS_EXPERIENCE.theme), así que
    // también respeta el override manual ?exp=parties, no solo el hostname.
    // document.body no existe todavía cuando este script corre en <head>,
    // por eso se hace aquí y no en el nivel superior del archivo.
    if (window.ERASMUS_EXPERIENCE.theme === 'theme-parties') {
        document.body.setAttribute('data-brand', 'parties');
    }

    // Navbar scroll shadow para el patrón header.topbar / .hero-legacy .topbar
    // (ciudad.html, mapa.html, servicios.html, viajes.html, alojamiento.html,
    // ciudades.html): ahora vive dentro de TopbarNav.jsx (rama react/menu),
    // igual que en Nav.jsx para el patrón .topnav — un querySelector aquí en
    // DOMContentLoaded podía disparar antes de que React montara el nodo
    // (se comprobó, fallaba 100% de las veces en local).

    if (window.ERASMUS_EXPERIENCE.theme !== 'theme-parties') return;

    // 1. Logo: "Verified" → "Parties"
    // (el nav de index.html/ciudades-todas.html es React — ver Nav.jsx,
    // que ya resuelve su propio brand/links según la experiencia y se
    // marca con [data-react-nav] para que estas mutaciones no lo toquen
    // dos veces, ni corran antes de que exista si el DOMContentLoaded
    // de esta página dispara antes de que React termine de montar)
    document.querySelectorAll('.brand').forEach(function (el) {
        if (el.closest('[data-react-nav]')) return;
        el.textContent = 'Erasmus Parties';
    });
    document.querySelectorAll('.logo').forEach(function (el) {
        if (el.closest('[data-react-nav]')) return;
        el.innerHTML = 'Erasmus<span class="logo-dot">Parties</span>';
    });
    document.querySelectorAll('.footer-logo').forEach(function (el) {
        el.textContent = 'Erasmus Parties';
    });

    // 2. Ocultar Servicios, Alojamiento y Viajes en todas las navs
    ['servicios.html', 'alojamiento.html', 'viajes.html'].forEach(function (page) {
        document.querySelectorAll('a[href="' + page + '"]').forEach(function (a) {
            a.style.display = 'none';
        });
    });

    // 3. Ocultar "Fiestas ↗" en topbar-nav y mobile-nav-links
    document.querySelectorAll('.nav-parties').forEach(function (a) {
        if (a.closest('[data-react-nav]')) return;
        a.style.display = 'none';
    });

    // 4. Ocultar "Fiestas" en el bottom-nav (clase distinta)
    document.querySelectorAll('.app-bottom-nav-item--parties').forEach(function (a) {
        a.style.display = 'none';
    });

    // 5. Añadir "Verified ↗" al final de topbar-nav y mobile-nav-links
    document.querySelectorAll('.topbar-nav, .mobile-nav-links').forEach(function (nav) {
        if (nav.closest('[data-react-nav]')) return;
        const a = document.createElement('a');
        a.href = 'https://erasmusverified.com';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'nav-verified';
        a.textContent = '🎓 Verified ↗';
        nav.appendChild(a);
    });

    // 6. Añadir "Verified ↗" al app-bottom-nav
    document.querySelectorAll('.app-bottom-nav').forEach(function (nav) {
        const a = document.createElement('a');
        a.href = 'https://erasmusverified.com';
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'app-bottom-nav-item nav-verified';
        a.innerHTML =
            '<span class="material-symbols-outlined">verified</span>' + '<span>Verified</span>';
        nav.appendChild(a);
    });
});
