-- Guardarraíl de formato (no de legitimidad) sobre las columnas que
-- terminan en atributos del DOM (.href/.src) sin pasar por ninguna API
-- intermedia: exige que empiecen por 'https://', bloqueando esquemas
-- ejecutables como javascript: o data: si algún día un dato sin
-- sanear llega hasta aquí.
--
-- Verificado ANTES de aplicar (execute_sql, no esta migración): 0 filas
-- incumplen la regla en las 4 columnas a día de hoy.
--
-- LÍMITE explícito, no lo trates como más de lo que es:
--   - Bloquea esquemas ejecutables, NO destinos maliciosos.
--     'https://sitio-falso.com' pasa esta validación sin problema.
--   - No sustituye al escapado de src/js/ciudades.js (y del resto de
--     páginas): una URL con comillas dentro sigue pudiendo romper un
--     atributo HTML o un bloque de CSS aunque empiece por https://.
--
-- Permite NULL solo donde la columna ya lo admitía antes de esta
-- migración (partner_links.url, cities.whatsapp_url) — la restricción
-- es sobre el FORMATO del valor cuando existe, no sobre si es
-- obligatorio. cities.image_url y partner_events.ticket_url son
-- NOT NULL con default '' desde su creación: como NULL nunca ha sido
-- un valor posible ahí, no llevan el escape "IS NULL OR", y una
-- inserción que deje el campo vacío (dependiendo del default '')
-- pasará a fallar por esta constraint en vez de guardar una cadena
-- vacía silenciosamente — comportamiento nuevo a vigilar en el panel
-- de admin, no corregido en esta rama.

alter table public.partner_links
    add constraint partner_links_url_https_ck
    check (url is null or url like 'https://%');

comment on constraint partner_links_url_https_ck on public.partner_links is
    'Si url existe, debe empezar por https:// — bloquea esquemas ejecutables (javascript:, data:) que puedan llegar a un atributo href sin sanear. No valida que el destino sea legítimo ni sustituye al escapado de HTML/CSS en el frontend.';

alter table public.cities
    add constraint cities_whatsapp_url_https_ck
    check (whatsapp_url is null or whatsapp_url like 'https://%');

comment on constraint cities_whatsapp_url_https_ck on public.cities is
    'Si whatsapp_url existe, debe empezar por https:// — misma razón que partner_links_url_https_ck.';

alter table public.cities
    add constraint cities_image_url_https_ck
    check (image_url like 'https://%');

comment on constraint cities_image_url_https_ck on public.cities is
    'image_url es NOT NULL (default ''''), no admite el escape "is null": todo valor debe empezar por https://. Bloquea esquemas ejecutables en el src de la imagen de ciudad.';

alter table public.partner_events
    add constraint partner_events_ticket_url_https_ck
    check (ticket_url like 'https://%');

comment on constraint partner_events_ticket_url_https_ck on public.partner_events is
    'ticket_url es NOT NULL (default ''''), no admite el escape "is null": todo valor debe empezar por https://. Bloquea esquemas ejecutables en el href del enlace de entradas.';
