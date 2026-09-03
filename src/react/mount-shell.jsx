// ─────────────────────────────────────────────────────────────
//  mount-shell.jsx — engancha <AppShell /> en <div id="shell-root">.
//  Mismo patrón que mount-nav.jsx: script type="module", corre durante
//  el parseo del HTML, antes de DOMContentLoaded.
// ─────────────────────────────────────────────────────────────

import { createRoot } from 'react-dom/client';
import AppShell from './AppShell.jsx';

const root = document.getElementById('shell-root');
if (root) {
    createRoot(root).render(<AppShell />);
}
