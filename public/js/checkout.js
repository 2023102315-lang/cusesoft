import { api } from './api.js';
import { openAuth } from './auth.js';
import { cartItems, cartTotal, clearCart, formatMoney, state } from './state.js';
import { $, closeModal, esc, icons, openModal, toast } from './ui.js';

const view = {
  step: 'summary',
  order: null,
  qr: null,
  links: [],
  emailSent: null,
  emailError: null,
  expired: false,
  busy: false,
  error: '',
  timer: null,
};

function stopTimer() {
  if (view.timer) {
    window.clearInterval(view.timer);
    view.timer = null;
  }
}

function resetView() {
  stopTimer();
  view.step = 'summary';
  view.order = null;
  view.qr = null;
  view.links = [];
  view.emailSent = null;
  view.emailError = null;
  view.expired = false;
  view.busy = false;
  view.error = '';
}

function formatClock(ms) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = String(Math.floor(total / 60)).padStart(2, '0');
  const seconds = String(total % 60).padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function stepper(active) {
  const steps = [
    [1, 'Resumen'],
    [2, 'Pago'],
    [3, 'Confirmación'],
  ];
  return `<div class="checkout-steps" aria-label="Progreso de la compra">${steps
    .map(
      ([number, label], index) => `
      <div class="checkout-step ${number < active ? 'is-done' : ''} ${number === active ? 'is-active' : ''}">
        <span class="num">${number < active ? icons.check : number}</span>
        <span>${label}</span>
      </div>
      ${index < steps.length - 1 ? '<span class="checkout-sep" aria-hidden="true"></span>' : ''}`,
    )
    .join('')}</div>`;
}

function orderSummary(items, total) {
  return `
    <div class="checkout-summary">
      <div class="checkout-summary-head"><span>Tu pedido</span><span>${items.length} ${items.length === 1 ? 'producto' : 'productos'}</span></div>
      <div class="checkout-items">
        ${items
          .map(
            (item) => `<div class="checkout-item"><span>${esc(item.name)}</span><strong>${formatMoney(item.price)}</strong></div>`,
          )
          .join('')}
      </div>
      <div class="checkout-total"><span>Total a yapear</span><strong>${formatMoney(total)}</strong></div>
    </div>`;
}

function summaryView() {
  const items = cartItems();
  const total = cartTotal();
  return `
    <div class="modal-head">
      <span class="eyebrow">Checkout</span>
      <h2 id="checkoutModalTitle">Revisa tu pedido</h2>
      <p>Pagarás con Yape. Al continuar generaremos un QR único con el monto exacto de tu compra.</p>
    </div>
    ${stepper(1)}
    <div class="checkout-grid">
      <div class="checkout-side">
        ${orderSummary(items, total)}
        <div class="detail-note">${icons.shield}<span>Tu compra queda vinculada a tu cuenta <strong>${esc(state.user?.email || '')}</strong>. Los enlaces también se envían a ese correo.</span></div>
        ${view.error ? `<div class="form-error" role="alert">${esc(view.error)}</div>` : ''}
      </div>
      <div class="checkout-side">
        <div class="pay-instructions">
          <h3>Qué pasará al continuar</h3>
          <ol>
            <li>Generamos un QR de Yape con el monto exacto y un código de pedido.</li>
            <li>Escaneas el QR o yapeas al número indicado y guardas tu número de operación.</li>
            <li>Ingresas el código de operación y desbloqueas tus descargas al instante.</li>
          </ol>
        </div>
        <button class="btn btn-primary btn-block btn-lg" type="button" id="startPaymentBtn">
          Generar QR de Yape ${icons.arrow}
        </button>
        <p class="form-note">Pago directo a ${esc(state.config?.yape?.name || 'CuseSoft')} · Sin comisiones extra</p>
      </div>
    </div>`;
}

function payView() {
  const order = view.order;
  const qr = view.qr;
  const expired = view.expired || order.expiresAt < Date.now();
  return `
    <div class="modal-head">
      <span class="eyebrow">Paso 2 de 3</span>
      <h2 id="checkoutModalTitle">Paga con Yape</h2>
      <p>Escanea el QR desde la app de Yape y paga el monto exacto. Luego ingresa el número de operación.</p>
    </div>
    ${stepper(2)}
    <div class="checkout-grid">
      <div class="qr-card">
        <div class="qr-frame"><img src="${esc(qr.image)}" alt="QR de Yape para el pedido ${esc(order.code)}"></div>
        <div class="qr-amount"><span>Monto a pagar</span>${formatMoney(order.total)}</div>
        <div class="qr-owner">Yapea a <strong>${esc(qr.merchant.name)}</strong></div>
        <div class="qr-phone">${icons.user} ${esc(qr.merchant.phone)}</div>
        <div class="qr-owner" style="margin-top:10px;">Pedido <span class="order-chip">${esc(order.code)}</span></div>
        ${qr.generated && state.config?.devMode ? `<p class="qr-dev-note">QR de demostración. Para cobrar de verdad, configura <strong>YAPE_QR_IMAGE</strong> con la imagen de tu QR oficial de Yape.</p>` : ''}
      </div>
      <div class="checkout-side">
        ${orderSummary(order.items, order.total)}
        <div class="pay-instructions">
          <h3>Cómo completar el pago</h3>
          <ol>
            <li>Abre Yape, toca el ícono de escanear y apunta al QR.</li>
            <li>Verifica que el monto sea <strong>${formatMoney(order.total)}</strong> y confirma el pago.</li>
            <li>Copia el número de operación del comprobante y vuelve aquí.</li>
          </ol>
        </div>
        <div class="pay-meta">
          <span class="timer" id="payTimer">${expired ? 'Expirado' : formatClock(order.expiresAt - Date.now())}</span>
          <span class="order-chip">${esc(order.code)}</span>
        </div>
        ${expired ? `<div class="form-error" id="payExpired" role="alert">El tiempo para pagar este pedido terminó. Genera un QR nuevo para continuar.</div>` : ''}
        <div class="form-error" id="payError" role="alert" ${view.error ? '' : 'hidden'}>${esc(view.error)}</div>
        <div class="checkout-actions">
          <button class="btn btn-primary btn-block" type="button" id="goConfirmBtn" ${expired ? 'disabled' : ''}>
            Ya pagué, ingresar código
          </button>
          <button class="btn btn-ghost btn-block" type="button" id="newQrBtn">Generar un QR nuevo</button>
        </div>
        <p class="form-note">No compartas tu código de operación con nadie.</p>
      </div>
    </div>`;
}

function confirmView() {
  const order = view.order;
  return `
    <div class="modal-head">
      <span class="eyebrow">Paso 3 de 3</span>
      <h2 id="checkoutModalTitle">Confirma tu pago</h2>
      <p>Ingresa el número de operación que aparece en tu comprobante de Yape. Lo usamos para validar la compra.</p>
    </div>
    ${stepper(3)}
    <div class="checkout-grid">
      <div class="checkout-side">
        ${orderSummary(order.items, order.total)}
        <div class="detail-note">${icons.lock}<span>Por seguridad, cada número de operación se acepta una sola vez y queda asociado a tu pedido <strong>${esc(order.code)}</strong>.</span></div>
        <div class="pay-meta">
          <span class="timer" id="confirmTimer">${formatClock(order.expiresAt - Date.now())}</span>
          <span class="order-chip">${esc(order.code)}</span>
        </div>
      </div>
      <div class="checkout-side">
        <form class="form" id="confirmForm" novalidate>
          <div class="code-box">
            <h3>Número de operación</h3>
            <p>Aparece en el comprobante de Yape, junto al monto que pagaste.</p>
            <label class="field" for="operationCode" style="position:absolute;left:-9999px;">Número de operación</label>
            <input class="input" id="operationCode" name="operationCode" type="text" inputmode="text" autocomplete="off" spellcheck="false" maxlength="20" placeholder="Ej. 123456789" required>
            <p class="code-help">Puedes escribirlo con o sin espacios. Entre 6 y 20 letras o dígitos.</p>
          </div>
          <div class="form-error" id="payError" role="alert" ${view.error ? '' : 'hidden'}>${esc(view.error)}</div>
          <button class="btn btn-primary btn-block btn-lg" type="submit" id="confirmPayBtn">Confirmar pago y descargar</button>
        </form>
        <button class="link-btn" type="button" data-back-pay style="align-self:center;">← Volver al QR</button>
      </div>
    </div>`;
}

function successView() {
  const order = view.order;
  return `
    <div class="success-wrap">
      <span class="success-ico" aria-hidden="true">${icons.check}</span>
      <h2 id="checkoutModalTitle">¡Pago confirmado!</h2>
      <p>Tu compra se registró correctamente. Los enlaces de descarga y el video de instrucciones ya están disponibles.</p>
      <div class="success-order">Pedido <strong>${esc(order.code)}</strong> · ${formatMoney(order.total)}</div>

      ${
        view.links.length
          ? `<div class="download-list">
              ${view.links
                .map(
                  (link) => `
                <div class="download-item">
                  <div>
                    <strong>${esc(link.name)}</strong>
                    <span>${esc(link.fileLabel)} · Enlace válido por 7 días</span>
                  </div>
                  <div class="download-actions">
                    <a class="btn btn-primary" href="${esc(link.downloadUrl)}">${icons.download} Descargar</a>
                    <a class="btn btn-ghost" href="${esc(link.tutorialUrl)}" target="_blank" rel="noopener">${icons.play} Video</a>
                  </div>
                </div>`,
                )
                .join('')}
            </div>`
          : ''
      }

      ${
        view.emailError
          ? `<div class="form-error" role="alert">${esc(view.emailError)}</div>`
          : `<p class="small muted">También enviamos los dos enlaces a <strong>${esc(state.user?.email || 'tu correo')}</strong>.</p>`
      }

      <div class="success-actions" style="margin-top:20px;">
        <button class="btn btn-primary" type="button" id="goAccountBtn">Ir a mis compras</button>
        <button class="btn btn-ghost" type="button" id="continueShoppingBtn">Seguir comprando</button>
      </div>
      <p class="success-note">Guarda tu número de operación: ${esc(order.operationCode || '—')}. Los enlaces de descarga son personales e intransferibles.</p>
    </div>`;
}

function verifyingView() {
  return `
    <div class="success-wrap">
      <span class="success-ico" style="background:rgba(96,165,250,.12);border-color:rgba(96,165,250,.3);color:#93c5fd;box-shadow:0 0 50px rgba(96,165,250,.16);" aria-hidden="true">${icons.clock}</span>
      <h2 id="checkoutModalTitle">Pago en verificación</h2>
      <p>Registramos tu número de operación. Un administrador revisará el pago y, cuando se confirme, recibirás los enlaces por correo.</p>
      <div class="success-order">Pedido <strong>${esc(view.order.code)}</strong> · ${formatMoney(view.order.total)}</div>
      <div class="success-actions" style="margin-top:20px;">
        <button class="btn btn-primary" type="button" id="goAccountBtn">Ir a mis compras</button>
        <button class="btn btn-ghost" type="button" id="continueShoppingBtn">Seguir explorando</button>
      </div>
    </div>`;
}

function expiredView() {
  return `
    <div class="success-wrap">
      <span class="success-ico" style="background:rgba(251,191,36,.1);border-color:rgba(251,191,36,.3);color:#fcd34d;box-shadow:none;" aria-hidden="true">${icons.clock}</span>
      <h2 id="checkoutModalTitle">Este pedido expiró</h2>
      <p>El plazo de 30 minutos para pagar terminó. Puedes volver al catálogo y generar un pedido nuevo.</p>
      <div class="success-actions" style="margin-top:20px;">
        <button class="btn btn-primary" type="button" id="continueShoppingBtn">Volver al catálogo</button>
        <button class="btn btn-ghost" type="button" id="goAccountBtn">Ir a mis compras</button>
      </div>
    </div>`;
}

function errorView() {
  return `
    <div class="success-wrap">
      <span class="success-ico" style="background:rgba(251,113,133,.1);border-color:rgba(251,113,133,.3);color:#fda4af;box-shadow:none;" aria-hidden="true">${icons.info}</span>
      <h2 id="checkoutModalTitle">No pudimos cargar el pedido</h2>
      <p>${esc(view.error || 'Intenta de nuevo en unos segundos.')}</p>
      <div class="success-actions" style="margin-top:20px;">
        <button class="btn btn-primary" type="button" id="continueShoppingBtn">Volver al catálogo</button>
      </div>
    </div>`;
}

function render() {
  const body = $('#checkoutModalBody');
  if (!body) return;
  stopTimer();

  body.innerHTML = (() => {
    switch (view.step) {
      case 'loading':
        return `<div class="modal-head"><span class="eyebrow">Checkout</span><h2 id="checkoutModalTitle">Cargando pedido...</h2></div><div class="skeleton skeleton-line w-60"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line w-40"></div>`;
      case 'pay':
        return payView();
      case 'confirm':
        return confirmView();
      case 'success':
        return successView();
      case 'verifying':
        return verifyingView();
      case 'expired':
        return expiredView();
      case 'error':
        return errorView();
      default:
        return summaryView();
    }
  })();

  if (view.step === 'pay') startTimer();
  if (view.step === 'confirm') {
    window.requestAnimationFrame(() => {
      const input = $('#operationCode');
      input?.focus({ preventScroll: true });
    });
  }
}

function startTimer() {
  stopTimer();
  const order = view.order;
  if (!order) return;

  const tick = () => {
    const left = order.expiresAt - Date.now();
    const timer = $('#payTimer') || $('#confirmTimer');
    if (timer) timer.textContent = left > 0 ? formatClock(left) : 'Expirado';
    if (left <= 0) {
      stopTimer();
      view.expired = true;
      const button = $('#goConfirmBtn');
      if (button) {
        button.disabled = true;
        button.textContent = 'Tiempo agotado';
      }
      const confirmButton = $('#confirmPayBtn');
      if (confirmButton) confirmButton.disabled = true;
      const banner = $('#payExpired');
      if (banner) banner.hidden = false;
    }
  };

  tick();
  view.timer = window.setInterval(tick, 1000);
}

function setBusy(element, busy, text) {
  if (!element) return;
  if (busy) {
    element.dataset.label = element.innerHTML;
    element.disabled = true;
    element.textContent = text;
  } else {
    element.disabled = false;
    if (element.dataset.label) {
      element.innerHTML = element.dataset.label;
      delete element.dataset.label;
    }
  }
}

function showPayError(message) {
  view.error = message;
  const box = $('#payError');
  if (box) {
    box.hidden = false;
    box.textContent = message;
    box.scrollIntoView({ block: 'nearest' });
  }
  toast(message, 'error');
}

async function startPayment() {
  if (view.busy) return;
  if (!state.user) {
    closeModal('checkoutModal');
    openAuth({ intent: 'checkout' });
    return;
  }
  if (!state.cart.length) {
    toast('Tu carrito está vacío.', 'info');
    return;
  }

  view.busy = true;
  view.error = '';
  const button = $('#startPaymentBtn') || $('#newQrBtn');
  setBusy(button, true, 'Generando QR...');

  try {
    const data = await api.createOrder(state.cart);
    view.order = data.order;
    view.qr = data.qr;
    view.links = [];
    view.expired = false;
    view.step = 'pay';
    render();
    toast('QR generado. Escanéalo desde Yape.', 'success', 'Pago listo');
  } catch (error) {
    if (error.status === 401) {
      closeModal('checkoutModal');
      openAuth({ intent: 'checkout' });
      return;
    }
    view.error = error.message;
    if (view.step === 'pay') {
      showPayError(error.message);
    } else {
      render();
      toast(error.message, 'error');
    }
  } finally {
    view.busy = false;
    setBusy(button, false, '');
  }
}

async function confirmPayment() {
  if (view.busy) return;
  const input = $('#operationCode');
  const code = String(input?.value || '').trim();

  if (!/^[A-Za-z0-9\s-]{6,24}$/.test(code)) {
    showPayError('Ingresa un número de operación válido (6 a 20 letras o dígitos).');
    input?.focus();
    return;
  }

  view.busy = true;
  view.error = '';
  const button = $('#confirmPayBtn');
  setBusy(button, true, 'Verificando pago...');

  try {
    const result = await api.confirmOrder(view.order.id, code);
    view.order = result.order || view.order;

    if (result.pendingApproval) {
      view.step = 'verifying';
      render();
      return;
    }

    view.links = result.links || [];
    view.emailSent = result.emailSent;
    view.emailError = result.emailError || null;
    view.step = 'success';
    stopTimer();
    clearCart();
    render();

    if (result.alreadyPaid) {
      toast('Este pedido ya estaba confirmado.', 'info');
    } else {
      toast('Pago confirmado. Tus enlaces están listos.', 'success', 'Compra completada');
    }
  } catch (error) {
    if (error.status === 401) {
      closeModal('checkoutModal');
      openAuth({ intent: 'checkout' });
      return;
    }
    if (error.code === 'ORDER_EXPIRED') {
      view.expired = true;
      view.step = 'pay';
      view.error = error.message;
      render();
      toast(error.message, 'error');
      return;
    }
    showPayError(error.message);
    setBusy(button, false, '');
  } finally {
    view.busy = false;
  }
}

function handleClick(event) {
  if (event.target.closest('#startPaymentBtn')) {
    startPayment();
    return;
  }
  if (event.target.closest('#goConfirmBtn')) {
    view.step = 'confirm';
    view.error = '';
    render();
    return;
  }
  if (event.target.closest('[data-back-pay]')) {
    view.step = 'pay';
    view.error = '';
    render();
    return;
  }
  if (event.target.closest('#newQrBtn')) {
    startPayment();
    return;
  }
  if (event.target.closest('#goAccountBtn')) {
    closeModal('checkoutModal');
    document.dispatchEvent(new CustomEvent('cs:open-account'));
    return;
  }
  if (event.target.closest('#continueShoppingBtn')) {
    closeModal('checkoutModal');
    document.querySelector('#catalogo')?.scrollIntoView({ behavior: 'smooth' });
  }
}

function handleSubmit(event) {
  if (event.target.id === 'confirmForm') {
    event.preventDefault();
    confirmPayment();
  }
}

export function openCheckout() {
  if (!state.user) {
    openAuth({ intent: 'checkout' });
    return;
  }
  if (!state.cart.length) {
    toast('Tu carrito está vacío. Agrega un producto para pagar.', 'info');
    return;
  }
  resetView();
  openModal('checkoutModal');
  render();
}

export async function openCheckoutWithOrder(orderId) {
  if (!state.user) {
    openAuth({ intent: 'checkout' });
    return;
  }
  resetView();
  view.step = 'loading';
  openModal('checkoutModal');
  render();

  try {
    const data = await api.getOrder(orderId);
    view.order = data.order;
    view.qr = data.qr || null;
    view.links = data.links || [];
    view.expired = data.order.expiresAt < Date.now();

    if (data.order.status === 'paid') view.step = 'success';
    else if (data.order.status === 'verifying') view.step = 'verifying';
    else if (data.order.status === 'expired') view.step = 'expired';
    else view.step = 'pay';

    render();
  } catch (error) {
    if (error.status === 401) {
      closeModal('checkoutModal');
      openAuth({ intent: 'checkout' });
      return;
    }
    view.step = 'error';
    view.error = error.message;
    render();
  }
}

export function initCheckout() {
  document.addEventListener('cs:auth', (event) => {
    if (event.detail?.intent === 'checkout') {
      window.setTimeout(() => openCheckout(), 60);
    }
  });

  document.addEventListener('cs:modal:closed', (event) => {
    if (event.detail?.id === 'checkoutModal') stopTimer();
  });

  const body = $('#checkoutModalBody');
  if (!body) return;
  body.addEventListener('click', handleClick);
  body.addEventListener('submit', handleSubmit);
}
