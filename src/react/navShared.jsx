// ─────────────────────────────────────────────────────────────
//  navShared.jsx — piezas comunes a los tres patrones de header
//  (rama react/menu): .topnav (Nav.jsx), header.topbar y
//  .hero-legacy .topbar (ambos en TopbarNav.jsx).
//
//  Mismas reglas que Nav.jsx (ver el comentario largo de ese archivo
//  para el porqué): nada de esto depende de scripts externos
//  enganchados a DOMContentLoaded para resolver texto/idioma/tema —
//  cada pieza lee window.I18n / window.ERASMUS_EXPERIENCE ella misma.
// ─────────────────────────────────────────────────────────────

export const NAV_LINKS = [
    { href: 'servicios.html', i18n: 'nav.services', label: 'Servicios', flag: 'showServices' },
    {
        href: 'alojamiento.html',
        i18n: 'nav.accommodation',
        label: 'Alojamiento',
        flag: 'showAlojamiento',
    },
    { href: 'viajes.html', i18n: 'nav.trips', label: 'Viajes', flag: 'showViajes' },
];

export const PARTIES_LINK = {
    href: 'https://erasmusparties.org',
    i18n: 'nav.parties',
    label: '🎉 Fiestas ↗',
};

export const VERIFIED_LINK = {
    href: 'https://erasmusverified.com',
    label: '🎓 Verified ↗',
};

export function currentPage() {
    const path = window.location.pathname.split('/').pop() || 'index.html';
    return path.split('?')[0] || 'index.html';
}

export function isPartiesExperience() {
    return window.ERASMUS_EXPERIENCE?.theme === 'theme-parties';
}

export function t(key, fallback) {
    return window.I18n?.t ? window.I18n.t(key) : fallback;
}

export function NavLinks({ page, onLinkClick }) {
    const parties = isPartiesExperience();
    const links = parties
        ? NAV_LINKS.filter((link) => window.ERASMUS_EXPERIENCE[link.flag])
        : NAV_LINKS;

    return (
        <>
            {links.map((link) => (
                <a
                    key={link.href}
                    href={link.href}
                    data-i18n={link.i18n}
                    className={link.href === page ? 'is-active' : undefined}
                    onClick={onLinkClick}
                >
                    {t(link.i18n, link.label)}
                </a>
            ))}
            {/* Sin onLinkClick a propósito, igual que la versión HTML original
                (nav.querySelectorAll('a:not(.nav-parties)')): abre en pestaña
                nueva, así que no tiene sentido cerrar el menú móvil al pulsarlo. */}
            {parties ? (
                <a
                    href={VERIFIED_LINK.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-verified"
                >
                    {VERIFIED_LINK.label}
                </a>
            ) : (
                <a
                    href={PARTIES_LINK.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="nav-parties"
                    data-i18n={PARTIES_LINK.i18n}
                >
                    {t(PARTIES_LINK.i18n, PARTIES_LINK.label)}
                </a>
            )}
        </>
    );
}

export function LangSwitcherButton() {
    return (
        <button
            id="lang-switcher"
            className="lang-switcher"
            aria-label="Cambiar idioma"
            onClick={() => {
                const next = window.I18n?.getLang() === 'es' ? 'en' : 'es';
                localStorage.setItem('lang', next);
                location.reload();
            }}
        >
            {window.I18n?.getLang() === 'es' ? 'EN' : 'ES'}
        </button>
    );
}

export function AuthButton() {
    return (
        // Placeholder: solo el icono por ahora, sin modal de login/registro
        // todavía (login real queda para una fase posterior).
        <button
            className="icon-btn"
            id="authBtn"
            aria-label="Iniciar sesión o registrarte"
            title="Iniciar sesión o registrarte"
        >
            <span className="material-symbols-outlined">person</span>
        </button>
    );
}

export function HamburgerButton({ open, onClick }) {
    return (
        <button
            className={`hamburger-btn${open ? ' is-open' : ''}`}
            id="hamburgerBtn"
            aria-label="Abrir menú"
            onClick={onClick}
        >
            <span></span>
            <span></span>
            <span></span>
        </button>
    );
}

export function MobileNavOverlay({ page, open, onClose }) {
    return (
        <div
            className={`mobile-nav${open ? ' is-open' : ''}`}
            id="mobileNav"
            aria-hidden={!open}
            data-react-nav="true"
        >
            <button
                className="mobile-nav-close"
                id="mobileNavClose"
                aria-label="Cerrar menú"
                onClick={onClose}
            >
                <span className="material-symbols-outlined">close</span>
            </button>
            <nav className="mobile-nav-links">
                <NavLinks page={page} onLinkClick={onClose} />
            </nav>
        </div>
    );
}
