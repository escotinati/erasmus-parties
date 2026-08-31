// ─────────────────────────────────────────────────────────────
//  mount-hero-legacy-nav.jsx — engancha <TopbarNav /> en el hueco que
//  deja ciudades.html (patrón .hero-legacy .topbar, única página que
//  lo usa). El botón de "volver a países" es estático — nunca lo
//  reescribe JS — así que su configuración va hardcodeada aquí en vez
//  de por window.__BACK_LINK__ como en mount-topbar-nav.jsx.
// ─────────────────────────────────────────────────────────────

import { createRoot } from 'react-dom/client';
import TopbarNav from './TopbarNav.jsx';

const root = document.getElementById('nav-root');
if (root) {
    createRoot(root).render(
        <TopbarNav
            as="div"
            backLink={{
                i18nKey: 'cities.back_to_countries',
                label: 'Todos los países',
                href: 'index.html',
            }}
        />
    );
}
