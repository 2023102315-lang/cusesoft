import { initTheme } from './theme.js';

const TOKEN_KEY = 'cusesoft_admin_token_v1';

const STATUS_LABELS = {
  pending: 'Pendiente',
  verifying: 'En verificación',
  paid: 'Pagado',
  expired: 'Vencido',
};

const state = {
  token: sessionStorage.getItem(TOKEN_KEY) || '',
  tab: 'overview',
  loginMode: 'credentials',
  overview: null,
  settings: null,
  orders: [],
  products: [],
  files: [],
  users: [],
  filter: 'all',
  ordersQuery: '',
  productsQuery: '',
  usersQuery: '',
  config: null,
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function money(value) {
  return `S/ ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-PE', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

function initials(name = '') {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'US';
  return `${parts[0][0] || ''}${parts[1]?.[0] || ''}`.toUpperCase();
}

let toastTimer = null;

function toast(message, isError = false) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.toggle('is-error', isError);
  element.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    element.hidden = true;
  }, 4200);
}

async function adminRequest(path, { method = 'GET', body } = {}) {
  const headers = {};
  if (state.token) headers['X-Admin-Token'] = state.token;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || 'Error al comunicarse con el servidor.');
    error.status = response.status;
    error.code = data.code;
    throw error;
  }
  return data;
}

function showGate(errorMessage = '') {
  $('#gate').hidden = false;
  $('#panel').hidden = true;
  const errorBox = $('#gateError');
  if (errorMessage) {
    errorBox.textContent = errorMessage;
    errorBox.hidden = false;
  } else {
    errorBox.hidden = true;
  }
}

function showPanel() {
  $('#gate').hidden = true;
  $('#panel').hidden = false;
}

function setLoginMode(mode) {
  state.loginMode = mode === 'token' ? 'token' : 'credentials';
  $$('[data-login-mode]').forEach((btn) => {
    const active = btn.dataset.loginMode === state.loginMode;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  });
  $('#credsFields').hidden = state.loginMode !== 'credentials';
  $('#tokenFields').hidden = state.loginMode !== 'token';
  $('#gateError').hidden = true;
}

function switchTab(tab) {
  state.tab = tab;
  $$('#adminTabs .admin-tab').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.tab === tab);
  });
  $('#tabOverview').hidden = tab !== 'overview';
  $('#tabOrders').hidden = tab !== 'orders';
  $('#tabProducts').hidden = tab !== 'products';
  $('#tabUsers').hidden = tab !== 'users';
  $('#tabSettings').hidden = tab !== 'settings';
}

/* Resumen -------------------------------------------------------- */

function renderOverview() {
  const data = state.overview;
  if (!data) return;
  const { stats, system } = data;

  const badge = $('#verifyingBadge');
  if (stats.ordersVerifying > 0) {
    badge.textContent = String(stats.ordersVerifying);
    badge.hidden = false;
  } else {
    badge.hidden = true;
  }

  $('#overviewStats').innerHTML = `
    <article class="admin-stat">
      <span>Ingresos pagados</span>
      <strong>${esc(money(stats.revenue))}</strong>
    </article>
    <article class="admin-stat">
      <span>Pedidos (${stats.ordersVerifying} por aprobar)</span>
      <strong>${stats.ordersPaid} / ${stats.ordersTotal}</strong>
    </article>
    <article class="admin-stat">
      <span>Productos en catálogo</span>
      <strong>${stats.productsTotal}</strong>
    </article>
    <article class="admin-stat">
      <span>Usuarios registrados</span>
      <strong>${stats.usersTotal}</strong>
    </article>
  `;

  $('#envBadge').textContent = system.env || 'development';

  const rows = [
    ['Tienda', system.storeName],
    ['Modo de correo', system.mailerConfigured ? 'SMTP configurado' : `Local (Outbox: ${stats.outboxCount})`],
    ['Aprobación manual', system.requireManualApproval ? 'Activada (requiere aprobar)' : 'Automática'],
    ['Yape receptor', `${system.yape.name} · ${system.yape.phone}`],
    ['Google Sign-In', system.googleEnabled ? 'Configurado' : 'Desactivado'],
    ['Archivos en server/files', `${stats.filesTotal} archivo(s)`],
  ];

  $('#systemInfo').innerHTML = rows
    .map(
      ([label, value]) => `
        <div class="admin-kv-row">
          <dt>${esc(label)}</dt>
          <dd>${esc(value)}</dd>
        </div>`,
    )
    .join('');

  const quickOutbox = $('#quickOutboxBtn');
  if (quickOutbox) quickOutbox.hidden = !system.devMode;
}

/* Pedidos -------------------------------------------------------- */

function renderOrderStats() {
  const orders = state.orders;
  const verifying = orders.filter((order) => order.status === 'verifying').length;
  const paid = orders.filter((order) => order.status === 'paid');
  const revenue = paid.reduce((sum, order) => sum + Number(order.total || 0), 0);

  $('#stats').innerHTML = `
    <article class="admin-stat">
      <span>En verificación</span>
      <strong>${verifying}</strong>
    </article>
    <article class="admin-stat">
      <span>Pagados</span>
      <strong>${paid.length}</strong>
    </article>
    <article class="admin-stat">
      <span>Total pedidos</span>
      <strong>${orders.length}</strong>
    </article>
    <article class="admin-stat">
      <span>Ingresos pagados</span>
      <strong>${esc(money(revenue))}</strong>
    </article>
  `;
}

function renderOrderFilters() {
  const counts = {
    all: state.orders.length,
    verifying: state.orders.filter((o) => o.status === 'verifying').length,
    paid: state.orders.filter((o) => o.status === 'paid').length,
    pending: state.orders.filter((o) => o.status === 'pending').length,
    expired: state.orders.filter((o) => o.status === 'expired').length,
  };
  const labels = {
    all: 'Todos',
    verifying: 'En verificación',
    paid: 'Pagados',
    pending: 'Pendientes',
    expired: 'Vencidos',
  };

  $('#filters').innerHTML = Object.entries(labels)
    .map(
      ([key, label]) => `
        <button
          type="button"
          class="admin-filter ${state.filter === key ? 'is-active' : ''}"
          data-filter="${key}"
        >
          ${esc(label)} (${counts[key] || 0})
        </button>`,
    )
    .join('');
}

function renderOrders() {
  renderOrderStats();
  renderOrderFilters();

  const q = state.ordersQuery.trim().toLowerCase();
  const visible = state.orders.filter((order) => {
    if (state.filter !== 'all' && order.status !== state.filter) return false;
    if (!q) return true;
    const haystack = [
      order.id,
      order.operationCode,
      order.user?.name,
      order.user?.email,
      ...(order.items || []).map((i) => i.name),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });

  const list = $('#orders');
  const empty = $('#empty');

  if (!visible.length) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  list.innerHTML = visible
    .map((order) => {
      const statusLabel = STATUS_LABELS[order.status] || order.status;
      const itemsText = (order.items || []).map((item) => `${item.name} (${money(item.price)})`).join(' · ');
      const customerName = order.user?.name || 'Cliente';
      const customerEmail = order.user?.email || '';

      let actions = '<span class="admin-order-date">Sin acciones</span>';
      if (order.status === 'verifying') {
        actions = `
          <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
            <button class="btn btn-primary btn-sm" type="button" data-approve="${esc(order.id)}">Aprobar</button>
            <button class="btn btn-danger btn-sm" type="button" data-reject="${esc(order.id)}">Rechazar</button>
          </div>`;
      } else if (order.status === 'pending') {
        actions = `<button class="btn btn-danger btn-sm" type="button" data-reject="${esc(order.id)}">Marcar vencido</button>`;
      } else if (order.status === 'paid') {
        actions = '<span class="admin-order-date">Entregado</span>';
      }

      return `
        <article class="admin-order">
          <div class="admin-order-main">
            <div class="admin-order-head">
              <strong class="admin-order-code">${esc(order.id)}</strong>
              <span class="status-chip status-${esc(order.status)}">${esc(statusLabel)}</span>
              <span class="admin-order-date">${esc(formatDate(order.createdAt))}</span>
            </div>
            <div class="admin-order-customer">
              ${esc(customerName)}
              <span class="admin-order-email">${esc(customerEmail)}</span>
            </div>
            <p class="admin-order-items">${esc(itemsText)}</p>
          </div>

          <div class="admin-order-meta">
            <strong>${esc(money(order.total))}</strong>
            <span>${order.operationCode ? `Operación <span class="operation">${esc(order.operationCode)}</span>` : 'Sin código de operación'}</span>
            ${order.paidAt ? `<span>Pagado: ${esc(formatDate(order.paidAt))}</span>` : ''}
          </div>

          <div class="admin-order-actions">
            ${actions}
          </div>
        </article>`;
    })
    .join('');
}

/* Productos ------------------------------------------------------ */

function renderProducts() {
  const q = state.productsQuery.trim().toLowerCase();
  const visible = state.products.filter((product) => {
    if (!q) return true;
    return `${product.name} ${product.category} ${product.id}`.toLowerCase().includes(q);
  });

  const datalist = $('#availableFilesList');
  if (datalist) {
    datalist.innerHTML = state.files.map((file) => `<option value="${esc(file.name)}"></option>`).join('');
  }

  const list = $('#productsList');
  const empty = $('#productsEmpty');
  if (!visible.length) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  list.innerHTML = visible
    .map(
      (product) => `
      <article class="admin-product-card">
        <img class="admin-product-cover" src="${esc(product.cover || '/assets/covers/freelance-os.svg')}" alt="">
        <div class="admin-product-body">
          <div class="admin-product-head">
            <h3>${esc(product.name)}</h3>
            <span class="admin-product-price">${esc(money(product.price))}</span>
          </div>
          <div class="admin-product-meta">
            <span>${esc(product.category)}</span>
            <span>·</span>
            <span class="${product.fileExists ? 'admin-file-ok' : 'admin-file-missing'}">
              ${product.fileExists ? `✓ ${esc(product.fileName)}` : `⚠ Falta ${esc(product.fileName || 'archivo')}`}
            </span>
          </div>
          <div class="admin-product-actions">
            <button class="btn btn-ghost btn-sm" type="button" data-edit-product="${esc(product.id)}">Editar</button>
            <button class="btn btn-danger btn-sm" type="button" data-delete-product="${esc(product.id)}">Eliminar</button>
          </div>
        </div>
      </article>`,
    )
    .join('');
}

function openProductEditor(product = null) {
  const modal = $('#productEditorModal');
  $('#prodFormError').hidden = true;
  $('#prodId').value = product ? product.id : '';
  $('#productEditorTitle').textContent = product ? `Editar: ${product.name}` : 'Nuevo producto';
  $('#prodName').value = product?.name || '';
  $('#prodCategory').value = product?.category || '';
  $('#prodTagline').value = product?.tagline || '';
  $('#prodDescription').value = product?.description || '';
  $('#prodPrice').value = product?.price ?? '';
  $('#prodCompareAt').value = product?.compareAt ?? '';
  $('#prodFileName').value = product?.fileName || '';
  $('#prodFileType').value = product?.fileType || 'ZIP';
  $('#prodCover').value = product?.cover || '/assets/covers/freelance-os.svg';
  $('#prodAccent').value = product?.accent || '#8b5cf6';
  $('#prodBadge').value = product?.badge || '';
  $('#prodYoutubeUrl').value = product?.youtubeUrl || '';
  $('#prodIncludes').value = (product?.includes || []).join('\n');

  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  $('#prodName').focus();
}

function closeProductEditor() {
  const modal = $('#productEditorModal');
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

/* Usuarios ------------------------------------------------------- */

function renderUsers() {
  const q = state.usersQuery.trim().toLowerCase();
  const visible = state.users.filter((user) => {
    if (!q) return true;
    return `${user.fullName} ${user.email}`.toLowerCase().includes(q);
  });

  $('#usersCountLabel').textContent = `${visible.length} usuario(s)`;
  const list = $('#usersList');
  const empty = $('#usersEmpty');

  if (!visible.length) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  list.innerHTML = visible
    .map(
      (user) => `
      <article class="admin-user-row">
        <div class="admin-user-id">
          <span class="avatar is-initials">${esc(initials(user.fullName || user.email))}</span>
          <div>
            <strong>${esc(user.fullName || 'Usuario')}</strong>
            <span>${esc(user.email)}</span>
          </div>
        </div>
        <div class="admin-user-stat">
          <span>Acceso</span>
          <strong>${esc(user.provider === 'google' ? 'Google' : 'OTP Correo')}</strong>
        </div>
        <div class="admin-user-stat">
          <span>Pedidos</span>
          <strong>${user.paidOrdersCount} pagados / ${user.ordersCount}</strong>
        </div>
        <div class="admin-user-stat">
          <span>Total gastado</span>
          <strong>${esc(money(user.totalSpent))}</strong>
        </div>
      </article>`,
    )
    .join('');
}

/* Configuración, Yape y Destacados ------------------------------- */

function renderSettings() {
  const s = state.settings;
  if (!s) return;
  $('#setYapeName').value = s.yapeName || '';
  $('#setYapePhone').value = s.yapePhone || '';
  $('#setYapeQr').value = s.yapeQrImage || '';
  $('#setStoreName').value = s.storeName || '';
  $('#setSupportEmail').value = s.supportEmail || '';
  $('#setManualApproval').checked = Boolean(s.requireManualApproval);

  const featured = new Set(s.featuredIds || []);
  const picker = $('#featuredPicker');
  if (picker) {
    picker.innerHTML = state.products
      .map(
        (product) => `
        <label class="admin-featured-item">
          <input type="checkbox" name="featuredIds" value="${esc(product.id)}" ${featured.has(product.id) ? 'checked' : ''}>
          <div>
            <strong>${esc(product.name)}</strong>
            <span>${esc(product.category)} · ${esc(money(product.price))}</span>
          </div>
        </label>`,
      )
      .join('');
  }
}

/* Carga global --------------------------------------------------- */

async function loadAll() {
  const [overview, ordersData, productsData, usersData, settingsData] = await Promise.all([
    adminRequest('/api/admin/overview'),
    adminRequest('/api/admin/orders'),
    adminRequest('/api/admin/products'),
    adminRequest('/api/admin/users'),
    adminRequest('/api/admin/settings'),
  ]);

  state.overview = overview;
  state.orders = ordersData.orders || [];
  state.products = productsData.products || [];
  state.files = productsData.files || [];
  state.users = usersData.users || [];
  state.settings = settingsData.settings || null;

  renderOverview();
  renderOrders();
  renderProducts();
  renderUsers();
  renderSettings();
}

/* Eventos -------------------------------------------------------- */

$$('[data-login-mode]').forEach((btn) => {
  btn.addEventListener('click', () => setLoginMode(btn.dataset.loginMode));
});

$('#fillDevCredsBtn')?.addEventListener('click', () => {
  $('#adminUsername').value = state.config?.adminDefaultUser || 'admin@gmail.com';
  $('#adminPassword').value = '123456789';
});

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const submitBtn = $('#loginSubmitBtn');
  submitBtn.disabled = true;
  $('#gateError').hidden = true;

  try {
    let payload;
    if (state.loginMode === 'token') {
      const token = $('#adminToken').value.trim();
      if (!token) {
        showGate('Ingresa el ADMIN_TOKEN.');
        return;
      }
      payload = { token };
    } else {
      const username = $('#adminUsername').value.trim();
      const password = $('#adminPassword').value;
      if (!username || !password) {
        showGate('Ingresa usuario y contraseña.');
        return;
      }
      payload = { username, password };
    }

    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      showGate(data.error || 'No pudimos iniciar sesión.');
      return;
    }

    state.token = data.token;
    sessionStorage.setItem(TOKEN_KEY, state.token);
    await loadAll();
    showPanel();
  } catch (error) {
    showGate(error.message || 'No pudimos iniciar sesión.');
  } finally {
    submitBtn.disabled = false;
  }
});

$$('#adminTabs .admin-tab').forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

const EYE_OPEN =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.8" stroke="currentColor" stroke-width="1.7"/></svg>';
const EYE_CLOSED =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 3 18 18M10.6 5.7A9.4 9.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16.8 16.8 0 0 1-3.3 4.3M6.7 7.1A16.5 16.5 0 0 0 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.2-1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

document.addEventListener('click', (event) => {
  const toggleBtn = event.target.closest('[data-toggle-password]');
  if (toggleBtn) {
    const input = document.getElementById(toggleBtn.dataset.togglePassword);
    if (!input) return;
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    toggleBtn.innerHTML = show ? EYE_CLOSED : EYE_OPEN;
    toggleBtn.setAttribute('aria-label', show ? 'Ocultar contraseña' : 'Mostrar contraseña');
    toggleBtn.setAttribute('aria-pressed', String(show));
    return;
  }

  const gotoBtn = event.target.closest('[data-goto-tab]');
  if (gotoBtn) switchTab(gotoBtn.dataset.gotoTab);
});

$('#filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  state.filter = button.dataset.filter;
  renderOrders();
});

$('#ordersSearch').addEventListener('input', (event) => {
  state.ordersQuery = event.target.value;
  renderOrders();
});

$('#productsSearch').addEventListener('input', (event) => {
  state.productsQuery = event.target.value;
  renderProducts();
});

$('#usersSearch').addEventListener('input', (event) => {
  state.usersQuery = event.target.value;
  renderUsers();
});

$('#orders').addEventListener('click', async (event) => {
  const approveBtn = event.target.closest('[data-approve]');
  if (approveBtn) {
    const orderId = approveBtn.dataset.approve;
    approveBtn.disabled = true;
    approveBtn.textContent = 'Aprobando...';
    try {
      const data = await adminRequest(`/api/admin/orders/${encodeURIComponent(orderId)}/approve`, {
        method: 'POST',
      });
      toast(data.emailSent ? `Pedido ${orderId} aprobado y correo enviado.` : `Pedido ${orderId} aprobado.`);
      await loadAll();
    } catch (error) {
      toast(error.message, true);
      approveBtn.disabled = false;
      approveBtn.textContent = 'Aprobar';
    }
    return;
  }

  const rejectBtn = event.target.closest('[data-reject]');
  if (rejectBtn) {
    const orderId = rejectBtn.dataset.reject;
    rejectBtn.disabled = true;
    try {
      await adminRequest(`/api/admin/orders/${encodeURIComponent(orderId)}/reject`, {
        method: 'POST',
      });
      toast(`Pedido ${orderId} marcado como vencido.`);
      await loadAll();
    } catch (error) {
      toast(error.message, true);
      rejectBtn.disabled = false;
    }
  }
});

$('#newProductBtn').addEventListener('click', () => openProductEditor(null));
$('#closeProductEditor').addEventListener('click', closeProductEditor);
$('#cancelProductEditor').addEventListener('click', closeProductEditor);

$('#productsList').addEventListener('click', async (event) => {
  const editBtn = event.target.closest('[data-edit-product]');
  if (editBtn) {
    const product = state.products.find((item) => item.id === editBtn.dataset.editProduct);
    if (product) openProductEditor(product);
    return;
  }

  const deleteBtn = event.target.closest('[data-delete-product]');
  if (deleteBtn) {
    const id = deleteBtn.dataset.deleteProduct;
    const product = state.products.find((item) => item.id === id);
    if (!window.confirm(`¿Eliminar el producto "${product?.name || id}" del catálogo?`)) return;
    deleteBtn.disabled = true;
    try {
      await adminRequest(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
      toast('Producto eliminado del catálogo.');
      await loadAll();
    } catch (error) {
      toast(error.message, true);
      deleteBtn.disabled = false;
    }
  }
});

$('#productEditorForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const errorBox = $('#prodFormError');
  errorBox.hidden = true;
  const saveBtn = $('#saveProductBtn');
  saveBtn.disabled = true;

  const id = $('#prodId').value.trim();
  const payload = {
    name: $('#prodName').value.trim(),
    category: $('#prodCategory').value.trim(),
    tagline: $('#prodTagline').value.trim(),
    description: $('#prodDescription').value.trim(),
    price: $('#prodPrice').value,
    compareAt: $('#prodCompareAt').value,
    fileName: $('#prodFileName').value.trim(),
    fileType: $('#prodFileType').value.trim(),
    cover: $('#prodCover').value.trim(),
    accent: $('#prodAccent').value,
    badge: $('#prodBadge').value.trim(),
    youtubeUrl: $('#prodYoutubeUrl').value.trim(),
    includes: $('#prodIncludes').value,
  };

  try {
    if (id) {
      await adminRequest(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
      toast('Producto actualizado.');
    } else {
      await adminRequest('/api/admin/products', { method: 'POST', body: payload });
      toast('Producto creado en el catálogo.');
    }
    closeProductEditor();
    await loadAll();
  } catch (error) {
    errorBox.textContent = error.message;
    errorBox.hidden = false;
  } finally {
    saveBtn.disabled = false;
  }
});

$('#settingsForm')?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const btn = $('#saveSettingsBtn');
  btn.disabled = true;
  const featuredIds = [...document.querySelectorAll('#featuredPicker input[name="featuredIds"]:checked')].map(
    (input) => input.value,
  );

  try {
    await adminRequest('/api/admin/settings', {
      method: 'PATCH',
      body: {
        yapeName: $('#setYapeName').value.trim(),
        yapePhone: $('#setYapePhone').value.trim(),
        yapeQrImage: $('#setYapeQr').value.trim(),
        storeName: $('#setStoreName').value.trim(),
        supportEmail: $('#setSupportEmail').value.trim(),
        requireManualApproval: $('#setManualApproval').checked,
        featuredIds,
      },
    });
    toast('Configuración de Yape, tienda y destacados guardada.');
    await loadAll();
  } catch (error) {
    toast(error.message, true);
  } finally {
    btn.disabled = false;
  }
});

$('#refreshBtn').addEventListener('click', async () => {
  try {
    await loadAll();
    toast('Panel actualizado.');
  } catch (error) {
    toast(error.message, true);
  }
});

$('#logoutBtn').addEventListener('click', () => {
  state.token = '';
  state.orders = [];
  state.products = [];
  state.users = [];
  state.overview = null;
  sessionStorage.removeItem(TOKEN_KEY);
  showGate();
});

async function init() {
  initTheme();
  try {
    const response = await fetch('/api/config');
    const config = await response.json();
    state.config = config;
    if (!config.devMode) {
      const link = $('#devOutboxLink');
      if (link) link.hidden = true;
    }
    if (config.adminDefaultCredentialsActive) {
      $('#devUserCode').textContent = config.adminDefaultUser || 'admin@gmail.com';
      $('#devCredsHint').hidden = false;
    }
  } catch {
    // ignore
  }

  try {
    await loadAll();
    showPanel();
  } catch (error) {
    const hadToken = Boolean(state.token);
    state.token = '';
    sessionStorage.removeItem(TOKEN_KEY);
    if (!hadToken && error.status === 401) {
      showGate();
      return;
    }
    showGate(
      error.status === 503
        ? 'El panel no está configurado. Define ADMIN_TOKEN o ADMIN_PASSWORD en .env.'
        : 'Tu sesión de administración expiró. Inicia sesión de nuevo.',
    );
  }
}

init();
