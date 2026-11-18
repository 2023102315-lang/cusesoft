import { api } from './api.js';
import { initAccount, openAccount } from './account.js';
import { initAdminPanel } from './admin-panel.js';
import { initAuth, openAuth } from './auth.js';
import { initCart } from './cart.js';
import { initCatalog } from './catalog.js';
import { initCheckout } from './checkout.js';
import { setUser, state, subscribe } from './state.js';
import { initTheme } from './theme.js';
import { $, esc, icons, initUi, initials, toast } from './ui.js';

function renderHeaderAccount() {
  const button = $('#accountBtn');
  if (!button) return;
  const user = state.user;

  if (user) {
    const label = user.name || 'Mi cuenta';
    const avatar = user.avatar
      ? `<span class="avatar"><img src="${esc(user.avatar)}" alt=""></span>`
      : `<span class="avatar is-initials">${esc(initials(user.name, user.lastName))}</span>`;
    button.innerHTML = `${avatar}<span class="account-label">${esc(label)}</span>`;
    button.setAttribute('aria-label', `Abrir mi cuenta, ${label}`);
  } else {
    button.innerHTML = `<span class="account-ico" aria-hidden="true">${icons.user}</span><span class="account-label">Ingresar</span>`;
    button.setAttribute('aria-label', 'Ingresar o crear una cuenta');
  }
}

function applyConfig() {
  const config = state.config;
  if (!config) return;

  const support = $('#supportLink');
  if (support && config.supportEmail) {
    support.href = `mailto:${config.supportEmail}`;
    support.textContent = 'Hablar con soporte';
  }

  if (config.devMode) {
    const slot = $('#devOutboxSlot');
    if (slot) {
      slot.innerHTML = `<a href="/api/dev/outbox" target="_blank" rel="noopener">Bandeja de correos de desarrollo ↗</a>`;
    }
  }
}

function setupStaticUi() {
  renderHeaderAccount();

  $('#accountBtn')?.addEventListener('click', () => {
    if (state.user) openAccount();
    else openAuth();
  });

  document.addEventListener('click', (event) => {
    const accountLink = event.target.closest('[data-open-account]');
    if (accountLink) {
      event.preventDefault();
      if (state.user) openAccount();
      else openAuth();
      return;
    }
    const authLink = event.target.closest('[data-open-auth]');
    if (authLink) {
      event.preventDefault();
      if (state.user) openAccount();
      else openAuth();
    }
  });

  const header = $('#siteHeader');
  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 12);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  subscribe((event) => {
    if (event === 'user') renderHeaderAccount();
  });

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('in-view');
          observer.unobserve(entry.target);
        }
      },
      { threshold: 0.12 },
    );
    document
      .querySelectorAll('.section-head, .step, .info-band, .faq-copy, .accordion, .cta-band, .trust-strip')
      .forEach((element) => {
        element.classList.add('reveal');
        observer.observe(element);
      });
  }
}

async function boot() {
  initTheme();
  initUi();
  initAuth();
  initCart();
  initCheckout();
  initAccount();
  initAdminPanel();
  setupStaticUi();

  const [configResult, meResult] = await Promise.allSettled([api.config(), api.me()]);

  if (configResult.status === 'fulfilled') {
    state.config = configResult.value;
    applyConfig();
  } else {
    toast('No pudimos cargar la configuración de la tienda.', 'error');
  }

  if (meResult.status === 'fulfilled') {
    setUser(meResult.value.user);
  } else {
    setUser(null);
  }

  initCatalog();
}

window.addEventListener('unhandledrejection', (event) => {
  console.error('[ui] promesa rechazada:', event.reason);
});

document.addEventListener('DOMContentLoaded', boot);
