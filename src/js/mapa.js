// ─────────────────────────────────────────────────────────────
//  MAPA.JS — Erasmus Parties
//  Orquestador de mapa.html (vista a pantalla completa).
//  Toda la lógica de mapa vive en cityMap.js, compartida con
//  el mapa embebido de ciudad.html.
// ─────────────────────────────────────────────────────────────
(async function () {
    const params = new URLSearchParams(window.location.search);
    const cityId = parseInt(params.get('city'), 10);

    function showMapError() {
        document.querySelector('.map-page-main').innerHTML = `
    <div style="text-align:center;padding:60px 20px;color:var(--on-surface-variant);">
      <span style="font-size:2.5rem;display:block;margin-bottom:16px;">😵</span>
      <h2 style="font-size:1.2rem;font-family:'Syne',sans-serif;color:var(--on-surface);margin-bottom:8px;">${I18n.t('errors.city_not_found_title')}</h2>
      <p>${I18n.t('errors.city_not_found_body')}</p>
      <a href="index.html" style="display:inline-block;margin-top:20px;color:var(--primary);">${I18n.t('nav.back_home_arrow')}</a>
    </div>`;
    }

    if (!cityId) {
        showMapError();
        return;
    }

    const { data: city, error } = await window.supabaseClient
        .from('cities')
        .select('*')
        .eq('id', cityId)
        .single();

    if (error || !city) {
        showMapError();
        return;
    }

    document.title = `Mapa de ${city.name}, ${city.country} — Erasmus Verified`;
    document.getElementById('backLink').href = `ciudad.html?ciudad=${city.id}`;
    document.getElementById('backLinkText').textContent = city.name;

    const mapEl = document.getElementById('map');
    const topbarHeight = document.querySelector('header.topbar').offsetHeight;
    const syncMapHeight = () => {
        mapEl.style.setProperty('height', window.innerHeight - topbarHeight + 'px', 'important');
    };
    syncMapHeight();
    window.addEventListener('resize', syncMapHeight);

    mountCityMap('map', {
        pais: city.country,
        ciudad: city.name,
        lat: city.lat,
        lng: city.lng,
        interactive: true,
    }).then((mapInstance) => {
        if (mapInstance) {
            syncMapHeight();
            mapInstance.invalidateSize();
            mountPartnersList('partners-list', mapInstance, city);
        }
    });
})();
