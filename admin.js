/* =============================================================
 * FALAHBAR.SnkS · PANEL ADMIN
 *
 * Carga productos.json (desde el server) o Excel/CSV (desde la PC),
 * los fusiona con la lógica del Excel del profe (los que están en
 * el Excel se quedan, los que no, se borran), y permite editar
 * y exportar productos.json para subir a GitHub.
 * ============================================================= */

// ---- Estado en memoria ----
let products = [];          // arreglo "fuente de verdad" en pantalla
let nextLocalId = 1;        // contador para generar ids únicos en filas nuevas

const CATEGORIAS = ['golosinas', 'snacks', 'gaseosas'];

// Mapeo del campo "Categoría" del Excel del profe a la categoría de la web
const CATEGORY_MAP = {
    'Chupetín':  ['golosinas', 'Chupetines',         '🍭'],
    'Alfajor':   ['golosinas', 'Alfajores Fantoche', '🍪'],
    'Chocolate': ['golosinas', 'Chocolates',         '🍫'],
    'Caramelo':  ['snacks',    'Caramelos',          '🍬'],
    'Chicle':    ['snacks',    'Chicles',            '🫧'],
    'Cereal':    ['snacks',    'Cereales',           '🥣'],
    'Snacks':    ['snacks',    'Snacks salados',     '🍿'],
    'Jugo':      ['gaseosas',  'Jugos',              '🧃'],
    'Gaseosa':   ['gaseosas',  'Gaseosas',           '🥤']
};

const LEADING_TOKENS = ['caramelo', 'chicle', 'gaseosa', 'jugo', 'cereal',
    'chupetin', 'bocadito', 'medallon', 'bombonera'];

// =============================================================
// HELPERS
// =============================================================
function $(id) { return document.getElementById(id); }

function showToast(msg, kind = '') {
    const t = $('toast');
    t.className = 'toast' + (kind ? (' toast-' + kind) : '');
    t.textContent = msg;
    requestAnimationFrame(() => t.classList.add('show'));
    clearTimeout(showToast._t);
    showToast._t = setTimeout(() => t.classList.remove('show'), 2400);
}

function normalize(s) {
    s = String(s || '').toLowerCase().trim();
    s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    s = s.replace(/\([^)]*\)/g, ' ');
    s = s.replace(/\b\d+[\.,]?\d*\s*(g|gr|kg|ml|cc|l)\b/g, ' ');
    s = s.replace(/[^a-z0-9 ]/g, ' ');
    return s.replace(/\s+/g, ' ').trim();
}

function coreTokens(s) {
    let n = normalize(s).split(' ').filter(Boolean);
    while (n.length && LEADING_TOKENS.includes(n[0])) n.shift();
    return new Set(n);
}

function matchScore(a, b) {
    const ta = coreTokens(a), tb = coreTokens(b);
    if (!ta.size || !tb.size) return 0;
    let inter = 0;
    ta.forEach(t => { if (tb.has(t)) inter++; });
    const union = ta.size + tb.size - inter;
    return inter / union;
}

function slugify(s) {
    let n = normalize(s);
    n = n.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return n.slice(0, 60);
}

function uniqueId(base) {
    let id = base, n = 1;
    const taken = new Set(products.map(p => p.id));
    while (taken.has(id)) {
        n++;
        id = `${base}-${n}`;
    }
    return id;
}

function emptyProduct() {
    nextLocalId++;
    return {
        codigo: '',
        id: 'nuevo-' + Date.now() + '-' + nextLocalId,
        categoria: 'golosinas',
        subcategoria: '',
        nombre: '',
        descripcion: '',
        precio: 0,
        precioPack: null,     // precio total del pack (ej: 1200 para "2 por $1200")
        cantidadPack: null,   // cantidad de unidades del pack (ej: 2). null = pack cerrado
        stock: 10,
        imagen: '',
        emoji: '🍬',
        destacado: false,
        activo: true,
        videoId: null,
        notas: ''
    };
}

// =============================================================
// CARGA: productos.json existente
// =============================================================
async function loadJson() {
    let data = null;
    try {
        const res = await fetch('data/productos.json?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        data = await res.json();
    } catch (err) {
        // Fallback: si abren el admin sin servidor, usamos el JS embebido
        if (window.FALAHBAR_PRODUCTS_DATA) {
            data = window.FALAHBAR_PRODUCTS_DATA;
            console.warn('[Admin] fetch falló, usando productos.js embebido', err);
        } else {
            console.error(err);
            showToast('No se pudo leer productos.json. Empezá vacío e importá un Excel.', 'error');
            return;
        }
    }
    products = (data.productos || []).map(p => ({ ...emptyProduct(), ...p }));
    renderTable();
    showToast(`✅ ${products.length} productos cargados`, 'ok');
}

// =============================================================
// IMPORTAR EXCEL/CSV y FUSIONAR
// =============================================================
function parseFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target.result);
                const wb = XLSX.read(data, { type: 'array' });
                const sheet = wb.Sheets[wb.SheetNames[0]];
                const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
                resolve(rows);
            } catch (err) { reject(err); }
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

// Toma una fila del Excel y la "normaliza" a un objeto producto homogéneo.
// Acepta tanto el formato del profe (Código, Categoría, Nombre del producto…)
// como un CSV exportado desde acá (codigo, categoria, nombre…).
function rowToProduct(row) {
    // Buscar el valor por varias posibles claves (con/sin acento, may/min)
    const get = (...keys) => {
        for (const k of keys) {
            for (const rk of Object.keys(row)) {
                if (rk.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                    === k.toLowerCase()) {
                    return row[rk];
                }
            }
        }
        return '';
    };

    const codigo  = String(get('codigo', 'codigo', 'code') || '').trim();
    const nombre  = String(get('nombre del producto', 'nombre', 'producto') || '').trim();
    const cat     = String(get('categoria', 'categoría') || '').trim();
    const sub     = String(get('subcategoria', 'subcategoría') || '').trim();
    const precio  = Number(get('precio', 'price') || 0) || 0;
    const stock   = Number(get('stock') || 10);
    const imagen  = String(get('imagen', 'img', 'foto') || '').trim();
    const emoji   = String(get('emoji') || '').trim();
    const notas   = String(get('notas', 'nota') || '').trim();
    const activo  = String(get('activo') || '').toLowerCase();

    // Si la "categoría" coincide con el formato del Excel del profe,
    // la mapeamos a la web. Si no, la dejamos como está.
    let webCat = cat.toLowerCase();
    let webSub = sub;
    let defaultEmoji = emoji;
    if (CATEGORY_MAP[cat]) {
        const [c, s, em] = CATEGORY_MAP[cat];
        webCat = c;
        if (!webSub) webSub = s;
        if (!defaultEmoji) defaultEmoji = em;
    }
    if (!CATEGORIAS.includes(webCat)) {
        webCat = 'snacks'; // fallback razonable
    }

    return {
        codigo,
        nombre,
        categoria: webCat,
        subcategoria: webSub,
        precio,
        stock: Number.isFinite(stock) ? stock : 10,
        imagen,
        emoji: defaultEmoji || '🍬',
        notas,
        activo: activo === '' ? true : !(activo === 'false' || activo === '0' || activo === 'no')
    };
}

async function importFile(file) {
    if (!file) return;
    try {
        const rows = await parseFile(file);
        if (!rows.length) {
            showToast('El archivo parece estar vacío.', 'error');
            return;
        }
        const importados = rows
            .map(rowToProduct)
            .filter(p => p.nombre);    // descartar filas sin nombre

        // ----- FUSIONAR con productos actuales -----
        // Para cada importado, buscamos el mejor match en lo que ya tenemos
        // (por nombre normalizado). Si el score es razonable, conservamos
        // los datos editables (precio, stock, imagen, emoji, videoId, descripcion).
        const usedExisting = new Set();
        const merged = [];

        importados.forEach(imp => {
            let best = -1;
            let bestScore = 0;
            for (let i = 0; i < products.length; i++) {
                if (usedExisting.has(i)) continue;
                const score = matchScore(imp.nombre, products[i].nombre);
                if (score > bestScore) {
                    bestScore = score;
                    best = i;
                }
            }
            if (best >= 0 && bestScore >= 0.6) {
                usedExisting.add(best);
                const old = products[best];
                merged.push({
                    ...old,
                    codigo:       imp.codigo || old.codigo,
                    nombre:       imp.nombre,
                    categoria:    imp.categoria,
                    subcategoria: imp.subcategoria || old.subcategoria,
                    // editable: si el Excel trae algo, gana; si no, mantenemos lo viejo
                    precio:       imp.precio || old.precio,
                    stock:        Number.isFinite(imp.stock) ? imp.stock : old.stock,
                    imagen:       imp.imagen || old.imagen,
                    emoji:        imp.emoji  || old.emoji,
                    notas:        imp.notas  || old.notas
                });
            } else {
                merged.push({
                    ...emptyProduct(),
                    codigo:       imp.codigo,
                    id:           uniqueIdFor(imp.nombre, merged),
                    categoria:    imp.categoria,
                    subcategoria: imp.subcategoria || guessSubcategoria(imp),
                    nombre:       imp.nombre,
                    precio:       imp.precio,
                    stock:        imp.stock,
                    imagen:       imp.imagen,
                    emoji:        imp.emoji,
                    notas:        imp.notas
                });
            }
        });

        const eliminados = products.length - usedExisting.size;
        const nuevos     = merged.length - usedExisting.size;
        products = merged;

        renderTable();
        showToast(
            `✅ Importados ${importados.length}. Coincidencias: ${usedExisting.size}, ` +
            `nuevos: ${nuevos}, eliminados (no estaban en el archivo): ${eliminados}`,
            'ok'
        );
    } catch (err) {
        console.error(err);
        showToast('Error leyendo el archivo: ' + err.message, 'error');
    }
}

function uniqueIdFor(nombre, currentArr) {
    const taken = new Set([...products, ...currentArr].map(p => p.id));
    let base = slugify(nombre) || 'producto';
    let id = base, n = 1;
    while (taken.has(id)) { n++; id = `${base}-${n}`; }
    return id;
}

function guessSubcategoria(imp) {
    // Si no hay subcategoría, usá la del CATEGORY_MAP por defecto si la
    // categoría coincide con alguna conocida del Excel del profe.
    return '';
}

// =============================================================
// RENDER DE LA TABLA
// =============================================================
function renderTable() {
    const tbody = $('tbody');
    const search = ($('searchTable').value || '').toLowerCase().trim();
    const filterCat   = $('filterCat').value;
    const filterSub   = $('filterSub') ? $('filterSub').value : '';
    const filterStock = $('filterStock').value;
    const filterPrice = $('filterPrice') ? $('filterPrice').value : '';

    // Refrescar opciones del dropdown de subcategoría con las que existen ahora
    if ($('filterSub')) {
        const subs = [...new Set(products.map(p => p.subcategoria).filter(Boolean))].sort();
        const current = $('filterSub').value;
        $('filterSub').innerHTML = '<option value="">Todas las subcategorías</option>'
            + subs.map(s => `<option value="${escapeAttr(s)}" ${s === current ? 'selected' : ''}>${escapeAttr(s)}</option>`).join('');
    }

    const filtered = products.filter(p => {
        if (filterCat && p.categoria !== filterCat) return false;
        if (filterSub && p.subcategoria !== filterSub) return false;
        const stk = Number(p.stock) || 0;
        if (filterStock === '0'   && stk !== 0)      return false;
        if (filterStock === 'low' && (stk === 0 || stk > 3)) return false;
        if (filterStock === 'ok'  && stk === 0)      return false;
        const pr = Number(p.precio) || 0;
        if (filterPrice === '0'  && pr !== 0) return false;
        if (filterPrice === 'ok' && pr === 0) return false;
        if (search) {
            const hay = (p.nombre + ' ' + p.codigo + ' ' + p.subcategoria).toLowerCase();
            if (!hay.includes(search)) return false;
        }
        return true;
    });

    tbody.innerHTML = filtered.map((p, idx) => {
        const realIdx = products.indexOf(p);
        const stk = Number(p.stock) || 0;
        const pr  = Number(p.precio) || 0;
        const rowClass = [
            stk === 0 ? 'is-out-of-stock' : '',
            !p.activo ? 'is-inactive' : '',
            pr === 0 ? 'needs-price' : '',
            !p.imagen ? 'needs-image' : ''
        ].filter(Boolean).join(' ');

        return `
            <tr data-idx="${realIdx}" class="${rowClass}">
                <td class="col-codigo">
                    <input type="text" data-field="codigo" value="${escapeAttr(p.codigo)}">
                </td>
                <td>
                    <input type="text" data-field="nombre" value="${escapeAttr(p.nombre)}">
                </td>
                <td class="col-cat">
                    <select data-field="categoria">
                        ${CATEGORIAS.map(c => `
                            <option value="${c}" ${p.categoria === c ? 'selected' : ''}>
                                ${c.charAt(0).toUpperCase() + c.slice(1)}
                            </option>
                        `).join('')}
                    </select>
                </td>
                <td class="col-sub">
                    <input type="text" data-field="subcategoria" value="${escapeAttr(p.subcategoria)}">
                </td>
                <td class="col-precio">
                    <input type="number" data-field="precio" min="0" step="50" value="${Number(p.precio) || 0}">
                    <div class="pack-row" style="display:flex;gap:4px;margin-top:3px;">
                        <input type="number" data-field="cantidadPack" min="0" step="1" placeholder="x"
                            title="Cantidad del pack (ej: 2)"
                            style="width:42px;font-size:11px;padding:2px 4px;"
                            value="${Number(p.cantidadPack) > 0 ? p.cantidadPack : ''}">
                        <input type="number" data-field="precioPack" min="0" step="50" placeholder="pack $"
                            title="Precio total del pack (ej: 1200)"
                            style="flex:1;font-size:11px;padding:2px 4px;"
                            value="${Number(p.precioPack) > 0 ? p.precioPack : ''}">
                    </div>
                </td>
                <td class="col-stock">
                    <input type="number" data-field="stock" min="0" step="1" value="${Number.isFinite(p.stock) ? p.stock : 0}"
                        class="${stk === 0 ? 'row-stock-out' : ''}">
                </td>
                <td class="col-emoji">
                    <input type="text" data-field="emoji" maxlength="4" value="${escapeAttr(p.emoji)}">
                </td>
                <td>
                    <input type="text" data-field="imagen" placeholder="img/...jpg" value="${escapeAttr(p.imagen)}">
                </td>
                <td class="col-act">
                    <input type="checkbox" data-field="activo" ${p.activo ? 'checked' : ''}>
                </td>
                <td>
                    <input type="text" data-field="notas" value="${escapeAttr(p.notas || '')}">
                </td>
                <td class="col-actions">
                    <button class="btn-ghost" data-action="del" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    $('emptyState').style.display = products.length === 0 ? 'block' : 'none';
    updateSummary();
}

function escapeAttr(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function updateSummary() {
    $('sumTotal').textContent     = products.length;
    $('sumGolosinas').textContent = products.filter(p => p.categoria === 'golosinas').length;
    $('sumSnacks').textContent    = products.filter(p => p.categoria === 'snacks').length;
    $('sumGaseosas').textContent  = products.filter(p => p.categoria === 'gaseosas').length;
    $('sumSinStock').textContent  = products.filter(p => Number(p.stock) === 0).length;
    $('sumInactivos').textContent = products.filter(p => !p.activo).length;
}

// Edición inline: cualquier cambio en un input/select de la tabla actualiza
// el array products en memoria.
$('tbody').addEventListener('input', (e) => {
    const inp = e.target.closest('[data-field]');
    if (!inp) return;
    const tr  = inp.closest('tr');
    const idx = Number(tr.dataset.idx);
    if (!Number.isFinite(idx)) return;
    const field = inp.dataset.field;
    const p = products[idx];
    if (!p) return;
    let value = inp.value;

    if (inp.type === 'checkbox') value = inp.checked;
    else if (inp.type === 'number') {
        // Para los campos del pack, vacío = null (no hay promo); para el resto, vacío = 0.
        const isPackField = (field === 'precioPack' || field === 'cantidadPack');
        if (inp.value === '' && isPackField) {
            value = null;
        } else {
            value = Number(value);
            if (!Number.isFinite(value)) value = isPackField ? null : 0;
        }
    }
    p[field] = value;

    if (field === 'stock' || field === 'activo' || field === 'categoria') {
        updateSummary();
        // Actualizar clase visual de la fila (sin re-renderizar todo)
        tr.classList.toggle('is-out-of-stock', Number(p.stock) === 0);
        tr.classList.toggle('is-inactive', !p.activo);
        if (field === 'stock') {
            inp.classList.toggle('row-stock-out', Number(p.stock) === 0);
        }
    }
});

// Eliminar fila
$('tbody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="del"]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const idx = Number(tr.dataset.idx);
    if (!Number.isFinite(idx)) return;
    const p = products[idx];
    if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
    products.splice(idx, 1);
    renderTable();
    showToast('Producto eliminado', 'ok');
});

// =============================================================
// EXPORTAR
// =============================================================
function buildCleanProducts() {
    const numOrNull = (v) => {
        const n = Number(v);
        return Number.isFinite(n) && n > 0 ? n : null;
    };
    return products.map(p => ({
        codigo:        String(p.codigo || ''),
        id:            p.id || slugify(p.nombre),
        categoria:     p.categoria,
        subcategoria:  p.subcategoria || '',
        nombre:        p.nombre,
        descripcion:   p.descripcion || '',
        precio:        Number(p.precio) || 0,
        precioPack:    numOrNull(p.precioPack),
        cantidadPack:  numOrNull(p.cantidadPack),
        stock:         Number.isFinite(Number(p.stock)) ? Number(p.stock) : 0,
        imagen:        p.imagen || '',
        emoji:         p.emoji || '🍬',
        destacado:     !!p.destacado,
        activo:        p.activo !== false,
        videoId:       p.videoId == null ? null : p.videoId,
        notas:         p.notas || ''
    }));
}

function exportJson() {
    if (products.length === 0) {
        showToast('No hay productos para exportar.', 'error');
        return;
    }
    const out = {
        version: 3,
        actualizado: new Date().toISOString().slice(0, 10),
        productos: buildCleanProducts()
    };
    const jsonTxt = JSON.stringify(out, null, 2);
    download('productos.json', jsonTxt, 'application/json');

    // También descargo productos.js (fallback para abrir el sitio sin servidor)
    const jsTxt =
        '// Auto-generado a partir de productos.json\n' +
        '// Subí este archivo a data/productos.js junto con data/productos.json.\n' +
        'window.FALAHBAR_PRODUCTS_DATA = ' + jsonTxt + ';\n';
    download('productos.js', jsTxt, 'application/javascript');

    showToast(`✅ Descargados productos.json y productos.js (${products.length} items). Subí los dos a la carpeta data/.`, 'ok');
}

function exportCsv() {
    if (products.length === 0) return;
    const headers = ['codigo','id','categoria','subcategoria','nombre','precio','stock','imagen','emoji','activo','notas'];
    const rows = products.map(p => headers.map(h => csvEscape(p[h] == null ? '' : p[h])).join(','));
    const txt = headers.join(',') + '\n' + rows.join('\n');
    download('productos.csv', txt, 'text/csv');
    showToast('✅ Descargado productos.csv', 'ok');
}

function csvEscape(s) {
    s = String(s);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
        return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
}

function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime + ';charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 200);
}

function previewJson() {
    const out = { version: 1, actualizado: new Date().toISOString().slice(0,10), productos: buildCleanProducts() };
    $('modalTitle').textContent = 'Vista previa de productos.json';
    $('modalText').textContent  = `${out.productos.length} productos. Copialo con ⌘/Ctrl+A → ⌘/Ctrl+C.`;
    const pre = $('modalPre');
    pre.style.display = 'block';
    pre.textContent = JSON.stringify(out, null, 2);
    $('modalConfirm').style.display = 'none';
    $('modalCancel').textContent = 'Cerrar';
    $('modal').classList.add('show');
}

// =============================================================
// EVENTOS DE BOTONES
// =============================================================
$('btnLoadJson').addEventListener('click', loadJson);
$('btnAdd').addEventListener('click', () => {
    products.unshift(emptyProduct());
    renderTable();
});
$('fileImport').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importFile(file);
    e.target.value = '';
});
$('btnReset').addEventListener('click', () => {
    if (!products.length) return;
    if (!confirm('¿Vaciar la tabla? Esto NO toca el JSON publicado.')) return;
    products = [];
    renderTable();
});
$('btnExportJson').addEventListener('click', exportJson);
$('btnExportCsv').addEventListener('click', exportCsv);
$('btnPreview').addEventListener('click', previewJson);

// Filtros / búsqueda
['searchTable', 'filterCat', 'filterSub', 'filterStock', 'filterPrice'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('input', renderTable);
});

// Modal
$('modalCancel').addEventListener('click', () => $('modal').classList.remove('show'));
$('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') $('modal').classList.remove('show');
});

// (la llamada inicial a loadJson + loadVideosJson se hace al final
//  del archivo, en una función boot() async para serializarlas)


/* =============================================================
 * SECCIÓN DE VIDEOS
 * Lista editable, sincroniza con productos (linkeo bidireccional)
 * y exporta videos.json + videos.js.
 * ============================================================= */

let videos = [];
let nextVideoId = 1;

function emptyVideo() {
    return {
        id: getNextVideoId(),
        titulo: '',
        tipo: 'mp4',          // mp4 | embed | link
        videoUrl: '',
        embedUrl: '',
        linkExterno: '',
        thumbnail: '',
        productoId: '',
        mostrarEnHome: false,
        ordenHome: 99,
        activo: true
    };
}

function getNextVideoId() {
    const used = new Set(videos.map(v => Number(v.id) || 0));
    let id = 1;
    while (used.has(id)) id++;
    nextVideoId = id + 1;
    return id;
}

// ------- TABS -------
document.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab-btn[data-tab]');
    if (!tab) return;
    const target = tab.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === tab));
    document.querySelectorAll('.tab-panel').forEach(p => {
        p.classList.toggle('active', p.id === 'tab-' + target);
    });
    // Si entran a la tab de videos por primera vez, cargamos
    if (target === 'videos' && !videos.length && window.FALAHBAR_VIDEOS_DATA) {
        loadVideosJson();
    }
});

// ------- CARGAR videos.json -------
async function loadVideosJson() {
    let data = null;
    try {
        const res = await fetch('data/videos.json?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        data = await res.json();
    } catch (err) {
        if (window.FALAHBAR_VIDEOS_DATA) {
            data = window.FALAHBAR_VIDEOS_DATA;
        } else {
            showToast('No se pudo leer videos.json. Empezá vacío y agregá videos.', 'error');
            return;
        }
    }
    videos = (data.videos || []).map(v => ({ ...emptyVideo(), ...v }));
    renderVideoTable();
    showToast(`✅ ${videos.length} videos cargados`, 'ok');
}

// ------- RENDER TABLA -------
function renderVideoTable() {
    const tbody = $('videoTbody');
    if (!tbody) return;

    if (videos.length === 0) {
        tbody.innerHTML = '';
        $('videoEmptyState').style.display = 'block';
        updateVideoSummary();
        return;
    }
    $('videoEmptyState').style.display = 'none';

    // Opciones del dropdown de productos vinculados
    const productOptions = ['<option value="">— Sin vincular —</option>']
        .concat(products
            .slice()
            .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''))
            .map(p => `<option value="${escapeAttr(p.id)}">${escapeAttr(p.nombre)}</option>`)
        ).join('');

    tbody.innerHTML = videos.map((v, idx) => {
        const tipoMp4   = v.tipo === 'mp4'   ? 'checked' : '';
        const tipoEmbed = v.tipo === 'embed' ? 'checked' : '';
        const tipoLink  = v.tipo === 'link'  ? 'checked' : '';

        // URL relevante según tipo
        const urlValue = v.tipo === 'embed' ? v.embedUrl
                       : v.tipo === 'link'  ? v.linkExterno
                       : v.videoUrl;
        const urlPlaceholder = v.tipo === 'embed' ? 'https://www.youtube.com/embed/XXXXX'
                             : v.tipo === 'link'  ? 'https://www.instagram.com/p/XXXX/'
                             : 'short1.mp4 (lo subís a videos/)';

        // Miniatura: si hay video MP4 propio, podemos mostrarlo; si hay thumbnail, mostrarla
        let thumbHTML = '🎬';
        if (v.thumbnail) {
            const tsrc = v.thumbnail.includes('/') ? v.thumbnail : 'img/' + v.thumbnail;
            thumbHTML = `<img src="${escapeAttr(tsrc)}" onerror="this.parentElement.textContent='🎬'">`;
        } else if (v.tipo === 'mp4' && v.videoUrl) {
            const vsrc = v.videoUrl.includes('/') ? v.videoUrl : 'videos/' + v.videoUrl;
            thumbHTML = `<video src="${escapeAttr(vsrc)}" muted preload="metadata" onerror="this.parentElement.textContent='🎬'"></video>`;
        }

        // Buscar nombre del producto vinculado
        const linked = v.productoId
            ? products.find(p => p.id === v.productoId)
            : null;

        return `
            <tr data-vidx="${idx}" class="${v.activo ? '' : 'is-inactive'}">
                <td class="col-codigo">
                    <input type="number" data-vfield="id" min="1" step="1" value="${Number(v.id) || ''}">
                </td>
                <td>
                    <input type="text" data-vfield="titulo" value="${escapeAttr(v.titulo)}" placeholder="Ej: Unboxing alfajores">
                </td>
                <td>
                    <div class="type-radio">
                        <input type="radio" name="vtype-${idx}" id="vt-mp4-${idx}"   data-vfield="tipo" value="mp4"   ${tipoMp4}>
                        <label for="vt-mp4-${idx}">MP4</label>
                        <input type="radio" name="vtype-${idx}" id="vt-emb-${idx}"   data-vfield="tipo" value="embed" ${tipoEmbed}>
                        <label for="vt-emb-${idx}">Embed</label>
                        <input type="radio" name="vtype-${idx}" id="vt-link-${idx}"  data-vfield="tipo" value="link"  ${tipoLink}>
                        <label for="vt-link-${idx}">Link</label>
                    </div>
                </td>
                <td>
                    <input type="text" data-vfield="url"
                           value="${escapeAttr(urlValue)}"
                           placeholder="${escapeAttr(urlPlaceholder)}">
                </td>
                <td>
                    <div style="display:flex; gap:8px; align-items:center;">
                        <span class="video-thumb">${thumbHTML}</span>
                        <input type="text" data-vfield="thumbnail" value="${escapeAttr(v.thumbnail)}" placeholder="(opcional)">
                    </div>
                </td>
                <td>
                    <select data-vfield="productoId">
                        ${productOptions.replace(`value="${escapeAttr(v.productoId)}"`,
                                                 `value="${escapeAttr(v.productoId)}" selected`)}
                    </select>
                    ${linked ? `<small style="color: var(--admin-muted); font-size:0.75rem;">✔ ${escapeAttr(linked.nombre)}</small>` : ''}
                </td>
                <td class="col-act">
                    <input type="checkbox" data-vfield="mostrarEnHome" ${v.mostrarEnHome ? 'checked' : ''}>
                </td>
                <td class="col-stock">
                    <input type="number" data-vfield="ordenHome" min="0" step="1" value="${Number(v.ordenHome) || 0}">
                </td>
                <td class="col-act">
                    <input type="checkbox" data-vfield="activo" ${v.activo ? 'checked' : ''}>
                </td>
                <td class="col-actions">
                    <button class="btn-ghost" data-vaction="del" title="Eliminar">🗑️</button>
                </td>
            </tr>
        `;
    }).join('');

    updateVideoSummary();
}

function updateVideoSummary() {
    $('vSumTotal').textContent    = videos.length;
    $('vSumHome').textContent     = videos.filter(v => v.mostrarEnHome && v.activo).length;
    $('vSumLinked').textContent   = videos.filter(v => v.productoId).length;
    $('vSumInactive').textContent = videos.filter(v => !v.activo).length;
}

// ------- EDICIÓN INLINE -------
$('videoTbody').addEventListener('input', (e) => {
    const inp = e.target.closest('[data-vfield]');
    if (!inp) return;
    const tr = inp.closest('tr');
    const idx = Number(tr.dataset.vidx);
    const v = videos[idx];
    if (!v) return;

    const field = inp.dataset.vfield;
    let value = inp.value;

    if (inp.type === 'checkbox')   value = inp.checked;
    else if (inp.type === 'number') value = Number(value);
    else if (inp.type === 'radio') {
        // Nombre name= "vtype-IDX"
        if (!inp.checked) return;
    }

    // Casos especiales
    if (field === 'url') {
        // Lo guardo en el campo correspondiente al tipo actual
        if (v.tipo === 'embed') v.embedUrl = value;
        else if (v.tipo === 'link') v.linkExterno = value;
        else v.videoUrl = value;
    } else if (field === 'tipo') {
        v.tipo = value;
        // re-render para que la URL se ajuste (placeholder + valor del campo correcto)
        renderVideoTable();
        return;
    } else if (field === 'productoId') {
        // ----- LINKEO BIDIRECCIONAL -----
        // Si este video estaba vinculado a otro producto, le sacamos el videoId.
        const oldProductoId = v.productoId;
        if (oldProductoId) {
            const oldP = products.find(p => p.id === oldProductoId);
            if (oldP && Number(oldP.videoId) === Number(v.id)) {
                oldP.videoId = null;
            }
        }
        v.productoId = value;
        // Y si elegimos un producto, le ponemos este videoId
        if (value) {
            const newP = products.find(p => p.id === value);
            if (newP) newP.videoId = Number(v.id) || null;
        }
        renderVideoTable();
        renderTable();
        return;
    } else if (field === 'id') {
        // Cambio de id: actualizar productos que apuntaban al viejo id
        const oldId = v.id;
        const newId = Number(value);
        if (Number.isFinite(newId) && newId > 0 && oldId !== newId) {
            products.forEach(p => {
                if (Number(p.videoId) === Number(oldId)) p.videoId = newId;
            });
            v.id = newId;
        }
    } else {
        v[field] = value;
    }

    if (field === 'mostrarEnHome' || field === 'activo') {
        tr.classList.toggle('is-inactive', !v.activo);
        updateVideoSummary();
    }
});

// Tipo (radio) — el evento change dispara cuando se marca
$('videoTbody').addEventListener('change', (e) => {
    const inp = e.target;
    if (inp.dataset.vfield !== 'tipo' || !inp.checked) return;
    const tr = inp.closest('tr');
    const idx = Number(tr.dataset.vidx);
    const v = videos[idx];
    if (!v) return;
    v.tipo = inp.value;
    renderVideoTable();
});

// Eliminar fila
$('videoTbody').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-vaction="del"]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const idx = Number(tr.dataset.vidx);
    const v = videos[idx];
    if (!confirm(`¿Eliminar el video "${v.titulo || 'sin título'}"?`)) return;
    // Si tenía producto vinculado, sacarle el videoId
    if (v.productoId) {
        const p = products.find(x => x.id === v.productoId);
        if (p && Number(p.videoId) === Number(v.id)) p.videoId = null;
    }
    videos.splice(idx, 1);
    renderVideoTable();
    renderTable();
    showToast('Video eliminado', 'ok');
});

// ------- BOTONES -------
$('btnLoadVideos').addEventListener('click', loadVideosJson);
$('btnAddVideo').addEventListener('click', () => {
    videos.push(emptyVideo());
    renderVideoTable();
});
$('btnResetVideos').addEventListener('click', () => {
    if (!videos.length) return;
    if (!confirm('¿Vaciar la tabla de videos? Esto NO toca el JSON publicado.')) return;
    videos = [];
    renderVideoTable();
});

// ------- EXPORTAR -------
function buildCleanVideos() {
    return videos.map(v => ({
        id:            Number(v.id) || 0,
        titulo:        v.titulo || '',
        tipo:          v.tipo || 'mp4',
        videoUrl:      v.tipo === 'mp4'   ? (v.videoUrl || '')    : '',
        embedUrl:      v.tipo === 'embed' ? (v.embedUrl || '')    : '',
        linkExterno:   v.tipo === 'link'  ? (v.linkExterno || '') : '',
        thumbnail:     v.thumbnail || '',
        productoId:    v.productoId || '',
        mostrarEnHome: !!v.mostrarEnHome,
        ordenHome:     Number(v.ordenHome) || 99,
        activo:        v.activo !== false
    }));
}

$('btnExportVideos').addEventListener('click', () => {
    if (!videos.length) {
        showToast('No hay videos para exportar.', 'error');
        return;
    }
    const out = {
        version: 1,
        actualizado: new Date().toISOString().slice(0, 10),
        videos: buildCleanVideos()
    };
    const jsonTxt = JSON.stringify(out, null, 2);
    download('videos.json', jsonTxt, 'application/json');

    const jsTxt =
        '// Auto-generado a partir de videos.json\n' +
        '// Subí este archivo a data/videos.js junto con data/videos.json.\n' +
        'window.FALAHBAR_VIDEOS_DATA = ' + jsonTxt + ';\n';
    download('videos.js', jsTxt, 'application/javascript');

    showToast(`✅ Descargados videos.json y videos.js (${videos.length}). Subilos a data/.`, 'ok');
});

$('btnPreviewVideos').addEventListener('click', () => {
    const out = { version: 1, actualizado: new Date().toISOString().slice(0,10), videos: buildCleanVideos() };
    $('modalTitle').textContent = 'Vista previa de videos.json';
    $('modalText').textContent  = `${out.videos.length} videos.`;
    $('modalPre').style.display = 'block';
    $('modalPre').textContent = JSON.stringify(out, null, 2);
    $('modalConfirm').style.display = 'none';
    $('modalCancel').textContent = 'Cerrar';
    $('modal').classList.add('show');
});

// =============================================================
// MEJORAS DE EXPERIENCIA DE USUARIO DEL ADMIN
// =============================================================

// 1) Persistir cuál tab estaba activa cuando recargo la página
const TAB_KEY = 'falahbar_admin_tab';
function restoreActiveTab() {
    try {
        const saved = localStorage.getItem(TAB_KEY);
        if (saved && (saved === 'productos' || saved === 'videos')) {
            const btn = document.querySelector(`.tab-btn[data-tab="${saved}"]`);
            if (btn) btn.click();
        }
    } catch (_) {}
}
document.addEventListener('click', (e) => {
    const tab = e.target.closest('.tab-btn[data-tab]');
    if (tab) {
        try { localStorage.setItem(TAB_KEY, tab.dataset.tab); } catch (_) {}
    }
}, true);

// 2) Resetear el modal (botón Confirm/Cancel) cada vez que se cierra
function resetAdminModal() {
    $('modalConfirm').style.display = '';
    $('modalCancel').textContent    = 'Cancelar';
    $('modalPre').style.display     = 'none';
    $('modalPre').textContent       = '';
}
$('modal').addEventListener('transitionend', () => {
    if (!$('modal').classList.contains('show')) resetAdminModal();
});
// Y también al cancel
$('modalCancel').addEventListener('click', () => {
    setTimeout(resetAdminModal, 300);
});

// 3) Validar IDs únicos de video al exportar
function validateVideoIds() {
    const seen = new Map();
    let hasError = false;
    videos.forEach((v, idx) => {
        const id = Number(v.id);
        if (!Number.isFinite(id) || id <= 0) {
            hasError = true;
            return;
        }
        if (seen.has(id)) {
            hasError = true;
        } else {
            seen.set(id, idx);
        }
    });
    return !hasError;
}

// Wrapper del export de videos con validación y warning si >5 en home
const _origExport = $('btnExportVideos').onclick;
$('btnExportVideos').addEventListener('click', (e) => {
    if (!validateVideoIds()) {
        showToast('⚠️ Hay videos con ID duplicado o vacío. Arreglá eso antes de exportar.', 'error');
        e.stopImmediatePropagation();
        return;
    }
    const enHome = videos.filter(v => v.mostrarEnHome && v.activo).length;
    if (enHome > 5) {
        if (!confirm(`Tenés ${enHome} videos marcados "🏠 En inicio", pero el home solo muestra los primeros 5 (por orden). ¿Continuar igual?`)) {
            e.stopImmediatePropagation();
            return;
        }
    }
    if (enHome === 0) {
        if (!confirm('No hay videos marcados "🏠 En inicio". El home va a mostrar solo placeholders "Más videos pronto". ¿Continuar?')) {
            e.stopImmediatePropagation();
            return;
        }
    }
}, true); // capture phase para correr antes que el listener de export

// 4) Mostrar última fecha de actualización al cargar el JSON (info útil)
async function showJsonInfo() {
    try {
        const [pRes, vRes] = await Promise.allSettled([
            fetch('data/productos.json?v=' + Date.now(), { cache: 'no-store' }),
            fetch('data/videos.json?v=' + Date.now(),    { cache: 'no-store' })
        ]);
        let info = [];
        if (pRes.status === 'fulfilled' && pRes.value.ok) {
            const d = await pRes.value.json();
            info.push(`📦 Productos: ${d.productos?.length || 0} (actualizado ${d.actualizado || '—'})`);
        }
        if (vRes.status === 'fulfilled' && vRes.value.ok) {
            const d = await vRes.value.json();
            info.push(`🎬 Videos: ${d.videos?.length || 0} (actualizado ${d.actualizado || '—'})`);
        }
        if (info.length) {
            const banner = document.createElement('div');
            banner.style.cssText = 'background: var(--admin-cream); padding: 8px 16px; border-radius: 999px; margin-bottom: 16px; font-size: 0.85rem; color: var(--admin-brown-d); display: inline-block;';
            banner.textContent = info.join(' · ');
            const main = document.querySelector('main');
            if (main && !document.getElementById('jsonInfoBanner')) {
                banner.id = 'jsonInfoBanner';
                main.insertBefore(banner, main.firstChild);
            }
        }
    } catch (_) {}
}

// 5) Antes de cerrar la pestaña: avisar si hay cambios sin exportar
let lastExportedSnapshot = '';
function snapshotProductsAndVideos() {
    return JSON.stringify({
        p: products.map(p => p.id + p.nombre + p.precio + p.stock + p.imagen + p.activo),
        v: videos.map(v => v.id + v.titulo + v.tipo + v.videoUrl + v.embedUrl + v.linkExterno + v.productoId + v.mostrarEnHome + v.ordenHome + v.activo)
    });
}
window.addEventListener('beforeunload', (e) => {
    const current = snapshotProductsAndVideos();
    if (lastExportedSnapshot && current !== lastExportedSnapshot) {
        e.preventDefault();
        e.returnValue = '';
    }
});
// Marcamos que se exportó después de descargar
['btnExportJson', 'btnExportVideos'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('click', () => {
        // Pequeño delay para que se complete la descarga antes de marcar
        setTimeout(() => { lastExportedSnapshot = snapshotProductsAndVideos(); }, 100);
    });
});

// 6) AUTO-SAVE DEL DRAFT en localStorage
//    Si la pestaña se cierra sin exportar y el usuario vuelve más tarde,
//    le ofrecemos restaurar exactamente lo que estaba editando.
const DRAFT_KEY = 'falahbar_admin_draft_v1';
let saveDraftTimer = null;
function saveDraft() {
    clearTimeout(saveDraftTimer);
    saveDraftTimer = setTimeout(() => {
        try {
            const draft = {
                ts: Date.now(),
                products: products,
                videos: videos
            };
            localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch (_) {}
    }, 600);
}
// Cualquier input en la página guarda draft (con debounce)
document.addEventListener('input', saveDraft);

function offerRestoreDraft() {
    let raw;
    try { raw = localStorage.getItem(DRAFT_KEY); } catch (_) { return; }
    if (!raw) return;
    let draft;
    try { draft = JSON.parse(raw); } catch (_) { return; }
    if (!draft || (!draft.products && !draft.videos)) return;
    const minutos = Math.round((Date.now() - (draft.ts || 0)) / 60000);
    const cuandoTxt = minutos < 1 ? 'hace menos de un minuto'
                    : minutos < 60 ? `hace ${minutos} minutos`
                    : `hace ${Math.round(minutos / 60)} horas`;
    if (confirm(`Encontramos cambios sin exportar de ${cuandoTxt}. ¿Querés restaurarlos?`)) {
        if (Array.isArray(draft.products)) products = draft.products;
        if (Array.isArray(draft.videos))   videos   = draft.videos;
        renderTable();
        renderVideoTable();
        showToast('✅ Draft restaurado', 'ok');
    } else {
        try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
    }
}
// Cuando se exporta, limpiamos el draft (ya no hace falta)
['btnExportJson', 'btnExportVideos'].forEach(id => {
    const el = $(id);
    if (el) el.addEventListener('click', () => {
        setTimeout(() => {
            try { localStorage.removeItem(DRAFT_KEY); } catch (_) {}
        }, 200);
    });
});

// 7) ATAJO Ctrl+S / Cmd+S → exportar la pestaña activa
document.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    if (e.key !== 's' && e.key !== 'S') return;
    e.preventDefault();
    const activeTab = document.querySelector('.tab-btn.active')?.dataset.tab;
    if (activeTab === 'videos') {
        $('btnExportVideos')?.click();
    } else {
        $('btnExportJson')?.click();
    }
});

// 8) BULK ACTION: marcar precios 0 → preguntar valor y aplicar
function bulkSetPrices() {
    const sinPrecio = products.filter(p => Number(p.precio) === 0);
    if (sinPrecio.length === 0) {
        showToast('No hay productos con precio 0.', 'ok');
        return;
    }
    const valor = prompt(`Hay ${sinPrecio.length} productos con precio 0. ¿Qué precio les ponés a TODOS de una vez? (dejá vacío para cancelar)`);
    if (!valor) return;
    const num = Number(valor);
    if (!Number.isFinite(num) || num < 0) {
        showToast('Precio inválido.', 'error');
        return;
    }
    sinPrecio.forEach(p => { p.precio = num; });
    renderTable();
    showToast(`✅ ${sinPrecio.length} productos actualizados a $${num.toLocaleString('es-AR')}`, 'ok');
}

// Botón flotante para bulk: lo agregamos al DOM dinámicamente, junto al "Agregar"
(function injectBulkBtn() {
    const target = $('btnAdd')?.parentElement;
    if (!target) return;
    const btn = document.createElement('button');
    btn.className = 'btn btn-ghost';
    btn.innerHTML = '💲 Setear precios faltantes';
    btn.title = 'Pone el mismo precio a todos los productos que tengan precio 0';
    btn.addEventListener('click', bulkSetPrices);
    target.appendChild(btn);
})();

// =============================================================
// BOOT (orden serializado: productos primero, luego videos
//        para que el dropdown de "producto vinculado" funcione)
// =============================================================
(async function boot() {
    await loadJson();
    await loadVideosJson();
    restoreActiveTab();
    showJsonInfo();
    offerRestoreDraft();
    // Snapshot inicial: si el usuario no cambia nada, no avisa al cerrar
    lastExportedSnapshot = snapshotProductsAndVideos();
})();
