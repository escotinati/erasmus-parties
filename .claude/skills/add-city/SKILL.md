---
name: add-city
description: Guía para añadir una nueva ciudad a Erasmus Verified a través del panel de administración (/admin), que escribe en Supabase. Usar cuando el usuario quiera ampliar la cobertura geográfica de la app.
disable-model-invocation: true
---

Las ciudades ya no se añaden editando código — viven en la tabla `cities` de Supabase y se gestionan desde el panel de administración en `/admin` (ver CLAUDE.md, sección "Panel de administración"). Este skill reúne los datos y le dice al usuario exactamente qué rellenar en ese formulario; no edita ningún archivo del repo.

## 1. Recopilar información

Pide en un solo mensaje los campos del formulario de ciudad (`/admin` → Ciudades → Nueva ciudad):

- **Nombre** de la ciudad (ej. "Bilbao")
- **País** (ej. "España")
- **Bandera** emoji del país (ej. "🇪🇸")
- **Descripción breve** en español e inglés (2-3 líneas cada una)
- **URL de imagen** (Unsplash recomendado)
- **Coordenadas**: o bien una URL de Google Maps de la ciudad (el panel las extrae solas con el botón "Extraer de Google Maps"), o lat/lng directamente si ya las tiene
- **Enlace de WhatsApp** del grupo (campo obligatorio en el formulario — si todavía no existe, avisa al usuario de que tendrá que crear el grupo antes o dejar el campo con un valor provisional y editarlo luego)
- **Prioridad** de orden (número, 0 por defecto — mayor prioridad sale antes en listados)
- Si quiere que la ciudad sea visible ya (**Activa**) o quede creada pero oculta hasta que esté lista

## 2. Guiar el alta en `/admin`

Con esos datos, indícale al usuario los pasos exactos:

1. Entrar en `/admin` (login con su cuenta, debe estar en la tabla `admins`)
2. Pestaña **Ciudades** → botón de nueva ciudad
3. Rellenar cada campo con los valores recopilados (el slug se genera solo a partir del nombre)
4. Si dio una URL de Google Maps, usar el botón de extracción antes de guardar
5. Guardar

## 3. Confirmar y explicar

- La ciudad aparecerá automáticamente en el home, el buscador global y el listado de ciudades del país en cuanto se guarde como activa — no hace falta tocar código.
- Si el usuario quiere añadir también partners para esta ciudad, sugerirle `/add-partner` (la ciudad debe existir ya en Supabase para poder asociarle partners).
