import { api } from './api.js';
import { openAuth } from './auth.js';
import { openCheckoutWithOrder } from './checkout.js';
import { setUser, state } from './state.js';
import {
  $,
  closeModal,
  esc,
  formatDate,
  icons,
  initials,
  openModal,
  toast,
} from './ui.js';

const account = {
  orders: [],
  loading: false,
  error: '',
  busy: false,
};

function avatarMarkup(user, size = '') {
  const className = `avatar ${size} ${user.avatar ? '' : 'is-initials'}`.trim();
  if (user.avatar) {
    return `<span class="${className}"><img src="${esc(user.avatar)}" alt=""></span>`;
  }
  return `<span class="${className}">${esc(initials(user.name, user.lastName))}</span>`;
}

function statusChip(status) {
  const labels = {
    paid: 'Pagado',
    pending: 'Pendiente',
    verifying: 'En verificación',
    expired: 'Expirado',
  };
  return `<span class="status-chip status-${esc(status)}">${esc(labels[status] || status)}</span>`;
}

function orderCard(order) {
  const names = order.items.map((item) => item.name).join(' · ');
  let actions = '';

  if (order.status === 'paid' && order.links?.length) {
    actions = `
      <div class="order-links">
        ${order.links
          .map(
            (link) => `
            <a class="btn btn-primary" href="${esc(link.downloadUrl)}">${icons.download} ${esc(link.name)}</a>
            <a class="btn btn-ghost" href="${esc(link.tutorialUrl)}" target="_blank" rel="noopener">${icons.play} Video</a>`,
          )
          .join('')}
      </div>`;
  } else if (order.status === 'pending') {
    actions = `<button class="btn btn-primary btn-sm" type="button" data-resume="${esc(order.id)}">Continuar pago</button>`;
  } else if (order.status === 'verifying') {
    actions = `<span class="small muted">Esperando confirmación del pago</span>`;
  } else if (order.status === 'expired') {
    actions = `<span class="small muted">Genera un pedido nuevo desde el catálogo</span>`;
  }

  return `
    <div class="order-card">
      <div class="order-card-head">
        <span class="order-code">${esc(order.code)} · ${esc(formatDate(order.createdAt))}</span>
        ${statusChip(order.status)}
      </div>
      <p class="order-card-names">${esc(names)}</p>
      <div class="order-card-foot">
        <span class="price"><strong>${`S/ ${Number(order.total).toFixed(2)}`}</strong></span>
        ${actions}
      </div>
    </div>`;
}

function profileView() {
  const user = state.user;
  const provider = user.provider === 'google' ? 'Google' : 'Correo + OTP';
  return `
    <div class="account-head">
      ${avatarMarkup(user, 'avatar-lg')}
      <div>
        <span class="eyebrow">Mi cuenta</span>
        <h2 id="accountModalTitle">${esc(user.fullName || user.name)}</h2>
        <p>${esc(user.email)}</p>
      </div>
    </div>

    <div class="profile-card">
      <div class="profile-grid">
        <div class="profile-field"><span>Correo</span><strong>${esc(user.email)}</strong></div>
        <div class="profile-field"><span>Año de nacimiento</span><strong>${user.birthYear ? esc(user.birthYear) : 'Sin completar'}</strong></div>
        <div class="profile-field"><span>Acceso</span><strong>${esc(provider)}</strong></div>
        <div class="profile-field"><span>Miembro desde</span><strong>${esc(formatDate(user.createdAt))}</strong></div>
      </div>
      ${
        !user.birthYear
          ? `<form class="profile-form" id="birthYearForm" novalidate>
              <div class="field">
                <label for="profileBirthYear">Completa tu año de nacimiento</label>
                <input class="input" id="profileBirthYear" name="birthYear" type="number" min="1900" max="${new Date().getFullYear() - 13}" placeholder="1995" required>
              </div>
              <button class="btn btn-primary btn-sm" type="submit" id="saveBirthYearBtn">Guardar</button>
            </form>`
          : ''
      }
      <div class="profile-actions">
        <span class="small muted">Sesión protegida con cookie HttpOnly</span>
        <button class="btn btn-ghost btn-sm" type="button" data-logout>Cerrar sesión</button>
      </div>
    </div>

    <div class="orders-head">
      <h3>Mis compras</h3>
      <button class="link-btn" type="button" data-refresh>Actualizar</button>
    </div>
    <div id="ordersList">${ordersView()}</div>
  `;
}

function ordersView() {
  if (account.loading) {
    return `<div class="skeleton skeleton-line" style="margin:14px 0;"></div><div class="skeleton skeleton-line w-60" style="margin:14px 0;"></div>`;
  }
  if (account.error) {
    return `<div class="form-error" role="alert">${esc(account.error)}</div>`;
  }
  if (!account.orders.length) {
    return `<div class="account-empty">Todavía no tienes compras. Explora el catálogo y estrena tu primer recurso.</div>`;
  }
  return `<div class="orders-list">${account.orders.map(orderCard).join('')}</div>`;
}

function render() {
  const body = $('#accountModalBody');
  if (!body) return;
  body.innerHTML = profileView();
}

async function loadOrders({ showSkeleton = true } = {}) {
  account.loading = showSkeleton;
  account.error = '';
  if (showSkeleton) render();
  try {
    const data = await api.getOrders();
    account.orders = data.orders || [];
  } catch (error) {
    if (error.status === 401) {
      setUser(null);
      closeModal('accountModal');
      openAuth();
      return;
    }
    account.error = error.message;
  } finally {
    account.loading = false;
    if ($('#accountModal')?.classList.contains('is-open')) render();
  }
}

export async function openAccount() {
  if (!state.user) {
    openAuth();
    return;
  }
  account.orders = [];
  account.error = '';
  openModal('accountModal');
  render();
  await loadOrders();
}

async function logout() {
  if (account.busy) return;
  account.busy = true;
  try {
    await api.logout();
    setUser(null);
    closeModal('accountModal');
    toast('Cerraste sesión. Tu carrito sigue guardado.', 'info');
  } catch (error) {
    toast(error.message, 'error');
  } finally {
    account.busy = false;
  }
}

async function saveBirthYear(form) {
  const value = form.birthYear.value.trim();
  const year = Number(value);
  if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() - 13) {
    toast('Ingresa un año de nacimiento válido (mínimo 13 años).', 'error');
    return;
  }

  const button = $('#saveBirthYearBtn');
  if (button) {
    button.disabled = true;
    button.textContent = 'Guardando...';
  }
  try {
    const data = await api.updateBirthYear(year);
    setUser(data.user);
    toast('Año de nacimiento guardado.', 'success');
    render();
  } catch (error) {
    toast(error.message, 'error');
    if (button) {
      button.disabled = false;
      button.textContent = 'Guardar';
    }
  }
}

export function initAccount() {
  document.addEventListener('cs:open-account', () => openAccount());

  const body = $('#accountModalBody');
  if (!body) return;

  body.addEventListener('click', (event) => {
    if (event.target.closest('[data-logout]')) {
      logout();
      return;
    }
    if (event.target.closest('[data-refresh]')) {
      loadOrders();
      return;
    }
    const resume = event.target.closest('[data-resume]');
    if (resume) {
      closeModal('accountModal');
      openCheckoutWithOrder(resume.dataset.resume);
    }
  });

  body.addEventListener('submit', (event) => {
    if (event.target.id === 'birthYearForm') {
      event.preventDefault();
      saveBirthYear(event.target);
    }
  });
}
