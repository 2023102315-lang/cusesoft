export class ApiError extends Error {
  constructor(message, status, code, data = {}) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

async function request(path, { method = 'GET', body } = {}) {
  let response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      credentials: 'same-origin',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No pudimos conectar con el servidor. Revisa tu conexión.', 0, 'NETWORK');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(
      data.error || 'Ocurrió un error. Intenta de nuevo.',
      response.status,
      data.code || null,
      data,
    );
  }
  return data;
}

export const api = {
  config: () => request('/config'),
  products: () => request('/products'),
  me: () => request('/auth/me'),
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  requestOtp: (payload) => request('/auth/otp/request', { method: 'POST', body: payload }),
  verifyOtp: (payload) => request('/auth/otp/verify', { method: 'POST', body: payload }),
  googleLogin: (credential) => request('/auth/google', { method: 'POST', body: { credential } }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  updateBirthYear: (birthYear) =>
    request('/auth/profile', { method: 'PATCH', body: { birthYear } }),
  createOrder: (items) => request('/orders', { method: 'POST', body: { items } }),
  getOrders: () => request('/orders'),
  getOrder: (id) => request(`/orders/${encodeURIComponent(id)}`),
  confirmOrder: (id, operationCode) =>
    request(`/orders/${encodeURIComponent(id)}/confirm`, {
      method: 'POST',
      body: { operationCode },
    }),
};
