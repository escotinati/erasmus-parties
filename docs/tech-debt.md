# Deuda técnica

## Categorías de partner: dos listas separadas que deben coincidir a mano

`admin/index.html` (el `<select id="f-category">`, líneas ~288-294) y `CATEGORY_META` (`src/js/map-helpers.js`) son dos listas independientes que representan lo mismo — las categorías válidas de un partner — y nada obliga a que coincidan. Hoy sí coinciden (las 5 opciones del desplegable de admin están todas en `CATEGORY_META`), pero nada impide que alguien añada una categoría nueva en un sitio y se olvide del otro.

**Por qué importa:** `src/js/mapPartners.js` usa `CATEGORY_META[partner.category]` con un fallback a `{ label: category, ... }` cuando la categoría no está en el objeto — es decir, si las dos listas divergen (o si `partners.category` se edita directamente en Supabase sin pasar por el `<select>`), el string crudo de `category` se convierte en la etiqueta mostrada. Se escapa con `escapeHtml` antes de insertarse en `innerHTML` (fix en `fix/sanitize-partner-link-url`), así que ya no es una vía de inyección, pero sigue siendo una categoría sin traducir ni estilo — un fallo visual/de UX silencioso, no de seguridad.

**Arreglo pendiente (fuera de esta rama):** una única fuente de verdad para las categorías — por ejemplo, generar las `<option>` del admin a partir de `CATEGORY_META` en vez de mantenerlas por separado, o mover ambas a una tabla/constante compartida que ambos archivos importen.
