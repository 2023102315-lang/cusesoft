import { api } from './api.js';
import { setUser, state } from './state.js';
import { $, closeModal, esc, icons, loadScript, openModal, toast } from './ui.js';

const auth = {
  tab: 'login',
  step: 'form',
  mode: 'login',
  intent: null,
  email: '',
  password: '',
  confirmPassword: '',
  name: '',
  lastName: '',
  birthYear: '',
  devCode: '',
  error: '',
  busy: false,
  resendAt: 0,
  timer: null,
};

let googleLoading = false;
let googleInitialized = false;

function stopTimer() {
  if (auth.timer) {
    window.clearInterval(auth.timer);
    auth.timer = null;
  }
}

function currentFormValues() {
  const form = $('#authForm');
  if (!form) return;
  auth.email = String(form.email?.value || auth.email).trim();
  if (form.password) auth.password = form.password.value;
  if (form.confirmPassword) auth.confirmPassword = form.confirmPassword.value;
  if (form.firstName) auth.name = form.firstName.value.trim();
  if (form.lastName) auth.lastName = form.lastName.value.trim();
  if (form.birthYear) auth.birthYear = form.birthYear.value.trim();
}

function googleBlock() {
  if (!state.config?.googleEnabled) {
    return `
      <button class="google-btn" type="button" disabled>${icons.google} Continuar con Google</button>
      <p class="google-note">Para activar Google Sign-In, define <code>GOOGLE_CLIENT_ID</code> en el archivo <code>.env</code> y reinicia el servidor.</p>`;
  }
  return `
    <div class="google-wrap">
      <div id="googleBtnSlot" style="display:flex;justify-content:center;min-height:44px;"></div>
      <p class="google-note" id="googleStatus" hidden></p>
    </div>`;
}

const EYE_OPEN =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12Z" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><circle cx="12" cy="12" r="2.8" stroke="currentColor" stroke-width="1.7"/></svg>';
const EYE_CLOSED =
  '<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m3 3 18 18M10.6 5.7A9.4 9.4 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16.8 16.8 0 0 1-3.3 4.3M6.7 7.1A16.5 16.5 0 0 0 2.5 12s3.5 6.5 9.5 6.5c1.6 0 3-.4 4.2-1" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>';

function authErrorBox() {
  return `<div class="form-error" id="authError" role="alert" ${auth.error ? '' : 'hidden'}>${esc(auth.error)}</div>`;
}

function formView() {
  const isSignup = auth.tab === 'signup';
  const buying = auth.intent === 'checkout';
  return `
    <div class="auth-header">
      <span class="eyebrow">${buying ? 'Compra protegida' : 'Tu cuenta'}</span>
      <h2 id="authModalTitle">${isSignup ? 'Crea tu cuenta' : 'Bienvenido de vuelta'}</h2>
      <p>${
        buying
          ? 'Inicia sesión o crea una cuenta para completar tu compra. Tu carrito se conserva.'
          : isSignup
            ? 'Regístrate con tu correo y crea una contraseña, o continúa con Google.'
            : 'Ingresa con tu correo y contraseña, o continúa con Google.'
      }</p>
    </div>

    <div class="segmented" role="tablist" aria-label="Acceso a la cuenta">
      <button type="button" role="tab" data-auth-tab="login" aria-selected="${!isSignup}" class="${!isSignup ? 'is-active' : ''}">Iniciar sesión</button>
      <button type="button" role="tab" data-auth-tab="signup" aria-selected="${isSignup}" class="${isSignup ? 'is-active' : ''}">Crear cuenta</button>
    </div>

    ${googleBlock()}
    <div class="divider">o con tu correo</div>

    <form class="form" id="authForm" novalidate>
      ${
        isSignup
          ? `<div class="form-row">
              <div class="field">
                <label for="firstName">Nombre</label>
                <input class="input" id="firstName" name="firstName" type="text" autocomplete="given-name" placeholder="Ana" value="${esc(auth.name)}" required>
              </div>
              <div class="field">
                <label for="lastName">Apellido</label>
                <input class="input" id="lastName" name="lastName" type="text" autocomplete="family-name" placeholder="García" value="${esc(auth.lastName)}" required>
              </div>
            </div>
            <div class="field">
              <label for="birthYear">Año de nacimiento</label>
              <input class="input" id="birthYear" name="birthYear" type="number" inputmode="numeric" min="1900" max="${new Date().getFullYear() - 13}" placeholder="1995" value="${esc(auth.birthYear)}" required>
              <span class="field-hint">Debes tener al menos 13 años. Solo lo usamos para tu perfil.</span>
            </div>`
          : ''
      }
      <div class="field">
        <label for="authEmail">Correo electrónico</label>
        <input class="input" id="authEmail" name="email" type="email" autocomplete="email" placeholder="tucorreo@ejemplo.com" value="${esc(auth.email)}" required>
      </div>
      <div class="field">
        <label for="authPassword">Contraseña</label>
        <div class="input-wrap">
          <input class="input" id="authPassword" name="password" type="password" autocomplete="${isSignup ? 'new-password' : 'current-password'}" minlength="6" placeholder="${isSignup ? 'Mínimo 6 caracteres' : 'Tu contraseña'}" required>
          <button class="password-toggle" type="button" data-toggle-password="authPassword" aria-label="Mostrar contraseña" aria-pressed="false">${EYE_OPEN}</button>
        </div>
      </div>
      ${
        isSignup
          ? `<div class="field">
              <label for="authPasswordConfirm">Confirmar contraseña</label>
              <div class="input-wrap">
                <input class="input" id="authPasswordConfirm" name="confirmPassword" type="password" autocomplete="new-password" minlength="6" placeholder="Repite tu contraseña" required>
                <button class="password-toggle" type="button" data-toggle-password="authPasswordConfirm" aria-label="Mostrar contraseña" aria-pressed="false">${EYE_OPEN}</button>
              </div>
            </div>`
          : ''
      }
      ${authErrorBox()}
      <button class="btn btn-primary btn-block" type="submit" id="authSubmit">
        ${isSignup ? 'Crear cuenta' : 'Iniciar sesión'}
      </button>
    </form>
    <p class="form-note">Al continuar aceptas nuestros términos y la política de privacidad. Nunca te pediremos tu contraseña de Yape.</p>
  `;
}

function otpView() {
  const isSignup = auth.mode === 'signup';
  const devHint = auth.devCode
    ? `<div class="dev-hint">
        <span>Modo demo · no hay SMTP configurado<br><strong>${esc(auth.devCode)}</strong></span>
        <button class="link-btn" type="button" data-fill-otp>Autocompletar</button>
      </div>`
    : '';
  const inputs = Array.from({ length: 6 }, (_, index) => `
    <input type="text" inputmode="numeric" pattern="[0-9]*" maxlength="1" aria-label="Dígito ${index + 1} de 6"
      ${index === 0 ? 'autocomplete="one-time-code"' : 'autocomplete="off"'} data-otp-index="${index}">`
  ).join('');

  return `
    <div class="auth-header otp-head">
      <span class="eyebrow">Verificación</span>
      <h2 id="authModalTitle">Revisa tu correo</h2>
      <p>Enviamos un código de 6 dígitos a</p>
      <span class="mail-pill">${icons.mail} ${esc(auth.email)}</span>
    </div>

    ${devHint}

    <form class="form" id="otpForm" novalidate>
      <div class="otp-inputs" id="otpInputs" role="group" aria-label="Código de verificación de 6 dígitos">${inputs}</div>
      ${authErrorBox()}
      <button class="btn btn-primary btn-block" type="submit" id="otpSubmit">
        ${isSignup ? 'Verificar y crear cuenta' : 'Verificar y entrar'}
      </button>
    </form>

    <div class="auth-links">
      <button class="link-btn" type="button" data-auth-back>← Usar otro correo</button>
      <span id="resendWrap"></span>
    </div>
  `;
}

function render() {
  const body = $('#authModalBody');
  if (!body) return;
  stopTimer();
  body.innerHTML = auth.step === 'otp' ? otpView() : formView();

  if (auth.step === 'otp') {
    bindOtpInputs();
    updateResendLabel();
    window.requestAnimationFrame(() => {
      document.querySelector('[data-otp-index="0"]')?.focus({ preventScroll: true });
    });
  } else {
    setupGoogle();
  }
}

function showError(message) {
  auth.error = message;
  const box = $('#authError');
  if (box) {
    box.hidden = false;
    box.textContent = message;
    box.scrollIntoView({ block: 'nearest' });
  }
}

function setBusy(button, busy, busyText) {
  auth.busy = busy;
  if (!button) return;
  if (busy) {
    button.dataset.label = button.innerHTML;
    button.disabled = true;
    button.textContent = busyText;
  } else {
    button.disabled = false;
    if (button.dataset.label) button.innerHTML = button.dataset.label;
  }
}

function validateForm({ email, password, confirmPassword, name, lastName, birthYear, signup }) {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email)) {
    return 'Ingresa un correo electrónico válido.';
  }
  if (signup) {
    if (name.trim().length < 2) return 'Ingresa tu nombre.';
    if (lastName.trim().length < 2) return 'Ingresa tu apellido.';
    const year = Number(birthYear);
    if (!Number.isInteger(year) || year < 1900 || year > new Date().getFullYear() - 13) {
      return 'Ingresa un año de nacimiento válido (mínimo 13 años).';
    }
    if (!password || password.length < 6) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }
    if (password !== confirmPassword) {
      return 'Las contraseñas no coinciden.';
    }
  } else if (!password) {
    return 'Ingresa tu contraseña.';
  }
  return '';
}

async function submitForm() {
  if (auth.busy) return;
  currentFormValues();
  const signup = auth.tab === 'signup';
  const problem = validateForm({
    email: auth.email,
    password: auth.password,
    confirmPassword: auth.confirmPassword,
    name: auth.name,
    lastName: auth.lastName,
    birthYear: auth.birthYear,
    signup,
  });
  if (problem) {
    showError(problem);
    return;
  }

  const button = $('#authSubmit');
  setBusy(button, true, signup ? 'Creando cuenta...' : 'Iniciando sesión...');
  auth.error = '';

  try {
    const result = signup
      ? await api.register({
          email: auth.email,
          password: auth.password,
          name: auth.name,
          lastName: auth.lastName,
          birthYear: auth.birthYear,
        })
      : await api.login({
          email: auth.email,
          password: auth.password,
        });
    auth.password = '';
    auth.confirmPassword = '';
    completeLogin(result.user);
  } catch (error) {
    if (error.code === 'ACCOUNT_EXISTS') {
      auth.tab = 'login';
      auth.error = error.message;
      render();
      return;
    }
    showError(error.message);
  } finally {
    setBusy(button, false, '');
  }
}

function bindOtpInputs() {
  const inputs = $$Otp();
  inputs.forEach((input) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/\D/g, '').slice(0, 1);
      input.classList.toggle('is-filled', Boolean(input.value));
      if (input.value) {
        const next = inputs[Number(input.dataset.otpIndex) + 1];
        next?.focus({ preventScroll: true });
      }
      if (inputs.every((item) => item.value)) {
        window.setTimeout(() => submitOtp(), 120);
      }
    });

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !input.value) {
        const previous = inputs[Number(input.dataset.otpIndex) - 1];
        if (previous) {
          event.preventDefault();
          previous.value = '';
          previous.classList.remove('is-filled');
          previous.focus({ preventScroll: true });
        }
      }
      if (event.key === 'ArrowLeft') {
        inputs[Number(input.dataset.otpIndex) - 1]?.focus();
      }
      if (event.key === 'ArrowRight') {
        inputs[Number(input.dataset.otpIndex) + 1]?.focus();
      }
    });

    input.addEventListener('paste', (event) => {
      const text = String(event.clipboardData?.getData('text') || '').replace(/\D/g, '').slice(0, 6);
      if (!text) return;
      event.preventDefault();
      inputs.forEach((item, index) => {
        item.value = text[index] || '';
        item.classList.toggle('is-filled', Boolean(item.value));
      });
      const last = inputs[Math.min(text.length, 6) - 1];
      last?.focus();
      if (text.length === 6) window.setTimeout(() => submitOtp(), 120);
    });
  });
}

function $$Otp() {
  return [...document.querySelectorAll('[data-otp-index]')];
}

async function submitOtp() {
  if (auth.busy) return;
  const code = $$Otp()
    .map((input) => input.value)
    .join('');
  if (code.length !== 6) {
    showError('Ingresa los 6 dígitos del código.');
    return;
  }

  const button = $('#otpSubmit');
  setBusy(button, true, 'Verificando...');
  auth.error = '';

  try {
    const result = await api.verifyOtp({ email: auth.email, code });
    completeLogin(result.user);
  } catch (error) {
    showError(error.message);
    if (['OTP_WRONG', 'OTP_FORMAT'].includes(error.code)) {
      $$Otp().forEach((input) => {
        input.value = '';
        input.classList.remove('is-filled');
      });
      $$Otp()[0]?.focus({ preventScroll: true });
    }
    if (['OTP_EXPIRED', 'OTP_MISSING', 'OTP_ATTEMPTS'].includes(error.code)) {
      auth.resendAt = 0;
      updateResendLabel();
    }
  } finally {
    setBusy(button, false, '');
  }
}

function startResendTimer(seconds) {
  stopTimer();
  auth.resendAt = Date.now() + Math.max(0, seconds) * 1000;
  updateResendLabel();
  auth.timer = window.setInterval(() => {
    if (Date.now() >= auth.resendAt) {
      stopTimer();
      updateResendLabel();
      return;
    }
    updateResendLabel();
  }, 1000);
}

function updateResendLabel() {
  const wrap = $('#resendWrap');
  if (!wrap) return;
  const remaining = Math.max(0, Math.ceil((auth.resendAt - Date.now()) / 1000));
  if (remaining > 0) {
    wrap.innerHTML = `Reenviar en <strong>${remaining}s</strong>`;
  } else {
    wrap.innerHTML = '<button class="link-btn" type="button" data-resend>Reenviar código</button>';
  }
}

async function resendCode() {
  if (Date.now() < auth.resendAt) return;
  const wrap = $('#resendWrap');
  if (wrap) wrap.textContent = 'Reenviando...';
  try {
    const result = await api.requestOtp({
      mode: auth.mode,
      email: auth.email,
      ...(auth.mode === 'signup'
        ? { name: auth.name, lastName: auth.lastName, birthYear: auth.birthYear }
        : {}),
    });
    auth.devCode = result.devCode || '';
    auth.error = '';
    render();
    startResendTimer(Math.max(1, Math.ceil((result.resendAt - Date.now()) / 1000)));
    toast('Te enviamos un código nuevo.', 'success');
  } catch (error) {
    if (error.code === 'RESEND_COOLDOWN' && error.data?.retryAfter) {
      startResendTimer(error.data.retryAfter);
      toast(error.message, 'info');
      return;
    }
    showError(error.message);
  }
}

function completeLogin(user) {
  stopTimer();
  setUser(user);
  const intent = auth.intent;
  auth.intent = null;
  auth.step = 'form';
  auth.error = '';
  auth.devCode = '';
  closeModal('authModal');
  toast(`Sesión iniciada como ${user.name}.`, 'success', '¡Hola de nuevo!');
  document.dispatchEvent(new CustomEvent('cs:auth', { detail: { intent, user } }));
}

async function setupGoogle() {
  if (!state.config?.googleEnabled) return;
  if (googleLoading) return;

  const renderOfficialButton = () => {
    const slot = document.getElementById('googleBtnSlot');
    if (!slot || !window.google?.accounts?.id) return;
    slot.innerHTML = '';
    window.google.accounts.id.renderButton(slot, {
      type: 'standard',
      theme: 'filled_black',
      size: 'large',
      text: 'continue_with',
      shape: 'pill',
      logo_alignment: 'center',
      width: Math.max(200, Math.min(340, Math.floor(slot.clientWidth || 340))),
    });
  };

  if (window.google?.accounts?.id) {
    if (!googleInitialized) {
      window.google.accounts.id.initialize({
        client_id: state.config.googleClientId,
        callback: handleGoogleCredential,
        ux_mode: 'popup',
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      googleInitialized = true;
    }
    renderOfficialButton();
    return;
  }

  googleLoading = true;
  try {
    await loadScript('https://accounts.google.com/gsi/client');
    if (!window.google?.accounts?.id) throw new Error('Google no está disponible');
    window.google.accounts.id.initialize({
      client_id: state.config.googleClientId,
      callback: handleGoogleCredential,
      ux_mode: 'popup',
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    googleInitialized = true;
    renderOfficialButton();
  } catch {
    const slot = document.getElementById('googleBtnSlot');
    if (slot) {
      slot.innerHTML = `<button class="google-btn" type="button" disabled>${icons.google} Continuar con Google</button>`;
    }
    const status = document.getElementById('googleStatus');
    if (status) {
      status.hidden = false;
      status.textContent =
        'No pudimos cargar Google. Revisa tu conexión o inicia sesión con tu correo.';
    }
  } finally {
    googleLoading = false;
  }
}

async function handleGoogleCredential(response) {
  if (!response?.credential) {
    toast('No se pudo completar el acceso con Google.', 'error');
    return;
  }
  try {
    const result = await api.googleLogin(response.credential);
    completeLogin(result.user);
  } catch (error) {
    showError(error.message);
    toast(error.message, 'error', 'Google Sign-In');
  }
}

export function openAuth({ intent = null, tab = null } = {}) {
  if (state.user) {
    if (intent === 'checkout') {
      document.dispatchEvent(new CustomEvent('cs:auth', { detail: { intent, user: state.user } }));
    }
    return;
  }
  if (intent) auth.intent = intent;
  if (tab) auth.tab = tab;
  auth.step = 'form';
  auth.error = '';
  auth.devCode = '';
  auth.busy = false;
  openModal('authModal');
  render();
}

export function initAuth() {
  const body = $('#authModalBody');
  if (!body) return;

  body.addEventListener('click', (event) => {
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

    const tabButton = event.target.closest('[data-auth-tab]');
    if (tabButton) {
      currentFormValues();
      auth.tab = tabButton.dataset.authTab;
      auth.error = '';
      render();
      return;
    }

    if (event.target.closest('[data-auth-back]')) {
      stopTimer();
      auth.step = 'form';
      auth.error = '';
      auth.devCode = '';
      render();
      return;
    }

    if (event.target.closest('[data-resend]')) {
      resendCode();
      return;
    }

    if (event.target.closest('[data-fill-otp]')) {
      const inputs = $$Otp();
      inputs.forEach((input, index) => {
        input.value = auth.devCode[index] || '';
        input.classList.toggle('is-filled', Boolean(input.value));
      });
      submitOtp();
    }
  });

  body.addEventListener('submit', (event) => {
    if (event.target.id === 'authForm') {
      event.preventDefault();
      submitForm();
      return;
    }
    if (event.target.id === 'otpForm') {
      event.preventDefault();
      submitOtp();
    }
  });

  document.addEventListener('cs:modal:closed', (event) => {
    if (event.detail?.id === 'authModal') stopTimer();
  });
}
