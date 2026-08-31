// ─────────────────────────────────────────────────────────────
//  TopbarNav.jsx — patrones header.topbar y .hero-legacy .topbar
//  (rama react/menu)
//
//  Cubre las 6 páginas que quedaban con el header duplicado en HTML
//  estático: ciudad.html, mapa.html, servicios.html, viajes.html,
//  alojamiento.html (header.topbar) y ciudades.html
//  (.hero-legacy .topbar). logo/topbar-nav/topbar-right son siempre
//  hijos DIRECTOS de .topbar (nunca envueltos en un .topbar-left) —
//  .topbar usa el mismo truco de grid de 3 columnas que .topnav-inner
//  (ver styles.css) para centrar los links en todo el ancho de la
//  barra, igual que en index.html/ciudades-todas.html.
//
//  `as`: 'header' (por defecto) para el patrón normal, o 'div' para
//  .hero-legacy, donde el topbar vive dentro de un <section> que ya
//  hace de contenedor (ver mount-hero-legacy-nav.jsx).
//
//  `backLink` (opcional): { i18nKey, label, href }. Solo lo llevan
//  ciudad.html, mapa.html (texto que sus scripts reescriben tras
//  cargar datos de Supabase, con await de por medio — llega siempre
//  después de que React haya montado, no hay carrera ahí) y
//  ciudades.html (estático, nunca se reescribe). El resto de páginas
//  del patrón header.topbar no lo pasan y no se renderiza.
//
//  Ver Nav.jsx para la explicación larga de por qué este componente
//  resuelve i18n/lang-switcher/tema Parties él mismo en vez de dejarlo
//  en manos de scripts externos post-DOMContentLoaded. Por el mismo
//  motivo la sombra de scroll (antes en experience.js, un
//  querySelector('.topbar') en DOMContentLoaded) vive aquí en un
//  useEffect — el umbral de 10px coincide con el que tenía ese código
//  (distinto del de 20px que usa Nav.jsx para .topnav, no es un typo).
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import {
    currentPage,
    isPartiesExperience,
    t,
    NavLinks,
    LangSwitcherButton,
    AuthButton,
    HamburgerButton,
    MobileNavOverlay,
} from './navShared.jsx';

export default function TopbarNav({ as = 'header', backLink }) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const page = currentPage();
    const Wrapper = as;

    useEffect(() => {
        function onScroll() {
            setScrolled(window.scrollY > 10);
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <>
            <Wrapper className={`topbar${scrolled ? ' scrolled' : ''}`} data-react-nav="true">
                <a href="index.html" className="logo">
                    Erasmus
                    <span className="logo-dot">
                        {isPartiesExperience() ? 'Parties' : 'Verified'}
                    </span>
                </a>
                <nav className="topbar-nav" id="mainNav">
                    <NavLinks page={page} />
                </nav>
                <div className="topbar-right">
                    {backLink && (
                        <a href={backLink.href} className="back-btn" id="backLink">
                            <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                            >
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                            <span id="backLinkText" data-i18n={backLink.i18nKey}>
                                {t(backLink.i18nKey, backLink.label)}
                            </span>
                        </a>
                    )}
                    <LangSwitcherButton />
                    <AuthButton />
                    <HamburgerButton
                        open={mobileOpen}
                        onClick={() => setMobileOpen((open) => !open)}
                    />
                </div>
            </Wrapper>

            <MobileNavOverlay page={page} open={mobileOpen} onClose={() => setMobileOpen(false)} />
        </>
    );
}
