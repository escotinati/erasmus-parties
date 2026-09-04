// ─────────────────────────────────────────────────────────────
//  SKELETON.JS — Erasmus Verified / Erasmus Parties
//
//  Único helper reutilizable para los estados de carga mientras se
//  espera Supabase: sustituye a los textos "Cargando…" (y a los
//  contenedores que hoy se quedan vacíos sin avisar). No hay un
//  sistema de skeleton distinto por página — cada consumidor construye
//  SU forma real (card de ciudad, fila de partner…) combinando estos
//  dos primitivos con las clases CSS reales del contenido final que va
//  a sustituir (ver .skeleton en src/css/styles.css, sección 2.7),
//  así el layout no salta cuando llegan los datos.
//
//  Sin ES Modules, como el resto del proyecto: window.Skeleton.
// ─────────────────────────────────────────────────────────────

(function () {
    // Bloque shimmer suelto — el primitivo base. `extraClass` añade un
    // modificador de forma (--fill, --text, --text-title, --text-sm,
    // --row, --block, ver styles.css) o una clase propia del layout
    // donde vive (p.ej. accordion-card--main). Puramente decorativo:
    // no es contenido, por eso aria-hidden.
    function block(extraClass) {
        const el = document.createElement('div');
        el.className = 'skeleton' + (extraClass ? ' ' + extraClass : '');
        el.setAttribute('aria-hidden', 'true');
        return el;
    }

    // Vacía `container`, marca aria-busy, y lo rellena con `count`
    // nodos construidos por `buildItem(index)` — buildItem es quien
    // decide la forma (usa block() por dentro para cada pieza que
    // necesite shimmer). Un solo punto de vaciado/relleno, en vez de
    // repetir el mismo innerHTML='' + bucle en cada archivo.
    function render(container, count, buildItem) {
        if (!container) return;
        container.innerHTML = '';
        container.setAttribute('aria-busy', 'true');
        const frag = document.createDocumentFragment();
        for (let i = 0; i < count; i++) {
            frag.appendChild(buildItem(i));
        }
        container.appendChild(frag);
    }

    // Los consumidores la llaman justo antes de pintar el contenido
    // real (innerHTML solo cambia los hijos, no el aria-busy del
    // propio contenedor — hay que quitarlo a mano).
    function clear(container) {
        if (container) container.removeAttribute('aria-busy');
    }

    window.Skeleton = { block: block, render: render, clear: clear };
})();
