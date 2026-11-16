const CART_KEY = 'cusesoft_cart_v1';

const listeners = new Set();

function loadCart() {
  try {
    const raw = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    return [...new Set(raw.filter((id) => typeof id === 'string'))].slice(0, 10);
  } catch {
    return [];
  }
}

export const state = {
  config: null,
  products: [],
  categories: [],
  user: null,
  cart: loadCart(),
  filters: { query: '', category: 'Todos' },
};

function persistCart() {
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(state.cart));
  } catch {
    /* almacenamiento no disponible */
  }
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emit(event) {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.error('[state]', error);
    }
  }
}

export function setUser(user) {
  state.user = user || null;
  emit('user');
}

export function setCatalog({ products = [], categories = [] }) {
  state.products = products;
  state.categories = categories;
  const valid = new Set(products.map((product) => product.id));
  const filtered = state.cart.filter((id) => valid.has(id));
  if (filtered.length !== state.cart.length) {
    state.cart = filtered;
    persistCart();
  }
  emit('catalog');
}

export function getProduct(productId) {
  return state.products.find((product) => product.id === productId) || null;
}

export function addToCart(productId) {
  if (!getProduct(productId) || state.cart.includes(productId)) return false;
  if (state.cart.length >= 10) return false;
  state.cart = [...state.cart, productId];
  persistCart();
  emit('cart');
  return true;
}

export function removeFromCart(productId) {
  const next = state.cart.filter((id) => id !== productId);
  if (next.length === state.cart.length) return;
  state.cart = next;
  persistCart();
  emit('cart');
}

export function clearCart() {
  state.cart = [];
  persistCart();
  emit('cart');
}

export function cartItems() {
  return state.cart.map((id) => getProduct(id)).filter(Boolean);
}

export function cartTotal() {
  return Number(cartItems().reduce((sum, product) => sum + product.price, 0).toFixed(2));
}

export function cartCount() {
  return state.cart.length;
}

export function formatMoney(value) {
  return `S/ ${Number(value || 0).toFixed(2)}`;
}

export function setFilter(patch) {
  state.filters = { ...state.filters, ...patch };
  emit('filters');
}

export function filteredProducts() {
  const query = state.filters.query.trim().toLowerCase();
  return state.products.filter((product) => {
    const matchesCategory =
      state.filters.category === 'Todos' || product.category === state.filters.category;
    if (!matchesCategory) return false;
    if (!query) return true;
    return `${product.name} ${product.category} ${product.tagline}`.toLowerCase().includes(query);
  });
}
