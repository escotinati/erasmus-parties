// ─────────────────────────────────────────────────────────────
//  ANIMATIONS.JS — Scroll reveal compartido (Verified / Parties)
//
//  Añade `is-visible` a cualquier elemento con clase `anim-fade-up`
//  o `anim-fade-in` cuando entra en el viewport, vía un único
//  Intersection Observer reutilizable. Cada elemento se revela una
//  sola vez (se deja de observar tras revelarse).
//
//  Sin ES Modules, como el resto del proyecto: se expone como
//  función global (window.initScrollReveal), no export/import.
//
//  Se puede (y se debe) volver a llamar tras cada re-render de una
//  lista dinámica (ej. bento grid, filtro de ciudades) para que los
//  elementos nuevos también se observen — si no, quedarían con
//  opacity:0 para siempre al no haber ya nadie observándolos.
// ─────────────────────────────────────────────────────────────

function initScrollReveal() {
    const targets = document.querySelectorAll(
        '.anim-fade-up:not(.is-visible), .anim-fade-in:not(.is-visible), .anim-slam:not(.is-visible)'
    );
    if (!targets.length) return;

    // Sin scroll-driven reveal bajo reduced-motion: todo el contenido debe
    // aparecer directamente, no quedarse en opacity:0 para siempre por
    // falta de IntersectionObserver.
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        targets.forEach((el) => el.classList.add('is-visible'));
        return;
    }

    const observer = new IntersectionObserver(
        (entries, obs) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add('is-visible');
                obs.unobserve(entry.target);
            });
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
    );

    targets.forEach((el) => observer.observe(el));
}

window.initScrollReveal = initScrollReveal;
