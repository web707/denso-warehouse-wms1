import { request, raw } from './client';
import { clearTokens, setTokens } from './tokens';

export const api = {
  auth: {
    async register(email, password, fullName) {
      const data = await request('/auth/register', { method: 'POST', body: { email, password, fullName }, skipAuth: true });
      setTokens(data);
      return data;
    },
    async login(email, password) {
      const data = await request('/auth/login', { method: 'POST', body: { email, password }, skipAuth: true });
      setTokens(data);
      return data;
    },
    me: () => request('/auth/me'),
    logout: () => clearTokens(),
    forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email }, skipAuth: true }),
    resetPassword: (token, newPassword) => request('/auth/reset-password', { method: 'POST', body: { token, newPassword }, skipAuth: true }),
  },

  divisions: { list: () => request('/divisions') },
  rackTypes: { list: () => request('/rack-types') },

  orders: {
    list: () => request('/orders'),
    create: (body) => request('/orders', { method: 'POST', body }),
    update: (id, body) => request(`/orders/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/orders/${id}`, { method: 'DELETE' }),
  },

  parts: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/parts${qs ? `?${qs}` : ''}`);
    },
    create: (body) => request('/parts', { method: 'POST', body }),
    update: (id, body) => request(`/parts/${id}`, { method: 'PATCH', body }),
    assignRack: (id, rackId, slotIndex = null) =>
      request(`/parts/${id}/rack-assignment`, { method: 'PATCH', body: { rackId, slotIndex } }),
    remove: (id) => request(`/parts/${id}`, { method: 'DELETE' }),
  },

  racks: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/racks${qs ? `?${qs}` : ''}`);
    },
    create: (body) => request('/racks', { method: 'POST', body }),
    initializeWarehouse: (body) => request('/racks/initialize-warehouse', { method: 'POST', body }),
    update: (id, body) => request(`/racks/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/racks/${id}`, { method: 'DELETE' }),
  },

  packingRules: {
    list: () => request('/packing-rules'),
    create: (body) => request('/packing-rules', { method: 'POST', body }),
    update: (id, body) => request(`/packing-rules/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/packing-rules/${id}`, { method: 'DELETE' }),
  },

  history: {
    list: (params = {}) => {
      const qs = new URLSearchParams(params).toString();
      return request(`/history${qs ? `?${qs}` : ''}`);
    },
  },

  storage: {
    solve: (rackId) => request(`/storage/racks/${rackId}/solve`, { method: 'POST' }),
    autoAssign: (rackId) => request(`/storage/racks/${rackId}/auto-assign`, { method: 'POST' }),
    plan: (rackId) => request(`/storage/racks/${rackId}/plan`),
    violations: (rackId) => request(`/storage/racks/${rackId}/violations`),
    recommendRack: (orderId) => request(`/storage/orders/${orderId}/recommend-rack`),
    exportXlsx: (rackId) => raw(`/storage/racks/${rackId}/export.xlsx`),
    exportOrderXlsx: (orderId) => raw(`/storage/orders/${orderId}/export.xlsx`),
  },


  inventory: {
    list: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/inventory/transactions${qs ? `?${qs}` : ''}`); },
    create: (body) => request('/inventory/transactions', { method: 'POST', body }),
    heatmap: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/inventory/heatmap${qs ? `?${qs}` : ''}`); },
  },

  zones: {
    list: (params = {}) => { const qs = new URLSearchParams(params).toString(); return request(`/warehouse-zones${qs ? `?${qs}` : ''}`); },
    create: (body) => request('/warehouse-zones', { method: 'POST', body }),
    update: (id, body) => request(`/warehouse-zones/${id}`, { method: 'PATCH', body }),
    remove: (id) => request(`/warehouse-zones/${id}`, { method: 'DELETE' }),
  },

  imports: {
    template: () => raw('/imports/template'),
    upload: (file, dryRun, targetOrderId, targetRackId) => {
      const form = new FormData();
      form.append('file', file);
      const qs = new URLSearchParams({ dryRun: String(dryRun) });
      if (targetOrderId) qs.set('targetOrderId', targetOrderId);
      if (targetRackId) qs.set('targetRackId', targetRackId);
      return request(`/imports/xlsx?${qs}`, { method: 'POST', body: form });
    },
  },
};
