// ─────────────────────────────────────────────────────────────
//  mount-partner-list.jsx — mismo patrón que mount-summary-cards.jsx:
//  mapPartners.js (script clásico, sin ES Modules) necesita crear un
//  root de React sobre el contenedor de la lista de partners UNA
//  ÚNICA VEZ y volver a pintar sobre ESE MISMO root en cada
//  toggleCategory() (y en el flujo de deep-link ?partner=), sin
//  destruirlo y recrearlo.
// ─────────────────────────────────────────────────────────────

import { createRoot } from 'react-dom/client';
import PartnerCategoryList from './PartnerCategoryList.jsx';

export function mountPartnerCategoryList(containerEl) {
    // createRoot() (React 18) NO borra los hijos preexistentes del
    // contenedor al montarse — eso solo pasaba con la antigua
    // ReactDOM.render() (React ≤17). Sin este vaciado explícito, lo
    // que hubiera antes en containerEl se quedaría mezclado para
    // siempre con las filas reales que React añade después.
    containerEl.innerHTML = '';
    const root = createRoot(containerEl);
    return {
        render(groups, activeCategories, onToggleCategory, onSelectPartner) {
            root.render(
                <PartnerCategoryList
                    groups={groups}
                    activeCategories={activeCategories}
                    onToggleCategory={onToggleCategory}
                    onSelectPartner={onSelectPartner}
                />
            );
        },
    };
}

window.mountPartnerCategoryList = mountPartnerCategoryList;
