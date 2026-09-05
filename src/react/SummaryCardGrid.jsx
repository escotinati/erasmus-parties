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
//
//  window.initScrollReveal() se dispara aquí, en un useEffect, en vez
//  de que lo llamen index.js/nightsSection.js justo después de
//  root.render() — root.render() en un root ya montado es una
//  actualización normal de React (no el mount inicial), y esas
//  actualizaciones NO se comprometen al DOM de forma síncrona: un
//  script clásico que llama a initScrollReveal() en la línea siguiente
//  puede correr antes de que las tarjetas nuevas existan de verdad,
//  con lo que su querySelectorAll no encuentra nada que observar y esas
//  tarjetas se quedan en opacity:0 para siempre (initScrollReveal() es
//  una foto fija, no seguía observando el DOM). Mismo tipo de carrera
//  que ya documenta este proyecto para el nav (ver CLAUDE.md, sección
//  Navegación) — la solución es la misma: resolverlo DENTRO del
//  componente React, en un efecto que corre después del commit real,
//  no confiar en que un script externo acierte el timing.
// ─────────────────────────────────────────────────────────────

import { useEffect } from 'react';
import SummaryCard from './SummaryCard.jsx';

export default function SummaryCardGrid({ items, variant, getCardProps }) {
    useEffect(() => {
        if (window.initScrollReveal) window.initScrollReveal();
    });

    return (
        <>
            {items.map((item, index) => (
                <SummaryCard key={item.id} variant={variant} {...getCardProps(item, index)} />
            ))}
        </>
    );
}
