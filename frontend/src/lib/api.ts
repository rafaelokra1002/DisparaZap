const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('disparazap_token');
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { ...extra };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

export const api = {
  // Auth
  async register(name: string, email: string, password: string, phone: string) {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, phone }),
    });
    return res.json();
  },

  async login(email: string, password: string) {
    const res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return res.json();
  },

  async getMe() {
    const res = await fetch(`${API_URL}/api/auth/me`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  // Anúncios
  async createAd(data: any) {
    const res = await fetch(`${API_URL}/api/ads`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async getAds() {
    const res = await fetch(`${API_URL}/api/ads`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  async updateAd(id: string, data: any) {
    const res = await fetch(`${API_URL}/api/ads/${id}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(data),
    });
    return res.json();
  },

  async deleteAd(id: string) {
    const res = await fetch(`${API_URL}/api/ads/${id}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return res.json();
  },

  // Disparo
  async disparar(adId: string, options?: { sendToAll?: boolean; groupIds?: string[]; postStatus?: boolean }) {
    const sendToAll = options?.sendToAll ?? true;
    const groupIds = options?.groupIds ?? [];
    const postStatus = options?.postStatus ?? false;

    const res = await fetch(`${API_URL}/api/disparar`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ adId, sendToAll, groupIds, postStatus }),
    });
    return res.json();
  },

  // Agendamento
  async agendarDisparo(adId: string, intervalMinutes: number, options?: { sendToAll?: boolean; groupIds?: string[] }) {
    const sendToAll = options?.sendToAll ?? true;
    const groupIds = options?.groupIds ?? [];

    const res = await fetch(`${API_URL}/api/disparar/agendar`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ adId, intervalMinutes, sendToAll, groupIds }),
    });
    return res.json();
  },

  async pararAgendamento() {
    const res = await fetch(`${API_URL}/api/disparar/parar`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return res.json();
  },

  async getAgendamento() {
    const res = await fetch(`${API_URL}/api/disparar/agendamento`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  // Agendamento Diário
  async ativarDiario(adId: string, startHour: number, intervalMinutes: number, scheduleMode: 'single' | 'triple' = 'single') {
    const res = await fetch(`${API_URL}/api/disparar/diario/ativar`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ adId, startHour, intervalMinutes, scheduleMode }),
    });
    return res.json();
  },

  async desativarDiario() {
    const res = await fetch(`${API_URL}/api/disparar/diario/desativar`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return res.json();
  },

  async getStatusDiario() {
    const res = await fetch(`${API_URL}/api/disparar/diario/status`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  async getLimiteDiario() {
    const res = await fetch(`${API_URL}/api/disparar/limite-diario`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  // Grupos
  async getGrupos() {
    const res = await fetch(`${API_URL}/api/grupos`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  // Métricas
  async getMetricas() {
    const res = await fetch(`${API_URL}/api/metricas`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  async getHistorico(page = 1) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    const res = await fetch(`${API_URL}/api/metricas/historico?${params}`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  // Pagamentos
  async createPayment(plan: 'days_3' | 'days_7' | 'days_15' | 'days_30') {
    const res = await fetch(`${API_URL}/api/pagamentos/criar`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ plan }),
    });
    return res.json();
  },

  async checkPayment(transactionId: string) {
    const res = await fetch(`${API_URL}/api/pagamentos/verificar/${transactionId}`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  // WhatsApp
  async startWhatsApp() {
    const res = await fetch(`${API_URL}/api/whatsapp/start`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return res.json();
  },

  async getQRCode() {
    const res = await fetch(`${API_URL}/api/whatsapp/qrcode`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  async getWhatsAppStatus() {
    const res = await fetch(`${API_URL}/api/whatsapp/status`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  async getWhatsAppGroups() {
    const res = await fetch(`${API_URL}/api/whatsapp/groups`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  async disconnectWhatsApp() {
    const res = await fetch(`${API_URL}/api/whatsapp/disconnect`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return res.json();
  },

  async logoutWhatsApp() {
    const res = await fetch(`${API_URL}/api/whatsapp/logout`, {
      method: 'POST',
      headers: authHeaders(),
    });
    return res.json();
  },

  // Admin
  async getAdminStats() {
    const res = await fetch(`${API_URL}/api/admin/stats`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  async getAdminUsers(page = 1, limit = 20, search = '') {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('limit', String(limit));
    if (search) params.set('search', search);

    const res = await fetch(`${API_URL}/api/admin/users?${params.toString()}`, {
      headers: authHeaders(),
    });
    return res.json();
  },

  async setDedicatedWhatsApp(userId: string, enabled: boolean) {
    const res = await fetch(`${API_URL}/api/admin/users/${userId}/dedicated-whatsapp`, {
      method: 'PATCH',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ enabled }),
    });
    return res.json();
  },

  async deleteAdminUser(userId: string) {
    const res = await fetch(`${API_URL}/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    return res.json();
  },

  // Upload
  async uploadImage(file: File) {
    const formData = new FormData();
    formData.append('image', file);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });
    return res.json();
  },
};
