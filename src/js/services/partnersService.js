// Convierte un rango relativo ('today' | 'week' | 'month') en límites
// ISO [desde, hasta) a partir de la medianoche local de hoy. No hay
// caso por defecto: dateRange nulo/desconocido no aplica límite, RLS
// ya garantiza que nunca llega nada vencido.
function dateRangeToISO(dateRange) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const daysByRange = { today: 1, week: 7, month: 30 };
    const days = daysByRange[dateRange];
    if (!days) return null;

    const until = new Date(startOfToday);
    until.setDate(until.getDate() + days);

    return { from: startOfToday.toISOString(), to: until.toISOString() };
}

// Próximos eventos reales (partner_events), con su partner y ciudad.
// RLS ya filtra en el servidor: solo activos y no vencidos (>1 día de
// margen) llegan aquí para usuarios anónimos — no hace falta filtrar
// otra vez en el cliente. Los filtros de este objeto son adicionales,
// encima de lo que RLS ya deja ver, y son todos opcionales/combinables.
//
// cityId filtra por partners.city_id. Con Supabase/PostgREST, filtrar
// por una columna de una tabla anidada exige el modificador !inner en
// el select() del recurso anidado — sin él, el .eq('partners.city_id', …)
// no descarta ninguna fila, solo condiciona qué contenido anidado se
// devuelve, y se cuelan eventos de otras ciudades.
//
// partnerId, en cambio, es una columna directa de partner_events (no
// anidada), así que un .eq('partner_id', partnerId) normal ya filtra
// correctamente sin necesitar !inner.
async function fetchUpcomingEvents({
    limit = 12,
    cityId = null,
    theme = null,
    dateRange = null,
    partnerId = null,
} = {}) {
    let query = window.supabaseClient
        .from('partner_events')
        .select('*, partners!inner(id, name, image_url, city_id, cities!inner(id, name, flag))')
        .order('starts_at', { ascending: true })
        .limit(limit);

    if (cityId) {
        query = query.eq('partners.city_id', cityId);
    }
    if (theme) {
        query = query.eq('theme', theme);
    }
    if (partnerId) {
        query = query.eq('partner_id', partnerId);
    }
    const range = dateRangeToISO(dateRange);
    if (range) {
        query = query.gte('starts_at', range.from).lt('starts_at', range.to);
    }

    const { data, error } = await query;

    if (error) {
        console.error('[partnersService] error cargando eventos:', error);
        return [];
    }

    return data.map((e) => ({
        id: e.id,
        title: I18n.tField(e.title),
        description: I18n.tField(e.description),
        theme: e.theme,
        image_url: e.image_url || e.partners?.image_url || '',
        starts_at: e.starts_at,
        price_label: I18n.tField(e.price_label),
        ticket_url: e.ticket_url,
        priority: e.priority,
        partner: e.partners ? { id: e.partners.id, name: e.partners.name } : null,
        city: e.partners?.cities
            ? { id: e.partners.cities.id, name: e.partners.cities.name, flag: e.partners.cities.flag }
            : null,
    }));
}

// Todos los partners activos con su ciudad, para el índice global del
// buscador de la home (src/js/index.js) — una fila de resultado no
// necesita el detalle de enlaces (partner_links), así que no se piden
// aquí, a diferencia de fetchPartnersByCity/fetchNightlifePartners.
// priority se incluye aunque no aparezca en la lista de columnas del
// encargo original: sin ella no hay campo para construir `weight` en
// el índice unificado (ciudades y eventos sí lo devuelven ya) — el
// ORDER BY de abajo no lo necesitaría (Postgres puede ordenar por una
// columna no seleccionada), pero el propio dato sí hace falta en el
// resultado.
async function fetchAllPartnersForSearch() {
    const { data, error } = await window.supabaseClient
        .from('partners')
        .select('id, name, category, city_id, priority, cities(id, name, flag)')
        .eq('active', true)
        .order('priority', { ascending: false });

    if (error) {
        console.error('[partnersService] error cargando partners para el buscador:', error);
        return [];
    }
    return data;
}

// Devuelve TODOS los partners activos de categoría 'nightlife', sin
// filtrar por ciudad — usado por el mapa y la ficha de ciudad, que
// muestran el LOCAL, no sus eventos.
async function fetchNightlifePartners(limit = 12) {
    const { data: partners, error: partnersError } = await window.supabaseClient
        .from('partners')
        .select('*, cities(id, name, flag)')
        .eq('category', 'nightlife')
        .eq('active', true)
        .order('priority', { ascending: false })
        .limit(limit);

    if (partnersError) {
        console.error('[partnersService] error cargando nightlife partners:', partnersError);
        return [];
    }

    const partnerIds = partners.map((p) => p.id);
    if (partnerIds.length === 0) return [];

    const { data: links, error: linksError } = await window.supabaseClient
        .from('partner_links')
        .select('*')
        .in('partner_id', partnerIds)
        .order('sort_order', { ascending: true });

    if (linksError) {
        console.error('[partnersService] error cargando links:', linksError);
    }

    const linksByPartnerId = {};
    for (const link of links || []) {
        if (!linksByPartnerId[link.partner_id]) linksByPartnerId[link.partner_id] = [];
        linksByPartnerId[link.partner_id].push({
            type: link.type,
            label: I18n.tField(link.label),
            url: link.url,
            sort_order: link.sort_order,
        });
    }

    return partners.map((p) => ({
        id: p.id,
        name: p.name,
        description: I18n.tField(p.description),
        image_url: p.image_url,
        priority: p.priority,
        city: p.cities ? { id: p.cities.id, name: p.cities.name, flag: p.cities.flag } : null,
        links: linksByPartnerId[p.id] || [],
    }));
}

async function fetchPartnersByCity(cityId) {
    const { data: partners, error: partnersError } = await window.supabaseClient
        .from('partners')
        .select('*')
        .eq('city_id', cityId)
        .eq('active', true)
        .order('priority', { ascending: false });

    if (partnersError) {
        console.error('[partnersService] error cargando partners:', partnersError);
        return [];
    }

    const partnerIds = partners.map((p) => p.id);

    if (partnerIds.length === 0) {
        return [];
    }

    const { data: links, error: linksError } = await window.supabaseClient
        .from('partner_links')
        .select('*')
        .in('partner_id', partnerIds)
        .order('sort_order', { ascending: true });

    if (linksError) {
        console.error('[partnersService] error cargando links:', linksError);
    }

    const linksByPartnerId = {};
    for (const link of links || []) {
        if (!linksByPartnerId[link.partner_id]) {
            linksByPartnerId[link.partner_id] = [];
        }
        linksByPartnerId[link.partner_id].push({
            type: link.type,
            label: I18n.tField(link.label),
            url: link.url,
            sort_order: link.sort_order,
        });
    }

    return partners.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        city_id: p.city_id,
        lat: p.lat,
        lng: p.lng,
        description: I18n.tField(p.description),
        image_url: p.image_url,
        priority: p.priority,
        active: p.active,
        links: linksByPartnerId[p.id] || [],
    }));
}

function groupPartnersByCategory(partners) {
    const byCategory = {};
    for (const partner of partners) {
        if (!byCategory[partner.category]) byCategory[partner.category] = [];
        byCategory[partner.category].push(partner);
    }

    return Object.keys(CATEGORY_META)
        .map((category) => ({ category, partners: byCategory[category] || [] }))
        .filter((group) => group.partners.length > 0);
}
