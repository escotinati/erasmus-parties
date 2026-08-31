// ─────────────────────────────────────────────────────────────
//  mount-nav.jsx — engancha <Nav /> en el hueco que deja cada página
//  (<div id="nav-root">). Script type="module" (Vite lo bundlea) — se
//  ejecuta durante el parseo del HTML, antes de DOMContentLoaded, así
//  que cuando corren experience.js / applyTranslations() / los demás
//  <script> inline (todos enganchados a DOMContentLoaded) el nav ya
//  existe en el DOM exactamente igual que si fuera HTML estático.
// ─────────────────────────────────────────────────────────────

import { createRoot } from 'react-dom/client';
import Nav from './Nav.jsx';

const root = document.getElementById('nav-root');
if (root) {
    createRoot(root).render(<Nav />);
}
