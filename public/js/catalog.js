import { api } from './api.js';
import { openAuth } from './auth.js';
import { addProductToCart } from './cart.js';
import { openCheckout } from './checkout.js';
import {
  filteredProducts,
  formatMoney,
  getProduct,
  setCatalog,
  setFilter,
  state,
  subscribe,
} from './state.js';
import { $, closeModal, esc, icons, openModal, toast } from './ui.js';

function skeletonGrid() {
  const grid = $('#productGrid');
  if (!grid) return;
  grid.innerHTML = Array.from({ length: 8 }, () => `
    <div class="skeleton-card" aria-hidden="true">
      <div class="skeleton skeleton-cover"></div>
      <div class="skeleton skeleton-line w-40"></div>
      <div class="skeleton skeleton-line w-60"></div>
      <div class="skeleton skeleton-line"></div>
    </div>`).join('');
}

function renderChips() {
  const container = $('#categoryChips');
  if (!container) return;
  const categories = ['Todos', ...state.categories];
  container.innerHTML = categories
    .map(
      (category) => `
      <button class="chip ${state.filters.category === category ? 'is-active' : ''}" type="button"
        data-category="${esc(category)}" aria-pressed="${state.filters.category === category}">
        ${esc(category)}
      </button>`,
    )
    .join('');
}

function syncChips() {
  document.querySelectorAll('#categoryChips [data-category]').forEach((chip) => {
    const active = chip.dataset.category === state.filters.category;
    chip.classList.toggle('is-active', active);
    chip.setAttribute('aria-pressed', String(active));
  });
}

function badgeMarkup(product) {
  if (!product.badge) return '';
  const accent = product.badge.toLowerCase() === 'nuevo';
  return `<span class="product-badge ${accent ? 'is-accent' : ''}">${esc(product.badge)}</span>`;
}

function productCard(product) {
  return `
    <article class="product-card" data-card="${esc(product.id)}">
      <div class="product-cover">
        <img src="${esc(product.cover)}" alt="Portada de ${esc(product.name)}" loading="lazy">
        ${badgeMarkup(product)}
      </div>
      <div class="product-body">
        <span class="product-cat">${esc(product.category)}</span>
        <h3 class="product-name">
          <button class="product-link" type="button" data-product="${esc(product.id)}">${esc(product.name)}</button>
        </h3>
        <p class="product-tagline">${esc(product.tagline)}</p>
        <div class="product-rating">
          <span class="stars" aria-hidden="true">★★★★★</span>
          <span>${Number(product.rating).toFixed(1)} · ${product.reviews} reseñas</span>
        </div>
        <div class="product-foot">
          <div class="price">
            <strong>${formatMoney(product.price)}</strong>
            ${product.compareAt ? `<s>${formatMoney(product.compareAt)}</s>` : ''}
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <a class="btn btn-ghost btn-sm" href="/producto/${esc(product.id)}" aria-label="Ver ficha de ${esc(product.name)}">Ficha</a>
            <button class="add-btn" type="button" data-add="${esc(product.id)}" aria-label="Agregar ${esc(product.name)} al carrito">
              ${icons.plus} Agregar
            </button>
          </div>
        </div>
      </div>
    </article>`;
}

function renderGrid() {
  const grid = $('#productGrid');
  const empty = $('#catalogEmpty');
  if (!grid) return;

  const items = filteredProducts();
  if (!items.length) {
    grid.innerHTML = '';
    if (empty) empty.hidden = false;
    return;
  }

  if (empty) empty.hidden = true;
  grid.innerHTML = items.map(productCard).join('');
}

function openProduct(productId) {
  const product = getProduct(productId);
  if (!product) return;

  const body = $('#productModalBody');
  if (!body) return;

  body.innerHTML = `
    <div class="product-detail">
      <div class="product-detail-media">
        <img src="${esc(product.cover)}" alt="Portada de ${esc(product.name)}">
        ${badgeMarkup(product)}
      </div>
      <div class="product-detail-body">
        <span class="product-cat">${esc(product.category)} · ${esc(product.fileLabel)}</span>
        <h2 id="productModalTitle">${esc(product.name)}</h2>
        <p class="product-detail-tagline">${esc(product.description)}</p>
        <div class="product-detail-price">
          <strong>${formatMoney(product.price)}</strong>
          ${product.compareAt ? `<s>${formatMoney(product.compareAt)}</s>` : ''}
        </div>
        <div class="product-detail-meta">
          <span class="meta-pill">${icons.download} Descarga inmediata</span>
          <span class="meta-pill">${icons.play} Video de instrucciones</span>
          <span class="meta-pill">${icons.shield} Pago con Yape</span>
          <span class="meta-pill">${icons.clock} Link válido 7 días</span>
        </div>

        <div class="product-detail-actions">
          <button class="btn btn-primary btn-lg" type="button" data-buy-now="${esc(product.id)}">
            Comprar ahora · ${formatMoney(product.price)}
          </button>
          <button class="btn btn-ghost" type="button" data-add="${esc(product.id)}">Agregar al carrito</button>
        </div>

        <h3 class="includes-title">Qué incluye</h3>
        <ul class="includes-list">
          ${product.includes.map((item) => `<li>${icons.check}<span>${esc(item)}</span></li>`).join('')}
        </ul>

        <div class="detail-note">
          ${icons.info}
          <span>Recibirás 2 enlaces por correo: uno para descargar el producto y otro con el video de instrucciones en YouTube. También quedarán disponibles en <strong>Mis compras</strong>.</span>
        </div>
      </div>
    </div>`;

  openModal('productModal');
}

function buyNow(productId) {
  const product = getProduct(productId);
  if (!product) return;

  addProductToCart(productId, { silent: true });

  if (!state.user) {
    closeModal('productModal');
    openAuth({ intent: 'checkout' });
    toast('Inicia sesión o crea tu cuenta para completar la compra.', 'info', 'Un paso más');
    return;
  }

  closeModal('productModal');
  openCheckout();
}

function syncHeroFeatured() {
  const ids = state.config?.featuredIds;
  if (!Array.isArray(ids) || !ids.length) return;
  const featured = ids.map((id) => getProduct(id)).filter(Boolean);
  if (!featured.length) return;

  ['.float-a', '.float-b'].forEach((selector, idx) => {
    const card = document.querySelector(selector);
    const product = featured[idx];
    if (!card || !product) return;
    const img = card.querySelector('img');
    const title = card.querySelector('.float-meta span');
    const price = card.querySelector('.float-meta strong');
    if (img && product.cover) img.src = product.cover;
    if (title) title.textContent = product.name;
    if (price) price.textContent = formatMoney(product.price);
  });
}

export async function initCatalog() {
  skeletonGrid();

  $('#searchInput')?.addEventListener('input', (event) => {
    setFilter({ query: event.target.value });
  });

  $('#categoryChips')?.addEventListener('click', (event) => {
    const chip = event.target.closest('[data-category]');
    if (!chip) return;
    setFilter({ category: chip.dataset.category });
  });

  $('#productGrid')?.addEventListener('click', (event) => {
    const addButton = event.target.closest('[data-add]');
    if (addButton) {
      event.stopPropagation();
      addProductToCart(addButton.dataset.add);
      return;
    }
    const card = event.target.closest('[data-product], [data-card]');
    if (card) openProduct(card.dataset.product || card.dataset.card);
  });

  $('#productModalBody')?.addEventListener('click', (event) => {
    const buyButton = event.target.closest('[data-buy-now]');
    if (buyButton) {
      buyNow(buyButton.dataset.buyNow);
      return;
    }
    const addButton = event.target.closest('[data-add]');
    if (addButton) {
      addProductToCart(addButton.dataset.add);
    }
  });

  $('#clearFiltersBtn')?.addEventListener('click', () => {
    const input = $('#searchInput');
    if (input) input.value = '';
    setFilter({ query: '', category: 'Todos' });
  });

  subscribe((event) => {
    if (event === 'catalog') {
      renderChips();
      renderGrid();
    }
    if (event === 'filters') {
      syncChips();
      renderGrid();
    }
  });

  document.addEventListener('cs:catalog:refresh', async () => {
    try {
      const data = await api.products();
      setCatalog({ products: data.products || [], categories: data.categories || [] });
      renderChips();
      renderGrid();
      syncHeroFeatured();
    } catch {
      // ignore
    }
  });

  try {
    const data = await api.products();
    setCatalog({ products: data.products || [], categories: data.categories || [] });
    renderChips();
    renderGrid();
    syncHeroFeatured();

    const addParam = new URLSearchParams(window.location.search).get('add');
    if (addParam && getProduct(addParam)) {
      addProductToCart(addParam);
      window.history.replaceState({}, '', '/');
    }
  } catch (error) {
    const grid = $('#productGrid');
    if (grid) {
      grid.innerHTML = '';
    }
    const empty = $('#catalogEmpty');
    if (empty) {
      empty.hidden = false;
      const title = empty.querySelector('h3');
      if (title) title.textContent = 'No pudimos cargar el catálogo';
      const copy = empty.querySelector('p');
      if (copy) copy.textContent = error.message;
    }
    toast(error.message, 'error', 'Catálogo no disponible');
  }
}
