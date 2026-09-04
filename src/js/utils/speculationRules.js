// ─────────────────────────────────────────────────────────────
//  SPECULATIONRULES.JS — Erasmus Verified / Erasmus Parties
//
//  Prefetch de las 4 rutas internas del bottom-nav (AppShell.jsx —
//  el salto de dominio Fiestas/Verified no es same-origin, no se
//  puede prefetchear vía Speculation Rules) para que la view
//  transition entre páginas (styles.css, sección 11) no se note lenta
//  en 3G: sin esto, la navegación sigue funcionando exactamente igual
//  (esto es una optimización de rendimiento, no una dependencia).
//
//  eagerness "eager" (precarga inmediata, no solo al pasar el dedo
//  cerca del link) a propósito: en táctil puro (el 90% del tráfico de
//  este proyecto, ver CLAUDE.md) "moderate" solo dispara en
//  pointerdown, justo antes del tap real — deja demasiado poco margen
//  en 3G para que se note la mejora. Son 4 páginas de HTML ligero (no
//  recursos pesados), el coste de datos es marginal frente al
//  beneficio. prefetch, no prerender: solo descarga, sin ejecutar JS
//  ni disparar fetches especulativos a Supabase.
//
//  Sin ES Modules, como el resto del proyecto: función global,
//  autoejecutada al cargar. HTMLScriptElement.supports() comprueba
//  soporte antes de inyectar nada — degradación limpia donde no hay
//  soporte (Safari, Firefox a fecha de esta rama): no pasa nada, ni
//  un error en consola.
// ─────────────────────────────────────────────────────────────

(function () {
    if (!window.HTMLScriptElement || !HTMLScriptElement.supports) return;
    if (!HTMLScriptElement.supports('speculationrules')) return;

    var BOTTOM_NAV_ROUTES = ['index.html', 'mapa.html', 'servicios.html', 'viajes.html'];

    var currentPage = (window.location.pathname.split('/').pop() || 'index.html').split('?')[0];
    var urls = BOTTOM_NAV_ROUTES.filter(function (route) {
        return route !== currentPage;
    });
    if (urls.length === 0) return;

    var script = document.createElement('script');
    script.type = 'speculationrules';
    script.textContent = JSON.stringify({
        prefetch: [{ urls: urls, eagerness: 'eager' }],
    });
    document.head.appendChild(script);
})();
