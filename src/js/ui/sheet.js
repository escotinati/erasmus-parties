// ─────────────────────────────────────────────────────────────
//  SHEET.JS — panel <dialog> nativo: hoja anclada abajo en móvil,
//  diálogo centrado desde --bp-md. Expone window.Sheet.
//
//  Primitiva vanilla, aislada en esta rama (feature/sheet-component)
//  — no se conecta a nada todavía. Su primer consumidor real será
//  mapPartners.js, en la rama siguiente. Demo: dev/sheet-demo.html
//  (fuera del flujo público, no enlazada desde el sitio).
//
//  Por qué vanilla y no una isla de React: el único consumidor
//  previsto (mapPartners.js) ya es vanilla. Montar React de forma
//  imperativa desde código vanilla reintroduciría el problema de
//  timing que documenta src/react/Nav.jsx (un <script> clásico
//  enganchado a DOMContentLoaded puede disparar antes de que React
//  termine de montar el nodo) — aquí no aplica: abrir/cerrar el panel
//  es síncrono, no depende de que ningún otro script "encuentre" un
//  nodo después del hecho.
//
//  Por qué <dialog> + showModal() y no un <div> a mano: da gratis el
//  focus trap (Tab no puede salir del panel), el cierre con Esc
//  (evento "cancel"), el estado inert del resto de la página, y la
//  capa "top layer" del navegador — por encima de CUALQUIER z-index
//  de la página (incluidos los tiles de Leaflet y el bottom-nav a
//  z-index:500) sin tener que competir por número. Reimplementar
//  cualquiera de esas piezas a mano sería estrictamente peor.
// ─────────────────────────────────────────────────────────────

(function () {
    let idCounter = 0;

    function prefersReducedMotion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    // Lee --bp-md de tokens.css en vez de hardcodear 900 aquí — así
    // el punto de corte del gesto de arrastre (solo tiene sentido en
    // la hoja móvil) se queda sincronizado con el mismo token que ya
    // decide, en CSS, cuándo el panel pasa a diálogo centrado.
    function isDesktopLayout() {
        const raw = getComputedStyle(document.documentElement).getPropertyValue('--bp-md');
        const bpMd = parseFloat(raw) || 900;
        return window.matchMedia('(min-width: ' + bpMd + 'px)').matches;
    }

    // Bloqueo de scroll del fondo sin salto de layout: compensa el
    // ancho real de la scrollbar (0 en la mayoría de móviles, donde
    // ya no ocupa espacio de layout) sumándolo al padding-right que
    // <html> ya tuviera, y lo revierte tal cual al desbloquear.
    // Contador porque varios Sheet podrían solaparse en teoría.
    let lockCount = 0;
    let savedOverflow = '';
    let savedPaddingRight = '';

    function lockScroll() {
        if (lockCount === 0) {
            const root = document.documentElement;
            const scrollbarWidth = window.innerWidth - root.clientWidth;
            savedOverflow = root.style.overflow;
            savedPaddingRight = root.style.paddingRight;
            root.style.overflow = 'hidden';
            if (scrollbarWidth > 0) {
                const currentPadding = parseFloat(getComputedStyle(root).paddingRight) || 0;
                root.style.paddingRight = currentPadding + scrollbarWidth + 'px';
            }
        }
        lockCount++;
    }

    function unlockScroll() {
        lockCount = Math.max(0, lockCount - 1);
        if (lockCount === 0) {
            const root = document.documentElement;
            root.style.overflow = savedOverflow;
            root.style.paddingRight = savedPaddingRight;
        }
    }

    /**
     * Crea un Sheet. `content` es un nodo del DOM (Element o
     * DocumentFragment), NUNCA una cadena HTML: es deliberado, no una
     * limitación — así el consumidor construye su contenido con
     * createElement/textContent (igual que mapPartners.js) y este
     * componente no abre una vía nueva de innerHTML sin escapar sobre
     * datos que, en el consumidor real, vienen de Supabase.
     *
     * `closeLabel` es opcional (no forma parte de la API mínima
     * pedida) — el texto del botón de cerrar para lectores de
     * pantalla; el futuro consumidor puede pasar window.I18n.t(...)
     * aquí sin que este archivo dependa de I18n.
     */
    function create(options) {
        const opts = options || {};
        const title = opts.title || '';
        const content = opts.content || null;
        const onClose = typeof opts.onClose === 'function' ? opts.onClose : null;
        const closeLabel = opts.closeLabel || 'Cerrar';

        idCounter += 1;
        const titleId = 'sheet-title-' + idCounter;

        const dialogEl = document.createElement('dialog');
        dialogEl.className = 'sheet';
        dialogEl.setAttribute('aria-labelledby', titleId);

        const handle = document.createElement('div');
        handle.className = 'sheet-handle';
        handle.setAttribute('aria-hidden', 'true');

        const header = document.createElement('header');
        header.className = 'sheet-header';

        const titleEl = document.createElement('h2');
        titleEl.className = 'sheet-title';
        titleEl.id = titleId;
        titleEl.textContent = title;

        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'sheet-close';
        closeBtn.setAttribute('aria-label', closeLabel);
        const closeIcon = document.createElement('span');
        closeIcon.className = 'material-symbols-outlined';
        closeIcon.setAttribute('aria-hidden', 'true');
        closeIcon.textContent = 'close';
        closeBtn.appendChild(closeIcon);

        header.appendChild(titleEl);
        header.appendChild(closeBtn);

        const body = document.createElement('div');
        body.className = 'sheet-body';
        if (content) body.appendChild(content);

        dialogEl.appendChild(handle);
        dialogEl.appendChild(header);
        dialogEl.appendChild(body);
        document.body.appendChild(dialogEl);

        let lastTrigger = null;
        let isClosing = false;

        function finishClose() {
            dialogEl.classList.remove('sheet--visible');
            if (dialogEl.open) dialogEl.close();
        }

        function requestClose() {
            if (!dialogEl.open || isClosing) return;
            isClosing = true;

            if (prefersReducedMotion()) {
                finishClose();
                return;
            }

            const onEnd = function (e) {
                if (e.target !== dialogEl) return; // ignora transitions que burbujean desde hijos
                dialogEl.removeEventListener('transitionend', onEnd);
                finishClose();
            };
            dialogEl.addEventListener('transitionend', onEnd);
            dialogEl.classList.remove('sheet--visible');
        }

        // Único sitio que limpia estado: corre tanto si el cierre lo
        // disparó requestClose() como si, por lo que sea, algo más
        // llamara a dialogEl.close() directamente.
        dialogEl.addEventListener('close', function () {
            isClosing = false;
            dialogEl.classList.remove('sheet--visible');
            dialogEl.style.transform = '';
            unlockScroll();
            if (lastTrigger && typeof lastTrigger.focus === 'function') {
                lastTrigger.focus();
            }
            lastTrigger = null;
            if (onClose) onClose();
        });

        // Esc dispara "cancel" y cierra de forma nativa e instantánea
        // antes de que podamos animar nada; se intercepta para pasar
        // por la misma salida animada que el resto de vías de cierre.
        dialogEl.addEventListener('cancel', function (e) {
            e.preventDefault();
            requestClose();
        });

        // Parche puntual a un hueco real de showModal(): el propio
        // navegador (comprobado en Chromium) hace inert todo lo de
        // fuera del diálogo, pero al llegar al final (o al principio,
        // con Shift+Tab) de sus elementos enfocables, el foco "cae" a
        // <body> en vez de volver a entrar — un escape real, no un
        // efecto de test. Ese salto a <body> NO dispara focusin
        // (comprobado: con un listener de focusin en document nunca se
        // ejecutaba), así que hay que engancharlo en el focusout que SÍ
        // dispara el propio panel al perder el foco, mirando su
        // relatedTarget; reenfocar de forma síncrona ahí mismo sí
        // "engancha" (comprobado con Tab real, sin rebote visible en
        // ningún frame). No es reimplementar el focus trap completo
        // (seguimos sin enumerar el ciclo ni interceptar Tab): solo se
        // corrige este salto concreto.
        dialogEl.addEventListener('focusout', function (e) {
            if (!dialogEl.open) return;
            if (e.relatedTarget && dialogEl.contains(e.relatedTarget)) return;
            const focusable = dialogEl.querySelector(
                'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
            );
            (focusable || dialogEl).focus();
        });

        // Toque en el fondo: el propio <dialog>, con showModal(), NO
        // ocupa el área oscurecida (eso es ::backdrop) — pero los
        // clics sobre ::backdrop burbujean con target = dialogEl, así
        // que basta comprobar si el punto cae fuera de su rect real.
        dialogEl.addEventListener('click', function (e) {
            const rect = dialogEl.getBoundingClientRect();
            const inside =
                e.clientX >= rect.left &&
                e.clientX <= rect.right &&
                e.clientY >= rect.top &&
                e.clientY <= rect.bottom;
            if (!inside) requestClose();
        });

        closeBtn.addEventListener('click', requestClose);

        // Arrastre hacia abajo para cerrar — solo hoja móvil (no hay
        // tirador en el diálogo centrado de --bp-md), y solo desde el
        // tirador/cabecera: el cuerpo con scroll queda fuera a
        // propósito para no competir con el gesto de scroll nativo.
        let dragStartY = null;
        let dragCurrentY = 0;
        let dragging = false;
        const DRAG_CLOSE_THRESHOLD = 120; // px

        function onDragStart(e) {
            if (isDesktopLayout()) return;
            dragStartY = e.clientY;
            dragCurrentY = 0;
            dragging = true;
            dialogEl.style.transition = 'none';
            if (e.target.setPointerCapture) e.target.setPointerCapture(e.pointerId);
        }

        function onDragMove(e) {
            if (!dragging) return;
            const delta = e.clientY - dragStartY;
            dragCurrentY = Math.max(0, delta);
            dialogEl.style.transform = 'translateY(' + dragCurrentY + 'px)';
        }

        function onDragEnd() {
            if (!dragging) return;
            dragging = false;
            dialogEl.style.transition = '';
            dialogEl.style.transform = '';
            if (dragCurrentY > DRAG_CLOSE_THRESHOLD) {
                requestClose();
            }
            dragStartY = null;
            dragCurrentY = 0;
        }

        [handle, header].forEach(function (el) {
            el.addEventListener('pointerdown', onDragStart);
            el.addEventListener('pointermove', onDragMove);
            el.addEventListener('pointerup', onDragEnd);
            el.addEventListener('pointercancel', onDragEnd);
        });

        function open(triggerElement) {
            if (dialogEl.open) return;
            isClosing = false;
            lastTrigger =
                triggerElement ||
                (document.activeElement && document.activeElement !== document.body
                    ? document.activeElement
                    : null);

            lockScroll();
            dialogEl.showModal();

            if (prefersReducedMotion()) {
                // "aparece sin animación de entrada": ni transform ni
                // opacity se transicionan, el panel aparece ya en su
                // posición final.
                dialogEl.classList.add('sheet--visible');
                return;
            }

            // Doble rAF: showModal() ya pintó el panel en su posición
            // CERRADA (display:flex vía [open], transform de reposo
            // de la regla base); hace falta esperar a que ese frame
            // se pinte de verdad antes de añadir la clase que dispara
            // la transición — si se añadiera en el mismo tick no
            // habría un frame "de partida" del que animar y el panel
            // aparecería ya abierto, sin transición.
            requestAnimationFrame(function () {
                requestAnimationFrame(function () {
                    dialogEl.classList.add('sheet--visible');
                });
            });
        }

        return {
            dialogEl: dialogEl,
            open: open,
            close: requestClose,
        };
    }

    window.Sheet = { create: create };
})();
