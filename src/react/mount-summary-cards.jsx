// ─────────────────────────────────────────────────────────────
//  mount-summary-cards.jsx — a diferencia de mount-nav.jsx /
//  mount-footer.jsx (que se auto-montan en un <div> fijo al cargar),
//  este módulo expone una factoría: index.js y nightsSection.js
//  (scripts clásicos, sin ES Modules) necesitan crear un root sobre
//  un contenedor que ellos mismos localizan (#partnerGrid /
//  .events-scroll) y volver a pintar sobre ÉL MISMO root en cada
//  cambio de filtro, sin destruirlo y recrearlo.
//
//  Un script clásico no puede hacer `import` de este archivo — se
//  expone en window, mismo puente que ya usan sanitize.js/Skeleton.js
//  para cruzar esa frontera en el resto del proyecto.
// ─────────────────────────────────────────────────────────────

import { createRoot } from 'react-dom/client';
import SummaryCardGrid from './SummaryCardGrid.jsx';

export function mountSummaryCards(containerEl) {
    const root = createRoot(containerEl);
    return {
        render(items, variant, getCardProps) {
            root.render(
                <SummaryCardGrid items={items} variant={variant} getCardProps={getCardProps} />
            );
        },
    };
}

window.mountSummaryCards = mountSummaryCards;
