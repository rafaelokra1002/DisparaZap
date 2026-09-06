const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
  async disparar(adId: string, groupIds?: string[], sendToAll?: boolean) {
    const res = await fetch(`${API_URL}/api/disparar`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ adId, groupIds, sendToAll }),
    });
    return res.json();
  },

  // Agendamento
  async agendarDisparo(adId: string, intervalMinutes: number) {
    const res = await fetch(`${API_URL}/api/disparar/agendar`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ adId, intervalMinutes }),
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
