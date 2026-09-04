// ─────────────────────────────────────────────────────────────
//  CIUDAD.JS — Erasmus Verified
// ─────────────────────────────────────────────────────────────

(async function () {
    const params = new URLSearchParams(window.location.search);
    const cityId = parseInt(params.get('ciudad'), 10);

    if (!cityId) {
        showCityError();
        return;
    }

    const { data: city, error } = await window.supabaseClient
        .from('cities')
        .select('*')
        .eq('id', cityId)
        .single();

    if (error || !city) {
        showCityError();
        return;
    }

    document.title = `${city.name}, ${city.country} — Erasmus Verified`;

    document.getElementById('backLink').href = 'index.html';
    document.getElementById('backLinkText').textContent = I18n.t('nav.home');

    document.getElementById('cityFlag').textContent = city.flag;
    document.getElementById('cityLocation').textContent = `${city.country} · Erasmus`;
    document.getElementById('cityName').textContent = city.name;

    let btns = buildMapBlock(city);
    btns += `<div class="section-divider"><span>${I18n.t('city.join_groups_divider')}</span></div>`;

    if (city.whatsapp_url) {
        btns += buildGroupBtn({
            platform: 'whatsapp',
            url: city.whatsapp_url,
            label: I18n.t('city.whatsapp_group_label'),
        });
    } else {
        btns += buildComingSoon(city.name);
    }

    document.getElementById('actionsWrap').innerHTML = btns;

    await buildContextualSections(city.id, city.name);

    const topbarEl = document.querySelector('header.topbar');
    if (topbarEl) {
        const setTopbarH = () => {
            document.documentElement.style.setProperty('--topbar-h', topbarEl.offsetHeight + 'px');
        };
        setTopbarH();
        window.addEventListener('resize', setTopbarH);
    }

    mountCityMap('city-map-embed', {
        pais: city.country,
        ciudad: city.name,
        lat: city.lat,
        lng: city.lng,
        interactive: true,
    }).then(async (mapInstance) => {
        if (mapInstance) {
            await mountPartnersList('city-partners-list', mapInstance, city);
            const mapEl = document.getElementById('city-map-embed');
            const asideEl = document.getElementById('city-partners-list');
            const syncHeight = () => {
                if (window.innerWidth >= 900) {
                    asideEl.style.height = mapEl.offsetHeight + 'px';
                } else {
                    asideEl.style.height = '';
                }
                mapInstance.invalidateSize();
            };
            syncHeight();
            new ResizeObserver(syncHeight).observe(mapEl);
        }
    });
})();

function showCityError() {
    document.getElementById('cityPage').innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:var(--on-surface-variant);">
      <span style="font-size:2.5rem;display:block;margin-bottom:16px;">😵</span>
      <h2 style="font-size:1.2rem;font-family:'Syne',sans-serif;color:var(--on-surface);margin-bottom:8px;">${I18n.t('errors.city_not_found_title')}</h2>
      <p>${I18n.t('errors.city_not_found_body')}</p>
      <a href="index.html" style="display:inline-block;margin-top:20px;color:var(--primary);">${I18n.t('nav.back_home_arrow')}</a>
    </div>`;
}

function buildGroupBtn(group) {
    const isWa = group.platform === 'whatsapp';
    const isTg = group.platform === 'telegram';
    const cls = isWa ? 'btn-wa' : isTg ? 'btn-tg' : 'btn-generic';
    const icon = isWa ? iconWa() : isTg ? iconTg() : iconGeneric();
    const label = isWa
        ? I18n.t('city.join_whatsapp_group')
        : isTg
          ? I18n.t('city.join_telegram_channel')
          : group.label;

    return `
    <a href="${sanitizeUrl(group.url, '#')}" target="_blank" rel="noopener noreferrer"
      class="action-btn ${cls}">
      ${icon}
      <div class="btn-label">
        <strong>${escapeHtml(label)}</strong>
        <span>${escapeHtml(group.label)}</span>
      </div>
      <svg class="btn-chevron" width="18" height="18" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2.5">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </a>`;
}

function buildComingSoon(cityName) {
    return `
    <div class="coming-soon">
      <span class="emoji">⏳</span>
      <h3>${I18n.t('city.groups_coming_soon_title')}</h3>
      <p>${I18n.t('city.groups_coming_soon_prefix')} ${escapeHtml(cityName)}. ${I18n.t('common.check_back_soon')}</p>
    </div>`;
}

async function buildContextualSections(cityId, ciudad) {
    const travelPartners = await fetchPartnersByCity(cityId).then((partners) =>
        partners.filter((p) => p.category === 'travel')
    );
    let html = '';

    html += `
    <div class="info-box anim-fade-up" style="margin-top:24px">
      <span class="info-icon material-symbols-outlined">apartment</span>
      <div>
        <p class="info-text" style="margin-bottom:12px">
          <strong>${I18n.t('city.find_housing_prefix')} ${escapeHtml(ciudad)}</strong><br>
          ${I18n.t('city.find_housing_body')}
        </p>
        <a href="alojamiento.html" class="btn-primary-pill" style="display:inline-flex">${I18n.t('city.view_collaborators_cta')}</a>
      </div>
    </div>`;

    if (travelPartners.length > 0) {
        const cards = travelPartners
            .map(
                (p, i) => `
        <div class="service-card anim-fade-up anim-delay-${(i % 8) + 1}">
          <div class="service-icon"><span class="material-symbols-outlined">flight</span></div>
          <h3 class="service-name">${escapeHtml(p.name)}</h3>
          <p class="service-desc">${escapeHtml(I18n.tField(p.description))}</p>
          ${
              p.links.length > 0
                  ? `<a href="${sanitizeUrl(p.links[0].url, '#')}" target="_blank" rel="noopener noreferrer" class="btn-primary-pill">${I18n.t('city.view_trip_cta')}</a>`
                  : ''
          }
        </div>`
            )
            .join('');

        html += `
    <div style="margin-top:32px">
      <span class="eyebrow eyebrow--primary">${I18n.t('nav.trips')}</span>
      <h2 class="section-title" style="font-size:1.1rem;margin-bottom:8px">${I18n.t('city.escapadas_prefix')} ${escapeHtml(ciudad)}</h2>
      <div class="services-grid" style="margin-top:16px">${cards}</div>
    </div>`;
    }

    const extra = document.getElementById('city-extra');
    if (extra) extra.innerHTML = html;

    if (window.initScrollReveal) window.initScrollReveal();
}

function buildMapBlock(city) {
    const fullscreenUrl = `mapa.html?city=${city.id}`;
    return `
    <div class="city-map-block">
      <div class="city-map-columns">
        <div id="city-map-embed" class="city-map-embed" aria-label="Mapa de ${escapeHtml(city.name)}"></div>
        <aside id="city-partners-list" class="partners-list"></aside>
      </div>
      <a href="${fullscreenUrl}" class="city-map-fullscreen-link">
        ${I18n.t('city.map_fullscreen_link')}
      </a>
    </div>`;
}

function iconWa() {
    return `<svg class="btn-icon" viewBox="0 0 24 24">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>`;
}

function iconTg() {
    return `<svg class="btn-icon" viewBox="0 0 24 24">
    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
  </svg>`;
}

function iconGeneric() {
    return `<svg class="btn-icon" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>`;
}

function iconMap() {
    return `<svg class="btn-icon" viewBox="0 0 24 24" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 1118 0z"/>
    <circle cx="12" cy="10" r="3"/>
  </svg>`;
}
