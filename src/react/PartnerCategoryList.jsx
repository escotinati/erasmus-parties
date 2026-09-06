// ─────────────────────────────────────────────────────────────
//  PartnerCategoryList.jsx — cabecera de categoría + lista de
//  partners de esa categoría, para el aside de ciudad.html/mapa.html.
//  Sustituye a buildGroupSection() (antes DOM imperativo en
//  mapPartners.js) — misma estructura, copiada campo a campo, sin
//  rediseño.
//
//  Presentacional puro (sin fetch ni estado propio, como SummaryCard):
//  cada grupo llega con `label`/`icon`/`color` YA resueltos —
//  mapPartners.js (script clásico) los calcula con CATEGORY_META
//  (map-helpers.js) y categoryLabel()/I18n antes de llamar a
//  `.render()`, porque CATEGORY_META es un `const` de script clásico
//  (no vive en `window`) y este componente, al ser un módulo ES, no
//  puede leerlo como identificador suelto — mismo límite por el que
//  sanitizeUrl/I18n solo cruzan esa frontera vía las propiedades que
//  sí se exponen explícitamente en window. Es la misma división de
//  trabajo que getPartnerCardProps()/getEventCardProps() ya hacen
//  para SummaryCard: la traducción de dominio vive en el script
//  clásico, el componente solo pinta.
//
//  Foto de partner (28px): sanea `image_url` con sanitizeUrl() (global,
//  ver src/js/utils/sanitize.js) antes de usarla como src, igual que
//  SummaryCard con imageUrl/ctaHref. Si no hay imagen válida, no se
//  renderiza la etiqueta <img> en absoluto — sin hueco ni icono de
//  imagen rota, solo el nombre.
// ─────────────────────────────────────────────────────────────

export default function PartnerCategoryList({
    groups,
    activeCategories,
    onToggleCategory,
    onSelectPartner,
}) {
    // Regla 4 (ver mapPartners.js): con una sola categoría en la
    // ciudad no hay nada que decida filtrarla — esa categoría se
    // muestra siempre, entera, con un heading simple sin control.
    const singleCategory = groups.length === 1;

    return (
        <>
            {groups.map(({ category, label, icon, color, partners }) => {
                const isActive = activeCategories.has(category);
                const collapsed = !singleCategory && !isActive;

                return (
                    <div
                        key={category}
                        className={'partner-group' + (collapsed ? ' partner-group--collapsed' : '')}
                    >
                        {singleCategory ? (
                            <h3 className="partner-group__title" style={{ '--pin-color': color }}>
                                <span
                                    className="material-symbols-outlined partner-group__icon"
                                    aria-hidden="true"
                                >
                                    {icon}
                                </span>
                                <span className="partner-group__label">{label}</span>
                            </h3>
                        ) : (
                            // <h3> envuelve al <button> en vez de sustituirlo:
                            // conserva la navegación por encabezados de un
                            // lector de pantalla, el elemento realmente
                            // interactivo (foco, Enter/Espacio, aria-pressed)
                            // es el <button> de dentro. Sin aria-label propio:
                            // el texto visible ya es un nombre accesible
                            // claro, aria-pressed comunica el estado — un
                            // "Mostrar/Ocultar X" aparte sería redundante.
                            <h3 className="partner-group__heading">
                                <button
                                    type="button"
                                    className="partner-group__toggle"
                                    style={{ '--pin-color': color }}
                                    aria-pressed={isActive}
                                    onClick={() => onToggleCategory(category)}
                                >
                                    <span
                                        className="material-symbols-outlined partner-group__icon"
                                        aria-hidden="true"
                                    >
                                        {icon}
                                    </span>
                                    <span className="partner-group__label">{label}</span>
                                </button>
                            </h3>
                        )}

                        <div className="partner-list">
                            {partners.map((partner) => {
                                const safeImageUrl = window.sanitizeUrl(partner.image_url);
                                return (
                                    <button
                                        key={partner.id}
                                        type="button"
                                        className="partner-toggle"
                                        onClick={(e) =>
                                            onSelectPartner(partner.id, e.currentTarget)
                                        }
                                    >
                                        {safeImageUrl ? (
                                            <img
                                                className="partner-toggle__thumb"
                                                src={safeImageUrl}
                                                width="28"
                                                height="28"
                                                alt=""
                                            />
                                        ) : null}
                                        {partner.name}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                );
            })}
        </>
    );
}
