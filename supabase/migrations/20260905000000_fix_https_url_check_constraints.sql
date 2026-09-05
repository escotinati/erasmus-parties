-- Corrige el bug dejado explícito (y sin corregir) en el comentario de
-- 20260904000000_add_https_url_check_constraints.sql: cities.image_url y
-- partner_events.ticket_url son NOT NULL con default '' — el código de
-- toda la app (admin.js, index.js, nightsSection.js, partnersService.js)
-- ya trata '' como "sin valor" (sanitizeUrl(), fallbacks `|| ''`, campos
-- opcionales sin validación de "obligatorio" en el panel de admin) — pero
-- el CHECK anterior exigía 'https://%' sin excepción, así que guardar
-- cualquiera de los dos campos vacío rompía el INSERT/UPDATE con un error
-- de constraint en vez de aceptar la cadena vacía como venía haciendo
-- desde su creación.
--
-- Se opta por relajar el CHECK (permitir también '') en vez de hacer las
-- columnas NULLABLE: cambiar NOT NULL habría exigido tocar además todo el
-- código que ya asume string no-null en estas columnas, para un problema
-- que el propio guardarraíl de formato no necesita resolver.
--
-- De paso, cierra la aplicación incompleta del mismo guardarraíl: mismo
-- tipo de columna (imagen mostrada en <img src>), incluida en cities pero
-- olvidada en partners.image_url y partner_events.image_url.
--
-- Verificado ANTES de aplicar (execute_sql, no esta migración): 0 filas
-- incumplen 'image_url = '''' or image_url like ''https://%''' en
-- partners ni en partner_events a día de hoy.

alter table public.cities
    drop constraint cities_image_url_https_ck;

alter table public.cities
    add constraint cities_image_url_https_ck
    check (image_url = '' or image_url like 'https://%');

comment on constraint cities_image_url_https_ck on public.cities is
    'image_url es NOT NULL (default ''''): '''' significa "sin imagen todavía", cualquier otro valor debe empezar por https:// — bloquea esquemas ejecutables en el src de la imagen de ciudad.';

alter table public.partner_events
    drop constraint partner_events_ticket_url_https_ck;

alter table public.partner_events
    add constraint partner_events_ticket_url_https_ck
    check (ticket_url = '' or ticket_url like 'https://%');

comment on constraint partner_events_ticket_url_https_ck on public.partner_events is
    'ticket_url es NOT NULL (default ''''): '''' significa "sin entradas todavía" (ver sanitizeUrl() en index.js), cualquier otro valor debe empezar por https:// — bloquea esquemas ejecutables en el href del enlace de entradas.';

alter table public.partners
    add constraint partners_image_url_https_ck
    check (image_url = '' or image_url like 'https://%');

comment on constraint partners_image_url_https_ck on public.partners is
    'image_url es NOT NULL (default ''''): '''' significa "sin imagen todavía", cualquier otro valor debe empezar por https:// — misma razón que cities_image_url_https_ck.';

alter table public.partner_events
    add constraint partner_events_image_url_https_ck
    check (image_url = '' or image_url like 'https://%');

comment on constraint partner_events_image_url_https_ck on public.partner_events is
    'image_url es NOT NULL (default ''''): '''' significa "sin imagen propia, usar la del partner" (ver partnersService.js), cualquier otro valor debe empezar por https:// — misma razón que cities_image_url_https_ck.';
