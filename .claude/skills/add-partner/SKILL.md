---
name: add-partner
description: Guía paso a paso para añadir un nuevo partner (local nocturno, alojamiento, servicio) a Erasmus Verified a través del panel de administración (/admin), que escribe en Supabase. Usa cuando el usuario quiera dar de alta un nuevo socio comercial en la app.
disable-model-invocation: true
---

Los partners ya no se añaden editando código — viven en la tabla `partners` de Supabase (sus enlaces en `partner_links`) y se gestionan desde el panel de administración en `/admin` (ver CLAUDE.md, sección "Panel de administración"). Este skill reúne los datos y le dice al usuario exactamente qué rellenar en ese formulario; no edita ningún archivo del repo.

## 1. Recopilar información

Pide en un solo mensaje los campos del formulario de partner (`/admin` → Partners → Nuevo partner):

- **Nombre** del local o negocio
- **Categoría**: `nightlife` (ocio nocturno) | `housing` (alojamiento) | `services` (servicios) — son las tres únicas que existen hoy en la base de datos
- **Ciudad**: debe existir ya en Supabase (el formulario la ofrece como desplegable) — si no existe, sugiere primero `/add-city`
- **Descripción** corta en español e inglés
- **URL de imagen** (opcional)
- **Coordenadas**: o bien una URL de Google Maps del local (el panel las extrae solas con el botón "Extraer de Google Maps"), o lat/lng directamente
- **Prioridad** de orden (número, 0 por defecto)
- Si debe quedar **Activo** ya o creado pero oculto
- **Links** (opcional, se añaden aparte dentro del mismo formulario): web oficial, entradas, WhatsApp propio del local, etc. — cada uno con su etiqueta y URL

## 2. Guiar el alta en `/admin`

Con esos datos, indícale al usuario los pasos exactos:

1. Entrar en `/admin` (login con su cuenta, debe estar en la tabla `admins`)
2. Pestaña **Partners** → botón de nuevo partner
3. Elegir la ciudad ya existente en el desplegable
4. Rellenar el resto de campos con los valores recopilados
5. Si dio una URL de Google Maps, usar el botón de extracción antes de guardar
6. Añadir los links con el botón "+ Añadir link" dentro del propio formulario, uno por uno
7. Guardar

## 3. Confirmar y explicar

- El partner aparecerá automáticamente en la ciudad correspondiente (home, página de ciudad y mapa) en cuanto se guarde como activo — no hace falta tocar código.
- Si la categoría elegida no tiene datos todavía en esa ciudad, el filtro de esa categoría la mostrará vacía hasta que haya más partners.
