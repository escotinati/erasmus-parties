// ─────────────────────────────────────────────────────────────
//  mount-summary-cards.jsx — a diferencia de mount-nav.jsx /
//  mount-footer.jsx (que se auto-montan en un <div> fijo al cargar),
//  este módulo expone una factoría: index.js y nightsSection.js
//  (scripts clásicos, sin ES Modules) necesitan crear un root sobre
//  un contenedor que ellos mismos localizan (#partnerGrid /
//  .events-scroll) y volver a pintar sobre ÉL MISMO root en cada
//  cambio de filtro, sin destruirlo y recrearlo.
//
//  Un script clásico no puede hacer `import` de este archivo, así que
//  se expone la factoría en window — el PRIMER puente module→script-
//  clásico del proyecto (sanitize.js/skeleton.js no son un precedente:
//  son scripts clásicos normales, sin type="module", nunca cruzan esta
//  frontera). mount-nav.jsx no necesitó nunca algo así porque se
//  auto-monta una única vez contra un <div> fijo y no vuelve a
//  renderizarse; SummaryCard sí necesita repintarse en cada cambio de
//  filtro desde código clásico (index.js/nightsSection.js), de ahí que
//  aquí haga falta devolver una factoría reutilizable en vez de
//  auto-montarse como los demás mount-*.jsx.
// ─────────────────────────────────────────────────────────────

import { createRoot } from 'react-dom/client';
import SummaryCardGrid from './SummaryCardGrid.jsx';

export function mountSummaryCards(containerEl) {
    // createRoot() (React 18) NO borra los hijos preexistentes del
    // contenedor al montarse — eso solo pasaba con la API antigua
    // ReactDOM.render() (React ≤17). Cuando esta función se llama,
    // containerEl todavía tiene el esqueleto de carga pintado con DOM
    // imperativo (Skeleton.render(), ver renderPartnerGridSkeleton()/
    // renderEventsSkeleton()) — sin este vaciado explícito, esos divs
    // se quedarían para siempre mezclados con las tarjetas reales que
    // React añade después.
    containerEl.innerHTML = '';
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
