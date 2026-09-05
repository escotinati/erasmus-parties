// ─────────────────────────────────────────────────────────────
//  SummaryCard.jsx — tarjeta de resumen compartida por el grid de
//  partners y la sección de fiestas del home. Presentacional puro
//  (sin fetch ni estado propio): todo el texto ya viene traducido y
//  las URLs ya vienen tal cual de Supabase — el único trabajo propio
//  es sanear imageUrl/ctaHref con sanitizeUrl() (global, ver
//  src/js/utils/sanitize.js) antes de usarlas como src/href. React
//  escapa el texto automáticamente, pero no valida esquemas de URL.
//
//  Reutiliza tal cual las clases de styles.css que ya existían en
//  buildPartnerCard()/buildNightCard() (src/js/index.js /
//  nightsSection.js) — no se ha tocado styles.css para esta pieza.
// ─────────────────────────────────────────────────────────────

export default function SummaryCard({
    variant,
    imageUrl,
    badgeText,
    priceLabel,
    name,
    metaLine,
    dateLine,
    description,
    ctaLabel,
    ctaHref,
    ctaAlwaysVisible = variant === 'event',
    onCtaClick,
    animClassName,
}) {
    const safeImageUrl = window.sanitizeUrl(imageUrl);
    const safeCtaHref = window.sanitizeUrl(ctaHref);
    // El comportamiento "oculto hasta hover" vs "siempre visible" ya lo
    // resuelve styles.css por selector de clase (.partner-card-cta /
    // .event-cta-btn) — aquí solo se elige cuál de las dos aplicar.
    const ctaClassName = ctaAlwaysVisible ? 'event-cta-btn' : 'partner-card-cta';
    const wrapperClassName = `${animClassName || ''}`.trim();

    if (variant === 'event') {
        return (
            <div className={`event-card card-hoverable ${wrapperClassName}`.trim()}>
                <div className="event-img-wrap">
                    {safeImageUrl ? (
                        <img src={safeImageUrl} alt={name} loading="lazy" />
                    ) : (
                        <div className="card-img-placeholder"></div>
                    )}
                    {badgeText ? (
                        <span className="event-badge event-badge--primary">{badgeText}</span>
                    ) : null}
                </div>
                <div className="event-body">
                    <h4 className="event-name">{name}</h4>
                    <p className="event-venue">
                        <span className="material-symbols-outlined">location_on</span>
                        <span className="event-venue-text">{metaLine}</span>
                    </p>
                    <p className="event-date">{dateLine}</p>
                    {priceLabel ? <p className="event-price">{priceLabel}</p> : null}
                    <div className="event-footer">
                        {safeCtaHref ? (
                            <a
                                className={ctaClassName}
                                href={safeCtaHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={onCtaClick}
                            >
                                <span>{ctaLabel}</span>
                                <span className="material-symbols-outlined">arrow_forward</span>
                            </a>
                        ) : null}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`partner-card ${wrapperClassName}`.trim()}>
            <div className="partner-card-img-wrap">
                {safeImageUrl ? (
                    <img src={safeImageUrl} alt="" loading="lazy" />
                ) : (
                    <div className="card-img-placeholder"></div>
                )}
                {badgeText ? <span className="partner-card-category">{badgeText}</span> : null}
            </div>
            <div className="partner-card-body">
                <h3 className="partner-card-name">{name}</h3>
                <p className="partner-card-desc">{description || ''}</p>
                {safeCtaHref ? (
                    <a
                        className={ctaClassName}
                        href={safeCtaHref}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={onCtaClick}
                    >
                        {ctaLabel}
                    </a>
                ) : null}
            </div>
        </div>
    );
}
