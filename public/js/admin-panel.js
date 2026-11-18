import { api } from './api.js';
import { state, subscribe } from './state.js';
import { $, esc, formatDate, initials, toast } from './ui.js';

const STATUS_LABELS = {
  pending: 'Pendiente',
  verifying: 'En verificación',
  paid: 'Pagado',
  expired: 'Vencido',
};

const panelState = {
  view: 'store',
  tab: 'overview',
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
  loaded: false,
};

function money(value) {
  return `S/ ${Number(value || 0).toFixed(2)}`;
}

async function adminFetch(path, { method = 'GET', body } = {}) {
  const headers = {};
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
    throw error;
  }
  return data;
}

export function setView(view) {
  const isAdmin = Boolean(state.user?.isAdmin);
  const next = view === 'admin' && isAdmin ? 'admin' : 'store';
  panelState.view = next;

  const storeView = $('#storeView');
  const adminView = $('#adminView');
  const navBtn = $('#navAdminBtn');

  if (storeView) storeView.hidden = next !== 'store';
  if (adminView) adminView.hidden = next !== 'admin';
  if (navBtn) navBtn.classList.toggle('is-active', next === 'admin');

  if (next === 'admin') {
    if (!panelState.loaded) {
      loadAdminData().catch((error) => toast(error.message, 'error'));
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

function switchTab(tab) {
  panelState.tab = tab;
  document.querySelectorAll('#adminTabs .admin-tab').forEach((btn) => {
    btn.classList.toggle('is-active', btn.dataset.tab === tab);
  });
  const map = {
    overview: '#tabOverview',
    orders: '#tabOrders',
    products: '#tabProducts',
    users: '#tabUsers',
    settings: '#tabSettings',
  };
  for (const [key, sel] of Object.entries(map)) {
    const el = $(sel);
    if (el) el.hidden = key !== tab;
  }
}

function renderOverview() {
  const data = panelState.overview;
  if (!data) return;
  const { stats, system } = data;

  const badge = $('#verifyingBadge');
  if (badge) {
    if (stats.ordersVerifying > 0) {
      badge.textContent = String(stats.ordersVerifying);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  const statsEl = $('#overviewStats');
  if (statsEl) {
    statsEl.innerHTML = `
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
  }

  const envBadge = $('#envBadge');
  if (envBadge) envBadge.textContent = system.env || 'development';

  const systemInfo = $('#systemInfo');
  if (systemInfo) {
    const rows = [
      ['Tienda', system.storeName],
      ['Modo de correo', system.mailerConfigured ? 'SMTP configurado' : `Local (Outbox: ${stats.outboxCount})`],
      ['Aprobación manual', system.requireManualApproval ? 'Activada (requiere aprobar)' : 'Automática'],
      ['Yape receptor', `${system.yape.name} · ${system.yape.phone}`],
      ['Google Sign-In', system.googleEnabled ? 'Configurado' : 'Desactivado'],
      ['Archivos en server/files', `${stats.filesTotal} archivo(s)`],
    ];
    systemInfo.innerHTML = rows
      .map(
        ([label, value]) => `
        <div class="admin-kv-row">
          <dt>${esc(label)}</dt>
          <dd>${esc(value)}</dd>
        </div>`,
      )
      .join('');
  }

  const quickOutbox = $('#quickOutboxBtn');
  if (quickOutbox) quickOutbox.hidden = !system.devMode;
}

function renderOrders() {
  const orders = panelState.orders;
  const verifying = orders.filter((o) => o.status === 'verifying').length;
  const paid = orders.filter((o) => o.status === 'paid');
  const revenue = paid.reduce((sum, o) => sum + Number(o.total || 0), 0);

  const statsEl = $('#stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <article class="admin-stat"><span>En verificación</span><strong>${verifying}</strong></article>
      <article class="admin-stat"><span>Pagados</span><strong>${paid.length}</strong></article>
      <article class="admin-stat"><span>Total pedidos</span><strong>${orders.length}</strong></article>
      <article class="admin-stat"><span>Ingresos pagados</span><strong>${esc(money(revenue))}</strong></article>
    `;
  }

  const counts = {
    all: orders.length,
    verifying,
    paid: paid.length,
    pending: orders.filter((o) => o.status === 'pending').length,
    expired: orders.filter((o) => o.status === 'expired').length,
  };
  const labels = {
    all: 'Todos',
    verifying: 'En verificación',
    paid: 'Pagados',
    pending: 'Pendientes',
    expired: 'Vencidos',
  };

  const filtersEl = $('#filters');
  if (filtersEl) {
    filtersEl.innerHTML = Object.entries(labels)
      .map(
        ([key, label]) => `
        <button type="button" class="admin-filter ${panelState.filter === key ? 'is-active' : ''}" data-filter="${key}">
          ${esc(label)} (${counts[key] || 0})
        </button>`,
      )
      .join('');
  }

  const q = panelState.ordersQuery.trim().toLowerCase();
  const visible = orders.filter((order) => {
    if (panelState.filter !== 'all' && order.status !== panelState.filter) return false;
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
  if (!list || !empty) return;

  if (!visible.length) {
    list.innerHTML = '';
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  list.innerHTML = visible
    .map((order) => {
      const statusLabel = STATUS_LABELS[order.status] || order.status;
      const itemsText = (order.items || []).map((i) => `${i.name} (${money(i.price)})`).join(' · ');
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
              ${esc(order.user?.name || 'Cliente')}
              <span class="admin-order-email">${esc(order.user?.email || '')}</span>
            </div>
            <p class="admin-order-items">${esc(itemsText)}</p>
          </div>
          <div class="admin-order-meta">
            <strong>${esc(money(order.total))}</strong>
            <span>${order.operationCode ? `Operación <span class="operation">${esc(order.operationCode)}</span>` : 'Sin código de operación'}</span>
          </div>
          <div class="admin-order-actions">${actions}</div>
        </article>`;
    })
    .join('');
}

function renderProducts() {
  const q = panelState.productsQuery.trim().toLowerCase();
  const visible = panelState.products.filter((product) => {
    if (!q) return true;
    return `${product.name} ${product.category} ${product.id}`.toLowerCase().includes(q);
  });

  const datalist = $('#availableFilesList');
  if (datalist) {
    datalist.innerHTML = panelState.files.map((f) => `<option value="${esc(f.name)}"></option>`).join('');
  }

  const list = $('#productsList');
  const empty = $('#productsEmpty');
  if (!list || !empty) return;

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

function renderUsers() {
  const q = panelState.usersQuery.trim().toLowerCase();
  const visible = panelState.users.filter((user) => {
    if (!q) return true;
    return `${user.fullName} ${user.email}`.toLowerCase().includes(q);
  });

  const countLabel = $('#usersCountLabel');
  if (countLabel) countLabel.textContent = `${visible.length} usuario(s)`;

  const list = $('#usersList');
  const empty = $('#usersEmpty');
  if (!list || !empty) return;

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
          <span class="avatar is-initials">${esc(initials(user.name, user.lastName))}</span>
          <div>
            <strong>${esc(user.fullName || 'Usuario')}</strong>
            <span>${esc(user.email)}</span>
          </div>
        </div>
        <div class="admin-user-stat">
          <span>Acceso</span>
          <strong>${esc(user.provider === 'google' ? 'Google' : 'Correo')}</strong>
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

function renderSettings() {
  const s = panelState.settings;
  if (!s) return;
  if ($('#setYapeName')) $('#setYapeName').value = s.yapeName || '';
  if ($('#setYapePhone')) $('#setYapePhone').value = s.yapePhone || '';
  if ($('#setYapeQr')) $('#setYapeQr').value = s.yapeQrImage || '';
  if ($('#setStoreName')) $('#setStoreName').value = s.storeName || '';
  if ($('#setSupportEmail')) $('#setSupportEmail').value = s.supportEmail || '';
  if ($('#setManualApproval')) $('#setManualApproval').checked = Boolean(s.requireManualApproval);

  const featured = new Set(s.featuredIds || []);
  const picker = $('#featuredPicker');
  if (picker) {
    picker.innerHTML = panelState.products
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

function openProductEditor(product = null) {
  const modal = $('#productEditorModal');
  if (!modal) return;
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
  if (!modal) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
}

async function loadAdminData() {
  const [overview, ordersData, productsData, usersData, settingsData] = await Promise.all([
    adminFetch('/api/admin/overview'),
    adminFetch('/api/admin/orders'),
    adminFetch('/api/admin/products'),
    adminFetch('/api/admin/users'),
    adminFetch('/api/admin/settings'),
  ]);

  panelState.overview = overview;
  panelState.orders = ordersData.orders || [];
  panelState.products = productsData.products || [];
  panelState.files = productsData.files || [];
  panelState.users = usersData.users || [];
  panelState.settings = settingsData.settings || null;
  panelState.loaded = true;

  renderOverview();
  renderOrders();
  renderProducts();
  renderUsers();
  renderSettings();
}

function syncAdminAccess() {
  const isAdmin = Boolean(state.user?.isAdmin);
  const navBtn = $('#navAdminBtn');
  if (navBtn) navBtn.hidden = !isAdmin;

  if (!isAdmin) {
    panelState.loaded = false;
    if (panelState.view === 'admin') setView('store');
  }
}

export function initAdminPanel() {
  const section = $('#adminView');
  if (!section) return;

  document.addEventListener('click', (event) => {
    const viewTrigger = event.target.closest('[data-view]');
    if (viewTrigger) {
      setView(viewTrigger.dataset.view);
      return;
    }

    if (panelState.view === 'admin' && event.target.closest('.brand')) {
      setView('store');
    }
  });

  document.querySelectorAll('#adminTabs .admin-tab').forEach((btn) => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  section.addEventListener('click', async (event) => {
    const gotoBtn = event.target.closest('[data-goto-tab]');
    if (gotoBtn) {
      switchTab(gotoBtn.dataset.gotoTab);
      return;
    }

    const filterBtn = event.target.closest('[data-filter]');
    if (filterBtn) {
      panelState.filter = filterBtn.dataset.filter;
      renderOrders();
      return;
    }

    const approveBtn = event.target.closest('[data-approve]');
    if (approveBtn) {
      const orderId = approveBtn.dataset.approve;
      approveBtn.disabled = true;
      approveBtn.textContent = 'Aprobando...';
      try {
        const data = await adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/approve`, { method: 'POST' });
        toast(data.emailSent ? `Pedido ${orderId} aprobado y correo enviado.` : `Pedido ${orderId} aprobado.`, 'success');
        await loadAdminData();
      } catch (error) {
        toast(error.message, 'error');
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
        await adminFetch(`/api/admin/orders/${encodeURIComponent(orderId)}/reject`, { method: 'POST' });
        toast(`Pedido ${orderId} marcado como vencido.`, 'info');
        await loadAdminData();
      } catch (error) {
        toast(error.message, 'error');
        rejectBtn.disabled = false;
      }
      return;
    }

    const editBtn = event.target.closest('[data-edit-product]');
    if (editBtn) {
      const product = panelState.products.find((p) => p.id === editBtn.dataset.editProduct);
      if (product) openProductEditor(product);
      return;
    }

    const deleteBtn = event.target.closest('[data-delete-product]');
    if (deleteBtn) {
      const id = deleteBtn.dataset.deleteProduct;
      const product = panelState.products.find((p) => p.id === id);
      if (!window.confirm(`¿Eliminar el producto "${product?.name || id}" del catálogo?`)) return;
      deleteBtn.disabled = true;
      try {
        await adminFetch(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'DELETE' });
        toast('Producto eliminado del catálogo.', 'success');
        await loadAdminData();
        document.dispatchEvent(new CustomEvent('cs:catalog:refresh'));
      } catch (error) {
        toast(error.message, 'error');
        deleteBtn.disabled = false;
      }
    }
  });

  $('#ordersSearch')?.addEventListener('input', (e) => {
    panelState.ordersQuery = e.target.value;
    renderOrders();
  });

  $('#productsSearch')?.addEventListener('input', (e) => {
    panelState.productsQuery = e.target.value;
    renderProducts();
  });

  $('#usersSearch')?.addEventListener('input', (e) => {
    panelState.usersQuery = e.target.value;
    renderUsers();
  });

  $('#adminRefreshBtn')?.addEventListener('click', async () => {
    try {
      await loadAdminData();
      toast('Panel actualizado.', 'success');
    } catch (error) {
      toast(error.message, 'error');
    }
  });

  $('#newProductBtn')?.addEventListener('click', () => openProductEditor(null));
  $('#closeProductEditor')?.addEventListener('click', closeProductEditor);
  $('#cancelProductEditor')?.addEventListener('click', closeProductEditor);

  $('#productEditorForm')?.addEventListener('submit', async (event) => {
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
        await adminFetch(`/api/admin/products/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload });
        toast('Producto actualizado.', 'success');
      } else {
        await adminFetch('/api/admin/products', { method: 'POST', body: payload });
        toast('Producto creado en el catálogo.', 'success');
      }
      closeProductEditor();
      await loadAdminData();
      document.dispatchEvent(new CustomEvent('cs:catalog:refresh'));
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
      await adminFetch('/api/admin/settings', {
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
      state.config = await api.config();
      toast('Configuración de Yape, tienda y destacados guardada.', 'success');
      await loadAdminData();
      document.dispatchEvent(new CustomEvent('cs:catalog:refresh'));
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  subscribe((event) => {
    if (event === 'user') syncAdminAccess();
  });

  document.addEventListener('cs:auth', (event) => {
    syncAdminAccess();
    if (event.detail?.user?.isAdmin && !event.detail?.intent) {
      setView('admin');
    }
  });

  syncAdminAccess();
}
