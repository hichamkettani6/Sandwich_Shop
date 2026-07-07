const SERVER_URL = 'http://localhost:3001';

async function apiFetch(path, options = {}) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}


export const getMenu = () => apiFetch('/api/menu');
export const getAvailability = () => apiFetch('/api/availability');


export const login = (username, password) =>
  apiFetch('/api/sessions', { method: 'POST', body: JSON.stringify({ username, password }) });

export const verifyTotp = (token) =>
  apiFetch('/api/sessions/totp', { method: 'POST', body: JSON.stringify({ token }) });

export const getCurrentUser = () => apiFetch('/api/sessions/current');

export const logout = () =>
  apiFetch('/api/sessions/current', { method: 'DELETE' });


export const getOrders = () => apiFetch('/api/orders');

export const submitOrder = (sandwiches) =>
  apiFetch('/api/orders', { method: 'POST', body: JSON.stringify({ sandwiches }) });

export const deleteOrder = (orderId) =>
  apiFetch(`/api/orders/${orderId}`, { method: 'DELETE' });
