// =============================================
// FALAHBAR.SnkS - LÓGICA DE LA TIENDA
// =============================================

// CATÁLOGO DE PRODUCTOS (precios en pesos argentinos)
// Podés editar nombres, precios y emojis libremente.
const golosinas = [
    { id: 'g1',  nombre: 'Alfajor de Chocolate',           precio: 1500, emoji: '🍫' },
    { id: 'g2',  nombre: 'Alfajor de Dulce de Leche',      precio: 1500, emoji: '🍪' },
    { id: 'g3',  nombre: 'Alfajor Blanco',                 precio: 1400, emoji: '🤍' },
    { id: 'g4',  nombre: 'Bocadito con Chocolate de Leche',precio: 800,  emoji: '🍬' },
    { id: 'g5',  nombre: 'Bocadito con Chocolate Blanco',  precio: 800,  emoji: '🍬' },
    { id: 'g6',  nombre: 'Gomitas Surtidas',               precio: 900,  emoji: '🍭' },
    { id: 'g7',  nombre: 'Gomitas Ácidas',                 precio: 950,  emoji: '🍋' },
    { id: 'g8',  nombre: 'Garrapiñadas de Maní',           precio: 1200, emoji: '🥜' },
    { id: 'g9',  nombre: 'Garrapiñadas de Almendra',       precio: 1600, emoji: '🌰' },
    { id: 'g10', nombre: 'Tableta Chocolate con Leche',    precio: 2500, emoji: '🍫' },
    { id: 'g11', nombre: 'Tableta Chocolate Amargo',       precio: 2800, emoji: '🍫' },
    { id: 'g12', nombre: 'Chupetines de Frutas',           precio: 400,  emoji: '🍭' },
    { id: 'g13', nombre: 'Turrón de Maní',                 precio: 1100, emoji: '🥇' },
    { id: 'g14', nombre: 'Turrón de Chocolate',            precio: 1300, emoji: '🍫' },
    { id: 'g15', nombre: 'Mix de Caramelos',               precio: 1200, emoji: '🍬' },
    { id: 'g16', nombre: 'Caja Surtida de Golosinas',      precio: 5500, emoji: '🎁' }
];

const snacks = [
    { id: 's1',  nombre: 'Pop Corn Clásico',          precio: 900,  emoji: '🍿' },
    { id: 's2',  nombre: 'Pop Corn con Queso',        precio: 1100, emoji: '🧀' },
    { id: 's3',  nombre: 'Pop Corn Dulce',            precio: 1000, emoji: '🍯' },
    { id: 's4',  nombre: 'Palitos Salados',           precio: 700,  emoji: '🥨' },
    { id: 's5',  nombre: 'Chizitos',                  precio: 900,  emoji: '🧡' },
    { id: 's6',  nombre: 'Cheetos',                   precio: 1000, emoji: '🔥' },
    { id: 's7',  nombre: 'Papas Fritas Clásicas',     precio: 1200, emoji: '🥔' },
    { id: 's8',  nombre: 'Papas Fritas con Sabor',    precio: 1300, emoji: '🌶️' },
    { id: 's9',  nombre: 'Papas Onduladas',           precio: 1400, emoji: '🥔' },
    { id: 's10', nombre: 'Maní Salado',               precio: 800,  emoji: '🥜' },
    { id: 's11', nombre: 'Maní con Miel',             precio: 1000, emoji: '🍯' },
    { id: 's12', nombre: 'Mix de Frutos Secos',       precio: 2200, emoji: '🌰' },
    { id: 's13', nombre: 'Crackers',                  precio: 800,  emoji: '🍘' },
    { id: 's14', nombre: 'Tostadas',                  precio: 700,  emoji: '🍞' },
    { id: 's15', nombre: 'Pistachos',                 precio: 2800, emoji: '🌿' },
    { id: 's16', nombre: 'Caja Surtida de Snacks',    precio: 5500, emoji: '🎁' }
];

// =============================================
// SHORTS / VIDEOS
// Dejá el array vacío para mostrar placeholders elegantes.
// Para agregar un video real, elegí una de estas formas:
//
// 1) Embed externo (YouTube Shorts, Instagram Reels, TikTok):
//    { id: 1, title: 'Mix de frutos secos', embedUrl: 'https://www.youtube.com/embed/XXXXXX' }
//
// 2) Archivo propio (MP4 alojado en la web):
//    { id: 2, title: 'Unboxing alfajores', videoUrl: 'videos/alfajores.mp4', thumbnail: 'img/alfajores.jpg' }
//
// 3) Solo miniatura (link a video externo en otro lado):
//    { id: 3, title: 'Nuevos snacks', thumbnail: 'img/snacks.jpg', link: 'https://instagram.com/p/XXXX/' }
// =============================================
const shortsData = [
    { id: 1, title: 'Falahbar en acción 🍫', videoUrl: 'videos/short1.mp4' },
    { id: 2, title: 'Novedades Falahbar ✨',  videoUrl: 'videos/short2.mp4' },
    { id: 3, title: 'Lo mejor de Falahbar 🍿', videoUrl: 'videos/short3.mp4' }
    // Agregá más objetos acá a medida que tengas nuevos videos.
];

const WHATSAPP_NUMBER = '5493804653294';
const FREE_SHIPPING_THRESHOLD = 30000; // Envío gratis superando este monto

// =============================================
// STORAGE KEYS
// =============================================
const STORAGE_KEY_USER             = 'falahbar_snks_user_name';
const STORAGE_KEY_CART             = 'falahbar_snks_cart';
const STORAGE_KEY_MODAL_DISMISSED  = 'falahbar_snks_modal_dismissed';

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
        if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) cart = parsed;
        }
    } catch (_) {
        cart = [];
    }
}

loadCartFromStorage();

// =============================================
// RENDERIZAR PRODUCTOS
// =============================================
function renderProducts(list, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = list.map(p => `
        <div class="product-card">
            <div class="product-emoji" aria-hidden="true">${p.emoji}</div>
            <h3>${p.nombre}</h3>
            <div class="product-price">$${p.precio.toLocaleString('es-AR')}</div>
            <button class="add-to-cart" data-id="${p.id}" aria-label="Agregar ${p.nombre} al carrito">
                Agregar
            </button>
        </div>
    `).join('');
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
        return `
            <a class="short-card short-card--video" href="shorts.html" aria-label="${title || 'Ver en Shorts'}">
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

function renderShorts(containerId, { limit = null, minPlaceholders = 6 } = {}) {
    const container = document.getElementById(containerId);
    if (!container) return;

    let items = shortsData.slice();
    if (limit) items = items.slice(0, limit);

    // Rellenar con placeholders hasta llegar al mínimo visual
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
                    <a href="index.html#golosinas" class="reel-cta">Ver productos →</a>
                </div>

                <div class="reel-actions">
                    <button class="reel-action" data-action="mute" aria-label="Activar o silenciar sonido">
                        <span class="reel-action-icon">🔇</span>
                        <span class="reel-action-label">Sonido</span>
                    </button>
                    <button class="reel-action" data-action="share" aria-label="Compartir">
                        <span class="reel-action-icon">📤</span>
                        <span class="reel-action-label">Compartir</span>
                    </button>
                    <a class="reel-action" href="index.html#cart" aria-label="Ver carrito">
                        <span class="reel-action-icon">🛒</span>
                        <span class="reel-action-label">Carrito</span>
                    </a>
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
    return [...golosinas, ...snacks].find(p => p.id === id);
}

function addToCart(id, btnEl) {
    const product = findProduct(id);
    if (!product) return;

    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    saveCartToStorage();
    updateCartUI();

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
    const totalPrice = cart.reduce((sum, i) => sum + (i.precio * i.qty), 0);

    // Actualizar TODOS los contadores de carrito (por si hay varios, ej. placeholder en otras páginas)
    document.querySelectorAll('.cart-count').forEach(el => { el.textContent = totalItems; });

    if (cartTotal) cartTotal.textContent = '$' + totalPrice.toLocaleString('es-AR');

    updateShippingProgress(totalPrice);

    if (cart.length === 0) {
        if (cartItems) cartItems.innerHTML = '<p class="cart-empty">Tu carrito está vacío.</p>';
        if (sendBtn) sendBtn.disabled = true;
        if (clearBtn) clearBtn.style.display = 'none';
    } else {
        if (sendBtn) sendBtn.disabled = false;
        if (clearBtn) clearBtn.style.display = 'block';
        if (cartItems) {
            cartItems.innerHTML = cart.map(i => `
                <div class="cart-item">
                    <div class="cart-item-info">
                        <h4><span aria-hidden="true">${i.emoji}</span> ${escapeHtml(i.nombre)}</h4>
                        <div class="cart-item-price">
                            $${(i.precio * i.qty).toLocaleString('es-AR')}
                        </div>
                    </div>
                    <div class="qty-controls">
                        <button class="qty-btn" data-action="decrease" data-id="${i.id}" aria-label="Restar uno">−</button>
                        <span class="qty-value">${i.qty}</span>
                        <button class="qty-btn" data-action="increase" data-id="${i.id}" aria-label="Sumar uno">+</button>
                    </div>
                </div>
            `).join('');
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
// ENVIAR PEDIDO POR WHATSAPP
// =============================================
const sendBtn = document.getElementById('sendWhatsApp');
if (sendBtn) {
    sendBtn.addEventListener('click', () => {
        if (cart.length === 0) return;

        const savedUserName = getSavedUserName();
        let message = savedUserName
            ? `Hola Falahbar! Soy ${savedUserName} y quiero hacer el siguiente pedido:\n\n`
            : 'Hola Falahbar! Quiero hacer el siguiente pedido:\n\n';

        cart.forEach(i => {
            message += `- ${i.nombre} x${i.qty} - $${(i.precio * i.qty).toLocaleString('es-AR')}\n`;
        });
        const total = cart.reduce((sum, i) => sum + (i.precio * i.qty), 0);
        message += `\nTotal: $${total.toLocaleString('es-AR')}\n`;
        message += `Zona de entrega: La Rioja Capital\n`;
        if (total >= FREE_SHIPPING_THRESHOLD) {
            message += `Envío: GRATIS (por superar $${FREE_SHIPPING_THRESHOLD.toLocaleString('es-AR')}) 🎉\n`;
        }
        message += `\nGracias!`;

        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
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
// BOOT: render inicial
// =============================================
renderProducts(golosinas, 'golosinasGrid');
renderProducts(snacks, 'snacksGrid');
renderShorts('homeShortsScroller', { limit: 5 });     // preview horizontal en home
renderReels('reelsFeed');                             // feed inmersivo estilo TikTok / Reels en shorts.html
updateCartUI(); // refleja el carrito persistido (incluso en páginas sin carrito, para el contador)
