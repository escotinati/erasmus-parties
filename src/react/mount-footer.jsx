// ─────────────────────────────────────────────────────────────
//  mount-footer.jsx — engancha <Footer /> en el hueco que deja cada
//  página pública con footer (todas salvo mapa.html).
// ─────────────────────────────────────────────────────────────

import { createRoot } from 'react-dom/client';
import Footer from './Footer.jsx';

const root = document.getElementById('footer-root');
if (root) {
    createRoot(root).render(<Footer />);
}
