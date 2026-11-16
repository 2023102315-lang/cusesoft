import { openAuth } from './auth.js';
import { openCheckout } from './checkout.js';
import {
  addToCart,
  cartCount,
  cartItems,
  cartTotal,
  formatMoney,
  removeFromCart,
  state,
  subscribe,
} from './state.js';
import { $, closeCartDrawer, esc, icons, openCartDrawer, toast } from './ui.js';

export function addProductToCart(productId, { silent = false } = {}) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    toast('Este producto ya no está disponible.', 'error');
    return false;
  }
  if (state.cart.includes(productId)) {
    if (!silent) toast('Este producto ya está en tu carrito.', 'info');
    return false;
  }
  if (!addToCart(productId)) {
    toast('Puedes comprar hasta 10 productos por pedido.', 'info');
    return false;
  }
  if (!silent) toast('Producto agregado a tu carrito.', 'success');
  return true;
}

export function initCart() {
  $('#cartBtn')?.addEventListener('click', openCartDrawer);

  $('#checkoutBtn')?.addEventListener('click', () => {
    if (!state.cart.length) {
      toast('Tu carrito está vacío. Agrega un producto para continuar.', 'info');
      return;
    }
    if (!state.user) {
      closeCartDrawer();
      openAuth({ intent: 'checkout' });
      return;
    }
    closeCartDrawer({ restoreFocus: false });
    openCheckout();
  });

  $('#cartItems')?.addEventListener('click', (event) => {
    const removeButton = event.target.closest('[data-remove]');
    if (removeButton) {
      removeFromCart(removeButton.dataset.remove);
      toast('Producto eliminado del carrito.', 'info');
    }
  });

  document.addEventListener('click', (event) => {
    if (event.target.closest('[data-close-cart]')) closeCartDrawer();
  });

  subscribe((event) => {
    if (['cart', 'catalog', 'user'].includes(event)) renderCart();
  });

  renderCart();
}

export function renderCart() {
  const items = cartItems();
  const count = cartCount();
  const total = cartTotal();

  const badge = $('#cartCount');
  if (badge) {
    badge.textContent = String(count);
    badge.hidden = count === 0;
    badge.setAttribute('aria-label', `${count} productos en el carrito`);
  }

  const totalEl = $('#cartTotal');
  if (totalEl) totalEl.textContent = formatMoney(total);

  const hint = $('#cartHint');
  if (hint) {
    hint.textContent = state.user
      ? 'Pago con Yape · Descarga inmediata'
      : 'Inicia sesión o crea tu cuenta al pagar. Tu carrito se conserva.';
  }

  const checkoutButton = $('#checkoutBtn');
  if (checkoutButton) {
    checkoutButton.disabled = items.length === 0;
    checkoutButton.textContent =
      items.length === 0
        ? 'Carrito vacío'
        : state.user
          ? 'Pagar con Yape'
          : 'Iniciar sesión y pagar';
  }

  const container = $('#cartItems');
  if (!container) return;

  if (!items.length) {
    container.innerHTML = `
      <div class="cart-empty">
        <span class="empty-ico" aria-hidden="true">${icons.receipt}</span>
        <h3>Tu carrito está vacío</h3>
        <p>Explora el catálogo y agrega el recurso que necesitas.</p>
        <button class="btn btn-primary btn-sm" type="button" data-close-cart>Ver catálogo</button>
      </div>`;
    return;
  }

  container.innerHTML = items
    .map(
      (product) => `
      <div class="cart-item">
        <img src="${esc(product.cover)}" alt="Portada de ${esc(product.name)}">
        <div>
          <div class="cart-item-name">${esc(product.name)}</div>
          <div class="cart-item-meta">${esc(product.fileLabel)} · Descarga inmediata</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:4px;">
          <span class="cart-item-price">${formatMoney(product.price)}</span>
          <button class="cart-remove" type="button" data-remove="${esc(product.id)}" aria-label="Quitar ${esc(product.name)} del carrito">
            ${icons.trash}
          </button>
        </div>
      </div>`,
    )
    .join('');
}
