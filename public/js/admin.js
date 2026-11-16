const TOKEN_KEY = 'cusesoft_admin_token_v1';

const STATUS_LABELS = {
  pending: 'Pendiente',
  verifying: 'En verificación',
  paid: 'Pagado',
  expired: 'Vencido',
};

const state = {
  token: sessionStorage.getItem(TOKEN_KEY) || '',
  orders: [],
  filter: 'all',
};

const $ = (selector) => document.querySelector(selector);

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

async function api(path, options = {}) {
  const headers = { 'x-admin-token': state.token, ...(options.headers || {}) };
  if (options.body) headers['Content-Type'] = 'application/json';
  const response = await fetch(`/api/admin${path}`, { ...options, headers });
  let data = null;
  try {
    data = await response.json();
  } catch {
    /* respuesta sin JSON */
  }
  if (!response.ok) {
    const error = new Error(data?.error || 'No pudimos completar la solicitud.');
    error.status = response.status;
    throw error;
  }
  return data;
}

function showGate(message = '') {
  $('#gate').hidden = false;
  $('#panel').hidden = true;
  const error = $('#gateError');
  error.hidden = !message;
  error.textContent = message;
  $('#adminToken').value = '';
  $('#adminToken').focus();
}

function showPanel() {
  $('#gate').hidden = true;
  $('#panel').hidden = false;
}

function counts() {
  const result = { all: state.orders.length, pending: 0, verifying: 0, paid: 0, expired: 0 };
  for (const order of state.orders) {
    if (result[order.status] !== undefined) result[order.status] += 1;
  }
  return result;
}

function renderStats() {
  const total = counts();
  const revenue = state.orders
    .filter((order) => order.status === 'paid')
    .reduce((sum, order) => sum + Number(order.total || 0), 0);

  const items = [
    { label: 'Pedidos', value: total.all },
    { label: 'Pagados', value: total.paid },
    { label: 'Por aprobar', value: total.verifying },
    { label: 'Ingresos confirmados', value: money(revenue) },
  ];

  $('#stats').innerHTML = items
    .map(
      (item) => `
      <div class="admin-stat">
        <span>${esc(item.label)}</span>
        <strong>${esc(item.value)}</strong>
      </div>`,
    )
    .join('');
}

function renderFilters() {
  const total = counts();
  const filters = [
    { id: 'all', label: 'Todos', count: total.all },
    { id: 'verifying', label: 'En verificación', count: total.verifying },
    { id: 'paid', label: 'Pagados', count: total.paid },
    { id: 'pending', label: 'Pendientes', count: total.pending },
    { id: 'expired', label: 'Vencidos', count: total.expired },
  ];

  $('#filters').innerHTML = filters
    .map(
      (filter) => `
      <button
        class="admin-filter${state.filter === filter.id ? ' is-active' : ''}"
        type="button"
        data-filter="${esc(filter.id)}"
        aria-pressed="${state.filter === filter.id}"
      >${esc(filter.label)} · ${esc(filter.count)}</button>`,
    )
    .join('');
}

function orderCard(order) {
  const owner = order.user || {};
  const items = Array.isArray(order.items) ? order.items : [];
  const canApprove = order.status === 'verifying';

  return `
    <article class="admin-order">
      <div class="admin-order-main">
        <div class="admin-order-head">
          <span class="admin-order-code">${esc(order.code)}</span>
          <span class="status-chip status-${esc(order.status)}">${esc(STATUS_LABELS[order.status] || order.status)}</span>
          <span class="admin-order-date">${esc(formatDate(order.createdAt))}</span>
        </div>
        <div class="admin-order-customer">
          ${esc(owner.name || 'Comprador sin nombre')}
          <span class="admin-order-email">${esc(owner.email || '')}</span>
        </div>
        <div class="admin-order-items">${items.map((item) => esc(item.name)).join(' · ')}</div>
      </div>
      <div class="admin-order-meta">
        <span>Total</span>
        <strong>${esc(money(order.total))}</strong>
        ${
          order.operationCode
            ? `<span>N.º de operación</span><span class="operation">${esc(order.operationCode)}</span>`
            : '<span>Sin número de operación</span>'
        }
      </div>
      <div class="admin-order-actions">
        ${
          canApprove
            ? `<button class="btn btn-accent btn-sm" type="button" data-approve="${esc(order.id)}">Aprobar pago</button>`
            : ''
        }
      </div>
    </article>`;
}

function renderOrders() {
  const orders = state.orders.filter(
    (order) => state.filter === 'all' || order.status === state.filter,
  );
  $('#orders').innerHTML = orders.map(orderCard).join('');
  $('#empty').hidden = orders.length > 0;
}

function render() {
  renderStats();
  renderFilters();
  renderOrders();
}

async function load() {
  const data = await api('/orders');
  state.orders = Array.isArray(data.orders) ? data.orders : [];
  render();
}

$('#tokenForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const token = $('#adminToken').value.trim();
  if (!token) return;

  const button = event.submitter || $('#tokenForm button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Verificando…';
  state.token = token;

  try {
    await load();
    sessionStorage.setItem(TOKEN_KEY, token);
    showPanel();
  } catch (error) {
    state.token = '';
    sessionStorage.removeItem(TOKEN_KEY);
    showGate(
      error.status === 503
        ? 'El panel no está configurado. Define ADMIN_TOKEN en .env y reinicia el servidor.'
        : error.message,
    );
  } finally {
    button.disabled = false;
    button.textContent = 'Entrar al panel';
  }
});

$('#filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;
  state.filter = button.dataset.filter;
  render();
});

$('#orders').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-approve]');
  if (!button) return;

  const order = state.orders.find((candidate) => candidate.id === button.dataset.approve);
  if (!order) return;

  const confirmed = window.confirm(
    `¿Aprobar el pedido ${order.code} por ${money(order.total)}?\n\nSe enviarán los enlaces de descarga al correo del comprador.`,
  );
  if (!confirmed) return;

  button.disabled = true;
  button.textContent = 'Aprobando…';

  try {
    const result = await api(`/orders/${encodeURIComponent(order.id)}/approve`, { method: 'POST' });
    toast(
      result.emailSent
        ? `Pedido ${order.code} aprobado. Enlaces enviados a ${result.user?.email || 'el comprador'}.`
        : `Pedido ${order.code} aprobado. El correo no se pudo enviar; revisa la bandeja de desarrollo.`,
      !result.emailSent,
    );
    await load();
  } catch (error) {
    toast(error.message, true);
    button.disabled = false;
    button.textContent = 'Aprobar pago';
  }
});

$('#refreshBtn').addEventListener('click', async () => {
  try {
    await load();
    toast('Pedidos actualizados.');
  } catch (error) {
    toast(error.message, true);
  }
});

$('#logoutBtn').addEventListener('click', () => {
  state.token = '';
  state.orders = [];
  sessionStorage.removeItem(TOKEN_KEY);
  showGate();
});

async function init() {
  fetch('/api/config')
    .then((response) => response.json())
    .then((config) => {
      if (!config.devMode) {
        const link = $('#devOutboxLink');
        if (link) link.hidden = true;
      }
    })
    .catch(() => {});

  if (!state.token) {
    showGate();
    return;
  }
  try {
    await load();
    showPanel();
  } catch (error) {
    state.token = '';
    sessionStorage.removeItem(TOKEN_KEY);
    showGate(
      error.status === 503
        ? 'El panel no está configurado. Define ADMIN_TOKEN en .env y reinicia el servidor.'
        : 'Tu sesión de administración expiró. Ingresa el token de nuevo.',
    );
  }
}

init();
