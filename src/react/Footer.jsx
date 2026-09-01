// ─────────────────────────────────────────────────────────────
//  Footer.jsx — footer compartido (rama react/menu)
//
//  Antes era HTML duplicado byte a byte en las 7 páginas públicas que
//  lo llevan (todas salvo mapa.html, que es pantalla completa de mapa
//  y no tiene footer) — ahora vive aquí una sola vez. Copia fiel del
//  markup/clases/data-i18n que ya existían; no es un rediseño, eso
//  queda para un paso posterior.
//
//  Mismas reglas que Nav.jsx/TopbarNav.jsx (ver el comentario largo de
//  Nav.jsx para el porqué): el componente resuelve tema Parties, i18n
//  y el año del copyright él mismo al renderizar, en vez de depender
//  de experience.js/applyTranslations()/un <script> con
//  DOMContentLoaded que lo mute después — cualquiera de esos puede
//  disparar antes de que React haya montado. Las mutaciones que
//  siguen en experience.js (footer-logo, ocultar Alojamiento/Viajes)
//  llevan un guard `closest('[data-react-footer]')` para no tocar dos
//  veces lo que este componente ya resuelve.
// ─────────────────────────────────────────────────────────────

import { isPartiesExperience, t } from './navShared.jsx';

const PLATFORM_LINKS = [
    { href: 'ciudades-todas.html', i18n: 'footer.destinations', label: 'Destinos' },
    {
        href: 'alojamiento.html',
        i18n: 'nav.accommodation',
        label: 'Alojamiento',
        flag: 'showAlojamiento',
    },
    {
        href: 'https://erasmusparties.org',
        i18n: 'nav.parties_bottom',
        label: 'Fiestas',
        external: true,
    },
    { href: 'viajes.html', i18n: 'nav.trips', label: 'Viajes', flag: 'showViajes' },
];

const LEGAL_LINKS = [
    { i18n: 'footer.about', label: 'Sobre nosotros' },
    { i18n: 'footer.local_partners', label: 'Socios locales' },
    { i18n: 'footer.insurance_policy', label: 'Política de seguros' },
    { i18n: 'footer.privacy', label: 'Privacidad' },
    { i18n: 'footer.terms', label: 'Términos' },
];

export default function Footer() {
    const parties = isPartiesExperience();
    const platformLinks = parties
        ? PLATFORM_LINKS.filter((link) => !link.flag || window.ERASMUS_EXPERIENCE[link.flag])
        : PLATFORM_LINKS;

    return (
        <footer className="site-footer" data-react-footer="true">
            <div className="footer-inner">
                <div className="footer-brand">
                    <span className="footer-logo">
                        {parties ? 'Erasmus Parties' : 'Erasmus Verified'}
                    </span>
                    <p className="footer-tagline" data-i18n="footer.tagline_long">
                        {t(
                            'footer.tagline_long',
                            'Experiencias premium para estudiantes de intercambio en más de 50 ciudades europeas.'
                        )}
                    </p>
                </div>

                <div className="footer-col">
                    <p className="footer-col-title" data-i18n="footer.platform_title">
                        {t('footer.platform_title', 'Plataforma')}
                    </p>
                    <ul>
                        {platformLinks.map((link) => (
                            <li key={link.href}>
                                <a
                                    href={link.href}
                                    data-i18n={link.i18n}
                                    {...(link.external
                                        ? { target: '_blank', rel: 'noopener noreferrer' }
                                        : {})}
                                >
                                    {t(link.i18n, link.label)}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>

                <div className="footer-col">
                    <p className="footer-col-title" data-i18n="footer.legal_title">
                        {t('footer.legal_title', 'Legal')}
                    </p>
                    <ul>
                        {LEGAL_LINKS.map((link) => (
                            <li key={link.i18n}>
                                <a href="#" data-i18n={link.i18n}>
                                    {t(link.i18n, link.label)}
                                </a>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>

            <div className="footer-bottom">
                <p>
                    © <span id="copyright-year">{new Date().getFullYear()}</span> Erasmus Verified.{' '}
                    <span data-i18n="footer.rights">
                        {t('footer.rights', 'Todos los derechos reservados.')}
                    </span>
                </p>
            </div>
        </footer>
    );
}
