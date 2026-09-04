#!/usr/bin/env node
'use strict';

// ─────────────────────────────────────────────────────────────
//  CHECK-SANITIZATION.JS — Erasmus Verified / Erasmus Parties
//
//  Guardarraíl de build (Capa 2 de feat/data-integrity-guardrails):
//  recorre src/js/ y src/react/ buscando asignaciones a .href, .src,
//  .style/.style.PROP o .innerHTML cuyo valor no pase por
//  sanitizeUrl()/escapeHtml() (o I18n.t()/I18n.tField(), contenido
//  estático de traducción, no de Supabase). Es la regresión concreta
//  que ya pasó tres veces en este proyecto (dato de Supabase sin
//  sanear llegando al DOM) — no es un escáner XSS genérico ni
//  entiende JS de verdad (no hay parser AST, "sin dependencias
//  nuevas" según el encargo): es un tokenizer de brackets/strings
//  hecho a mano + un clasificador de "¿esta pieza es segura?" con
//  reglas explícitas. Puede tener puntos ciegos ante código muy
//  distinto al patrón ya establecido en este repo — su trabajo es
//  no perder DE NUEVO el patrón conocido, no demostrar seguridad
//  matemática.
//
//  LÍMITE explícito, mismo espíritu que el comentario de la migración
//  SQL hermana (20260904000000_add_https_url_check_constraints.sql):
//  esto detecta la FORMA del bug histórico (valor crudo interpolado
//  en un sumidero DOM), no analiza si el destino final es legítimo.
// ─────────────────────────────────────────────────────────────

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SCAN_DIRS = ['src/js', 'src/react'];
const FILE_EXT_RE = /\.(js|jsx)$/;

// Funciones cuyo valor de retorno es SIEMPRE seguro para un sumidero,
// sin importar el argumento: escapeHtml/sanitizeUrl por sanear de
// verdad; I18n.t/I18n.tField porque devuelven texto ESTÁTICO de
// translations.js, nunca dato de Supabase; parseFloat/parseInt/Number/
// Math.* porque su tipo de retorno es siempre numérico (NaN incluido),
// nunca una cadena que pueda romper HTML/CSS.
const SAFE_WRAPPER_CALLS = [
    'escapeHtml',
    'sanitizeUrl',
    'I18n.t',
    'I18n.tField',
    'parseFloat',
    'parseInt',
    'Number',
    'Math.max',
    'Math.min',
    'Math.round',
    'Math.floor',
    'Math.ceil',
    'Math.abs',
    // Percent-encoding: convierte cualquier carácter que pueda romper
    // HTML/URL (comillas, <, >, &, /, ?, #...) en secuencias %XX — igual
    // de seguro que escapeHtml/sanitizeUrl para interpolar en un
    // segmento de ruta o query string.
    'encodeURIComponent',
];

// Columnas de Supabase confirmadas NO-texto en el esquema actual
// (list_tables verbose, sesión de esta rama): bigint/float8/int4/bool.
// Un valor de estos tipos, al interpolarse en una plantilla, nunca
// puede contener comillas/ángulos/esquemas ejecutables — por eso basta
// con el nombre del campo, sin envolverlo. Si algún día una de estas
// columnas pasa a ser texto libre, este check deja de protegerla en
// silencio: es la misma limitación que ya tiene la CHECK constraint
// de la Capa 1, aceptada por el mismo motivo (lista explícita, no
// inferencia de tipos en tiempo real contra Supabase).
const SAFE_NUMERIC_FIELDS = new Set([
    'id',
    'lat',
    'lng',
    'priority',
    'active',
    'sort_order',
    'city_id',
    'partner_id',
]);

// Propiedades numéricas de APIs del DOM (medidas de layout) — nunca
// datos de Supabase, siempre números que el propio navegador calcula.
const DOM_GEOMETRY_FIELDS = new Set([
    'offsetHeight',
    'offsetWidth',
    'clientWidth',
    'clientHeight',
    'innerWidth',
    'innerHeight',
    'scrollWidth',
    'scrollHeight',
    'scrollLeft',
    'scrollTop',
    'width',
    'height',
    'left',
    'top',
    'right',
    'bottom',
    'x',
    'y',
]);

// Nombres convencionales de índice de bucle/posición en array — se
// usan en TODO el proyecto como segundo parámetro de .map()/.forEach()
// (ej. `.map((city, i) => ...)`) y son siempre un número entero, nunca
// un campo de Supabase.
const SAFE_LOOP_INDEX_NAMES = new Set(['i', 'idx', 'index']);

// ── EXCEPCIONES EXPLÍCITAS ──────────────────────────────────────
// Casos que no encajan en las reglas generales de abajo. Cada una
// lleva su propio motivo. `contains` es un fragmento de texto estable
// que debe aparecer en la línea del hallazgo para que la excepción
// aplique — si el código cambia lo bastante como para que el
// fragmento deje de aparecer, la excepción deja de suprimir nada y el
// check vuelve a evaluar esa línea con las reglas generales.
const EXPLICIT_EXCEPTIONS = [
    {
        file: 'src/js/index.js',
        contains: 'track.innerHTML = html + html;',
        reason: 'html se construye arriba vía escapeHtml(text) sobre claves ESTÁTICAS de i18n (items del ticker), no sobre datos de Supabase.',
    },
    {
        file: 'src/js/experience.js',
        contains: "a.href = 'https://erasmusverified.com';",
        reason: 'Literal fijo del salto de marca Parties→Verified, sin interpolación — ya cubierto por la regla de literales, listado aquí solo para que quede trazado explícitamente (lo pedía el encargo).',
    },
    {
        file: 'src/js/experience.js',
        contains:
            "'<span class=\"material-symbols-outlined\">verified</span>' + '<span>Verified</span>'",
        reason: 'Concatenación de dos literales fijos, sin interpolación — mismo motivo que la excepción anterior.',
    },
    {
        file: 'src/js/index.js',
        contains: 'window.location.href = item.url;',
        reason: 'item.url se construye en buildSearchIndex() (misma función, más arriba) como `ciudad.html?ciudad=${encodeURIComponent(city.id)}` — relativa, id numérico de Supabase codificado con encodeURIComponent. La propagación de este checker no cruza el límite de la función que crea el índice de búsqueda hasta el callback que lo consume.',
    },
    {
        file: 'src/js/index.js',
        contains: 'if (match) window.location.href = match.url;',
        reason: 'match.url viene del mismo índice de búsqueda que item.url arriba (mismo array, mismo .find()) — misma garantía.',
    },
    {
        file: 'src/js/ciudades.js',
        contains: 'heroBg.style.backgroundImage = `url(${JSON.stringify(safeImageUrl)})`;',
        reason: 'safeImageUrl ya pasó por sanitizeUrl() (línea de arriba); JSON.stringify() aquí resuelve el escapado de comillas específico de un valor dentro de url(...) en CSS — ver el comentario del propio archivo. No se generaliza JSON.stringify(...) como wrapper seguro en las reglas globales porque NO escapa < > & (no serviría para innerHTML de texto, solo para este contexto de cadena CSS/JS).',
    },
];

function isExplicitlyExempted(relFile, lineText) {
    return EXPLICIT_EXCEPTIONS.find((ex) => ex.file === relFile && lineText.includes(ex.contains));
}

// ── 1. DESCUBRIMIENTO DE ARCHIVOS ───────────────────────────────

function walk(dir, out) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walk(full, out);
        } else if (FILE_EXT_RE.test(entry.name)) {
            out.push(full);
        }
    }
    return out;
}

function discoverFiles() {
    const files = [];
    for (const dir of SCAN_DIRS) {
        const abs = path.join(ROOT, dir);
        if (fs.existsSync(abs)) walk(abs, files);
    }
    return files;
}

// ── 2. TOKENIZER MÍNIMO (brackets/strings/template literals) ───
//
// Máquina de pila genérica: cada frame de la pila representa "qué me
// devuelve al modo anterior". Sirve tanto para saltar de un `${` a
// código y volver al modo plantilla, como para encontrar el `;` de
// nivel superior que cierra una sentencia — es el mismo mecanismo,
// solo cambia el criterio de parada.

// mode: 'semicolon' (para para en el ';' de nivel superior — RHS de
// una asignación) | 'balance' (para en cuanto la pila vuelve a estar
// vacía tras haberse abierto, o al toparse en nivel superior con un
// cierre/coma que no es suyo — para extraer el cuerpo de un arrow
// function dentro de una llamada como .map(...), sin saber de
// antemano si ese cuerpo es un bloque {} o una expresión suelta).
function scanRegion(text, start, mode) {
    const stopAtTopLevelSemicolon = mode === 'semicolon';
    const stopAtBalance = mode === 'balance';
    const stack = [];
    let opened = false;
    let i = start;
    while (i < text.length) {
        const ch = text[i];
        const top = stack.length ? stack[stack.length - 1] : null;

        if (!top || (top.closer !== "'" && top.closer !== '"' && top.closer !== '`')) {
            // Modo código (nivel superior o dentro de (), [], {}, o de un ${} de plantilla)
            if (stopAtTopLevelSemicolon && stack.length === 0 && ch === ';') {
                return { end: i, text: text.slice(start, i) };
            }
            if (stopAtBalance && stack.length === 0) {
                if (opened) {
                    return { end: i, text: text.slice(start, i) };
                }
                if (ch === ')' || ch === ']' || ch === '}' || ch === ',') {
                    return { end: i, text: text.slice(start, i) };
                }
            }
            if (top && ch === top.closer) {
                stack.pop();
                i++;
                continue;
            }
            if (ch === "'") {
                stack.push({ closer: "'" });
                opened = true;
                i++;
                continue;
            }
            if (ch === '"') {
                stack.push({ closer: '"' });
                opened = true;
                i++;
                continue;
            }
            if (ch === '`') {
                stack.push({ closer: '`' });
                opened = true;
                i++;
                continue;
            }
            if (ch === '(') {
                stack.push({ closer: ')' });
                opened = true;
                i++;
                continue;
            }
            if (ch === '[') {
                stack.push({ closer: ']' });
                opened = true;
                i++;
                continue;
            }
            if (ch === '{') {
                stack.push({ closer: '}' });
                opened = true;
                i++;
                continue;
            }
            if (ch === '/' && text[i + 1] === '/') {
                const nl = text.indexOf('\n', i);
                i = nl === -1 ? text.length : nl;
                continue;
            }
            if (ch === '/' && text[i + 1] === '*') {
                const end = text.indexOf('*/', i + 2);
                i = end === -1 ? text.length : end + 2;
                continue;
            }
            i++;
            continue;
        }

        if (top.closer === "'" || top.closer === '"') {
            if (ch === '\\') {
                i += 2;
                continue;
            }
            if (ch === top.closer) {
                stack.pop();
                i++;
                continue;
            }
            i++;
            continue;
        }

        // top.closer === '`'  → dentro de una plantilla, leyendo texto literal
        if (ch === '\\') {
            i += 2;
            continue;
        }
        if (ch === '`') {
            stack.pop();
            i++;
            continue;
        }
        if (ch === '$' && text[i + 1] === '{') {
            stack.push({ closer: '}' });
            i += 2;
            continue;
        }
        i++;
    }
    return { end: text.length, text: text.slice(start) };
}

// Extrae el RHS de una asignación (todo hasta el `;` de nivel superior).
function extractRhs(text, startAfterEquals) {
    return scanRegion(text, startAfterEquals, 'semicolon').text.trim();
}

// Dado el texto completo de una plantilla (con backticks incluidos),
// devuelve el array de expresiones dentro de cada ${...} de nivel
// superior de esa plantilla (sin anidar en sub-plantillas, que se
// tratan como su propia pieza recursivamente vía isSafeExpr).
function extractTemplatePieces(templateText) {
    const pieces = [];
    let i = 1; // saltar la backtick inicial
    while (i < templateText.length) {
        const ch = templateText[i];
        if (ch === '\\') {
            i += 2;
            continue;
        }
        if (ch === '`') break;
        if (ch === '$' && templateText[i + 1] === '{') {
            // Arranca justo en la '{' (modo 'balance' la empuja a la pila
            // y se detiene en cuanto vuelve a vaciarse) — recorta las
            // llaves exteriores para quedarnos con la expresión interior.
            const region = scanRegion(templateText, i + 1, 'balance');
            pieces.push(region.text.slice(1, -1));
            i = region.end;
            continue;
        }
        i++;
    }
    return pieces;
}

// ── 3. CLASIFICADOR DE SEGURIDAD ────────────────────────────────

function isPureLiteral(expr) {
    const t = expr.trim();
    if (t.length < 2) return false;
    const q = t[0];
    if ((q === "'" || q === '"') && t[t.length - 1] === q) {
        // sin comillas sin escapar en medio ya lo garantiza haber sido
        // extraído por el tokenizer como una sola pieza balanceada
        return true;
    }
    if (q === '`' && t[t.length - 1] === '`') {
        return !t.includes('${');
    }
    return false;
}

function isWrappedBySafeCall(expr) {
    const t = expr.trim();
    for (const fn of SAFE_WRAPPER_CALLS) {
        if (t.startsWith(fn + '(') && t.endsWith(')')) return true;
    }
    return false;
}

function isSafeNumericFieldAccess(expr) {
    const t = expr.trim();
    // IDENT.campo — un único nivel de acceso a propiedad, sin más.
    const m = /^[A-Za-z_$][\w$]*\.([A-Za-z_$][\w$]*)$/.exec(t);
    if (!m) return false;
    return SAFE_NUMERIC_FIELDS.has(m[1]) || DOM_GEOMETRY_FIELDS.has(m[1]);
}

function containsNoPropertyAccess(expr) {
    // Heurística "sin punto": una expresión aritmética/local (contador de
    // bucle, índice, ternario de literales) que no lee ningún campo de un
    // objeto no puede estar leyendo un dato crudo de Supabase — Supabase
    // siempre llega como propiedad de un objeto (city.x, partner.x...),
    // nunca como variable suelta con el propio texto dentro.
    return !expr.includes('.');
}

// 'a' + b - c.d || e  → ["'a'", 'b', 'c.d', 'e'], respetando
// strings/plantillas/paréntesis. Cubre concatenación de texto (+) y
// aritmética/medidas de layout (- * / || &&) con el mismo mecanismo:
// cada lado se clasifica por separado y recursivamente. Un '+'/'-' al
// principio de un trozo (signo unario) o duplicado (++/--) no cuenta
// como separador.
function splitTopLevelConcat(expr) {
    const parts = [];
    let depth = 0;
    let mode = null; // "'" | '"' | '`' | null
    let cur = '';
    for (let i = 0; i < expr.length; i++) {
        const ch = expr[i];
        if (mode) {
            cur += ch;
            if (ch === '\\') {
                cur += expr[i + 1] || '';
                i++;
                continue;
            }
            if (ch === mode) mode = null;
            continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') {
            mode = ch;
            cur += ch;
            continue;
        }
        if (ch === '(' || ch === '[' || ch === '{') {
            depth++;
            cur += ch;
            continue;
        }
        if (ch === ')' || ch === ']' || ch === '}') {
            depth--;
            cur += ch;
            continue;
        }
        if (depth === 0 && (ch === '+' || ch === '-')) {
            const isUnary = cur.trim() === '' || /[+\-*/%<>=&|,(:?]\s*$/.test(cur);
            const isDoubled = expr[i + 1] === ch;
            if (!isUnary && !isDoubled) {
                parts.push(cur.trim());
                cur = '';
                continue;
            }
        }
        if (
            depth === 0 &&
            (ch === '*' || ch === '/') &&
            expr[i + 1] !== '/' &&
            expr[i + 1] !== '*'
        ) {
            parts.push(cur.trim());
            cur = '';
            continue;
        }
        if (depth === 0 && (ch === '|' || ch === '&') && expr[i + 1] === ch) {
            parts.push(cur.trim());
            cur = '';
            i++; // consume el segundo carácter del operador (|| o &&)
            continue;
        }
        cur += ch;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
}

function isSafeExpr(expr, ctx) {
    const t = expr.trim();
    if (!t) return true;

    if (isPureLiteral(t)) return true;
    if (isWrappedBySafeCall(t)) return true;
    if (isSafeNumericFieldAccess(t)) return true;
    // list.map((p) => `...`).join('') directamente en el sumidero, no
    // solo cuando pasa antes por una variable con nombre (ver
    // buildSafeSymbols) — misma regla, aplicada aquí también para que
    // la recursión la alcance en cualquier profundidad.
    if (looksLikeMapJoin(t) && isSafeMapJoin(t, ctx)) return true;

    // Identificador suelto: seguro si está en el conjunto ya
    // clasificado como seguro (propagación, ver buildSafeSymbols) o si
    // es un nombre convencional de índice de bucle (siempre numérico,
    // independientemente de en qué callback/bloque aparezca — por eso
    // va aquí como regla global y no solo en el alcance local de
    // isSafeMapJoin, que no ve declaraciones intermedias como
    // "const delay = ... ${i * 70} ...").
    if (/^[A-Za-z_$][\w$]*$/.test(t)) {
        return ctx.safeSymbols.has(t) || SAFE_LOOP_INDEX_NAMES.has(t);
    }

    // Plantilla con interpolaciones: cada ${...} debe ser seguro por
    // sí mismo, recursivamente.
    if (t.startsWith('`') && t.endsWith('`')) {
        const pieces = extractTemplatePieces(t);
        return pieces.every((p) => isSafeExpr(p, ctx));
    }

    // Concatenación con "+": cada lado debe ser seguro.
    const concatParts = splitTopLevelConcat(t);
    if (concatParts.length > 1) {
        return concatParts.every((p) => isSafeExpr(p, ctx));
    }

    // Llamada a una función local ya clasificada como "devuelve
    // siempre contenido seguro" (ver construirSafeSymbols).
    const callMatch = /^([A-Za-z_$][\w$]*)\(/.exec(t);
    if (callMatch && ctx.safeFunctions.has(callMatch[1])) return true;

    // Ternario simple (cond ? a : b): seguro si ambas ramas lo son.
    // Split ingenuo por el primer '?'/':' de nivel superior — suficiente
    // para los casos reales de este repo (sin ternarios anidados en los
    // sumideros auditados).
    const ternary = splitTernary(t);
    if (ternary) {
        return isSafeExpr(ternary.a, ctx) && isSafeExpr(ternary.b, ctx);
    }

    // Paréntesis envolviendo toda la expresión (con o sin signo unario
    // delante, ej. -(a - b)): se desenvuelve y se evalúa el interior —
    // splitTopLevelConcat no entra dentro de paréntesis a propósito
    // (para no romper la agrupación de operadores), así que sin esto
    // "-(a.x - b.y)" quedaría como una sola pieza opaca.
    const unwrapped = stripOuterParens(t);
    if (unwrapped !== null) return isSafeExpr(unwrapped, ctx);

    if (containsNoPropertyAccess(t)) return true;

    return false;
}

function stripOuterParens(expr) {
    let t = expr;
    if (t[0] === '-' || t[0] === '+' || t[0] === '!') t = t.slice(1).trim();
    if (t[0] !== '(') return null;
    let depth = 0;
    let mode = null;
    for (let i = 0; i < t.length; i++) {
        const ch = t[i];
        if (mode) {
            if (ch === '\\') {
                i++;
                continue;
            }
            if (ch === mode) mode = null;
            continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') {
            mode = ch;
            continue;
        }
        if (ch === '(') depth++;
        else if (ch === ')') {
            depth--;
            if (depth === 0) {
                // Debe ser el último carácter no-espacio de la expresión.
                return i === t.length - 1 ? t.slice(1, i) : null;
            }
        }
    }
    return null;
}

function splitTernary(expr) {
    let depth = 0;
    let mode = null;
    let qIdx = -1;
    for (let i = 0; i < expr.length; i++) {
        const ch = expr[i];
        if (mode) {
            if (ch === '\\') {
                i++;
                continue;
            }
            if (ch === mode) mode = null;
            continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') {
            mode = ch;
            continue;
        }
        if (ch === '(' || ch === '[' || ch === '{') depth++;
        else if (ch === ')' || ch === ']' || ch === '}') depth--;
        else if (ch === '?' && depth === 0 && expr[i + 1] !== '.' && expr[i + 1] !== '?') {
            qIdx = i;
            break;
        }
    }
    if (qIdx === -1) return null;
    // buscar el ':' de nivel superior correspondiente, a partir de qIdx+1
    let depth2 = 0;
    let mode2 = null;
    for (let i = qIdx + 1; i < expr.length; i++) {
        const ch = expr[i];
        if (mode2) {
            if (ch === '\\') {
                i++;
                continue;
            }
            if (ch === mode2) mode2 = null;
            continue;
        }
        if (ch === "'" || ch === '"' || ch === '`') {
            mode2 = ch;
            continue;
        }
        if (ch === '(' || ch === '[' || ch === '{') depth2++;
        else if (ch === ')' || ch === ']' || ch === '}') depth2--;
        else if (ch === ':' && depth2 === 0) {
            return {
                a: expr.slice(qIdx + 1, i),
                b: expr.slice(i + 1),
            };
        }
    }
    return null;
}

// ── 4. CONSTRUCCIÓN DEL CONJUNTO "SEGURO" POR ARCHIVO ──────────
//
// Sin AST no hay data-flow real: esto es una propagación de un solo
// nivel (con 2 pasadas para encadenar dependencias simples), no un
// análisis completo. Cubre los patrones YA establecidos en este repo
// (const safeX = sanitizeUrl(...); let html=''; html+=...; const rows
// = list.map(...).join(''); function buildX(){ return `...`; }) — no
// pretende cubrir cualquier forma posible de JS.

function buildSafeSymbols(text) {
    const safeSymbols = new Set();
    const safeFunctions = new Set();
    const ctx = { safeSymbols, safeFunctions };

    for (let pass = 0; pass < 2; pass++) {
        // const/let NAME = RHS;
        const declRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*/g;
        let m;
        while ((m = declRe.exec(text))) {
            const name = m[1];
            if (safeSymbols.has(name)) continue;
            const rhs = extractRhs(text, declRe.lastIndex);
            if (looksLikeMapJoin(rhs) ? isSafeMapJoin(rhs, ctx) : isSafeExpr(rhs, ctx)) {
                safeSymbols.add(name);
            }
        }

        // let NAME = '' (o "" o ``); ... NAME += RHS; (acumulador)
        const emptyInitRe = /\blet\s+([A-Za-z_$][\w$]*)\s*=\s*(['"`])\2\s*;/g;
        while ((m = emptyInitRe.exec(text))) {
            const name = m[1];
            if (safeSymbols.has(name)) continue;
            const appendRe = new RegExp('\\b' + escapeRegExp(name) + '\\s*\\+=\\s*', 'g');
            let am;
            let allSafe = true;
            let found = false;
            while ((am = appendRe.exec(text))) {
                found = true;
                const rhs = extractRhs(text, appendRe.lastIndex);
                if (!isSafeExpr(rhs, ctx)) {
                    allSafe = false;
                    break;
                }
            }
            if (found && allSafe) safeSymbols.add(name);
        }

        // function NAME(...) { ... return RHS; ... }
        const fnRe = /\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/g;
        while ((m = fnRe.exec(text))) {
            const name = m[1];
            if (safeFunctions.has(name)) continue;
            const body = scanRegion(text, fnRe.lastIndex - 1, 'balance').text; // incluye la '{' inicial
            const returns = extractReturnExprs(body);
            if (returns.length > 0 && returns.every((r) => isSafeExpr(r, ctx))) {
                safeFunctions.add(name);
            }
        }
    }

    return ctx;
}

function looksLikeMapJoin(rhs) {
    return /\.map\s*\(/.test(rhs) && /\.join\s*\(/.test(rhs);
}

// const rows = list.map((p[, i]) => `...`).join('');
// Trata el cuerpo de la arrow function del .map() como una plantilla
// (o expresión) a clasificar igual que cualquier otra — el parámetro
// del callback (p, event, city...) se comporta exactamente como
// cualquier otro identificador con acceso a propiedades dentro de esa
// plantilla, así que las mismas reglas (escapeHtml/sanitizeUrl/campo
// numérico conocido) aplican sin necesitar tratamiento especial.
function isSafeMapJoin(rhs, ctx) {
    const arrowMatch = /\.map\s*\(\s*(\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>\s*/.exec(rhs);
    if (!arrowMatch) return false;

    // El/los parámetro(s) de índice del callback (segundo en adelante,
    // ej. la "i" de (city, i) => ...) son siempre números — se añaden a
    // una COPIA del conjunto seguro, con alcance solo a esta llamada,
    // para no filtrar ese nombre corto como "seguro" en el resto del
    // archivo si se reutiliza para otra cosa en otro sitio.
    const params = arrowMatch[1]
        .replace(/^\(|\)$/g, '')
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
    const localSafeSymbols = new Set(ctx.safeSymbols);
    for (const p of params.slice(1)) localSafeSymbols.add(p);
    const localCtx = { safeSymbols: localSafeSymbols, safeFunctions: ctx.safeFunctions };

    const bodyStart = arrowMatch.index + arrowMatch[0].length;
    const region = scanRegion(rhs, bodyStart, 'balance');
    const trimmed = region.text.trim();
    // Si el cuerpo es un bloque { ... return X; }, evalúa los returns;
    // si es una expresión directa (template literal u otra), evalúa esa.
    if (trimmed.startsWith('{')) {
        const returns = extractReturnExprs(trimmed);
        return returns.length > 0 && returns.every((r) => isSafeExpr(r, localCtx));
    }
    // Expresión directa: puede venir seguida de más código tras el
    // cierre del arrow (el resto de rhs, p.ej. ".join('')") — nos
    // quedamos solo con lo que scanRegion ya delimitó como la propia
    // expresión (se detiene en el primer ')' o ',' de nivel superior
    // porque scanRegion para en profundidad 0, que aquí es el paréntesis
    // de .map(...) ya abierto antes de entrar).
    return isSafeExpr(trimmed, localCtx);
}

function extractReturnExprs(blockText) {
    const returns = [];
    const returnRe = /\breturn\s+/g;
    let m;
    while ((m = returnRe.exec(blockText))) {
        const rhs = extractRhs(blockText, returnRe.lastIndex);
        returns.push(rhs);
    }
    return returns;
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── 5. BÚSQUEDA DE SUMIDEROS Y EVALUACIÓN ───────────────────────

const SINK_PATTERNS = [
    { name: 'href', re: /\.href\s*=(?!=)/g },
    { name: 'src', re: /\.src\s*=(?!=)/g },
    { name: 'style', re: /\.style(?:\.[A-Za-z_$][\w$]*)?\s*=(?!=)/g },
    { name: 'innerHTML', re: /\.innerHTML\s*=(?!=)/g },
];

function lineAndColOf(text, idx) {
    const upTo = text.slice(0, idx);
    const line = upTo.split('\n').length;
    const lastNl = upTo.lastIndexOf('\n');
    const col = idx - lastNl;
    return { line, col };
}

function checkFile(absPath) {
    const relFile = path.relative(ROOT, absPath).split(path.sep).join('/');
    const text = fs.readFileSync(absPath, 'utf8');
    const ctx = buildSafeSymbols(text);
    const findings = [];

    for (const sink of SINK_PATTERNS) {
        sink.re.lastIndex = 0;
        let m;
        while ((m = sink.re.exec(text))) {
            const rhsStart = m.index + m[0].length;
            const rhs = extractRhs(text, rhsStart);
            const { line } = lineAndColOf(text, m.index);
            const lineText = text.split('\n')[line - 1] || '';

            if (!isSafeExpr(rhs, ctx)) {
                const exemption = isExplicitlyExempted(relFile, lineText);
                if (exemption) continue;
                findings.push({
                    file: relFile,
                    line,
                    sink: sink.name,
                    snippet: lineText.trim().slice(0, 160),
                });
            }
        }
    }

    return findings;
}

// ── 6. COHERENCIA POR PÁGINA (supabaseClient.js → sanitize.js) ──
//
// Si una página carga supabaseClient.js o toca window.supabaseClient,
// debe cargar también utils/sanitize.js, y ese <script> debe aparecer
// ANTES que cualquier otro <script src> que lo use (en la práctica,
// antes del script propio de la página — el resto de scripts
// compartidos ya están auditados y no dependen de sanitize.js).

function checkPageConsistency() {
    const findings = [];
    const htmlFiles = fs
        .readdirSync(ROOT)
        .filter((f) => f.endsWith('.html'))
        .concat(
            fs.existsSync(path.join(ROOT, 'admin'))
                ? fs
                      .readdirSync(path.join(ROOT, 'admin'))
                      .filter((f) => f.endsWith('.html'))
                      .map((f) => 'admin/' + f)
                : []
        );

    for (const relHtml of htmlFiles) {
        const absHtml = path.join(ROOT, relHtml);
        const html = fs.readFileSync(absHtml, 'utf8');

        const usesSupabase =
            /src=["']\/src\/js\/lib\/supabaseClient\.js["']/.test(html) ||
            /window\.supabaseClient/.test(html);
        if (!usesSupabase) continue;

        const scriptSrcRe = /<script[^>]*\bsrc=["']([^"']+)["'][^>]*>/g;
        const scriptOrder = [];
        let m;
        while ((m = scriptSrcRe.exec(html))) {
            scriptSrcRe.lastIndex; // no-op, solo legibilidad
            scriptOrder.push({ src: m[1], idx: m.index });
        }

        const sanitizeIdx = scriptOrder.findIndex((s) => s.src.endsWith('/utils/sanitize.js'));
        const clientIdx = scriptOrder.findIndex((s) => s.src.endsWith('/lib/supabaseClient.js'));

        if (sanitizeIdx === -1) {
            findings.push({
                file: relHtml,
                problem:
                    'carga supabaseClient.js pero no carga utils/sanitize.js en ningún <script src>.',
            });
            continue;
        }

        if (clientIdx !== -1 && sanitizeIdx < clientIdx) {
            findings.push({
                file: relHtml,
                problem: `carga utils/sanitize.js ANTES que supabaseClient.js (orden: ${scriptOrder
                    .map((s) => s.src)
                    .join(
                        ' → '
                    )}) — no es un error funcional en sí, pero invierte el orden esperado; revísalo si no fue intencional.`,
            });
        }

        // El resto de scripts LOCALES (no CDN externo) que además usan
        // sanitizeUrl/escapeHtml en su propio código deben ir DESPUÉS de
        // sanitize.js — se comprueba leyendo cada script referenciado,
        // no adivinando por su ruta (evita falsos positivos con scripts
        // locales que no tocan sanitize.js, como tracking.js, y con CDNs
        // externos como leaflet/supabase-js que nunca podrían tocarlo).
        scriptOrder.forEach((s, sIdx) => {
            if (sIdx === sanitizeIdx || sIdx === clientIdx) return;
            if (!s.src.startsWith('/')) return; // CDN externo, fuera de alcance
            const scriptAbsPath = path.join(ROOT, s.src);
            if (!fs.existsSync(scriptAbsPath)) return;
            const scriptText = fs.readFileSync(scriptAbsPath, 'utf8');
            const usesSanitizer = /\bsanitizeUrl\s*\(|\bescapeHtml\s*\(/.test(scriptText);
            if (usesSanitizer && sIdx < sanitizeIdx) {
                findings.push({
                    file: relHtml,
                    problem: `${s.src} usa sanitizeUrl/escapeHtml pero se carga ANTES que utils/sanitize.js — fallaría en tiempo de ejecución.`,
                });
            }
        });
    }

    return findings;
}

// ── 7. MAIN ──────────────────────────────────────────────────────

function main() {
    const files = discoverFiles();
    let allFindings = [];

    for (const f of files) {
        const findings = checkFile(f);
        allFindings = allFindings.concat(findings);
    }

    const pageFindings = checkPageConsistency();

    if (allFindings.length === 0 && pageFindings.length === 0) {
        console.log(
            `[check-sanitization] OK — ${files.length} archivos revisados en ${SCAN_DIRS.join(', ')}, sin sumideros sin sanear. Coherencia de páginas (supabaseClient.js → sanitize.js) correcta.`
        );
        process.exit(0);
    }

    console.error('[check-sanitization] FALLÓ\n');

    if (allFindings.length > 0) {
        console.error(
            `Sumideros (.href/.src/.style/.innerHTML) con valores que no pasan por sanitizeUrl()/escapeHtml():\n`
        );
        for (const f of allFindings) {
            console.error(`  ${f.file}:${f.line}  [.${f.sink}]`);
            console.error(`    ${f.snippet}`);
        }
        console.error('');
    }

    if (pageFindings.length > 0) {
        console.error('Coherencia de carga de scripts por página:\n');
        for (const f of pageFindings) {
            console.error(`  ${f.file}: ${f.problem}`);
        }
        console.error('');
    }

    console.error(
        'Envuelve el valor en sanitizeUrl()/escapeHtml() (src/js/utils/sanitize.js), o si es un caso legítimo nuevo, añádelo a EXPLICIT_EXCEPTIONS en scripts/check-sanitization.js con su motivo.'
    );
    process.exit(1);
}

if (require.main === module) {
    main();
} else {
    module.exports = {
        buildSafeSymbols,
        isSafeExpr,
        extractRhs,
        extractTemplatePieces,
        scanRegion,
        checkFile,
        checkPageConsistency,
        isSafeMapJoin,
        extractTemplatePieces,
    };
}
