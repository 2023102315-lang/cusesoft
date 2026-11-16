const MODAL_IDS = ['productModal', 'authModal', 'checkoutModal', 'accountModal'];
let lastFocused = null;

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

export function esc(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function initials(name = '', lastName = '') {
  const parts = `${name} ${lastName}`.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return 'CS';
  return `${parts[0][0] || ''}${parts[1]?.[0] || ''}`.toUpperCase();
}

export function formatDate(value) {
  try {
    return new Intl.DateTimeFormat('es-PE', { day: '2-digit', month: 'short', year: 'numeric' }).format(
      new Date(value),
    );
  } catch {
    return '';
  }
}

export const icons = {
  close: '<svg viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none"><path d="m5 12.5 4.5 4.5L19 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 4v11" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="m7.5 11 4.5 4.5L16.5 11" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 20h14" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="3.2" stroke="currentColor" stroke-width="1.7"/><path d="m10.2 9.2 5 3-5 3V9.2Z" fill="currentColor"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none"><path d="M4.5 7h15M9.5 7V5.2c0-.7.5-1.2 1.2-1.2h2.6c.7 0 1.2.5 1.2 1.2V7M7 7l.8 12c0 .8.7 1.5 1.5 1.5h5.4c.8 0 1.5-.7 1.5-1.5L17 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="14" rx="3" stroke="currentColor" stroke-width="1.7"/><path d="m4.5 7 6.3 5.2a2 2 0 0 0 2.4 0L19.5 7" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3 5 6v5.5c0 4.2 3 7.6 7 9.5 4-1.9 7-5.3 7-9.5V6l-7-3Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9 12 2 2 4-4" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.4" stroke="currentColor" stroke-width="1.7"/><path d="M12 7.5V12l3 1.8" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3.5 13.7 9l5.5 1.7-5.5 1.7L12 18l-1.7-5.6L4.8 10.7 10.3 9 12 3.5Z" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><path d="M18.5 16.5 19.2 18.6 21.2 19.3 19.2 20 18.5 22 17.8 20 15.8 19.3 17.8 18.6 18.5 16.5Z" fill="currentColor"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.6" stroke="currentColor" stroke-width="1.6"/><path d="M12 11v5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="8" r="1.05" fill="currentColor"/></svg>',
  receipt: '<svg viewBox="0 0 24 24" fill="none"><path d="M6 3.5h12v17l-3-2-3 2-3-2-3 2v-17Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 8h6M9 12h6M9 16h3" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none"><rect x="4.5" y="10" width="15" height="10" rx="2.6" stroke="currentColor" stroke-width="1.7"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.4" stroke="currentColor" stroke-width="1.8"/><path d="M5 20c.7-3.6 3.6-5.6 7-5.6s6.3 2 7 5.6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
  google:
    '<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.3-.4-3.5Z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7Z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44Z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.3-.4-3.5Z"/></svg>',
};

export function toast(message, type = 'info', title = '') {
  const stack = $('#toasts');
  if (!stack) return;
  while (stack.children.length >= 3) stack.firstElementChild?.remove();

  const node = document.createElement('div');
  node.className = `toast toast-${type}`;
  node.innerHTML = `<span class="toast-dot" aria-hidden="true"></span><div>${
    title ? `<strong>${esc(title)}</strong><br>` : ''
  }${esc(message)}</div>`;
  stack.append(node);

  window.setTimeout(() => {
    node.classList.add('is-leaving');
    window.setTimeout(() => node.remove(), 280);
  }, type === 'error' ? 6200 : 4200);
}

function anyModalOpen() {
  return MODAL_IDS.some((id) => document.getElementById(id)?.classList.contains('is-open'));
}

function anyOverlayOpen() {
  return anyModalOpen() || Boolean($('#cartDrawer')?.classList.contains('is-open'));
}

function syncBodyScroll() {
  document.body.classList.toggle('no-scroll', anyOverlayOpen());
}

export function openModal(id) {
  const modal = document.getElementById(id);
  if (!modal) return;

  closeCartDrawer({ restoreFocus: false });
  for (const otherId of MODAL_IDS) {
    if (otherId !== id) closeModal(otherId, { silent: true, restoreFocus: false });
  }

  if (!modal.classList.contains('is-open')) lastFocused = document.activeElement;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');

  window.requestAnimationFrame(() => {
    const target =
      modal.querySelector('[data-autofocus]') ||
      modal.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])') ||
      modal.querySelector('.modal-panel button:not([disabled]):not(.modal-close)') ||
      modal.querySelector('.modal-close');
    target?.focus({ preventScroll: true });
  });
}

export function closeModal(id, { silent = false, restoreFocus = true } = {}) {
  const modal = document.getElementById(id);
  if (!modal || !modal.classList.contains('is-open')) return;
  modal.classList.remove('is-open');
  modal.setAttribute('aria-hidden', 'true');
  syncBodyScroll();
  if (!silent) {
    document.dispatchEvent(new CustomEvent('cs:modal:closed', { detail: { id } }));
  }
  if (restoreFocus && !anyOverlayOpen() && lastFocused instanceof HTMLElement) {
    lastFocused.focus({ preventScroll: true });
  }
}

export function closeAllModals() {
  for (const id of MODAL_IDS) closeModal(id, { silent: false, restoreFocus: false });
}

export function openCartDrawer() {
  closeAllModals();
  const scrim = $('#scrim');
  const drawer = $('#cartDrawer');
  if (!drawer) return;

  lastFocused = document.activeElement;
  if (scrim) {
    scrim.hidden = false;
    window.requestAnimationFrame(() => scrim.classList.add('is-visible'));
  }
  drawer.classList.add('is-open');
  drawer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('no-scroll');
  window.requestAnimationFrame(() => {
    drawer.querySelector('[data-close-cart]')?.focus({ preventScroll: true });
  });
}

export function closeCartDrawer({ restoreFocus = true } = {}) {
  const drawer = $('#cartDrawer');
  const scrim = $('#scrim');
  if (!drawer || !drawer.classList.contains('is-open')) return;

  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
  if (scrim) {
    scrim.classList.remove('is-visible');
    window.setTimeout(() => {
      if (!drawer.classList.contains('is-open')) scrim.hidden = true;
    }, 300);
  }
  syncBodyScroll();
  if (restoreFocus && !anyOverlayOpen() && lastFocused instanceof HTMLElement) {
    lastFocused.focus({ preventScroll: true });
  }
}

export function closeAllOverlays() {
  closeAllModals();
  closeCartDrawer({ restoreFocus: false });
}

function trapFocus(event, container) {
  const focusable = $$(
    'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    container,
  ).filter((element) => element.offsetParent !== null || element === document.activeElement);
  if (!focusable.length) return;

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function initUi() {
  const scrim = $('#scrim');
  scrim?.addEventListener('click', () => closeCartDrawer());

  document.addEventListener('keydown', (event) => {
    const openId = MODAL_IDS.find((id) => document.getElementById(id)?.classList.contains('is-open'));
    if (event.key === 'Escape') {
      if (openId) {
        event.preventDefault();
        closeModal(openId);
        return;
      }
      if ($('#cartDrawer')?.classList.contains('is-open')) {
        event.preventDefault();
        closeCartDrawer();
        return;
      }
    }
    if (event.key === 'Tab' && openId) {
      trapFocus(event, document.getElementById(openId));
    }
  });

  document.addEventListener('click', (event) => {
    const closeButton = event.target.closest('[data-close-modal]');
    if (closeButton) {
      const modal = closeButton.closest('.modal');
      if (modal) closeModal(modal.id);
      return;
    }
    if (event.target.classList?.contains('modal')) {
      closeModal(event.target.id);
    }
  });

  const year = $('#year');
  if (year) year.textContent = String(new Date().getFullYear());
}

export function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === 'true') return resolve();
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('No se pudo cargar el script')), {
        once: true,
      });
      return;
    }
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.defer = true;
    script.addEventListener(
      'load',
      () => {
        script.dataset.loaded = 'true';
        resolve();
      },
      { once: true },
    );
    script.addEventListener('error', () => reject(new Error('No se pudo cargar el script')), {
      once: true,
    });
    document.head.append(script);
  });
}
