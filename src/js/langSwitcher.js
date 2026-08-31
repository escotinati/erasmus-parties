// ─────────────────────────────────────────────────────────────
//  LANGSWITCHER.JS — Erasmus Verified / Erasmus Parties
//
//  Cambio de idioma con recarga completa (opción elegida, no SPA):
//  guarda el idioma en localStorage y recarga la página para que
//  applyTranslations() y tField() se resuelvan de cero en el nuevo
//  idioma, sin tener que reescribir el DOM en caliente.
//
//  En index.html/ciudades-todas.html el switcher vive dentro de
//  Nav.jsx (rama react/menu), que ya resuelve su propio texto inicial
//  y su propio click — evitamos engancharnos dos veces ahí (y de paso
//  la carrera de encontrar el botón antes de que React haya montado).
// ─────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function () {
    const btn = document.getElementById('lang-switcher');
    if (!btn || btn.closest('[data-react-nav]')) return;
    btn.textContent = window.I18n.getLang() === 'es' ? 'EN' : 'ES';
    btn.addEventListener('click', function () {
        const next = window.I18n.getLang() === 'es' ? 'en' : 'es';
        localStorage.setItem('lang', next);
        location.reload();
    });
});
