// ─────────────────────────────────────────────────────────────
//  Nav.jsx — patrón .topnav (rama react/menu)
//
//  Primera pieza en React del proyecto (el resto sigue siendo HTML +
//  <script> clásicos, ver CLAUDE.md). Antes este bloque estaba
//  duplicado byte a byte en cada página con el patrón .topnav
//  (index.html, ciudades-todas.html) — ahora vive aquí una sola vez.
//  El otro patrón de header (header.topbar) vive en TopbarNav.jsx;
//  ambos comparten los links/lang-switcher/hamburguesa/overlay móvil
//  vía navShared.jsx.
//
//  Regla general de estos componentes, aprendida a base de bugs
//  reales: NINGÚN script externo enganchado a DOMContentLoaded puede
//  confiar en encontrar nodos que renderiza React. El script (módulo,
//  con `defer` implícito) siempre termina de CARGARSE antes de
//  DOMContentLoaded, pero el commit real al DOM de
//  createRoot().render() puede quedar encolado por el scheduler de
//  React y resolverse después de que DOMContentLoaded ya haya
//  disparado — se comprobó en la práctica (Vite dev), no es solo
//  teoría. Por eso todo lo que antes se hacía desde fuera "buscando"
//  estos nodos después del hecho (sombra de scroll, tema Parties,
//  año/idioma del switcher) ahora lo resuelve este componente él
//  mismo, en su primer render o en un useEffect — ver navShared.jsx
//  para el detalle de i18n/lang-switcher/tema Parties.
//
//  Lo que SÍ se movió aquí (antes vivía en un <script> inline
//  duplicado en cada página):
//  - El toggle de la hamburguesa/menú móvil y el cálculo de "ítem
//    activo" — ver mount-nav.jsx para lo que queda del script inline
//    (solo la parte del bottom-nav, que no se ha migrado).
//  - La sombra de scroll (antes initNavScroll() en index.js, o su
//    equivalente inline en ciudades-todas.html): con el efecto aquí
//    dentro no hay carrera posible, solo se registra cuando el nodo ya
//    existe.
// ─────────────────────────────────────────────────────────────

import { useEffect, useState } from 'react';
import {
    currentPage,
    isPartiesExperience,
    NavLinks,
    LangSwitcherButton,
    AuthButton,
    HamburgerButton,
    MobileNavOverlay,
} from './navShared.jsx';

export default function Nav() {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [scrolled, setScrolled] = useState(false);
    const page = currentPage();

    useEffect(() => {
        function onScroll() {
            setScrolled(window.scrollY > 20);
        }
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, []);

    return (
        <>
            <nav
                className={`topnav${scrolled ? ' scrolled' : ''}`}
                id="topNav"
                data-react-nav="true"
            >
                <div className="topnav-inner">
                    <div className="topnav-left">
                        <a href="index.html" className="brand">
                            {isPartiesExperience() ? 'Erasmus Parties' : 'Erasmus Verified'}
                        </a>
                    </div>
                    <nav className="topbar-nav" id="mainNav">
                        <NavLinks page={page} />
                    </nav>
                    <div className="topnav-right">
                        <LangSwitcherButton />
                        <AuthButton />
                        <HamburgerButton
                            open={mobileOpen}
                            onClick={() => setMobileOpen((open) => !open)}
                        />
                    </div>
                </div>
            </nav>

            <MobileNavOverlay page={page} open={mobileOpen} onClose={() => setMobileOpen(false)} />
        </>
    );
}
