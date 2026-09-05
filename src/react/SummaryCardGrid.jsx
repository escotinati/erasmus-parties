// ─────────────────────────────────────────────────────────────
//  SummaryCardGrid.jsx — itera `items` y monta un <SummaryCard> por
//  cada uno. No sabe nada de la forma de un partner ni de un evento:
//  esa traducción la hace `getCardProps(item, index)`, que pasa el
//  padre (getPartnerCardProps en index.js / getEventCardProps en
//  nightsSection.js).
//
//  Sin wrapper propio (Fragment): las cards deben quedar como hijas
//  DIRECTAS del contenedor real (.partner-grid / .events-scroll),
//  que las trata como flex/grid items — un <div> intermedio aquí
//  rompería ese layout.
// ─────────────────────────────────────────────────────────────

import SummaryCard from './SummaryCard.jsx';

export default function SummaryCardGrid({ items, variant, getCardProps }) {
    return (
        <>
            {items.map((item, index) => (
                <SummaryCard key={item.id} variant={variant} {...getCardProps(item, index)} />
            ))}
        </>
    );
}
