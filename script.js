// =============================================
// FALAHBAR.SnkS - LÓGICA DE LA TIENDA
// =============================================

// =============================================
// CATÁLOGO DE PRODUCTOS (data-driven)
// =============================================
// Los productos NO se escriben acá. Se cargan desde data/productos.json.
// Para editarlos, usá el panel admin (admin.html) o editá ese JSON directo.
//
// Estructura de cada producto en el JSON:
//   {
//     "codigo": "FAL003",
//     "id":     "alf-triple-choco",   // slug único usado por el carrito
//     "categoria":   "golosinas",     // golosinas | snacks | gaseosas
//     "subcategoria":"Chupetines",    // chip de filtro / título del modal
//     "nombre":      "...",
//     "descripcion": "",
//     "precio":      2500,
//     "stock":       10,              // 0 = sin stock (no se puede agregar)
//     "imagen":      "img/...jpg",    // si está vacío, se usa el emoji
//     "emoji":       "🍬",
//     "destacado":   false,
//     "activo":      true,            // false = no se renderiza
//     "videoId":     null,
//     "notas":       ""
//   }
// =============================================

const DESC_PLACEHOLDER = 'Descripción próximamente. Un clásico que no falla en Falahbar.SnkS 🍬';

// Estos arrays se llenan al cargar productos.json.
// Mantenemos los nombres antiguos (golosinas / snacks / gaseosas) para no
// romper el resto del código, pero ahora son "let" porque se reemplazan
// después del fetch.
let golosinas = [];
let snacks    = [];
let gaseosas  = [];
let allProducts = [];          // catálogo completo (las 3 listas concatenadas)

// Map auxiliar: id → producto. Se rebuildea al recargar el catálogo.
let productById = new Map();

// Adapta un producto del JSON al "shape" antiguo que el resto del JS espera
// (que usa `.grupo` en lugar de `.subcategoria`). Mantenemos los dos para
// compatibilidad con el código que ya estaba.
function adaptProduct(p) {
    return {
        ...p,
        grupo: p.subcategoria || p.grupo || ''
    };
}

// Convierte una ruta de imagen "corta" (ej: "fantoche-triple.jpg") en
// una ruta completa "img/productos/fantoche-triple.jpg". Si ya viene con
// "/" o es una URL absoluta, no la toca.
function resolveImagePath(img) {
    if (!img) return '';
    const s = String(img).trim();
    if (!s) return '';
    if (s.startsWith('http') || s.startsWith('/') || s.includes('/')) return s;
    return 'img/productos/' + s;
}

// Cargar el catálogo. Estrategia:
//   1) Probamos fetch a productos.json (es lo "live", actualizable desde el admin).
//   2) Si falla (típicamente abierto con file://), caemos al objeto global
//      window.FALAHBAR_PRODUCTS_DATA que viene de data/productos.js.
async function loadCatalog() {
    let data = null;
    try {
        const res = await fetch('data/productos.json?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        data = await res.json();
    } catch (err) {
        console.warn('[Falahbar] fetch productos.json falló (probable file://). Usando productos.js.', err);
        if (window.FALAHBAR_PRODUCTS_DATA) {
            data = window.FALAHBAR_PRODUCTS_DATA;
        }
    }

    const lista = (data && Array.isArray(data.productos)) ? data.productos : [];
    const visibles = lista
        .filter(p => p && p.activo !== false)
        .map(adaptProduct)
        .map(p => ({ ...p, imagen: resolveImagePath(p.imagen) }));

    golosinas = visibles.filter(p => p.categoria === 'golosinas');
    snacks    = visibles.filter(p => p.categoria === 'snacks');
    gaseosas  = visibles.filter(p => p.categoria === 'gaseosas');
    allProducts = visibles;
    productById = new Map(allProducts.map(p => [p.id, p]));

    if (!visibles.length) {
        console.error('[Falahbar] No se pudo cargar el catálogo. Verificá data/productos.js o servir con servidor.');
    }
}

// =============================================
// SHORTS / VIDEOS (data-driven)
// =============================================
// Los videos se editan desde admin.html (pestaña Videos) y se guardan
// en data/videos.json. Cada video tiene esta estructura:
//
//   {
//     id:            1,                           // id único, número
//     titulo:        "...",                       // texto en pantalla
//     tipo:          "mp4" | "embed" | "link",   // formato del video
//     videoUrl:      "videos/short1.mp4",        // si tipo=mp4
//     embedUrl:      "https://youtube.com/embed/XXX",  // si tipo=embed
//     linkExterno:   "https://www.instagram.com/p/XXX/", // si tipo=link
//     thumbnail:     "img/...",                  // miniatura opcional
//     productoId:    "alf-raul-simple-negro",   // id del producto vinculado, "" si ninguno
//     mostrarEnHome: true,                       // si va al carrusel del home
//     ordenHome:     1,                          // orden dentro del home
//     activo:        true                        // false = no se renderiza
//   }
// =============================================
let shortsData = [];           // se llena después del fetch
let shortsHomeData = [];       // subset filtrado para el preview del home

// Adaptador: convierte la forma "json" del video a la forma legacy que ya
// usaban renderShortCard / renderReelItem (con campos title, videoUrl, etc.).
function adaptVideo(v) {
    const out = {
        id: v.id,
        title: v.titulo,
        thumbnail: v.thumbnail || ''
    };
    if (v.tipo === 'embed' && v.embedUrl) {
        out.embedUrl = v.embedUrl;
    } else if (v.tipo === 'link' && v.linkExterno) {
        out.link = v.linkExterno;
    } else if (v.videoUrl) {
        // mp4 (default)
        out.videoUrl = v.videoUrl;
    } else if (v.linkExterno) {
        // fallback: si no hay videoUrl pero sí link, lo tratamos como link
        out.link = v.linkExterno;
    }
    return out;
}

async function loadVideos() {
    let data = null;
    try {
        const res = await fetch('data/videos.json?v=' + Date.now(), { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        data = await res.json();
    } catch (err) {
        if (window.FALAHBAR_VIDEOS_DATA) {
            data = window.FALAHBAR_VIDEOS_DATA;
        }
    }
    const list = (data && Array.isArray(data.videos)) ? data.videos : [];
    const visibles = list.filter(v => v && v.activo !== false);

    // Lista completa para shorts.html (feed inmersivo) — orden estable por id
    shortsData = visibles
        .slice()
        .sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0))
        .map(adaptVideo);

    // Subset para el preview del home: solo los marcados como mostrarEnHome,
    // ordenados por ordenHome.
    shortsHomeData = visibles
        .filter(v => v.mostrarEnHome !== false)
        .slice()
        .sort((a, b) => (Number(a.ordenHome) || 999) - (Number(b.ordenHome) || 999))
        .map(adaptVideo);
}

const WHATSAPP_NUMBER = '5493804653294';
const FREE_SHIPPING_THRESHOLD = 30000; // Envío gratis superando este monto

// =============================================
// STORAGE KEYS
// =============================================
const STORAGE_KEY_USER             = 'falahbar_snks_user_name';
const STORAGE_KEY_CART             = 'falahbar_snks_cart';
const STORAGE_KEY_MODAL_DISMISSED  = 'falahbar_snks_modal_dismissed';
const STORAGE_KEY_DELIVERY         = 'falahbar_snks_delivery';

// =============================================
// ESTADO DE ENTREGA (dirección + ubicación)
// Vive en memoria mientras la página está abierta y se persiste a localStorage.
// =============================================
let geoState = {
    link:    '',     // URL de Google Maps ya armada
    lat:     null,
    lng:     null,
    ready:   false   // true si tenemos coordenadas válidas
};
let deliveryState = {
    address:   '',
    reference: ''
};

// =============================================
// ESTADO DEL CARRITO (con persistencia)
// =============================================
let cart = [];

function saveCartToStorage() {
    try {
        localStorage.setItem(STORAGE_KEY_CART, JSON.stringify(cart));
    } catch (_) { /* storage puede estar deshabilitado */ }
}

function loadCartFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_CART);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return;

        // Validación de shape: en este punto el catálogo todavía no se cargó
        // (es asíncrono). Aceptamos cualquier id "razonable" — los ids que
        // ya no existan en el catálogo nuevo se limpian más tarde, en
        // bootCatalog(), una vez que tenemos productById poblado.
        cart = parsed.filter(item =>
            item && typeof item === 'object'
            && typeof item.id === 'string' && item.id.length > 0
            && typeof item.precio === 'number'
            && typeof item.qty === 'number' && item.qty > 0
        );

        if (cart.length !== parsed.length) {
            try { localStorage.setItem(STORAGE_KEY_CART, JSON.stringify(cart)); } catch (_) {}
        }
    } catch (_) {
        cart = [];
    }
}

loadCartFromStorage();

// =============================================
// RENDERIZAR PRODUCTOS (grilla plana + chips de filtro opcional)
// =============================================
function productCardHTML(p) {
    // Cada tarjeta es clickeable para abrir el modal de detalle.
    // El botón "Agregar" sigue funcionando por delegación y evita abrir
    // el modal al hacer click encima.
    const videoBadge = (p.videoId != null)
        ? `<span class="product-video-badge" aria-label="Tiene video" title="Tiene video">🎬</span>`
        : '';

    const stock      = Number.isFinite(p.stock) ? p.stock : 1;
    const sinStock   = stock <= 0;
    const stockLow   = stock > 0 && stock <= 3;

    // Visual del producto: si hay imagen real, mostramos <img>; si no, emoji.
    let mediaHTML;
    if (p.imagen) {
        mediaHTML = `
            <div class="product-media">
                <img class="product-img" src="${escapeHtml(p.imagen)}" alt="${escapeHtml(p.nombre)}"
                     loading="lazy" decoding="async"
                     onerror="this.parentElement.classList.add('product-media--fallback'); this.remove();">
                <div class="product-emoji product-emoji--inline" aria-hidden="true">${p.emoji || '🍬'}</div>
            </div>
        `;
    } else {
        mediaHTML = `
            <div class="product-emoji product-emoji--big" aria-hidden="true">${p.emoji || '🍬'}</div>
            <div class="product-photo-placeholder" aria-hidden="true">📷 Imagen pendiente</div>
        `;
    }

    // Etiqueta de stock
    let stockBadge = '';
    if (sinStock) {
        stockBadge = `<span class="stock-badge stock-badge--out">Sin stock</span>`;
    } else if (stockLow) {
        stockBadge = `<span class="stock-badge stock-badge--low">¡Quedan ${stock}!</span>`;
    }

    const btnHTML = sinStock
        ? `<button class="add-to-cart is-disabled" disabled aria-disabled="true">Sin stock</button>`
        : `<button class="add-to-cart" data-id="${escapeHtml(p.id)}" aria-label="Agregar ${escapeHtml(p.nombre)} al carrito">Agregar</button>`;

    // Precio: si es 0/null, lo mostramos como "Precio a consultar" en gris
    // (más amable que un "$0" pelado) y el botón pasa a "Consultar"
    const precioNum = Number(p.precio) || 0;
    const priceHTML = precioNum > 0
        ? `<div class="product-price">$${precioNum.toLocaleString('es-AR')}</div>`
        : `<div class="product-price product-price--pending">Precio a consultar</div>`;

    // Badge de promo / pack clickeable: agrega `cantidadPack` unidades de una.
    // Si no hay cantidadPack (pack cerrado sin cantidad), muestra el texto
    // pero no es clickeable.
    const promoText = formatPromoText(p);
    const cantPack  = Number(p.cantidadPack);
    let promoHTML = '';
    if (promoText && !sinStock) {
        if (Number.isFinite(cantPack) && cantPack >= 2) {
            promoHTML = `<button type="button" class="product-promo product-promo--btn"
                data-action="add-pack" data-id="${escapeHtml(p.id)}" data-pack-qty="${cantPack}"
                aria-label="Agregar ${cantPack} unidades de ${escapeHtml(p.nombre)} con descuento">${escapeHtml(promoText)}</button>`;
        } else {
            promoHTML = `<div class="product-promo">${escapeHtml(promoText)}</div>`;
        }
    }

    const sinPrecio = precioNum <= 0;
    const cardClasses = ['product-card'];
    if (sinStock)  cardClasses.push('is-out-of-stock');
    if (sinPrecio) cardClasses.push('is-no-price');

    return `
        <div class="${cardClasses.join(' ')}"
             data-product-id="${escapeHtml(p.id)}"
             data-product-group="${escapeHtml(p.grupo || '')}"
             data-product-stock="${stock}"
             role="button" tabindex="0"
             aria-label="Ver ${escapeHtml(p.nombre)}, ${precioNum > 0 ? '$' + precioNum : 'precio a consultar'}">
            ${videoBadge}
            ${stockBadge}
            ${mediaHTML}
            <h3>${escapeHtml(p.nombre)}</h3>
            ${priceHTML}
            ${promoHTML}
            ${btnHTML}
        </div>
    `;
}

/**
 * Formatea el texto del badge de promo/pack a partir de los campos
 * `precioPack` (precio total del pack) y `cantidadPack` (unidades del pack).
 * Devuelve string vacío si no hay promo válida.
 */
function formatPromoText(p) {
    const pp = Number(p.precioPack);
    const qty = Number(p.cantidadPack);
    if (!Number.isFinite(pp) || pp <= 0) return '';
    const ppFmt = pp.toLocaleString('es-AR');
    if (Number.isFinite(qty) && qty >= 2) {
        return `${qty} por $${ppFmt}`;
    }
    return `Pack: $${ppFmt}`;
}

/**
 * Calcula el subtotal de un ítem del carrito aplicando el descuento de pack.
 * Si tiene `precioPack` + `cantidadPack`, agrupa de a `cantidadPack` y cobra
 * `precioPack` por cada grupo; lo que sobra se cobra al precio unitario.
 *
 * Ejemplo: precio=1000, precioPack=1800, cantidadPack=2
 *   qty=1 → 1000   qty=2 → 1800   qty=3 → 2800   qty=4 → 3600
 */
function lineTotal(item) {
    const u   = Number(item.precio) || 0;
    const n   = Number(item.qty) || 0;
    const pp  = Number(item.precioPack);
    const qty = Number(item.cantidadPack);
    if (Number.isFinite(pp) && pp > 0 && Number.isFinite(qty) && qty >= 2 && n >= qty) {
        const packs  = Math.floor(n / qty);
        const extras = n % qty;
        return packs * pp + extras * u;
    }
    return n * u;
}

/**
 * Renderiza productos como una grilla plana en el contenedor.
 * @param {Array} list - Productos a renderizar.
 * @param {String} containerId - Id del div donde renderizar las tarjetas.
 * @param {Object} [options]
 * @param {String} [options.chipsContainerId] - Si se pasa, renderiza chips de filtro ahí
 *                                              usando el campo `grupo` de cada producto.
 */
function renderProducts(list, containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Lista vacía → placeholder "Próximamente"
    if (!list || list.length === 0) {
        container.innerHTML = `
            <div class="products-empty">
                <div class="products-empty-icon" aria-hidden="true">🕒</div>
                <h3>Próximamente</h3>
                <p>Estamos cargando los productos de esta sección. Muy pronto los vas a ver acá.</p>
            </div>
        `;
        // Si había chips de una lista anterior, limpiarlos
        if (options.chipsContainerId) {
            const chipsEl = document.getElementById(options.chipsContainerId);
            if (chipsEl) chipsEl.innerHTML = '';
        }
        return;
    }

    // Grilla plana, sin headers de subcategoría
    container.innerHTML = list.map(productCardHTML).join('');

    // Por defecto NO se muestran en la grilla los productos sin stock ni los
    // de "Precio a consultar" (precio = 0). El buscador los puede mostrar
    // al matchear nombre, o al buscar "sin stock".
    Array.from(container.querySelectorAll('.product-card.is-out-of-stock, .product-card.is-no-price')).forEach(card => {
        card.classList.add('is-hidden');
    });

    // Asignar --fx-card-index a cada tarjeta para el stagger de animación
    // (limito a las primeras 24 para que productos lejos no esperen demasiado)
    Array.from(container.querySelectorAll('.product-card:not(.is-hidden)')).forEach((card, i) => {
        card.style.setProperty('--fx-card-index', String(Math.min(i, 24)));
    });

    // Si pidieron chips de filtro, los armamos
    if (options.chipsContainerId) {
        renderSubgroupChips(list, options.chipsContainerId, containerId);
    }
}

/**
 * Chips de filtro por subgrupo (ej: Caramelos, Chicles…).
 * Click en un chip filtra visualmente las tarjetas del grid asociado.
 * Combina con la búsqueda de texto (clases is-hidden e is-hidden-filter).
 */
function renderSubgroupChips(list, chipsContainerId, gridContainerId) {
    const chipsContainer = document.getElementById(chipsContainerId);
    if (!chipsContainer) return;

    // Grupos únicos en orden de aparición
    const groups = [];
    const seen = new Set();
    list.forEach(p => {
        if (p.grupo && !seen.has(p.grupo)) {
            seen.add(p.grupo);
            groups.push(p.grupo);
        }
    });

    // Si solo hay un grupo (o ninguno), no tiene sentido mostrar chips
    if (groups.length <= 1) {
        chipsContainer.innerHTML = '';
        return;
    }

    const chipsHTML = [
        `<button type="button" class="filter-chip is-active" data-filter="*">Todos</button>`,
        ...groups.map(g =>
            `<button type="button" class="filter-chip" data-filter="${escapeHtml(g)}">${escapeHtml(g)}</button>`
        )
    ].join('');

    chipsContainer.innerHTML = chipsHTML;

    // Marcar que ya tiene listener (evitar múltiples bindings si se re-renderiza)
    if (chipsContainer.dataset.bound === '1') return;
    chipsContainer.dataset.bound = '1';

    chipsContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;

        const filter = chip.dataset.filter;
        const gridEl = document.getElementById(gridContainerId);
        if (!gridEl) return;

        chipsContainer.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('is-active'));
        chip.classList.add('is-active');

        // Animación SOLO en el botón clickeado: pulso corto y satisfactorio.
        // Las tarjetas cambian sin animación → respuesta instantánea.
        chip.classList.remove('is-tapped');
        // Forzar reflow para reiniciar la animación si el chip ya estaba "tapeado"
        const _ = chip.offsetWidth; void _;
        chip.classList.add('is-tapped');
        setTimeout(() => chip.classList.remove('is-tapped'), 380);

        // Aplicar el filtro directo, sin animar las tarjetas
        gridEl.querySelectorAll('.product-card').forEach(card => {
            const cardGroup = card.dataset.productGroup || '';
            const matches = filter === '*' || cardGroup === filter;
            card.classList.toggle('is-hidden-filter', !matches);
        });
    });
}

/**
 * Aplica un cambio de filtro con animación de salida + entrada escalonada.
 *
 * @param {HTMLElement} grid          El contenedor con .product-card adentro.
 * @param {String}      hideClass     Clase que oculta la tarjeta (ej: 'is-hidden' o 'is-hidden-filter').
 * @param {Function}    decideVisible Función (card) => bool. true si la tarjeta debe quedar visible.
 * @param {Object}      [opts]
 * @param {String}      [opts.mode='chip']  'chip' (más dramático) o 'search' (más rápido / sutil).
 */
function animatedFilter(grid, hideClass, decideVisible, opts = {}) {
    const reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const mode = opts.mode || 'chip';
    // Tiempos cortos para que se sienta snappy. La sensación que importa
    // es: "click → cambio inmediato", no esperar a que termine la animación.
    const exitMs   = mode === 'search' ? 70  : 110;  // espera antes de aplicar el hide real
    const enterCap = mode === 'search' ? 8   : 12;   // tope del índice para el stagger

    const cards = Array.from(grid.querySelectorAll('.product-card'));

    // Atajo: si el usuario tiene reduce-motion, hacemos el cambio sin animación
    if (reduceMotion) {
        cards.forEach(card => {
            card.classList.toggle(hideClass, !decideVisible(card));
        });
        return;
    }

    // 1) Decidimos antes de tocar nada
    const decisions = new Map();
    cards.forEach(card => {
        const wasVisible = !card.classList.contains(hideClass);
        const willShow   = decideVisible(card);
        decisions.set(card, { wasVisible, willShow });
    });

    // 2) Las que se van: marcar para que se animen "afuera"
    let anyExiting = false;
    cards.forEach(card => {
        const d = decisions.get(card);
        if (d.wasVisible && !d.willShow) {
            card.classList.add('is-rejecting');
            anyExiting = true;
        }
    });

    // Cancelamos timers previos para que filtros consecutivos no peleen
    if (grid._filterTimer) clearTimeout(grid._filterTimer);
    if (grid._restageTimer) clearTimeout(grid._restageTimer);

    const delay = anyExiting ? exitMs : 0;

    grid._filterTimer = setTimeout(() => {
        // 3) Aplicar el hide real y limpiar la clase de salida
        cards.forEach(card => {
            const d = decisions.get(card);
            card.classList.toggle(hideClass, !d.willShow);
            card.classList.remove('is-rejecting');
        });

        // 4) Restagger: las que quedan visibles vuelven a entrar
        const visibles = cards.filter(c =>
            !c.classList.contains('is-hidden') &&
            !c.classList.contains('is-hidden-filter')
        );

        visibles.forEach((card, i) => {
            card.style.setProperty('--fx-card-index', String(Math.min(i, enterCap)));
            card.classList.remove('is-restaging');
            // Forzar reflow para que la animación se reinicie
            // (asignar a una variable evita que el optimizador lo descarte)
            const _ = card.offsetWidth; void _;
            card.classList.add('is-restaging');
        });

        grid._restageTimer = setTimeout(() => {
            visibles.forEach(c => c.classList.remove('is-restaging'));
        }, mode === 'search' ? 450 : 600);
    }, delay);
}

// =============================================
// RENDERIZAR SHORTS (data-driven)
// =============================================
function escapeHtml(s) {
    return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function renderShortCard(item) {
    // Placeholder elegante
    if (!item || item.placeholder) {
        return `
            <div class="short-card short-card--placeholder" aria-hidden="true">
                <div class="short-placeholder">
                    <span class="short-placeholder-icon">🎬</span>
                    <span class="short-placeholder-text">Más videos muy pronto</span>
                </div>
            </div>
        `;
    }

    const title = item.title ? escapeHtml(item.title) : '';
    const caption = title ? `<div class="short-caption">${title}</div>` : '';

    // Embed externo (YouTube, etc.)
    if (item.embedUrl) {
        return `
            <div class="short-card">
                <iframe
                    src="${escapeHtml(item.embedUrl)}"
                    loading="lazy"
                    title="${title || 'Short Falahbar'}"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen></iframe>
                ${caption}
            </div>
        `;
    }

    // Video propio alojado (preview autoplay muteada + loop, tap para ver en Shorts)
    if (item.videoUrl) {
        const poster = item.thumbnail ? ` poster="${escapeHtml(item.thumbnail)}"` : '';
        // Pasamos el id del short en el hash para que shorts.html abra el video correcto.
        const hrefTarget = item.id != null ? `shorts.html#short-${encodeURIComponent(item.id)}` : 'shorts.html';
        return `
            <a class="short-card short-card--video" href="${hrefTarget}" aria-label="${title || 'Ver en Shorts'}">
                <video${poster} muted loop playsinline preload="metadata" autoplay>
                    <source src="${escapeHtml(item.videoUrl)}">
                </video>
                <span class="short-play-badge" aria-hidden="true">▶</span>
                ${caption || '<div class="short-caption short-caption--hint">Tocá para ver</div>'}
            </a>
        `;
    }

    // Solo miniatura (eventualmente con link a red social)
    if (item.thumbnail) {
        if (item.link) {
            return `
                <a class="short-card short-card--link" href="${escapeHtml(item.link)}" target="_blank" rel="noopener" aria-label="${title || 'Ver short'}">
                    <img src="${escapeHtml(item.thumbnail)}" alt="${title || 'Short Falahbar'}" loading="lazy">
                    ${caption}
                </a>
            `;
        }
        return `
            <div class="short-card">
                <img src="${escapeHtml(item.thumbnail)}" alt="${title || 'Short Falahbar'}" loading="lazy">
                ${caption}
            </div>
        `;
    }

    // Fallback
    return renderShortCard({ placeholder: true });
}

function renderShorts(containerId, { limit = null, minPlaceholders = 6, useHomeList = false } = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // En el home queremos solo los seleccionados ("mostrarEnHome").
    // En shorts.html queremos todo.
    const fuente = useHomeList ? shortsHomeData : shortsData;
    let items = fuente.slice();
    if (limit) items = items.slice(0, limit);

    // Rellenar con placeholders ("Más videos pronto") hasta el mínimo visual.
    // El placeholder SIEMPRE queda al final.
    const target = limit || minPlaceholders;
    while (items.length < target) {
        items.push({ placeholder: true });
    }

    container.innerHTML = items.map(renderShortCard).join('');
}

// =============================================
// RENDERIZAR REELS (feed vertical tipo TikTok / IG Reels)
// =============================================
function renderReelItem(item, index) {
    // Placeholder de "más videos pronto"
    if (item && item.placeholder) {
        return `
            <article class="reel reel--placeholder" data-index="${index}">
                <div class="reel-placeholder-inner">
                    <div class="reel-placeholder-icon">🎬</div>
                    <h3>Más videos muy pronto</h3>
                    <p>Seguinos para no perderte los próximos shorts.</p>
                    <a href="https://instagram.com/falahbar.snks" target="_blank" rel="noopener" class="btn btn-secondary">
                        Seguir en Instagram
                    </a>
                </div>
            </article>
        `;
    }

    // Tarjeta final
    if (item && item.endCard) {
        return `
            <article class="reel reel--end" data-index="${index}">
                <div class="reel-end-inner">
                    <img src="logo.png" alt="Falahbar.SnkS" class="reel-end-logo">
                    <h2>¡Gracias por mirar!</h2>
                    <p>Seguí explorando la web o hacé tu pedido en un click.</p>
                    <div class="reel-end-buttons">
                        <a href="index.html#golosinas" class="btn btn-primary">Ver productos</a>
                        <a href="index.html" class="btn btn-secondary">Ir al inicio</a>
                    </div>
                </div>
            </article>
        `;
    }

    // Reel real
    const title = item.title ? escapeHtml(item.title) : '';
    const poster = item.thumbnail ? ` poster="${escapeHtml(item.thumbnail)}"` : '';

    // Producto promocionado (primer producto cuyo videoId coincide con el id del short)
    const promoted = (item.id != null)
        ? allProducts.find(p => Number(p.videoId) === Number(item.id))
        : null;

    // CTA: si hay producto promocionado, abre su modal en home; si no, va a la sección golosinas
    const ctaHref = promoted
        ? `index.html#product-${encodeURIComponent(promoted.id)}`
        : 'index.html#golosinas';
    const ctaText = promoted
        ? `Ver ${escapeHtml(promoted.nombre)} →`
        : 'Ver productos →';

    // Acción del 🛒: si hay producto, suma ese producto al carrito; si no, va al carrito de home
    const cartActionHTML = promoted
        ? `<button class="reel-action" data-action="add-to-cart" data-product-id="${escapeHtml(promoted.id)}" data-tooltip="Agregar ${escapeHtml(promoted.nombre)} al carrito" aria-label="Agregar ${escapeHtml(promoted.nombre)} al carrito">
                <span class="reel-action-icon">🛒</span>
                <span class="reel-action-label">Agregar</span>
            </button>`
        : `<a class="reel-action" href="index.html#cart" data-tooltip="Ver mi carrito" aria-label="Ver carrito">
                <span class="reel-action-icon">🛒</span>
                <span class="reel-action-label">Carrito</span>
            </a>`;

    return `
        <article class="reel" data-index="${index}">
            <div class="reel-media">
                <video class="reel-video"${poster} muted loop playsinline preload="metadata" src="${escapeHtml(item.videoUrl)}"></video>
                <button class="reel-tap" aria-label="Pausar / Reproducir"></button>
                <div class="reel-play-indicator" aria-hidden="true">▶</div>
                <div class="reel-gradient"></div>

                <div class="reel-info">
                    <div class="reel-brand">
                        <img src="logo.png" alt="" class="reel-brand-logo">
                        <strong>Falahbar.SnkS</strong>
                    </div>
                    ${title ? `<p class="reel-title">${title}</p>` : ''}
                    <a href="${ctaHref}" class="reel-cta">${ctaText}</a>
                </div>

                <div class="reel-actions">
                    <button class="reel-action" data-action="mute" data-tooltip="Activar o silenciar sonido" aria-label="Activar o silenciar sonido">
                        <span class="reel-action-icon">🔇</span>
                        <span class="reel-action-label">Sonido</span>
                    </button>
                    <button class="reel-action" data-action="share" data-tooltip="Compartir este short" aria-label="Compartir">
                        <span class="reel-action-icon">📤</span>
                        <span class="reel-action-label">Compartir</span>
                    </button>
                    ${cartActionHTML}
                </div>
            </div>
        </article>
    `;
}

function renderReels(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const items = shortsData.slice();

    // Si hay menos de X videos, agregá un placeholder de "más pronto"
    if (shortsData.length < 6) {
        items.push({ placeholder: true });
    }

    // Card final de despedida
    items.push({ endCard: true });

    container.innerHTML = items.map((item, i) => renderReelItem(item, i)).join('');

    initReelsBehavior(container);
}

function initReelsBehavior(container) {
    const videos = Array.from(container.querySelectorAll('.reel-video'));
    if (!videos.length) {
        // Aún así enganchamos el hint
        setupReelsHint(container);
        return;
    }

    // --- Autoplay / pause según visibilidad ---
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const video = entry.target;
            if (entry.intersectionRatio >= 0.6) {
                const p = video.play();
                if (p && typeof p.catch === 'function') p.catch(() => {});
                video.closest('.reel').classList.add('reel--active');
                video.closest('.reel').classList.remove('reel--paused');
            } else {
                video.pause();
                video.closest('.reel').classList.remove('reel--active');
            }
        });
    }, {
        root: container,
        threshold: [0, 0.25, 0.5, 0.6, 0.75, 1]
    });

    videos.forEach(v => io.observe(v));

    // --- Estado global de sonido ---
    let globalMuted = true;

    function updateMuteIcons() {
        container.querySelectorAll('[data-action="mute"] .reel-action-icon').forEach(icon => {
            icon.textContent = globalMuted ? '🔇' : '🔊';
        });
        container.querySelectorAll('[data-action="mute"]').forEach(btn => {
            btn.classList.toggle('is-unmuted', !globalMuted);
        });
    }

    // --- Clicks dentro del feed ---
    container.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('[data-action]');
        if (actionBtn) {
            const action = actionBtn.dataset.action;

            if (action === 'mute') {
                e.preventDefault();
                globalMuted = !globalMuted;
                videos.forEach(v => { v.muted = globalMuted; });
                updateMuteIcons();
                return;
            }

            if (action === 'add-to-cart') {
                e.preventDefault();
                const pid = actionBtn.dataset.productId;
                if (pid) {
                    // Solo mostramos el feedback dorado si efectivamente se agregó
                    // (addToCart se rehúsa silenciosamente si está sin stock).
                    const product = findProduct(pid);
                    const stock   = product && Number.isFinite(product.stock) ? product.stock : 1;
                    const yaEnCart = (cart.find(i => i.id === pid)?.qty) || 0;
                    const podemos  = product && stock > 0 && yaEnCart < stock;

                    addToCart(pid, actionBtn);

                    if (podemos) {
                        actionBtn.classList.remove('reel-action--added');
                        void actionBtn.offsetWidth;
                        actionBtn.classList.add('reel-action--added');
                        setTimeout(() => actionBtn.classList.remove('reel-action--added'), 700);
                    }
                }
                return;
            }

            if (action === 'share') {
                e.preventDefault();
                const reel = actionBtn.closest('.reel');
                const title = reel.querySelector('.reel-title')?.textContent || 'Shorts Falahbar';
                const pageUrl = window.location.origin + window.location.pathname;
                const shareText = `Mirá este short de Falahbar.SnkS: ${title}`;

                if (navigator.share) {
                    navigator.share({
                        title: 'Falahbar.SnkS',
                        text: shareText,
                        url: pageUrl
                    }).catch(() => {
                        // Fallback a WhatsApp si el share nativo falla
                        window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + pageUrl)}`, '_blank');
                    });
                } else {
                    window.open(`https://wa.me/?text=${encodeURIComponent(shareText + ' ' + pageUrl)}`, '_blank');
                }
                return;
            }
        }

        // Tap sobre el video = pausa / reproduce
        const tap = e.target.closest('.reel-tap');
        if (tap) {
            const reel = tap.closest('.reel');
            const video = reel && reel.querySelector('.reel-video');
            if (!video) return;
            if (video.paused) {
                video.play().catch(() => {});
                reel.classList.remove('reel--paused');
            } else {
                video.pause();
                reel.classList.add('reel--paused');
            }
        }
    });

    setupReelsHint(container);
}

function setupReelsHint(container) {
    const hint = document.getElementById('reelsHint');
    if (!hint) return;

    // Mostrar el hint solo la primera vez que se entra al feed
    const HINT_KEY = 'falahbar_reels_hint_seen';
    try {
        if (localStorage.getItem(HINT_KEY) !== '1') {
            hint.classList.add('is-visible');
            setTimeout(() => hint.classList.remove('is-visible'), 4000);
        }
    } catch (_) {}

    const hideHint = () => {
        hint.classList.remove('is-visible');
        try { localStorage.setItem(HINT_KEY, '1'); } catch (_) {}
    };

    container.addEventListener('scroll', hideHint, { once: true, passive: true });
    container.addEventListener('touchstart', hideHint, { once: true, passive: true });
}

// =============================================
// SONIDO Y FEEDBACK VISUAL AL AGREGAR
// =============================================
function playAddSound() {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(900, ctx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.18);
    } catch (_) { /* silently fail if audio not supported */ }
}

let toastTimer = null;
function showCartToast(nombre) {
    let toast = document.getElementById('cartToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'cartToast';
        toast.className = 'cart-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = `✓ ${nombre} agregado`;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 2000);
}

// =============================================
// FUNCIONES DEL CARRITO
// =============================================
function findProduct(id) {
    if (productById.has(id)) return productById.get(id);
    return allProducts.find(p => p.id === id);
}

// Pequeño toast de error (cuando se intenta agregar sin stock o pasarse del stock)
function showStockToast(msg) {
    let toast = document.getElementById('cartToast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'cartToast';
        toast.className = 'cart-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = '⚠️ ' + msg;
    toast.classList.add('visible', 'cart-toast--warn');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toast.classList.remove('visible', 'cart-toast--warn');
    }, 2400);
}

// "Fly to cart": una mini-bola con el emoji del producto vuela desde el botón
// hasta el ícono del carrito. Sirve como confirmación visceral del agregado.
function flyToCart(originEl, emoji) {
    if (!originEl) return;
    const cartBtn = document.getElementById('cartBtn');
    if (!cartBtn) return;
    // Respeta reduce-motion
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const start = originEl.getBoundingClientRect();
    const end   = cartBtn.getBoundingClientRect();

    const ball = document.createElement('div');
    ball.className = 'fly-to-cart-ball';
    ball.textContent = emoji || '🍬';
    ball.style.left = (start.left + start.width / 2 - 14) + 'px';
    ball.style.top  = (start.top  + start.height / 2 - 14) + 'px';
    document.body.appendChild(ball);

    // Forzar reflow antes de transicionar al destino
    requestAnimationFrame(() => {
        ball.style.transform = `translate(${end.left + end.width / 2 - (start.left + start.width / 2)}px, ${end.top + end.height / 2 - (start.top + start.height / 2)}px) scale(0.3)`;
        ball.style.opacity = '0';
    });
    setTimeout(() => ball.remove(), 700);
}

function addToCart(id, btnEl, addQty) {
    const product = findProduct(id);
    if (!product) return;

    // Bloqueo total si está sin stock (incluso aunque alguien intente
    // llamar addToCart desde la consola).
    const stock = Number.isFinite(product.stock) ? product.stock : 1;
    if (stock <= 0) {
        showStockToast(`${product.nombre} está sin stock.`);
        return;
    }

    // Cantidad a sumar: 1 por defecto. Si vino el botón de pack, sumamos `cantidadPack`.
    let toAdd = Number(addQty);
    if (!Number.isFinite(toAdd) || toAdd <= 0) toAdd = 1;

    const existing = cart.find(item => item.id === id);
    const yaEnCarrito = existing ? existing.qty : 0;

    // Si pediste más del stock, recortamos y avisamos.
    if (yaEnCarrito + toAdd > stock) {
        const espacio = stock - yaEnCarrito;
        if (espacio <= 0) {
            showStockToast(`Solo quedan ${stock} de ${product.nombre}.`);
            return;
        }
        toAdd = espacio;
        showStockToast(`Solo agregamos ${toAdd} (quedan ${stock} en total).`);
    }

    if (existing) {
        existing.qty += toAdd;
    } else {
        cart.push({ ...product, qty: toAdd });
    }
    saveCartToStorage();
    updateCartUI();

    // Animación "fly to cart"
    if (btnEl) flyToCart(btnEl, product.emoji);

    if (btnEl) {
        btnEl.classList.remove('added');
        void btnEl.offsetWidth;
        btnEl.classList.add('added');
        setTimeout(() => btnEl.classList.remove('added'), 460);
    }

    const cartBtn = document.getElementById('cartBtn');
    if (cartBtn) {
        cartBtn.classList.remove('pulse');
        void cartBtn.offsetWidth;
        cartBtn.classList.add('pulse');
        setTimeout(() => cartBtn.classList.remove('pulse'), 460);
    }

    playAddSound();
    showCartToast(product.nombre);
}

function changeQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;

    // Si están sumando, validar stock
    if (delta > 0) {
        const product = findProduct(id);
        const stock = product && Number.isFinite(product.stock) ? product.stock : Infinity;
        if (item.qty + delta > stock) {
            showStockToast(`Solo quedan ${stock} de ${item.nombre}.`);
            return;
        }
    }

    item.qty += delta;
    if (item.qty <= 0) {
        cart = cart.filter(i => i.id !== id);
    }
    saveCartToStorage();
    updateCartUI();
}

function updateCartUI() {
    const cartItems = document.getElementById('cartItems');
    const cartTotal = document.getElementById('cartTotal');
    const sendBtn   = document.getElementById('sendWhatsApp');
    const clearBtn  = document.getElementById('clearCartBtn');

    const totalItems = cart.reduce((sum, i) => sum + i.qty, 0);
    const totalPrice = cart.reduce((sum, i) => sum + lineTotal(i), 0);
    // Ahorro total: lo que costaría sin pack menos lo que cuesta con pack.
    const totalSinDesc = cart.reduce((sum, i) => sum + (Number(i.precio) || 0) * i.qty, 0);
    const ahorro = Math.max(0, totalSinDesc - totalPrice);

    // Actualizar TODOS los contadores de carrito (por si hay varios, ej. placeholder en otras páginas)
    // Si el número subió respecto al render anterior, "bump" animado en el badge.
    document.querySelectorAll('.cart-count').forEach(el => {
        const oldVal = parseInt(el.dataset.lastValue || '0', 10);
        el.textContent = totalItems;
        el.dataset.lastValue = String(totalItems);
        if (totalItems > oldVal) {
            el.classList.remove('is-bumped');
            // Reflow para reiniciar la animación
            const _ = el.offsetWidth; void _;
            el.classList.add('is-bumped');
            setTimeout(() => el.classList.remove('is-bumped'), 480);
        }
    });

    if (cartTotal) cartTotal.textContent = '$' + totalPrice.toLocaleString('es-AR');

    // Mostrar/ocultar el cartelito verde de ahorro
    const cartSavings = document.getElementById('cartSavings');
    if (cartSavings) {
        if (ahorro > 0) {
            cartSavings.textContent = '🎉 Te ahorraste $' + ahorro.toLocaleString('es-AR');
            cartSavings.hidden = false;
        } else {
            cartSavings.hidden = true;
            cartSavings.textContent = '';
        }
    }

    updateShippingProgress(totalPrice);

    if (cart.length === 0) {
        if (cartItems) cartItems.innerHTML = `
            <div class="cart-empty-state">
                <div class="cart-empty-icon" aria-hidden="true">🛍️</div>
                <p class="cart-empty">Tu carrito está vacío</p>
                <p class="cart-empty-hint">Sumá productos del catálogo para hacer tu pedido por WhatsApp.</p>
                <button type="button" class="btn btn-secondary" id="cartEmptyExploreBtn">Ver productos</button>
            </div>
        `;
        if (sendBtn) sendBtn.disabled = true;
        if (clearBtn) clearBtn.style.display = 'none';
        // Conectar el botón "Ver productos" → cierra el carrito + scroll a #golosinas
        const exploreBtn = document.getElementById('cartEmptyExploreBtn');
        if (exploreBtn) {
            exploreBtn.addEventListener('click', () => {
                closeCart();
                const target = document.getElementById('golosinas');
                if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        }
    } else {
        if (sendBtn) sendBtn.disabled = false;
        if (clearBtn) clearBtn.style.display = 'block';
        if (cartItems) {
            cartItems.innerHTML = cart.map(i => {
                // Si aplicó descuento de pack, mostramos el subtotal real y un cartelito.
                const subtotal = lineTotal(i);
                const sinDesc  = (Number(i.precio) || 0) * i.qty;
                const aplicaDesc = subtotal < sinDesc;
                const descHTML = aplicaDesc
                    ? `<span class="cart-item-strike">$${sinDesc.toLocaleString('es-AR')}</span>
                       <span class="cart-item-discount-tag">¡Pack!</span>`
                    : '';
                return `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <h4><span aria-hidden="true">${i.emoji}</span> ${escapeHtml(i.nombre)}</h4>
                        <div class="cart-item-price">
                            $${subtotal.toLocaleString('es-AR')} ${descHTML}
                        </div>
                    </div>
                    <div class="qty-controls">
                        <button class="qty-btn" data-action="decrease" data-id="${i.id}" aria-label="Restar uno">−</button>
                        <span class="qty-value">${i.qty}</span>
                        <button class="qty-btn" data-action="increase" data-id="${i.id}" aria-label="Sumar uno">+</button>
                    </div>
                </div>
            `;}).join('');
        }
    }
}

function updateShippingProgress(totalPrice) {
    const progressBar  = document.getElementById('shippingProgressBar');
    const progressText = document.getElementById('shippingProgressText');
    if (!progressBar || !progressText) return;

    const pct = Math.min(100, (totalPrice / FREE_SHIPPING_THRESHOLD) * 100);
    progressBar.style.width = pct + '%';

    if (totalPrice >= FREE_SHIPPING_THRESHOLD) {
        progressText.innerHTML = '🎉 <strong>¡Tenés envío gratis!</strong>';
        progressBar.classList.add('is-free');
    } else {
        const falta = FREE_SHIPPING_THRESHOLD - totalPrice;
        progressText.innerHTML =
            'Te faltan <strong>$' + falta.toLocaleString('es-AR') +
            '</strong> para envío gratis';
        progressBar.classList.remove('is-free');
    }
}

// =============================================
// EVENTOS: AGREGAR AL CARRITO (delegación)
// =============================================
document.addEventListener('click', (e) => {
    // Badge de pack clickeable: agrega `cantidadPack` unidades de una pasada.
    const packBtn = e.target.closest('[data-action="add-pack"]');
    if (packBtn) {
        e.stopPropagation(); // que no abra el modal de la tarjeta
        addToCart(packBtn.dataset.id, packBtn, Number(packBtn.dataset.packQty) || 2);
        return;
    }
    const addBtn = e.target.closest('.add-to-cart');
    if (addBtn) {
        addToCart(addBtn.dataset.id, addBtn);
        return;
    }
    const qtyBtn = e.target.closest('.qty-btn');
    if (qtyBtn) {
        const id = qtyBtn.dataset.id;
        const action = qtyBtn.dataset.action;
        changeQty(id, action === 'increase' ? 1 : -1);
    }
});

// =============================================
// ABRIR / CERRAR CARRITO (solo en la home)
// =============================================
const cartEl      = document.getElementById('cart');
const cartOverlay = document.getElementById('cartOverlay');
const cartBtn     = document.getElementById('cartBtn');
const cartClose   = document.getElementById('cartClose');

function openCart() {
    if (!cartEl) return;
    cartEl.classList.add('active');
    cartOverlay && cartOverlay.classList.add('active');
    document.body.classList.add('no-scroll');
}
function closeCart() {
    if (!cartEl) return;
    cartEl.classList.remove('active');
    cartOverlay && cartOverlay.classList.remove('active');
    document.body.classList.remove('no-scroll');
}

// Si cartBtn es un <button> (en la home) funciona como botón; si es un <a>
// (en otras páginas) se deja su comportamiento default (navegar a index.html#cart).
if (cartBtn && cartBtn.tagName === 'BUTTON') {
    cartBtn.addEventListener('click', openCart);
}
if (cartClose) cartClose.addEventListener('click', closeCart);
if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && cartEl && cartEl.classList.contains('active')) {
        closeCart();
    }
});

// Abrir carrito automáticamente cuando venimos con #cart desde otra página.
if (cartEl && window.location.hash === '#cart') {
    // Limpio el hash para que no quede pegado si el usuario comparte la URL.
    history.replaceState(null, '', window.location.pathname + window.location.search);
    setTimeout(openCart, 250);
}

// =============================================
// MÓDULO DE ENTREGA: dirección + ubicación
// =============================================

// --- Persistencia ---
function saveDeliveryToStorage() {
    try {
        const payload = {
            address:   deliveryState.address || '',
            reference: deliveryState.reference || '',
            lat:       geoState.lat,
            lng:       geoState.lng,
            link:      geoState.link || '',
            ready:     !!geoState.ready
        };
        localStorage.setItem(STORAGE_KEY_DELIVERY, JSON.stringify(payload));
    } catch (_) {}
}

function loadDeliveryFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY_DELIVERY);
        if (!raw) return;
        const data = JSON.parse(raw);
        if (!data || typeof data !== 'object') return;
        deliveryState.address   = String(data.address   || '').trim();
        deliveryState.reference = String(data.reference || '').trim();
        if (data.ready && data.link && typeof data.lat === 'number' && typeof data.lng === 'number') {
            geoState.lat   = data.lat;
            geoState.lng   = data.lng;
            geoState.link  = String(data.link);
            geoState.ready = true;
        }
    } catch (_) {}
}

loadDeliveryFromStorage();

// --- API del navegador envuelta en Promise ---
function requestGeo(highAccuracy, timeout) {
    return new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: highAccuracy,
            timeout: timeout,
            maximumAge: highAccuracy ? 0 : 30000
        });
    });
}

// Dos intentos: primero GPS (alta precisión, mobile), después red/Wi-Fi (rápido en PC).
async function getLocation() {
    if (!navigator.geolocation) {
        throw new Error('Tu navegador no soporta geolocalización.');
    }
    if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        throw new Error('Necesitás abrir la página por HTTPS para usar la ubicación.');
    }
    try {
        return await requestGeo(true, 20000);
    } catch (firstErr) {
        if (firstErr && firstErr.code === 1) throw firstErr; // sin permiso → no reintentar
        return await requestGeo(false, 12000);
    }
}

function positionError(err) {
    if (!err) return 'No se pudo obtener la ubicación.';
    if (err.code === 1) return 'No diste permiso. Activalo desde el candadito del navegador y volvé a intentar.';
    if (err.code === 2) return 'No se pudo detectar tu ubicación. Probá con GPS / Wi-Fi activado.';
    if (err.code === 3) return 'La ubicación tardó demasiado. Probá de nuevo.';
    return err.message || 'No se pudo obtener la ubicación.';
}

// --- UI del bloque de entrega ---
(function initDeliveryUI() {
    const addressInput   = document.getElementById('cartAddressInput');
    const referenceInput = document.getElementById('cartReferenceInput');
    const useLocationBtn = document.getElementById('useLocationBtn');
    const statusEl       = document.getElementById('cartGeoStatus');
    const card           = document.getElementById('cartGeoCard');
    const cardCoords     = document.getElementById('cartGeoCoords');
    const cardLink       = document.getElementById('cartGeoLink');
    const cardClear      = document.getElementById('cartGeoClear');

    // Si no estamos en la home, esta sección no existe.
    if (!useLocationBtn) return;

    function setStatus(text, kind) {
        if (!statusEl) return;
        statusEl.textContent = text || '';
        statusEl.classList.remove('is-info', 'is-ok', 'is-error');
        if (kind === 'info')  statusEl.classList.add('is-info');
        if (kind === 'ok')    statusEl.classList.add('is-ok');
        if (kind === 'error') statusEl.classList.add('is-error');
    }

    function setBtnLoading(isLoading) {
        useLocationBtn.disabled = !!isLoading;
        useLocationBtn.classList.toggle('is-loading', !!isLoading);
    }

    function renderGeoCard() {
        if (!card) return;
        if (!geoState.ready) {
            card.hidden = true;
            return;
        }
        if (cardCoords) {
            cardCoords.textContent =
                `Lat ${geoState.lat.toFixed(5)}, Lng ${geoState.lng.toFixed(5)}`;
        }
        if (cardLink) cardLink.href = geoState.link;
        card.hidden = false;
    }

    function clearGeo() {
        geoState = { link: '', lat: null, lng: null, ready: false };
        renderGeoCard();
        setStatus('', '');
        saveDeliveryToStorage();
    }

    // Hidratar inputs desde estado persistido
    if (addressInput)   addressInput.value   = deliveryState.address   || '';
    if (referenceInput) referenceInput.value = deliveryState.reference || '';
    renderGeoCard();
    if (geoState.ready) setStatus('✅ Ubicación guardada de un pedido anterior.', 'ok');

    // Inputs: persistir al escribir
    if (addressInput) {
        addressInput.addEventListener('input', () => {
            deliveryState.address = addressInput.value.trim();
            saveDeliveryToStorage();
        });
    }
    if (referenceInput) {
        referenceInput.addEventListener('input', () => {
            deliveryState.reference = referenceInput.value.trim();
            saveDeliveryToStorage();
        });
    }

    // Botón "Usar mi ubicación"
    useLocationBtn.addEventListener('click', async () => {
        setBtnLoading(true);
        setStatus('Buscando tu ubicación…', 'info');
        try {
            const pos  = await getLocation();
            const lat  = pos.coords.latitude;
            const lng  = pos.coords.longitude;
            const link = `https://www.google.com/maps?q=${lat},${lng}`;
            geoState = { link, lat, lng, ready: true };
            renderGeoCard();
            setStatus('✅ Listo. La ubicación se va a incluir en el pedido.', 'ok');
            saveDeliveryToStorage();
        } catch (err) {
            const msg = (err && typeof err.code === 'number') ? positionError(err) : (err.message || 'No se pudo obtener la ubicación.');
            setStatus('⚠️ ' + msg, 'error');
        } finally {
            setBtnLoading(false);
        }
    });

    // Botón "x" para quitar la ubicación
    if (cardClear) {
        cardClear.addEventListener('click', clearGeo);
    }
})();

// =============================================
// ENVIAR PEDIDO POR WHATSAPP
// =============================================
const sendBtn = document.getElementById('sendWhatsApp');
if (sendBtn) {
    sendBtn.addEventListener('click', () => {
        if (cart.length === 0) return;

        // Validación: necesitamos al menos dirección o ubicación
        const addressInput = document.getElementById('cartAddressInput');
        const refInput     = document.getElementById('cartReferenceInput');
        const statusEl     = document.getElementById('cartGeoStatus');
        const address      = addressInput ? addressInput.value.trim() : '';
        const reference    = refInput     ? refInput.value.trim()     : '';
        const hasGeo       = !!(geoState.ready && geoState.link);
        const hasAddress   = address.length > 0;

        if (!hasGeo && !hasAddress) {
            if (statusEl) {
                statusEl.textContent = '⚠️ Necesitamos tu dirección o tu ubicación para enviarte el pedido.';
                statusEl.classList.remove('is-info', 'is-ok');
                statusEl.classList.add('is-error');
            }
            if (addressInput) {
                addressInput.classList.add('is-error');
                setTimeout(() => addressInput.classList.remove('is-error'), 2000);
            }
            // Palpitar el botón "Usar mi ubicación" para llamar la atención
            const geoBtn = document.getElementById('useLocationBtn');
            if (geoBtn) {
                geoBtn.classList.remove('is-pulsing');
                void geoBtn.offsetWidth; // reinicia la animación
                geoBtn.classList.add('is-pulsing');
                // Scrolleo el botón a la vista por si quedó fuera del viewport del carrito
                geoBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setTimeout(() => geoBtn.classList.remove('is-pulsing'), 2400);
            }
            // Foco al input al final, así el usuario puede escribir si prefiere esa vía
            if (addressInput) {
                setTimeout(() => addressInput.focus({ preventScroll: true }), 600);
            }
            return;
        }

        // Sincronizo estado por las dudas (input puede haber cambiado sin disparar 'input')
        deliveryState.address   = address;
        deliveryState.reference = reference;
        saveDeliveryToStorage();

        const savedUserName = getSavedUserName();
        let message = savedUserName
            ? `Hola Falahbar! Soy ${savedUserName} y quiero hacer el siguiente pedido:\n\n`
            : 'Hola Falahbar! Quiero hacer el siguiente pedido:\n\n';

        cart.forEach(i => {
            const sub  = lineTotal(i);
            const full = (Number(i.precio) || 0) * i.qty;
            const tag  = (sub < full) ? ` (pack ${i.cantidadPack}x$${Number(i.precioPack).toLocaleString('es-AR')})` : '';
            message += `- ${i.nombre} x${i.qty} - $${sub.toLocaleString('es-AR')}${tag}\n`;
        });
        const total = cart.reduce((sum, i) => sum + lineTotal(i), 0);
        message += `\nTotal: $${total.toLocaleString('es-AR')}\n`;
        message += `Zona de entrega: La Rioja Capital\n`;
        if (total >= FREE_SHIPPING_THRESHOLD) {
            message += `Envío: GRATIS (por superar $${FREE_SHIPPING_THRESHOLD.toLocaleString('es-AR')}) 🎉\n`;
        }

        // Datos de entrega
        message += `\n📍 Datos de entrega:\n`;
        if (hasAddress)         message += `Dirección: ${address}\n`;
        if (reference.length)   message += `Referencia: ${reference}\n`;
        if (hasGeo)             message += `Ubicación en mapa: ${geoState.link}\n`;

        message += `\nGracias!`;

        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank', 'noopener');
    });
}

// =============================================
// VACIAR CARRITO
// =============================================
const clearCartBtn = document.getElementById('clearCartBtn');
if (clearCartBtn) {
    clearCartBtn.addEventListener('click', () => {
        if (!confirm('¿Querés vaciar el carrito? Se eliminarán todos los productos.')) return;
        cart = [];
        saveCartToStorage();
        updateCartUI();
    });
}

// =============================================
// NOMBRE DEL CLIENTE (localStorage)
// =============================================
function getSavedUserName() {
    try {
        return (localStorage.getItem(STORAGE_KEY_USER) || '').trim();
    } catch (_) { return ''; }
}

function setSavedUserName(name) {
    try {
        localStorage.setItem(STORAGE_KEY_USER, String(name || '').trim());
    } catch (_) { /* storage no disponible */ }
}

function clearSavedUserName() {
    try {
        localStorage.removeItem(STORAGE_KEY_USER);
    } catch (_) {}
}

function wasModalDismissed() {
    try {
        return localStorage.getItem(STORAGE_KEY_MODAL_DISMISSED) === '1';
    } catch (_) { return false; }
}

function setModalDismissed(flag) {
    try {
        if (flag) localStorage.setItem(STORAGE_KEY_MODAL_DISMISSED, '1');
        else localStorage.removeItem(STORAGE_KEY_MODAL_DISMISSED);
    } catch (_) {}
}

// ---- Formulario inferior ----
const userForm          = document.getElementById('userForm');
const userNameInput     = document.getElementById('userName');
const userSavedMessage  = document.getElementById('userSavedMessage');

function syncUserFormFromStorage() {
    if (!userNameInput) return;
    const savedName = getSavedUserName();
    if (savedName) {
        userNameInput.value = savedName;
        if (userSavedMessage) userSavedMessage.textContent = `✓ Nombre guardado: ${savedName}`;
    } else {
        userNameInput.value = '';
        if (userSavedMessage) userSavedMessage.textContent = '';
    }
}

if (userForm) {
    syncUserFormFromStorage();

    userForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = userNameInput.value.trim();

        if (name.length < 2) {
            if (userSavedMessage) {
                userSavedMessage.textContent = 'Ingresá un nombre válido (al menos 2 letras).';
                userSavedMessage.classList.add('is-error');
            }
            userNameInput.focus();
            return;
        }

        setSavedUserName(name);
        // Guardar también limpia el flag de "dismissed" para que tenga sentido
        setModalDismissed(false);

        if (userSavedMessage) {
            userSavedMessage.classList.remove('is-error');
            userSavedMessage.textContent = `✓ Nombre guardado: ${name}`;
        }
    });

    userNameInput && userNameInput.addEventListener('input', () => {
        if (userSavedMessage && userSavedMessage.classList.contains('is-error')) {
            userSavedMessage.classList.remove('is-error');
            userSavedMessage.textContent = '';
        }
    });
}

// =============================================
// MENÚ MÓVIL
// =============================================
const navToggle = document.getElementById('navToggle');
const navLinks  = document.getElementById('navLinks');

if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
        const isOpen = navLinks.classList.toggle('active');
        navToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    });

    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            navToggle.setAttribute('aria-expanded', 'false');
        });
    });
}

// =============================================
// FORMULARIO DE CONTACTO
// Ahora abre WhatsApp con el mensaje pre-cargado (solución simple sin backend).
// =============================================
const contactForm = document.getElementById('contactForm');

function showError(input, message) {
    const formGroup = input.parentElement;
    formGroup.classList.add('has-error');
    const errorSpan = formGroup.querySelector('.error-message');
    if (errorSpan) errorSpan.textContent = message;
}

function clearErrors() {
    document.querySelectorAll('.form-group').forEach(group => {
        group.classList.remove('has-error');
        const errorSpan = group.querySelector('.error-message');
        if (errorSpan) errorSpan.textContent = '';
    });
}

if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearErrors();

        const name    = document.getElementById('name');
        const email   = document.getElementById('email');
        const subject = document.getElementById('subject');
        const message = document.getElementById('message');

        let isValid = true;

        if (name.value.trim().length < 2) {
            showError(name, 'Por favor ingresá tu nombre');
            isValid = false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.value.trim())) {
            showError(email, 'Por favor ingresá un email válido');
            isValid = false;
        }

        if (subject.value.trim().length < 3) {
            showError(subject, 'El asunto es muy corto');
            isValid = false;
        }

        if (message.value.trim().length < 10) {
            showError(message, 'El mensaje debe tener al menos 10 caracteres');
            isValid = false;
        }

        if (!isValid) return;

        // Construyo el mensaje para WhatsApp
        const waText =
            `Hola Falahbar! Soy ${name.value.trim()} y te dejo una consulta.\n\n` +
            `Asunto: ${subject.value.trim()}\n` +
            `Email de contacto: ${email.value.trim()}\n\n` +
            `Mensaje:\n${message.value.trim()}\n\n` +
            `¡Gracias!`;

        const waUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(waText)}`;
        window.open(waUrl, '_blank');

        const success = document.getElementById('formSuccess');
        if (success) {
            success.style.display = 'block';
            setTimeout(() => { success.style.display = 'none'; }, 6000);
        }
        contactForm.reset();
    });
}

// =============================================
// ANIMACIÓN AL HACER SCROLL (fade-in)
// =============================================
if ('IntersectionObserver' in window) {
    const observerOptions = { threshold: 0.1, rootMargin: '0px 0px -50px 0px' };

    const fadeObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                fadeObserver.unobserve(entry.target);
            }
        });
    }, observerOptions);

    document.querySelectorAll('.value-item, .team-member').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        fadeObserver.observe(el);
    });
}

// =============================================
// MODAL: NOMBRE DEL CLIENTE (solo index.html)
// Expone window.openNameModal() para que se pueda abrir desde botones externos.
// =============================================
(function initNameModal() {
    const overlay = document.getElementById('nameModalOverlay');
    if (!overlay) {
        // Si no hay modal en esta página, aún exponemos un no-op para evitar errores.
        window.openNameModal = function () {};
        return;
    }

    const modalInput = document.getElementById('modalUserName');
    const modalForm  = document.getElementById('nameModalForm');
    const saveBtn    = document.getElementById('modalSaveBtn');
    const skipBtn    = document.getElementById('modalSkipBtn');
    const closeBtn   = document.getElementById('nameModalClose');

    function resetInputError() {
        if (modalInput) modalInput.style.borderColor = '';
    }

    function closeModal() {
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('no-scroll');
    }

    function openModal() {
        const saved = getSavedUserName();
        if (modalInput) modalInput.value = saved || '';
        resetInputError();
        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('no-scroll');
        // Foco después de que termine la transición
        setTimeout(() => modalInput && modalInput.focus(), 350);
    }

    // Autoabrir solo si: no hay nombre guardado Y el usuario no lo descartó antes.
    if (!getSavedUserName() && !wasModalDismissed()) {
        setTimeout(openModal, 500);
    }

    function handleSave(e) {
        e && e.preventDefault && e.preventDefault();
        const name = modalInput ? modalInput.value.trim() : '';
        if (name.length < 2) {
            if (modalInput) {
                modalInput.style.borderColor = 'var(--color-error)';
                modalInput.focus();
            }
            return;
        }
        setSavedUserName(name);
        setModalDismissed(false);
        syncUserFormFromStorage();
        resetInputError();
        closeModal();
    }

    modalForm && modalForm.addEventListener('submit', handleSave);
    saveBtn   && saveBtn.addEventListener('click', handleSave);

    skipBtn && skipBtn.addEventListener('click', () => {
        setModalDismissed(true);
        closeModal();
    });

    closeBtn && closeBtn.addEventListener('click', () => {
        setModalDismissed(true);
        closeModal();
    });

    // Reset del borde de error al escribir
    modalInput && modalInput.addEventListener('input', resetInputError);

    // Cerrar con Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) {
            setModalDismissed(true);
            closeModal();
        }
    });

    // Click fuera del modal también cierra
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            setModalDismissed(true);
            closeModal();
        }
    });

    // Expongo abrir como API pública
    window.openNameModal = openModal;
})();

// Botón "Volver a abrir el diálogo" en la sección inferior de la home
const reopenBtn = document.getElementById('reopenNameModalBtn');
if (reopenBtn) {
    reopenBtn.addEventListener('click', () => {
        setModalDismissed(false);
        if (typeof window.openNameModal === 'function') {
            window.openNameModal();
        }
    });
}

// =============================================
// TRANSICIONES ENTRE PÁGINAS
// =============================================
(function initPageTransitions() {
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    window.addEventListener('pageshow', () => {
        document.body.classList.remove('page-leaving');
    });

    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href]');
        if (!link) return;

        const href = link.getAttribute('href');
        if (!href) return;

        if (href.startsWith('#')) return;
        if (/^(https?:|mailto:|tel:)/.test(href)) return;
        if (link.target === '_blank') return;

        const esInternoHtml = /\.html(\?|#|$)/.test(href) || href === 'index.html';
        if (!esInternoHtml) return;

        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button === 1) return;

        e.preventDefault();
        document.body.classList.add('page-leaving');
        setTimeout(() => { window.location.href = href; }, 220);
    });
})();

// =============================================
// BUSCADOR DE PRODUCTOS
// Filtra tarjetas visibles por nombre (y grupo) en golosinas + snacks.
// Esconde subcategorías que quedan sin resultados.
// =============================================
(function initProductSearch() {
    const input    = document.getElementById('productSearch');
    const clearBtn = document.getElementById('searchClear');
    const statusEl = document.getElementById('searchStatus');

    if (!input) return; // No estamos en el home

    // Los grids que queremos cubrir con la búsqueda.
    // Cada uno tiene un "empty state" opcional.
    const targets = [
        { gridId: 'golosinasGrid', emptyId: 'golosinasEmpty', dataLen: () => golosinas.length },
        { gridId: 'snacksGrid',    emptyId: 'snacksEmpty',    dataLen: () => snacks.length },
        { gridId: 'gaseosasGrid',  emptyId: 'gaseosasEmpty',  dataLen: () => gaseosas.length }
    ];

    function normalize(s) {
        return String(s || '')
            .toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // saca acentos
            .trim();
    }

    // Queries especiales que listan los productos sin stock.
    const SIN_STOCK_QUERIES = new Set([
        'sin stock', 'sinstock', 'sin-stock',
        'agotado', 'agotados', 'no hay', 'no hay stock'
    ]);

    function applyFilter(rawQuery) {
        const q = normalize(rawQuery);
        const filtering = q.length > 0;
        const verSinStock = SIN_STOCK_QUERIES.has(q);

        if (clearBtn) clearBtn.hidden = !filtering;

        let totalVisibles = 0;

        targets.forEach(t => {
            const grid = document.getElementById(t.gridId);
            if (!grid) return;
            const cards = grid.querySelectorAll('.product-card');
            let countInGrid = 0;

            // Calculamos primero cuáles van a quedar visibles (para el empty state)
            // Reglas:
            // - Sin búsqueda → ocultamos los sin stock y los "precio a consultar".
            // - Búsqueda "sin stock"/"agotado" → mostramos SOLO los sin stock o sin precio.
            // - Búsqueda normal → matcheamos por nombre/grupo (incluyendo los ocultos).
            const visibleSet = new Set();
            cards.forEach(card => {
                const nombre  = normalize(card.querySelector('h3')?.textContent);
                const grupo   = normalize(card.dataset.productGroup);
                const fuera   = card.classList.contains('is-out-of-stock');
                const sinPrec = card.classList.contains('is-no-price');
                const oculto  = fuera || sinPrec;

                let matches;
                if (!filtering) {
                    matches = !oculto;
                } else if (verSinStock) {
                    matches = oculto;
                } else {
                    matches = nombre.includes(q) || grupo.includes(q);
                }
                if (matches) {
                    visibleSet.add(card);
                    countInGrid++;
                }
            });

            // Aplica con animación (modo 'search': suave y rápido)
            animatedFilter(grid, 'is-hidden', card => visibleSet.has(card), { mode: 'search' });

            const emptyEl = document.getElementById(t.emptyId);
            if (emptyEl) {
                // Mostrar empty state solo si estamos filtrando, no matchea nada,
                // y la sección sí tiene productos cargados.
                emptyEl.hidden = !(filtering && countInGrid === 0 && t.dataLen() > 0);
            }

            totalVisibles += countInGrid;
        });

        if (statusEl) {
            if (!filtering) {
                statusEl.textContent = '';
            } else if (verSinStock) {
                statusEl.textContent = totalVisibles === 0
                    ? '¡Todo en stock! 🎉'
                    : (totalVisibles === 1
                        ? '1 producto sin stock'
                        : `${totalVisibles} productos sin stock`);
                return;
            } else if (totalVisibles === 0) {
                statusEl.textContent = `Sin resultados para "${rawQuery.trim()}".`;
            } else {
                statusEl.textContent =
                    totalVisibles === 1
                        ? '1 producto encontrado'
                        : `${totalVisibles} productos encontrados`;
            }
        }
    }

    let debounceTimer;
    input.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const value = e.target.value;
        debounceTimer = setTimeout(() => applyFilter(value), 80);
    });

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            input.value = '';
            applyFilter('');
            input.focus();
        });
    }

    applyFilter(input.value);
})();

// =============================================
// MODAL: DETALLE DE PRODUCTO
// Se abre al tocar una tarjeta (no al tocar "Agregar").
// =============================================
(function initProductModal() {
    const overlay = document.getElementById('productModalOverlay');
    if (!overlay) return; // Esta página no tiene modal de producto

    const closeBtn  = document.getElementById('productModalClose');
    const titleEl   = document.getElementById('productModalTitle');
    const descEl    = document.getElementById('productModalDesc');
    const priceEl   = document.getElementById('productModalPrice');
    const groupEl   = document.getElementById('productModalGroup');
    const emojiEl   = document.getElementById('productModalEmoji');
    const qtyValEl  = document.getElementById('productModalQtyValue');
    const qtyMinus  = document.getElementById('productModalQtyMinus');
    const qtyPlus   = document.getElementById('productModalQtyPlus');
    const addBtn    = document.getElementById('productModalAdd');
    const videoLink = document.getElementById('productModalVideoLink');

    let currentProduct = null;
    let currentQty = 1;

    function updateQtyUI() {
        if (qtyValEl) qtyValEl.textContent = String(currentQty);
        const stock = (currentProduct && Number.isFinite(currentProduct.stock))
            ? currentProduct.stock : Infinity;
        if (qtyMinus) qtyMinus.disabled = currentQty <= 1;
        if (qtyPlus)  qtyPlus.disabled  = currentQty >= stock;
    }

    const modalEl = overlay.querySelector('.product-modal');
    const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setOriginFromRect(rect) {
        if (!modalEl || !rect) return;
        const cx = window.innerWidth / 2;
        const cy = window.innerHeight / 2;
        const ox = rect.left + rect.width / 2;
        const oy = rect.top + rect.height / 2;
        const tx = Math.round(ox - cx);
        const ty = Math.round(oy - cy);
        modalEl.style.setProperty('--origin-tx', `${tx}px`);
        modalEl.style.setProperty('--origin-ty', `${ty}px`);
        modalEl.classList.add('with-origin-anim');
    }

    function clearOrigin() {
        if (!modalEl) return;
        modalEl.classList.remove('with-origin-anim');
        modalEl.style.removeProperty('--origin-tx');
        modalEl.style.removeProperty('--origin-ty');
    }

    function openModal(product, originRect) {
        if (!product) return;
        currentProduct = product;
        currentQty = 1;

        if (titleEl) titleEl.textContent = product.nombre;
        if (descEl)  descEl.textContent  = product.descripcion || DESC_PLACEHOLDER;
        if (priceEl) {
            const precioNum = Number(product.precio) || 0;
            if (precioNum > 0) {
                priceEl.textContent = '$' + precioNum.toLocaleString('es-AR');
                priceEl.classList.remove('product-price--pending');
            } else {
                priceEl.textContent = 'Precio a consultar';
                priceEl.classList.add('product-price--pending');
            }
        }

        // Promo / pack en el modal: agregamos un span al lado del precio
        if (priceEl && priceEl.parentElement) {
            let promoEl = priceEl.parentElement.querySelector('.product-modal-promo');
            const promoText = formatPromoText(product);
            if (promoText) {
                if (!promoEl) {
                    promoEl = document.createElement('div');
                    promoEl.className = 'product-modal-promo';
                    priceEl.insertAdjacentElement('afterend', promoEl);
                }
                promoEl.textContent = promoText;
                promoEl.hidden = false;
            } else if (promoEl) {
                promoEl.hidden = true;
                promoEl.textContent = '';
            }
        }
        if (groupEl) groupEl.textContent = product.grupo || product.subcategoria || '';
        if (emojiEl) emojiEl.textContent = product.emoji || '🍬';

        // Imagen real en el modal: si hay, la inyectamos sobre el hero;
        // si no, dejamos sólo el emoji.
        const heroEl = overlay.querySelector('.product-modal-hero');
        if (heroEl) {
            // Quitar imagen anterior si existía
            const oldImg = heroEl.querySelector('.product-modal-img');
            if (oldImg) oldImg.remove();
            heroEl.classList.remove('product-modal-hero--with-image');
            if (product.imagen) {
                const img = document.createElement('img');
                img.className = 'product-modal-img';
                img.src = product.imagen;
                img.alt = product.nombre;
                img.onerror = () => { img.remove(); heroEl.classList.remove('product-modal-hero--with-image'); };
                heroEl.appendChild(img);
                heroEl.classList.add('product-modal-hero--with-image');
            }
        }

        // Link al short asociado (si el producto tiene videoId)
        if (videoLink) {
            if (product.videoId != null) {
                videoLink.href = 'shorts.html#short-' + encodeURIComponent(product.videoId);
                videoLink.hidden = false;
            } else {
                videoLink.href = '#';
                videoLink.hidden = true;
            }
        }

        // Stock: si es 0, deshabilitamos el botón Agregar y mostramos cartel.
        const stock = Number.isFinite(product.stock) ? product.stock : 1;
        const sinStock = stock <= 0;
        if (addBtn) {
            addBtn.disabled = sinStock;
            addBtn.textContent = sinStock ? 'Sin stock' : 'Agregar al carrito';
            addBtn.classList.toggle('is-disabled', sinStock);
        }
        if (qtyPlus)  qtyPlus.disabled  = sinStock;
        if (qtyMinus) qtyMinus.disabled = sinStock || currentQty <= 1;

        // Etiqueta de stock dentro del modal
        let modalStockEl = overlay.querySelector('.product-modal-stock');
        if (!modalStockEl) {
            modalStockEl = document.createElement('div');
            modalStockEl.className = 'product-modal-stock';
            const priceParent = priceEl && priceEl.parentElement;
            if (priceParent) priceParent.insertBefore(modalStockEl, priceEl);
        }
        if (sinStock) {
            modalStockEl.textContent = 'Sin stock por ahora';
            modalStockEl.className = 'product-modal-stock product-modal-stock--out';
        } else if (stock <= 3) {
            modalStockEl.textContent = `Quedan solo ${stock} unidades`;
            modalStockEl.className = 'product-modal-stock product-modal-stock--low';
        } else {
            modalStockEl.textContent = `${stock} disponibles`;
            modalStockEl.className = 'product-modal-stock product-modal-stock--ok';
        }

        updateQtyUI();

        // Animación estilo Mac: el modal "crece" desde la tarjeta clickeada
        if (originRect && !reduceMotion) {
            setOriginFromRect(originRect);
        } else {
            clearOrigin();
        }

        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('no-scroll');
    }

    function closeModal() {
        // Marca el modal como "cerrando" para que use la curva/duración
        // de cierre (más punchy que la de apertura) y se "regrese" al origen.
        if (modalEl) modalEl.classList.add('is-closing');
        overlay.classList.remove('active');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('no-scroll');
        // Limpio el origen y el flag al terminar la animación de cierre
        setTimeout(() => {
            clearOrigin();
            if (modalEl) modalEl.classList.remove('is-closing');
        }, 360);
        currentProduct = null;
    }

    // Abrir al click en tarjeta (evitando el botón Agregar y el badge de pack)
    document.addEventListener('click', (e) => {
        // Si clickeó el botón Agregar dentro de la tarjeta, que no abra el modal
        if (e.target.closest('.add-to-cart')) return;
        // Idem para el badge de pack ("2 por $X")
        if (e.target.closest('[data-action="add-pack"]')) return;

        const card = e.target.closest('.product-card');
        if (!card) return;

        const id = card.dataset.productId;
        const product = findProduct(id);
        if (product) {
            const rect = card.getBoundingClientRect();
            openModal(product, rect);
        }
    });

    // Abrir con Enter o Espacio (accesibilidad)
    document.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && document.activeElement
            && document.activeElement.classList
            && document.activeElement.classList.contains('product-card')) {
            e.preventDefault();
            const id = document.activeElement.dataset.productId;
            const product = findProduct(id);
            if (product) {
                const rect = document.activeElement.getBoundingClientRect();
                openModal(product, rect);
            }
        }
    });

    // Cierre
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && overlay.classList.contains('active')) closeModal();
    });

    // Qty
    if (qtyMinus) qtyMinus.addEventListener('click', () => {
        if (currentQty > 1) { currentQty--; updateQtyUI(); }
    });
    if (qtyPlus) qtyPlus.addEventListener('click', () => {
        const stock = (currentProduct && Number.isFinite(currentProduct.stock))
            ? currentProduct.stock : Infinity;
        if (currentQty + 1 > stock) {
            showStockToast(`Solo quedan ${stock} de ${currentProduct.nombre}.`);
            return;
        }
        currentQty++; updateQtyUI();
    });

    // Agregar desde el modal (sumando la cantidad elegida)
    if (addBtn) addBtn.addEventListener('click', () => {
        if (!currentProduct) return;
        const stock = Number.isFinite(currentProduct.stock) ? currentProduct.stock : Infinity;
        if (stock <= 0) return;
        // No pasarse del stock contando lo que ya está en el carrito
        const yaEnCarrito = (cart.find(i => i.id === currentProduct.id)?.qty) || 0;
        const cabe = Math.max(0, stock - yaEnCarrito);
        const aAgregar = Math.min(currentQty, cabe);
        if (aAgregar <= 0) {
            showStockToast(`Ya tenés ${yaEnCarrito} en el carrito y solo hay ${stock}.`);
            return;
        }
        for (let i = 0; i < aAgregar; i++) {
            addToCart(currentProduct.id);
        }
        closeModal();
    });

    // Si llegamos con #product-XXX (ej. desde un reel), abrir el modal de ese producto
    function openModalFromHash() {
        const hash = window.location.hash || '';
        const m = hash.match(/^#product-(.+)$/);
        if (!m) return;
        const id = decodeURIComponent(m[1]);
        const product = findProduct(id);
        if (!product) return;
        // Limpio el hash para que no se reabra al recargar
        history.replaceState(null, '', window.location.pathname + window.location.search);
        // Pequeño delay para que primero rendericen las grillas
        setTimeout(() => openModal(product), 250);
    }
    // Lo exponemos para llamarlo después de que termine de cargar el catálogo
    window.openProductFromHash = openModalFromHash;
})();

// =============================================
// SHORTS: abrir el video correcto desde home
// Si la URL trae #short-X, arrancamos el feed en ese reel.
// =============================================
function scrollReelsToHash() {
    const feed = document.getElementById('reelsFeed');
    if (!feed) return;
    const hash = window.location.hash || '';
    const match = hash.match(/^#short-(\d+)$/);
    if (!match) return;

    const targetId = Number(match[1]);
    const idx = shortsData.findIndex(s => Number(s.id) === targetId);
    if (idx < 0) return;

    const reels = feed.querySelectorAll('.reel');
    const targetReel = reels[idx];
    if (!targetReel) return;

    // Esperar un tick a que IntersectionObserver se enganche
    requestAnimationFrame(() => {
        targetReel.scrollIntoView({ behavior: 'auto', block: 'start' });
    });
}

// =============================================
// SCROLL: arrancar siempre arriba (salvo que la URL apunte a algo concreto)
// El browser "recuerda" el scroll en algunas navegaciones; lo desactivamos
// y, si la URL no trae un anchor que tenga sentido (golosinas/snacks/gaseosas/cart/short-X/product-X),
// forzamos volver al tope al cargar.
// =============================================
(function initScrollRestoration() {
    if ('scrollRestoration' in history) {
        try { history.scrollRestoration = 'manual'; } catch (_) {}
    }
    const meaningfulHash = /^#(golosinas|snacks|gaseosas|cart|short-\d+|product-.+)$/i;
    const hash = window.location.hash || '';
    if (!meaningfulHash.test(hash)) {
        // Saltarse el "scroll a la mitad" que algunos browsers hacen en back/forward
        window.scrollTo(0, 0);
        // Y otra vez después de pintar, para vencer cualquier scroll automático
        requestAnimationFrame(() => window.scrollTo(0, 0));
    }
})();

// =============================================
// NAV ACTIVA POR SECCIÓN (basado en scroll-position)
// En home, marca como activo el link cuya sección está siendo vista.
// Algoritmo: hay una "línea de activación" a 32% del viewport desde
// arriba. La sección actual es la última cuyo top cruzó esa línea
// (y cuyo bottom todavía no la pasó). Mucho más predecible que un
// IntersectionObserver con thresholds.
// =============================================
(function initSectionNavSpy() {
    const navLinks = document.querySelectorAll('.nav-links a');
    if (!navLinks.length) return;

    // Sólo aplica en páginas con secciones internas (home)
    const sections = ['golosinas', 'snacks', 'gaseosas']
        .map(id => document.getElementById(id))
        .filter(Boolean);

    if (!sections.length) return; // No es home: no tocamos nada

    // Mapa: id de sección → links que apuntan a ella
    const linksBySection = new Map();
    function registerLink(linkEl, sectionId) {
        if (!linksBySection.has(sectionId)) linksBySection.set(sectionId, []);
        linksBySection.get(sectionId).push(linkEl);
    }

    // Link a "Inicio" (en home, suele ser href="index.html" o href="#")
    const homeLinks = [];
    navLinks.forEach(a => {
        const href = a.getAttribute('href') || '';
        if (href.startsWith('#')) {
            const id = href.slice(1);
            if (id) registerLink(a, id);
        } else if (
            href === 'index.html' ||
            href === '/' ||
            href === './' ||
            href === 'index.html#'
        ) {
            homeLinks.push(a);
        }
    });

    // Helper: marca UN único nav link como activo (limpia los demás internos)
    let lastActive = null;
    function setActive(activeLink) {
        if (lastActive === activeLink) return; // evita reflows innecesarios
        navLinks.forEach(a => {
            const href = a.getAttribute('href') || '';
            const isInternal = href.startsWith('#') ||
                href === 'index.html' || href === '/' ||
                href === './' || href === 'index.html#';
            if (isInternal) a.classList.remove('active');
        });
        if (activeLink) activeLink.classList.add('active');
        lastActive = activeLink;
    }

    function recalcActive() {
        // Posición absoluta de la "línea de activación" (32% desde el top del viewport)
        const scrollY = window.scrollY || window.pageYOffset || 0;
        const trigger = scrollY + window.innerHeight * 0.32;

        // Si todavía no llegamos a la primera sección → Inicio
        const firstTop = sections[0].offsetTop;
        if (trigger < firstTop) {
            setActive(homeLinks[0] || null);
            return;
        }

        // Buscamos la última sección cuyo top está por encima de la línea
        let current = null;
        for (const s of sections) {
            if (s.offsetTop <= trigger) {
                current = s;
            } else {
                break;
            }
        }

        if (current) {
            const links = linksBySection.get(current.id) || [];
            setActive(links[0] || null);
        } else {
            setActive(homeLinks[0] || null);
        }
    }

    // Throttle con rAF para que el scroll sea fluido
    let scheduled = false;
    function onScrollOrResize() {
        if (scheduled) return;
        scheduled = true;
        requestAnimationFrame(() => {
            scheduled = false;
            recalcActive();
        });
    }

    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize, { passive: true });

    // Las grillas se renderizan después → las secciones cambian de altura.
    // Re-medimos varias veces tras la carga inicial para acompañar ese reflow.
    [50, 200, 600, 1500].forEach(ms => setTimeout(recalcActive, ms));

    // Estado inicial
    recalcActive();
})();

// =============================================
// BOOT: render inicial
// =============================================
async function bootCatalog() {
    // Skeleton loader: 6 tarjetas "fantasmas" con shimmer mientras llega el JSON.
    // Es más amable que un texto "Cargando..." porque ya muestra la grilla.
    const skeletonHTML = Array(6).fill(0).map(() => `
        <div class="product-card product-card--skeleton" aria-hidden="true">
            <div class="skeleton-shimmer skeleton-img"></div>
            <div class="skeleton-shimmer skeleton-line skeleton-line--title"></div>
            <div class="skeleton-shimmer skeleton-line skeleton-line--price"></div>
            <div class="skeleton-shimmer skeleton-btn"></div>
        </div>
    `).join('');
    ['golosinasGrid', 'snacksGrid', 'gaseosasGrid'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = skeletonHTML;
    });

    // Cargamos productos y videos en paralelo (son independientes)
    await Promise.all([loadCatalog(), loadVideos()]);

    // Si la carga falló completamente, mostramos un mensaje útil en lugar
    // del placeholder genérico de "Próximamente".
    if (allProducts.length === 0) {
        ['golosinasGrid', 'snacksGrid', 'gaseosasGrid'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `
                <div class="products-empty">
                    <div class="products-empty-icon" aria-hidden="true">⚠️</div>
                    <h3>No pudimos cargar el catálogo</h3>
                    <p>Refrescá la página (Ctrl+F5 / Cmd+Shift+R). Si el problema persiste, escribinos por WhatsApp y te atendemos personalmente: <strong>3804-65-3294</strong>.</p>
                </div>
            `;
        });
        return;
    }

    renderProducts(golosinas, 'golosinasGrid', { chipsContainerId: 'golosinasFilters' });
    renderProducts(snacks,    'snacksGrid',    { chipsContainerId: 'snacksFilters' });
    renderProducts(gaseosas,  'gaseosasGrid',  { chipsContainerId: 'gaseosasFilters' });

    // Limpiar carrito de items con id que ya no existen en el catálogo nuevo
    if (productById.size > 0) {
        const before = cart.length;
        cart = cart.filter(it => productById.has(it.id));
        if (cart.length !== before) saveCartToStorage();
    }
    updateCartUI();

    // Preview de shorts en el home: solo los marcados "mostrarEnHome"
    renderShorts('homeShortsScroller', { limit: 5, useHomeList: true });

    // Re-renderizamos los reels: ahora sí tenemos productos para enlazarles
    renderReels('reelsFeed');
    scrollReelsToHash();

    // Si venimos con #product-XYZ, ahora que el catálogo está cargado,
    // abrimos el modal correspondiente.
    if (typeof window.openProductFromHash === 'function') {
        window.openProductFromHash();
    }
}

updateCartUI();           // refleja el contador del carrito persistido
bootCatalog();            // carga productos.json + videos.json y renderiza grids/reels/shorts

// =============================================
// MEJORAS DE EXPERIENCIA DE USUARIO
// =============================================

// 1) Botón flotante "subir al inicio" — aparece cuando scrolleás >400px
(function initScrollTop() {
    if (!document.body) return;
    // Solo en pantallas que tienen scroll vertical (la home, etc.)
    const btn = document.createElement('button');
    btn.className = 'scroll-top';
    btn.setAttribute('aria-label', 'Volver al inicio de la página');
    btn.innerHTML = '↑';
    document.body.appendChild(btn);

    let visible = false;
    function onScroll() {
        const shouldShow = window.scrollY > 400;
        if (shouldShow !== visible) {
            visible = shouldShow;
            btn.classList.toggle('is-visible', visible);
        }
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    btn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
})();

// 2) Atajo de teclado Ctrl+K / Cmd+K → enfocar el buscador
(function initSearchShortcut() {
    const input = document.getElementById('productSearch');
    if (!input) return;

    // Hint visual (kbd) dentro del search box
    const box = input.closest('.search-box');
    if (box && !box.querySelector('.search-shortcut-hint')) {
        const isMac = /(Mac|iPhone|iPad)/i.test(navigator.platform);
        const hint = document.createElement('span');
        hint.className = 'search-shortcut-hint';
        hint.setAttribute('aria-hidden', 'true');
        hint.textContent = isMac ? '⌘ K' : 'Ctrl K';
        box.appendChild(hint);
    }

    document.addEventListener('keydown', (e) => {
        const isMod = e.ctrlKey || e.metaKey;
        if (isMod && (e.key === 'k' || e.key === 'K')) {
            e.preventDefault();
            input.focus();
            input.select();
            window.scrollTo({ top: input.getBoundingClientRect().top + window.scrollY - 120, behavior: 'smooth' });
        }
        // Esc en el buscador limpia y blurrea
        if (e.key === 'Escape' && document.activeElement === input && input.value) {
            input.value = '';
            input.dispatchEvent(new Event('input'));
        }
    });
})();

// 3) Sticky CTA en mobile: botón flotante "Hacer pedido (X)" que aparece
//    cuando hay items en el carrito y la página está scrolleada. Solo en mobile.
(function initStickyCTA() {
    if (!document.body) return;
    // Solo en home (donde existe el carrito propio, no link a otra página)
    const cartBtn = document.getElementById('cartBtn');
    if (!cartBtn || cartBtn.tagName !== 'BUTTON') return;

    const cta = document.createElement('button');
    cta.className = 'sticky-cta';
    cta.setAttribute('aria-label', 'Abrir carrito y hacer el pedido');
    cta.innerHTML = `
        <span class="sticky-cta-icon" aria-hidden="true">🛒</span>
        <span>Hacer pedido</span>
        <span class="sticky-cta-count" id="stickyCtaCount">0</span>
    `;
    document.body.appendChild(cta);

    cta.addEventListener('click', () => {
        // openCart() está definida arriba en script.js — la llamamos
        if (typeof openCart === 'function') openCart();
    });

    function update() {
        const total = cart.reduce((sum, i) => sum + i.qty, 0);
        const countEl = document.getElementById('stickyCtaCount');
        if (countEl) countEl.textContent = total;
        const scrolled = window.scrollY > 300;
        const cartOpen = document.getElementById('cart')?.classList.contains('active');
        const visible = total > 0 && scrolled && !cartOpen;
        cta.classList.toggle('is-visible', visible);
    }

    window.addEventListener('scroll', update, { passive: true });
    // Reaccionar a cambios del carrito: paqueamos updateCartUI con un decorador
    const origUpdateCartUI = window.updateCartUI || updateCartUI;
    if (typeof origUpdateCartUI === 'function') {
        window.updateCartUI = function() {
            origUpdateCartUI.apply(this, arguments);
            update();
        };
    }
    update();
})();

// 4) Shake feedback cuando addToCart rechaza algo (sin stock o overflow)
(function decorateShowStockToast() {
    const original = window.showStockToast || showStockToast;
    if (typeof original !== 'function') return;
    window.showStockToast = function(msg) {
        original.apply(this, arguments);
        // Shakear la última tarjeta tocada (si hay)
        const lastBtn = document._lastClickedAddBtn;
        if (lastBtn) {
            const card = lastBtn.closest('.product-card') || lastBtn;
            card.classList.remove('is-shaking');
            void card.offsetWidth;
            card.classList.add('is-shaking');
            setTimeout(() => card.classList.remove('is-shaking'), 450);
        }
    };
    // Track el último botón clicado para asociar el shake
    document.addEventListener('click', (e) => {
        const b = e.target.closest('.add-to-cart, .qty-btn, .reel-action');
        if (b) document._lastClickedAddBtn = b;
    }, true);
})();
