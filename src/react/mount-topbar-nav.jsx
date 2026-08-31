// ─────────────────────────────────────────────────────────────
//  mount-topbar-nav.jsx — engancha <TopbarNav /> en el hueco que deja
//  cada página con el patrón header.topbar (ciudad.html, mapa.html,
//  servicios.html, viajes.html, alojamiento.html).
//
//  window.__BACK_LINK__ es opcional: solo lo define (con un <script>
//  de una línea justo antes de este) ciudad.html/mapa.html, que sí
//  llevan botón de "volver". El resto de páginas no lo definen y
//  TopbarNav simplemente no renderiza el botón.
// ─────────────────────────────────────────────────────────────

import { createRoot } from 'react-dom/client';
import TopbarNav from './TopbarNav.jsx';

const root = document.getElementById('nav-root');
if (root) {
    createRoot(root).render(<TopbarNav backLink={window.__BACK_LINK__} />);
}
