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

const WHATSAPP_NUMBER = '5493804653294';

// =============================================
// ESTADO DEL CARRITO
// =============================================
let cart = [];
const STORAGE_KEY_USER = 'falahbar_snks_user_name';

// =============================================
// RENDERIZAR PRODUCTOS
// =============================================
function renderProducts(list, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = list.map(p => `
        <div class="product-card">
            <div class="product-emoji">${p.emoji}</div>
            <h3>${p.nombre}</h3>
            <div class="product-price">$${p.precio.toLocaleString('es-AR')}</div>
            <button class="add-to-cart" data-id="${p.id}">Agregar</button>
        </div>
    `).join('');
}

renderProducts(golosinas, 'golosinasGrid');
renderProducts(snacks, 'snacksGrid');

// =============================================
// FUNCIONES DEL CARRITO
// =============================================
function findProduct(id) {
    return [...golosinas, ...snacks].find(p => p.id === id);
}

function addToCart(id) {
    const product = findProduct(id);
    if (!product) return;

    const existing = cart.find(item => item.id === id);
    if (existing) {
        existing.qty += 1;
    } else {
        cart.push({ ...product, qty: 1 });
    }
    updateCartUI();
}

function changeQty(id, delta) {
    const item = cart.find(i => i.id === id);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) {
        cart = cart.filter(i => i.id !== id);
    }
    updateCartUI();
}

function updateCartUI() {
    const cartItems = document.getElementById('cartItems');
    const cartCount = document.getElementById('cartCount');
    const cartTotal = document.getElementById('cartTotal');
    const sendBtn = document.getElementById('sendWhatsApp');

    const totalItems = cart.reduce((sum, i) => sum + i.qty, 0);
    const totalPrice = cart.reduce((sum, i) => sum + (i.precio * i.qty), 0);

    cartCount.textContent = totalItems;
    cartTotal.textContent = '$' + totalPrice.toLocaleString('es-AR');

    if (cart.length === 0) {
        cartItems.innerHTML = '<p class="cart-empty">Tu carrito está vacío.</p>';
        sendBtn.disabled = true;
    } else {
        sendBtn.disabled = false;
        cartItems.innerHTML = cart.map(i => `
            <div class="cart-item">
                <div class="cart-item-info">
                    <h4>${i.emoji} ${i.nombre}</h4>
                    <div class="cart-item-price">
                        $${(i.precio * i.qty).toLocaleString('es-AR')}
                    </div>
                </div>
                <div class="qty-controls">
                    <button class="qty-btn" data-action="decrease" data-id="${i.id}">−</button>
                    <span class="qty-value">${i.qty}</span>
                    <button class="qty-btn" data-action="increase" data-id="${i.id}">+</button>
                </div>
            </div>
        `).join('');
    }
}

// =============================================
// EVENTOS: AGREGAR AL CARRITO (delegación)
// =============================================
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('add-to-cart')) {
        addToCart(e.target.dataset.id);
    }
    if (e.target.classList.contains('qty-btn')) {
        const id = e.target.dataset.id;
        const action = e.target.dataset.action;
        changeQty(id, action === 'increase' ? 1 : -1);
    }
});

// =============================================
// ABRIR / CERRAR CARRITO
// =============================================
const cartEl = document.getElementById('cart');
const cartOverlay = document.getElementById('cartOverlay');
const cartBtn = document.getElementById('cartBtn');
const cartClose = document.getElementById('cartClose');

function openCart() {
    if (!cartEl) return;
    cartEl.classList.add('active');
    cartOverlay.classList.add('active');
}
function closeCart() {
    if (!cartEl) return;
    cartEl.classList.remove('active');
    cartOverlay.classList.remove('active');
}

if (cartBtn) cartBtn.addEventListener('click', openCart);
if (cartClose) cartClose.addEventListener('click', closeCart);
if (cartOverlay) cartOverlay.addEventListener('click', closeCart);

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
        message += `\nTotal: $${total.toLocaleString('es-AR')}\n\nGracias!`;

        const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
        window.open(url, '_blank');
    });
}


// =============================================
// NOMBRE DEL CLIENTE (login simple con localStorage)
// =============================================
const userForm = document.getElementById('userForm');
const userNameInput = document.getElementById('userName');
const userSavedMessage = document.getElementById('userSavedMessage');

function getSavedUserName() {
    return localStorage.getItem(STORAGE_KEY_USER)?.trim() || '';
}

function setSavedUserName(name) {
    localStorage.setItem(STORAGE_KEY_USER, name.trim());
}

function loadSavedUserName() {
    if (!userNameInput) return;
    const savedName = getSavedUserName();
    if (savedName) {
        userNameInput.value = savedName;
        if (userSavedMessage) {
            userSavedMessage.textContent = `Nombre guardado: ${savedName}`;
        }
    }
}

if (userForm) {
    loadSavedUserName();

    userForm.addEventListener('submit', (e) => {
        e.preventDefault();

        const name = userNameInput.value.trim();

        if (name.length < 2) {
            if (userSavedMessage) {
                userSavedMessage.textContent = 'Ingresá un nombre válido.';
            }
            return;
        }

        setSavedUserName(name);

        if (userSavedMessage) {
            userSavedMessage.textContent = `Nombre guardado: ${name}`;
        }
    });
}

// =============================================
// MENÚ MÓVIL
// =============================================
const navToggle = document.getElementById('navToggle');
const navLinks = document.getElementById('navLinks');

if (navToggle && navLinks) {
    navToggle.addEventListener('click', () => {
        navLinks.classList.toggle('active');
    });

    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
        });
    });
}

// =============================================
// FORMULARIO DE CONTACTO (en contact.html)
// =============================================
const contactForm = document.getElementById('contactForm');

if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
        e.preventDefault();
        clearErrors();

        const name = document.getElementById('name');
        const email = document.getElementById('email');
        const subject = document.getElementById('subject');
        const message = document.getElementById('message');

        let isValid = true;

        if (name.value.trim().length < 2) {
            showError(name, 'Por favor ingresa tu nombre');
            isValid = false;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.value.trim())) {
            showError(email, 'Por favor ingresa un email válido');
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

        if (isValid) {
            document.getElementById('formSuccess').style.display = 'block';
            contactForm.reset();
            setTimeout(() => {
                document.getElementById('formSuccess').style.display = 'none';
            }, 5000);
        }
    });
}

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

// =============================================
// ANIMACIÓN AL HACER SCROLL (fade-in)
// =============================================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const fadeObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

document.querySelectorAll('.value-item').forEach(el => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
    fadeObserver.observe(el);
});
