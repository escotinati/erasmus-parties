let editingPartnerId = null;

// Copia en memoria del último array cargado por cada loadX() — sirve
// de base para el buscador (filtrado en cliente, sin query nueva) y
// para los contadores del dashboard. No sustituye a loadX(): se rellena
// justo después de la consulta que loadX() ya hacía.
let allPartners = [];
let allEvents = [];
let allCities = [];

// Pestaña activa de la sección partners ('active' | 'inactive') y
// último array pasado a renderPartnersTable (ya filtrado por el
// buscador) — se reutiliza al cambiar de pestaña o tras un toggle
// optimista, para no tener que volver a filtrar desde allPartners.
let partnersTab = 'active';
let currentPartnersList = [];

// Vistas: 'dashboard' (las 3 cards) o el nombre de una sección
// (partners/events/cities). Oculta todo lo demás usando [hidden], el
// mismo patrón que ya usan login-view/panel-view.
function showView(name) {
    document.getElementById('dashboard-view').hidden = name !== 'dashboard';
    document.querySelectorAll('.admin-section[data-section]').forEach((section) => {
        section.hidden = section.dataset.section !== name;
    });
    if (name === 'dashboard') renderDashboardCounts();
}

function renderDashboardCounts() {
    const setCount = (id, list, singular, plural) => {
        const el = document.getElementById(id);
        if (!el) return;
        const activeCount = list.filter((x) => x.active).length;
        const inactiveCount = list.length - activeCount;
        const noun = list.length === 1 ? singular : plural;
        const activeLabel = activeCount === 1 ? 'activo' : 'activos';
        const inactiveLabel = inactiveCount === 1 ? 'inactivo' : 'inactivos';
        el.textContent = `${list.length} ${noun} · ${activeCount} ${activeLabel}, ${inactiveCount} ${inactiveLabel}`;
    };
    setCount('dashboard-partners-count', allPartners, 'partner', 'partners');
    setCount('dashboard-events-count', allEvents, 'evento', 'eventos');
    setCount('dashboard-cities-count', allCities, 'ciudad', 'ciudades');
}

// ── TOASTS ────────────────────────────────────────────────────
// Sustituye a los alert() de antes: no bloquea la interacción con el
// resto del panel y desaparece sola a los pocos segundos.
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `admin-toast admin-toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    // rAF para que el navegador pinte el estado inicial (opacity:0)
    // antes de añadir la clase que anima la entrada.
    requestAnimationFrame(() => toast.classList.add('is-visible'));

    setTimeout(() => {
        toast.classList.remove('is-visible');
        toast.addEventListener('transitionend', () => toast.remove(), { once: true });
        // por si prefers-reduced-motion desactiva la transición y
        // transitionend no llega a disparar nunca
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// ── MODAL DE CONFIRMACIÓN GENÉRICA ───────────────────────────
// Reutilizable para cualquier "¿seguro?" que no sea un alert() ni el
// modal de eliminar evento (que ya tiene su propio flujo). Se resuelve
// con true/false según el botón que pulse el usuario.
let confirmModalResolve = null;

function openConfirmModal({ title, message, confirmLabel = 'Confirmar', danger = false }) {
    document.getElementById('confirm-modal-title').textContent = title;
    document.getElementById('confirm-modal-subtitle').textContent = message;

    const confirmBtn = document.getElementById('confirm-modal-confirm');
    confirmBtn.textContent = confirmLabel;
    confirmBtn.className = `admin-btn ${danger ? 'admin-btn--danger' : 'admin-btn--primary'}`;

    document.getElementById('confirm-modal').hidden = false;

    return new Promise((resolve) => {
        confirmModalResolve = resolve;
    });
}

function closeConfirmModal(result) {
    document.getElementById('confirm-modal').hidden = true;
    if (confirmModalResolve) {
        confirmModalResolve(result);
        confirmModalResolve = null;
    }
}

// ── TRADUCCIÓN (DeepL vía Edge Function) ─────────────────────
// Un único listener delegado en vez de uno por botón: los botones de
// las filas de link (partner_links) se crean/destruyen dinámicamente
// en addLinkRow(), así que no hay un momento fijo en el que "engancharlos"
// todos de una vez.
document.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-translate');
    if (btn) handleTranslateClick(btn);
});

async function handleTranslateClick(btn) {
    const sourceEl = document.getElementById(btn.dataset.source);
    const targetEl = document.getElementById(btn.dataset.target);
    if (!sourceEl || !targetEl) return;

    const text = sourceEl.value.trim();
    if (!text) {
        showToast('No hay texto en español para traducir.', 'error');
        return;
    }

    const originalLabel = btn.textContent;
    btn.disabled = true;
    btn.textContent = '...';

    try {
        const { data, error } = await window.supabaseClient.functions.invoke('translate', {
            body: { text, target_lang: 'en' },
        });

        if (error || !data?.translation) {
            showToast(
                'Error al traducir: ' + (data?.error || error?.message || 'respuesta inválida'),
                'error'
            );
            return;
        }

        targetEl.value = data.translation;
    } catch (err) {
        showToast('Error al traducir: ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = originalLabel;
    }
}

// escapeHtml() vive ahora en src/js/utils/sanitize.js (window.escapeHtml),
// cargado antes que este script en admin/index.html — no se duplica aquí.

function extractCoordsFromGoogleMapsUrl(url) {
    let match = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    match = url.match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (match) return { lat: parseFloat(match[1]), lng: parseFloat(match[2]) };
    return null;
}

document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('login-btn').addEventListener('click', login);
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('toggle-password').addEventListener('click', () => {
        const input = document.getElementById('login-password');
        const isPassword = input.type === 'password';
        input.type = isPassword ? 'text' : 'password';
        document.getElementById('icon-eye').style.display = isPassword ? 'block' : 'none';
        document.getElementById('icon-eye-off').style.display = isPassword ? 'none' : 'block';
        document
            .getElementById('toggle-password')
            .setAttribute('aria-label', isPassword ? 'Ocultar contraseña' : 'Mostrar contraseña');
    });
    ['login-email', 'login-password'].forEach((id) => {
        document.getElementById(id).addEventListener('keydown', (e) => {
            if (e.key === 'Enter') login();
        });
    });
    document
        .getElementById('confirm-modal-close')
        .addEventListener('click', () => closeConfirmModal(false));
    document
        .getElementById('confirm-modal-cancel')
        .addEventListener('click', () => closeConfirmModal(false));
    document
        .getElementById('confirm-modal-confirm')
        .addEventListener('click', () => closeConfirmModal(true));
    document
        .querySelector('#confirm-modal .admin-modal__backdrop')
        .addEventListener('click', () => closeConfirmModal(false));

    // Pestañas Activos/Inactivos: filtran en cliente sobre el mismo
    // array que ya tiene renderPartnersTable, sin volver a consultar
    // Supabase.
    document.querySelectorAll('.admin-tabs[data-tabs="partners"] .admin-tab').forEach((tab) => {
        tab.addEventListener('click', () => {
            partnersTab = tab.dataset.tab;
            document
                .querySelectorAll('.admin-tabs[data-tabs="partners"] .admin-tab')
                .forEach((t) => t.classList.toggle('is-active', t === tab));
            renderPartnersTable(currentPartnersList);
        });
    });

    document.getElementById('new-partner-btn').addEventListener('click', () => openModal(null));
    document.getElementById('modal-close').addEventListener('click', closeModal);
    document.getElementById('modal-cancel').addEventListener('click', closeModal);
    document.getElementById('modal-save').addEventListener('click', savePartner);
    document.getElementById('add-link-btn').addEventListener('click', () => addLinkRow());
    document
        .querySelector('#partner-modal .admin-modal__backdrop')
        .addEventListener('click', closeModal);

    document.getElementById('f-maps-extract').addEventListener('click', () => {
        const url = document.getElementById('f-maps-url').value.trim();
        const fb = document.getElementById('f-maps-feedback');
        const coords = extractCoordsFromGoogleMapsUrl(url);
        if (coords) {
            document.getElementById('f-lat').value = coords.lat;
            document.getElementById('f-lng').value = coords.lng;
            fb.textContent = `✓ Coordenadas extraídas: ${coords.lat}, ${coords.lng}`;
            fb.style.color = '#16a34a';
        } else {
            fb.textContent =
                'No se pudieron extraer las coordenadas. ' +
                'Usa la URL completa de la barra del navegador (no enlaces acortados goo.gl).';
            fb.style.color = '#dc2626';
        }
    });

    document.getElementById('cf-maps-extract').addEventListener('click', () => {
        const url = document.getElementById('cf-maps-url').value.trim();
        const fb = document.getElementById('cf-maps-feedback');
        const coords = extractCoordsFromGoogleMapsUrl(url);
        if (coords) {
            document.getElementById('cf-lat').value = coords.lat;
            document.getElementById('cf-lng').value = coords.lng;
            fb.textContent = `✓ Coordenadas extraídas: ${coords.lat}, ${coords.lng}`;
            fb.style.color = '#16a34a';
        } else {
            fb.textContent =
                'No se pudieron extraer las coordenadas. ' +
                'Usa la URL completa de la barra del navegador (no enlaces acortados goo.gl).';
            fb.style.color = '#dc2626';
        }
    });

    document.getElementById('new-city-btn')?.addEventListener('click', () => openCityModal(null));
    document.getElementById('city-modal-close')?.addEventListener('click', closeCityModal);
    document.getElementById('city-modal-cancel')?.addEventListener('click', closeCityModal);
    document.getElementById('city-modal-save')?.addEventListener('click', saveCity);
    document
        .querySelector('#city-modal .admin-modal__backdrop')
        ?.addEventListener('click', closeCityModal);

    document.getElementById('new-event-btn')?.addEventListener('click', () => openEventModal(null));
    document.getElementById('event-modal-close')?.addEventListener('click', closeEventModal);
    document.getElementById('event-modal-cancel')?.addEventListener('click', closeEventModal);
    document.getElementById('event-modal-save')?.addEventListener('click', saveEvent);
    document
        .querySelector('#event-modal .admin-modal__backdrop')
        ?.addEventListener('click', closeEventModal);

    document
        .getElementById('delete-event-modal-close')
        ?.addEventListener('click', closeDeleteEventModal);
    document
        .getElementById('delete-event-modal-cancel')
        ?.addEventListener('click', closeDeleteEventModal);
    document
        .getElementById('delete-event-modal-confirm')
        ?.addEventListener('click', () => deleteEvent(deletingEventId));
    document
        .querySelector('#delete-event-modal .admin-modal__backdrop')
        ?.addEventListener('click', closeDeleteEventModal);

    // Dashboard: cards → sección; botón "Volver" → dashboard de nuevo.
    document.querySelectorAll('.admin-dashboard-card').forEach((card) => {
        card.addEventListener('click', () => showView(card.dataset.goto));
    });
    document.querySelectorAll('[data-back]').forEach((btn) => {
        btn.addEventListener('click', () => showView('dashboard'));
    });

    // Buscadores por sección: filtran en cliente sobre los arrays ya
    // cargados (allPartners/allEvents/allCities), sin query nueva a
    // Supabase, y reutilizan las funciones de pintado ya existentes.
    document.getElementById('partners-search')?.addEventListener('input', (e) => {
        const term = e.target.value.trim().toLowerCase();
        const filtered = !term
            ? allPartners
            : allPartners.filter((p) =>
                  [p.name, p.category, p.cities?.name].some((field) =>
                      (field || '').toLowerCase().includes(term)
                  )
              );
        renderPartnersTable(filtered);
    });

    document.getElementById('events-search')?.addEventListener('input', (e) => {
        const term = e.target.value.trim().toLowerCase();
        const filtered = !term
            ? allEvents
            : allEvents.filter((ev) =>
                  [ev.title?.es, ev.title?.en, ev.theme, ev.partners?.cities?.name].some((field) =>
                      (field || '').toLowerCase().includes(term)
                  )
              );
        renderEventsTable(filtered);
    });

    document.getElementById('cities-search')?.addEventListener('input', (e) => {
        const term = e.target.value.trim().toLowerCase();
        const filtered = !term
            ? allCities
            : allCities.filter((c) =>
                  [c.name, c.country].some((field) => (field || '').toLowerCase().includes(term))
              );
        renderCitiesTable(filtered);
    });

    window.supabaseClient.auth
        .getSession()
        .then(({ data: { session } }) => {
            session ? showPanel() : showLogin();
        })
        .catch((err) => {
            console.error('[admin] error comprobando sesión:', err);
            showLogin();
        });
});

async function login() {
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const errorEl = document.getElementById('login-error');
    errorEl.textContent = '';

    const { data, error } = await window.supabaseClient.auth.signInWithPassword({
        email,
        password,
    });

    if (error) {
        errorEl.textContent = error.message || 'Credenciales incorrectas.';
        return;
    }
    showPanel();
}

async function logout() {
    await window.supabaseClient.auth.signOut();
    document.getElementById('login-email').value = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-error').textContent = '';
    showLogin();
}

function showLogin() {
    document.getElementById('login-view').hidden = false;
    document.getElementById('panel-view').hidden = true;
}

async function showPanel() {
    document.getElementById('login-view').hidden = true;
    document.getElementById('panel-view').hidden = false;
    await Promise.all([loadPartners(), loadEvents(), loadCities(), loadClicksReport()]);
    showView('dashboard');
}

// ── PARTNERS ──────────────────────────────────────────────────

async function loadPartners() {
    const { data, error } = await window.supabaseClient
        .from('partners')
        .select('*, cities(name)')
        .order('priority', { ascending: false });

    if (error) {
        showToast('Error cargando partners: ' + error.message, 'error');
        return;
    }
    allPartners = data;
    renderPartnersTable(data);
}

function renderPartnersTable(partners) {
    // Se guarda tal cual llega (ya filtrado por el buscador, si hay
    // término) para poder volver a pintar sin refiltrar al cambiar de
    // pestaña o tras un toggle optimista.
    currentPartnersList = partners;

    const activePartners = partners.filter((p) => p.active);
    // Los desactivados más recientemente, primero — para no perderlos
    // de vista entre el volumen de partners/ciudades. El trigger
    // touch_updated_at() de Postgres actualiza updated_at en cada
    // UPDATE, así que esto también ordena por "última edición" en
    // general, no solo por desactivación, pero es lo más cercano a
    // "recién desactivado" que hay sin una columna dedicada.
    const inactivePartners = partners
        .filter((p) => !p.active)
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    const activeCountEl = document.getElementById('partners-tab-active-count');
    const inactiveCountEl = document.getElementById('partners-tab-inactive-count');
    if (activeCountEl) activeCountEl.textContent = activePartners.length;
    if (inactiveCountEl) inactiveCountEl.textContent = inactivePartners.length;

    const list = partnersTab === 'inactive' ? inactivePartners : activePartners;

    const wrap = document.getElementById('partners-table');
    const countEl = document.getElementById('partner-count');
    if (countEl) countEl.textContent = list.length + (list.length === 1 ? ' partner' : ' partners');

    if (list.length === 0) {
        wrap.innerHTML = `<p class="admin-empty">${
            partnersTab === 'inactive'
                ? 'No hay partners inactivos.'
                : 'No hay partners activos todavía.'
        }</p>`;
        return;
    }

    const rows = list
        .map(
            (p) => `
    <tr>
      <td data-label="Nombre">${escapeHtml(p.name)}</td>
      <td data-label="Categoría"><span class="admin-badge admin-badge--${escapeHtml(p.category)}">${escapeHtml(p.category)}</span></td>
      <td data-label="Ciudad">${escapeHtml(p.cities?.name || '—')}</td>
      <td data-label="Prioridad" class="col-center"><span class="admin-priority-badge">${p.priority}</span></td>
      <td data-label="Activo" class="col-center">
        <label class="admin-switch" title="${p.active ? 'Desactivar' : 'Activar'} ${escapeHtml(p.name)}">
          <input type="checkbox" ${p.active ? 'checked' : ''}
            onchange="onTogglePartnerActive(${p.id}, ${p.active}, this)" />
          <span class="admin-switch__slider"></span>
        </label>
      </td>
      <td class="col-actions">
        <div class="row-actions">
          <button type="button" class="admin-btn admin-btn--sm admin-btn--ghost"
            onclick="openModal(${p.id})">Editar</button>
        </div>
      </td>
    </tr>`
        )
        .join('');

    wrap.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Nombre</th><th>Categoría</th><th>Ciudad</th>
          <th class="col-center">Prioridad</th><th class="col-center">Activo</th><th class="col-actions">Acciones</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

// Comprueba si un partner tiene algún evento futuro (starts_at >= hoy)
// todavía activo — se usa para pedir confirmación extra antes de
// desactivarlo. Fallo de red al comprobar: no bloquea la desactivación
// (se trata como "no tiene eventos futuros"), ya que es una fricción
// de UX adicional, no una barrera de seguridad.
async function partnerHasFutureActiveEvent(partnerId) {
    const { data, error } = await window.supabaseClient
        .from('partner_events')
        .select('id')
        .eq('partner_id', partnerId)
        .eq('active', true)
        .gte('starts_at', new Date().toISOString())
        .limit(1);

    if (error) {
        console.error('[admin] error comprobando eventos futuros del partner:', error);
        return false;
    }
    return (data || []).length > 0;
}

// Punto de entrada del switch de la fila: decide si hace falta
// confirmación (evento futuro activo) antes de llamar a
// togglePartnerActive. checkboxEl solo se usa para revertir el
// checkbox al cancelar, sin re-pintar toda la tabla.
async function onTogglePartnerActive(id, currentActive, checkboxEl) {
    if (currentActive) {
        const hasFutureEvent = await partnerHasFutureActiveEvent(id);
        if (hasFutureEvent) {
            const confirmed = await openConfirmModal({
                title: 'Desactivar partner',
                message: 'Este partner tiene un evento próximo activo. ¿Desactivar igualmente?',
                confirmLabel: 'Desactivar igualmente',
                danger: true,
            });
            if (!confirmed) {
                if (checkboxEl) checkboxEl.checked = currentActive;
                return;
            }
        }
    }
    await togglePartnerActive(id, currentActive);
}

async function togglePartnerActive(id, currentActive) {
    const partner = allPartners.find((p) => p.id === id);
    if (!partner) return;

    const newActive = !currentActive;
    const previousActive = partner.active;
    const previousUpdatedAt = partner.updated_at;

    // Optimista: la fila cambia de pestaña antes de esperar respuesta
    // del servidor. Se revierte más abajo si Supabase devuelve error o
    // no llega a tocar ninguna fila (bloqueo silencioso de RLS: el
    // update no da error, solo no afecta filas).
    partner.active = newActive;
    partner.updated_at = new Date().toISOString();
    renderPartnersTable(currentPartnersList);

    const { data, error } = await window.supabaseClient
        .from('partners')
        .update({ active: newActive })
        .eq('id', id)
        .select('updated_at')
        .single();

    if (error || !data) {
        partner.active = previousActive;
        partner.updated_at = previousUpdatedAt;
        renderPartnersTable(currentPartnersList);
        showToast(
            `No se pudo ${newActive ? 'activar' : 'desactivar'} "${partner.name}": ${
                error?.message || 'sin permisos o partner no encontrado'
            }`,
            'error'
        );
        return;
    }

    partner.updated_at = data.updated_at;
    showToast(
        `"${partner.name}" ${newActive ? 'activado' : 'desactivado'} correctamente.`,
        'success'
    );
}

async function populateCitySelect(selectId, selectedCityId = null) {
    const select = document.getElementById(selectId);
    if (!select) return;

    const cities = await fetchAllCities();
    select.innerHTML = '<option value="">— Selecciona ciudad —</option>';
    for (const city of cities) {
        const opt = document.createElement('option');
        opt.value = city.id;
        opt.textContent = `${city.flag} ${city.name} (${city.country})`;
        if (selectedCityId !== null && city.id === selectedCityId) opt.selected = true;
        select.appendChild(opt);
    }
}

async function openModal(partnerId) {
    editingPartnerId = partnerId || null;
    document.getElementById('modal-title').textContent = partnerId
        ? 'Editar partner'
        : 'Nuevo partner';
    document.getElementById('modal-subtitle').textContent = partnerId
        ? 'Editando los datos del partner'
        : 'Rellena los campos para crear un nuevo partner';

    clearForm();
    await populateCitySelect('f-city-id');

    if (partnerId) {
        const { data: partner } = await window.supabaseClient
            .from('partners')
            .select('*')
            .eq('id', partnerId)
            .single();

        const { data: links } = await window.supabaseClient
            .from('partner_links')
            .select('*')
            .eq('partner_id', partnerId)
            .order('sort_order');

        document.getElementById('f-name').value = partner.name;
        document.getElementById('f-category').value = partner.category;
        document.getElementById('f-description-es').value = partner.description?.es ?? '';
        document.getElementById('f-description-en').value = partner.description?.en ?? '';
        document.getElementById('f-image').value = partner.image_url || '';
        document.getElementById('f-lat').value = partner.lat || '';
        document.getElementById('f-lng').value = partner.lng || '';
        document.getElementById('f-priority').value = partner.priority;
        document.getElementById('f-active').checked = partner.active;

        const citySelect = document.getElementById('f-city-id');
        if (partner.city_id) citySelect.value = partner.city_id;

        for (const link of links || []) {
            addLinkRow(link);
        }
    }

    document.getElementById('partner-modal').hidden = false;
}

function closeModal() {
    document.getElementById('partner-modal').hidden = true;
    clearForm();
}

function clearForm() {
    [
        'f-name',
        'f-description-es',
        'f-description-en',
        'f-image',
        'f-lat',
        'f-lng',
        'f-maps-url',
    ].forEach((id) => {
        document.getElementById(id).value = '';
    });
    document.getElementById('f-maps-feedback').textContent = '';
    document.getElementById('f-category').value = 'nightlife';
    document.getElementById('f-city-id').value = '';
    document.getElementById('f-priority').value = '0';
    document.getElementById('f-active').checked = true;
    document.getElementById('links-container').innerHTML = '';
}

// Contador para generar ids únicos por fila (label-es/label-en) — varias
// filas de link pueden coexistir en el mismo modal, así que no pueden
// compartir id como el resto de campos del formulario.
let linkRowCounter = 0;

function addLinkRow(link = {}) {
    const container = document.getElementById('links-container');
    const row = document.createElement('div');
    row.className = 'admin-link-row';

    const uid = `link-row-${linkRowCounter++}`;
    const esId = `${uid}-label-es`;
    const enId = `${uid}-label-en`;

    row.innerHTML = `
    <div class="admin-link-row__main">
      <select class="link-type">
        <option value="WEBSITE"       ${link.type === 'WEBSITE' ? 'selected' : ''}>WEBSITE</option>
        <option value="TICKETS"       ${link.type === 'TICKETS' ? 'selected' : ''}>TICKETS</option>
        <option value="OWN_EVENT"     ${link.type === 'OWN_EVENT' ? 'selected' : ''}>OWN_EVENT</option>
        <option value="WHATSAPP_CHAT" ${link.type === 'WHATSAPP_CHAT' ? 'selected' : ''}>WHATSAPP_CHAT</option>
      </select>
      <input class="link-url" type="text" placeholder="URL" value="${escapeHtml(link.url || '')}" />
      <button type="button" class="admin-btn admin-btn--sm admin-btn--danger"
        onclick="this.closest('.admin-link-row').remove()">×</button>
    </div>
    <div class="i18n-field i18n-field--compact">
      <div class="i18n-field__lang">
        <label>Etiqueta (ES)</label>
        <input id="${esId}" class="i18n-input link-label-es" type="text" placeholder="Etiqueta"
          value="${escapeHtml(link.label?.es || '')}" />
      </div>
      <div class="i18n-field__actions">
        <button type="button" class="btn-translate" data-source="${esId}" data-target="${enId}"
          title="Traducir al inglés">EN →</button>
      </div>
      <div class="i18n-field__lang">
        <label>Etiqueta (EN)</label>
        <input id="${enId}" class="i18n-input link-label-en" type="text" placeholder="Label"
          value="${escapeHtml(link.label?.en || '')}" />
      </div>
    </div>
  `;
    container.appendChild(row);
}

async function savePartner() {
    const name = document.getElementById('f-name').value.trim();
    const cityId = parseInt(document.getElementById('f-city-id').value, 10);
    const imageUrl = document.getElementById('f-image').value.trim();

    if (!name || !cityId) {
        showToast('Nombre y ciudad son obligatorios.', 'error');
        return;
    }
    if (!isValidOptionalHttpsUrl(imageUrl)) {
        showToast('La URL de la imagen debe empezar por https://', 'error');
        return;
    }

    const links = Array.from(document.querySelectorAll('.admin-link-row'))
        .map((row, i) => ({
            type: row.querySelector('.link-type').value,
            label: {
                es: row.querySelector('.link-label-es').value.trim(),
                en: row.querySelector('.link-label-en').value.trim(),
            },
            url: row.querySelector('.link-url').value.trim(),
            sort_order: i,
        }))
        .filter((l) => l.label.es && l.url);

    if (links.some((l) => !isValidOptionalHttpsUrl(l.url))) {
        showToast('Todos los enlaces del partner deben empezar por https://', 'error');
        return;
    }

    const partnerData = {
        name,
        category: document.getElementById('f-category').value,
        city_id: cityId,
        description: {
            es: document.getElementById('f-description-es').value.trim(),
            en: document.getElementById('f-description-en').value.trim(),
        },
        image_url: imageUrl,
        lat: parseFloat(document.getElementById('f-lat').value) || null,
        lng: parseFloat(document.getElementById('f-lng').value) || null,
        priority: parseInt(document.getElementById('f-priority').value) || 0,
        active: document.getElementById('f-active').checked,
    };

    let savedId = editingPartnerId;
    if (editingPartnerId) {
        const { error } = await window.supabaseClient
            .from('partners')
            .update(partnerData)
            .eq('id', editingPartnerId);
        if (error) {
            showToast('Error guardando partner: ' + error.message, 'error');
            return;
        }
    } else {
        const { data, error } = await window.supabaseClient
            .from('partners')
            .insert(partnerData)
            .select('id')
            .single();
        if (error) {
            showToast('Error guardando partner: ' + error.message, 'error');
            return;
        }
        savedId = data.id;
    }

    await window.supabaseClient.from('partner_links').delete().eq('partner_id', savedId);

    if (links.length > 0) {
        const { error: linksError } = await window.supabaseClient
            .from('partner_links')
            .insert(links.map((l) => ({ ...l, partner_id: savedId })));
        if (linksError) {
            showToast('Error guardando links: ' + linksError.message, 'error');
            return;
        }
    }

    closeModal();
    await loadPartners();
    showToast(`Partner "${name}" guardado correctamente.`, 'success');
}

// ── EVENTOS ───────────────────────────────────────────────────

let editingEventId = null;

// El admin ve TODOS los eventos (activos e inactivos, pasados y
// futuros) — a diferencia de la vista pública, que RLS limita a
// activos y no vencidos.
async function loadEvents() {
    // partners(name, cities(name)): se añadió cities(name) al join que
    // ya existía — antes solo traía el nombre del partner, y el
    // buscador por ciudad (más abajo) necesita la ciudad del partner
    // asociado, que no llegaba con el select original.
    const { data, error } = await window.supabaseClient
        .from('partner_events')
        .select('*, partners(name, cities(name))')
        .order('starts_at', { ascending: false });

    if (error) {
        showToast('Error cargando eventos: ' + error.message, 'error');
        return;
    }
    allEvents = data;
    renderEventsTable(data);
}

function formatAdminDateTime(isoString) {
    if (!isoString) return '—';
    return new Intl.DateTimeFormat('es-ES', { dateStyle: 'short', timeStyle: 'short' }).format(
        new Date(isoString)
    );
}

function renderEventsTable(events) {
    const wrap = document.getElementById('events-table');
    if (!wrap) return;

    const countEl = document.getElementById('events-count');
    if (countEl) countEl.textContent = `(${events.length})`;

    if (events.length === 0) {
        wrap.innerHTML = '<p class="admin-empty">No hay eventos todavía.</p>';
        return;
    }

    const rows = events
        .map(
            (e) => `
    <tr>
      <td data-label="Título">
        <div class="partner-name">${escapeHtml(e.title?.es || '')}</div>
        <div class="partner-desc">${escapeHtml(e.theme || '—')}</div>
      </td>
      <td data-label="Partner">${escapeHtml(e.partners?.name || '—')}</td>
      <td data-label="Fecha" class="col-num">${formatAdminDateTime(e.starts_at)}</td>
      <td data-label="Precio">${escapeHtml(e.price_label?.es || '—')}</td>
      <td data-label="Prioridad" class="col-num">${e.priority}</td>
      <td data-label="Estado" class="col-center">
        <span class="admin-badge ${e.active ? 'admin-badge--active' : 'admin-badge--inactive'}">
          ${e.active ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td class="col-actions" data-label="Acciones">
        <div class="row-actions">
          <button type="button"
            class="admin-btn admin-btn--ghost admin-btn--sm"
            onclick="openEventModal(${e.id})">Editar</button>
          <button type="button"
            class="admin-btn admin-btn--sm ${e.active ? 'admin-btn--danger' : 'admin-btn--success'}"
            onclick="toggleEventActive(${e.id}, ${e.active})">
            ${e.active ? 'Desactivar' : 'Activar'}
          </button>
          <button type="button"
            class="admin-btn admin-btn--sm admin-btn--danger admin-btn--delete"
            onclick="openDeleteEventModal(${e.id})">
            <span class="material-symbols-outlined">delete</span>
            Eliminar
          </button>
        </div>
      </td>
    </tr>`
        )
        .join('');

    wrap.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Título</th><th>Partner</th><th class="col-num">Fecha</th><th>Precio</th>
          <th class="col-num">Prioridad</th><th class="col-center">Estado</th><th class="col-actions"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function toggleEventActive(id, current) {
    const { error } = await window.supabaseClient
        .from('partner_events')
        .update({ active: !current })
        .eq('id', id);
    if (error) {
        showToast('Error: ' + error.message, 'error');
        return;
    }
    await loadEvents();
    showToast(`Evento ${!current ? 'activado' : 'desactivado'} correctamente.`, 'success');
}

// ── ELIMINAR EVENTO (borrado físico) ─────────────────────────
// Alcance deliberadamente limitado a eventos: borrar un partner
// implicaría cascada sobre partner_events, cta_clicks y partner_links,
// y esa acción no está expuesta en el admin por ahora.

let deletingEventId = null;

function openDeleteEventModal(eventId) {
    deletingEventId = eventId;
    const event = allEvents.find((ev) => ev.id === eventId);
    document.getElementById('delete-event-modal-subtitle').innerHTML = event
        ? `¿Seguro que quieres eliminar <strong>"${escapeHtml(event.title?.es || '')}"</strong>? Esta acción no se puede deshacer.`
        : 'Esta acción no se puede deshacer.';
    document.getElementById('delete-event-modal').hidden = false;
}

function closeDeleteEventModal() {
    document.getElementById('delete-event-modal').hidden = true;
    deletingEventId = null;
}

async function deleteEvent(id) {
    const { error } = await window.supabaseClient.from('partner_events').delete().eq('id', id);
    if (error) {
        showToast('Error eliminando evento: ' + error.message, 'error');
        return;
    }
    closeDeleteEventModal();
    await loadEvents();
    showToast('Evento eliminado correctamente.', 'success');
}

// Solo partners de category='nightlife' — un evento sin un local de
// fiesta detrás no tiene sentido en este modelo de datos.
async function populateEventPartnerSelect(selectedPartnerId = null) {
    const select = document.getElementById('ef-partner-id');
    if (!select) return;

    const { data: partners, error } = await window.supabaseClient
        .from('partners')
        .select('id, name, cities(name)')
        .eq('category', 'nightlife')
        .order('name', { ascending: true });

    if (error) {
        console.error('[admin] error cargando partners nightlife:', error);
        return;
    }

    select.innerHTML = '<option value="">— Selecciona partner —</option>';
    for (const partner of partners || []) {
        const opt = document.createElement('option');
        opt.value = partner.id;
        opt.textContent = partner.cities?.name
            ? `${partner.name} — ${partner.cities.name}`
            : partner.name;
        if (selectedPartnerId !== null && partner.id === selectedPartnerId) opt.selected = true;
        select.appendChild(opt);
    }
}

// <input type="datetime-local"> trabaja en hora LOCAL del navegador,
// sin zona horaria — Supabase guarda starts_at como timestamptz (UTC).
// new Date(value) interpreta el string "YYYY-MM-DDTHH:mm" como hora
// local, así que toISOString() ya hace la conversión a UTC correcta.
function localDateTimeToISO(value) {
    if (!value) return null;
    return new Date(value).toISOString();
}

// Camino inverso: de un timestamptz UTC al formato que espera el
// input, ya en hora local (por eso se usa getHours/getMonth, no los
// UTC*, que devolverían la hora tal cual está guardada en UTC).
function isoToLocalDateTimeInput(isoString) {
    if (!isoString) return '';
    const date = new Date(isoString);
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function openEventModal(eventId) {
    editingEventId = eventId || null;
    document.getElementById('event-modal-title').textContent = eventId
        ? 'Editar evento'
        : 'Nuevo evento';
    document.getElementById('event-modal-subtitle').textContent = eventId
        ? 'Editando el evento #' + eventId
        : 'Rellena los datos del nuevo evento';

    clearEventForm();

    if (eventId) {
        const { data: event } = await window.supabaseClient
            .from('partner_events')
            .select('*')
            .eq('id', eventId)
            .single();

        await populateEventPartnerSelect(event.partner_id);

        document.getElementById('ef-title-es').value = event.title?.es ?? '';
        document.getElementById('ef-title-en').value = event.title?.en ?? '';
        document.getElementById('ef-theme').value = event.theme || '';
        document.getElementById('ef-description-es').value = event.description?.es ?? '';
        document.getElementById('ef-description-en').value = event.description?.en ?? '';
        document.getElementById('ef-image').value = event.image_url || '';
        document.getElementById('ef-starts-at').value = isoToLocalDateTimeInput(event.starts_at);
        document.getElementById('ef-price-label-es').value = event.price_label?.es ?? '';
        document.getElementById('ef-price-label-en').value = event.price_label?.en ?? '';
        document.getElementById('ef-ticket-url').value = event.ticket_url || '';
        document.getElementById('ef-priority').value = event.priority;
        document.getElementById('ef-active').checked = event.active;
    } else {
        await populateEventPartnerSelect();
    }

    document.getElementById('event-modal').hidden = false;
}

function closeEventModal() {
    document.getElementById('event-modal').hidden = true;
    clearEventForm();
}

function clearEventForm() {
    [
        'ef-title-es',
        'ef-title-en',
        'ef-theme',
        'ef-description-es',
        'ef-description-en',
        'ef-image',
        'ef-starts-at',
        'ef-price-label-es',
        'ef-price-label-en',
        'ef-ticket-url',
    ].forEach((id) => {
        document.getElementById(id).value = '';
    });
    document.getElementById('ef-partner-id').value = '';
    document.getElementById('ef-priority').value = '0';
    document.getElementById('ef-active').checked = true;
    ['ef-title-es', 'ef-partner-id', 'ef-starts-at', 'ef-image', 'ef-ticket-url'].forEach((id) =>
        setFieldError(id, '')
    );
}

// Replica en el cliente el guardarraíl de formato de las CHECK
// constraints https:// de la base de datos (ver migraciones
// 20260904000000/20260905000000): '' es válido (campo opcional sin
// rellenar todavía), cualquier otro valor debe empezar por https://.
// Sin esto, un admin que teclee http:// o una URL sin esquema solo se
// entera de que algo fue mal al recibir el mensaje crudo de Postgres
// tras el INSERT/UPDATE.
function isValidOptionalHttpsUrl(value) {
    return value === '' || value.startsWith('https://');
}

// Muestra (o limpia, si message es '') un error específico bajo el
// campo indicado — en vez del alert() genérico que había antes.
// El input ya lleva aria-describedby="${fieldId}-error" fijo en el HTML
// (apunta a un <p> vacío cuando no hay error, lo que los lectores de
// pantalla no anuncian); aquí solo se actualiza lo que sí cambia en
// cada intento: aria-invalid y el propio texto, que el role="alert" del
// <p> (en el HTML) anuncia aunque el usuario no haya vuelto a entrar en
// el campo.
function setFieldError(fieldId, message) {
    const errorEl = document.getElementById(`${fieldId}-error`);
    const inputEl = document.getElementById(fieldId);
    if (errorEl) errorEl.textContent = message || '';
    if (inputEl) {
        inputEl.classList.toggle('admin-input--invalid', Boolean(message));
        inputEl.setAttribute('aria-invalid', String(Boolean(message)));
    }
}

async function saveEvent() {
    // El español es el idioma obligatorio (fuente para traducir); el
    // inglés es opcional — si se deja vacío, tField() en el sitio
    // público ya cae de vuelta a 'es'.
    const titleEs = document.getElementById('ef-title-es').value.trim();
    const titleEn = document.getElementById('ef-title-en').value.trim();
    const partnerId = parseInt(document.getElementById('ef-partner-id').value, 10);
    const startsAtLocal = document.getElementById('ef-starts-at').value;
    const imageUrl = document.getElementById('ef-image').value.trim();
    const ticketUrl = document.getElementById('ef-ticket-url').value.trim();

    // Única fuente de verdad para qué campo falla y por qué — evita
    // mantener la misma condición duplicada en dos sitios que podrían
    // desincronizarse con un cambio futuro. El ORDEN de este array
    // DEBE coincidir con el orden real de los campos en el DOM (ver
    // admin/index.html): `firstInvalid` de abajo asume que recorrerlo
    // de arriba a abajo equivale a recorrer el formulario de arriba a
    // abajo, para llevar el foco al primer error visible, no a uno
    // cualquiera. Si se añade o reordena un campo aquí, hazlo también
    // en el HTML.
    const fieldChecks = [
        { id: 'ef-partner-id', valid: Boolean(partnerId), message: 'Selecciona un partner.' },
        {
            id: 'ef-title-es',
            valid: Boolean(titleEs),
            message: 'El título (español) es obligatorio.',
        },
        {
            id: 'ef-starts-at',
            valid: Boolean(startsAtLocal),
            message: 'La fecha y hora son obligatorias.',
        },
        {
            id: 'ef-image',
            valid: isValidOptionalHttpsUrl(imageUrl),
            message: 'Debe empezar por https://',
        },
        {
            id: 'ef-ticket-url',
            valid: isValidOptionalHttpsUrl(ticketUrl),
            message: 'Debe empezar por https://',
        },
    ];

    // Se recalcula en cada intento: si el usuario corrige un campo y
    // vuelve a guardar, el mensaje de ESE campo desaparece aunque los
    // otros sigan sin rellenar.
    fieldChecks.forEach(({ id, valid, message }) => setFieldError(id, valid ? '' : message));

    const firstInvalid = fieldChecks.find((f) => !f.valid);
    if (firstInvalid) {
        document.getElementById(firstInvalid.id)?.focus();
        return;
    }

    const eventData = {
        partner_id: partnerId,
        title: { es: titleEs, en: titleEn },
        description: {
            es: document.getElementById('ef-description-es').value.trim(),
            en: document.getElementById('ef-description-en').value.trim(),
        },
        theme: document.getElementById('ef-theme').value.trim(),
        image_url: imageUrl,
        starts_at: localDateTimeToISO(startsAtLocal),
        price_label: {
            es: document.getElementById('ef-price-label-es').value.trim(),
            en: document.getElementById('ef-price-label-en').value.trim(),
        },
        ticket_url: ticketUrl,
        priority: parseInt(document.getElementById('ef-priority').value) || 0,
        active: document.getElementById('ef-active').checked,
    };

    if (editingEventId) {
        const { error } = await window.supabaseClient
            .from('partner_events')
            .update(eventData)
            .eq('id', editingEventId);
        if (error) {
            showToast('Error guardando evento: ' + error.message, 'error');
            return;
        }
    } else {
        const { error } = await window.supabaseClient.from('partner_events').insert(eventData);
        if (error) {
            showToast('Error guardando evento: ' + error.message, 'error');
            return;
        }
    }

    closeEventModal();
    await loadEvents();
    showToast(`Evento "${titleEs}" guardado correctamente.`, 'success');
}

// ── CIUDADES ──────────────────────────────────────────────────

let editingCityId = null;

async function loadCities() {
    const { data, error } = await window.supabaseClient
        .from('cities')
        .select('*')
        .order('priority', { ascending: false });

    if (error) {
        showToast('Error cargando ciudades: ' + error.message, 'error');
        return;
    }
    allCities = data;
    renderCitiesTable(data);
}

function renderCitiesTable(cities) {
    const wrap = document.getElementById('cities-table');
    if (!wrap) return;

    const countEl = document.getElementById('cities-count');
    if (countEl) countEl.textContent = `(${cities.length})`;

    if (cities.length === 0) {
        wrap.innerHTML = '<p class="admin-empty">No hay ciudades todavía.</p>';
        return;
    }

    const rows = cities
        .map(
            (c) => `
    <tr>
      <td data-label="Ciudad">
        <div class="partner-name">${escapeHtml(c.flag)} ${escapeHtml(c.name)}</div>
        <div class="partner-desc">${escapeHtml(c.country)}</div>
      </td>
      <td data-label="WhatsApp" class="col-center">
        ${c.whatsapp_url ? '<span class="admin-badge admin-badge--active">✓ Configurado</span>' : '<span class="admin-badge admin-badge--inactive">Sin URL</span>'}
      </td>
      <td data-label="Prioridad" class="col-num">${c.priority}</td>
      <td data-label="Estado" class="col-center">
        <span class="admin-badge ${c.active ? 'admin-badge--active' : 'admin-badge--inactive'}">
          ${c.active ? 'Activa' : 'Inactiva'}
        </span>
      </td>
      <td class="col-actions" data-label="Acciones">
        <div class="row-actions">
          <button type="button"
            class="admin-btn admin-btn--ghost admin-btn--sm"
            onclick="openCityModal(${c.id})">Editar</button>
          <button type="button"
            class="admin-btn admin-btn--sm ${c.active ? 'admin-btn--danger' : 'admin-btn--success'}"
            onclick="toggleCityActive(${c.id}, ${c.active})">
            ${c.active ? 'Desactivar' : 'Activar'}
          </button>
        </div>
      </td>
    </tr>`
        )
        .join('');

    wrap.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Ciudad</th>
          <th class="col-center">WhatsApp</th>
          <th class="col-num">Prioridad</th>
          <th class="col-center">Estado</th>
          <th class="col-actions"></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`;
}

async function toggleCityActive(id, current) {
    const { error } = await window.supabaseClient
        .from('cities')
        .update({ active: !current })
        .eq('id', id);
    if (error) {
        showToast('Error: ' + error.message, 'error');
        return;
    }
    await loadCities();
    showToast(`Ciudad ${!current ? 'activada' : 'desactivada'} correctamente.`, 'success');
}

async function openCityModal(cityId) {
    editingCityId = cityId || null;
    document.getElementById('city-modal-title').textContent = cityId
        ? 'Editar ciudad'
        : 'Nueva ciudad';
    document.getElementById('city-modal-subtitle').textContent = cityId
        ? 'Editando ciudad #' + cityId
        : 'Rellena los datos de la nueva ciudad';

    clearCityForm();

    if (cityId) {
        const { data: city } = await window.supabaseClient
            .from('cities')
            .select('*')
            .eq('id', cityId)
            .single();

        document.getElementById('cf-name').value = city.name;
        document.getElementById('cf-country').value = city.country;
        document.getElementById('cf-flag').value = city.flag;
        document.getElementById('cf-description-es').value = city.description?.es ?? '';
        document.getElementById('cf-description-en').value = city.description?.en ?? '';
        document.getElementById('cf-image').value = city.image_url || '';
        document.getElementById('cf-lat').value = city.lat || '';
        document.getElementById('cf-lng').value = city.lng || '';
        document.getElementById('cf-whatsapp-url').value = city.whatsapp_url || '';
        document.getElementById('cf-priority').value = city.priority;
        document.getElementById('cf-active').checked = city.active;
    }

    document.getElementById('city-modal').hidden = false;
}

function closeCityModal() {
    document.getElementById('city-modal').hidden = true;
    clearCityForm();
}

function clearCityForm() {
    [
        'cf-name',
        'cf-country',
        'cf-flag',
        'cf-description-es',
        'cf-description-en',
        'cf-image',
        'cf-lat',
        'cf-lng',
        'cf-whatsapp-url',
        'cf-maps-url',
    ].forEach((id) => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    document.getElementById('cf-maps-feedback').textContent = '';
    document.getElementById('cf-priority').value = '0';
    document.getElementById('cf-active').checked = false;
}

async function saveCity() {
    const name = document.getElementById('cf-name').value.trim();
    const country = document.getElementById('cf-country').value.trim();
    const whatsappUrl = document.getElementById('cf-whatsapp-url').value.trim();
    const imageUrl = document.getElementById('cf-image').value.trim();

    if (!name || !country) {
        showToast('Nombre y país son obligatorios.', 'error');
        return;
    }
    if (!whatsappUrl) {
        showToast('El grupo de WhatsApp es obligatorio.', 'error');
        return;
    }
    if (!isValidOptionalHttpsUrl(whatsappUrl)) {
        showToast('El enlace del grupo de WhatsApp debe empezar por https://', 'error');
        return;
    }
    if (!isValidOptionalHttpsUrl(imageUrl)) {
        showToast('La URL de la imagen debe empezar por https://', 'error');
        return;
    }

    const slug = name
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');

    const cityData = {
        name,
        country,
        slug,
        flag: document.getElementById('cf-flag').value.trim(),
        description: {
            es: document.getElementById('cf-description-es').value.trim(),
            en: document.getElementById('cf-description-en').value.trim(),
        },
        image_url: imageUrl,
        lat: parseFloat(document.getElementById('cf-lat').value) || null,
        lng: parseFloat(document.getElementById('cf-lng').value) || null,
        whatsapp_url: whatsappUrl,
        priority: parseInt(document.getElementById('cf-priority').value) || 0,
        active: document.getElementById('cf-active').checked,
    };

    if (editingCityId) {
        const { error } = await window.supabaseClient
            .from('cities')
            .update(cityData)
            .eq('id', editingCityId);
        if (error) {
            showToast('Error guardando ciudad: ' + error.message, 'error');
            return;
        }
    } else {
        const { error } = await window.supabaseClient.from('cities').insert(cityData);
        if (error) {
            showToast('Error guardando ciudad: ' + error.message, 'error');
            return;
        }
    }

    closeCityModal();
    await loadCities();
    showToast(`Ciudad "${name}" guardada correctamente.`, 'success');
}

// ── CLICKS REPORT ─────────────────────────────────────────────

async function loadClicksReport() {
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data, error } = await window.supabaseClient
        .from('cta_clicks')
        .select('partner_id, partners(name)')
        .gte('created_at', since);

    if (error) {
        document.getElementById('clicks-report').innerHTML =
            '<p class="admin-empty">Error cargando métricas.</p>';
        return;
    }

    if (!data || data.length === 0) {
        document.getElementById('clicks-report').innerHTML =
            '<p class="admin-empty">Sin clics registrados todavía.</p>';
        return;
    }

    const counts = {};
    for (const row of data) {
        const name = row.partners?.name || String(row.partner_id);
        counts[name] = (counts[name] || 0) + 1;
    }

    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const rows = sorted
        .map(
            ([name, count]) => `
    <div class="admin-metric-card">
      <div class="admin-metric-card__count">${count}</div>
      <div class="admin-metric-card__name">${escapeHtml(name)}</div>
      <div class="admin-metric-card__label">clics</div>
    </div>`
        )
        .join('');

    document.getElementById('clicks-report').innerHTML = rows;
}
