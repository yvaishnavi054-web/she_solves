export const API_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem("token");
  return token ? { "Authorization": `Bearer ${token}` } : {};
};

export const api = {
  register: async (data: any) => {
    const res = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  login: async (data: any) => {
    const res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  getMe: async () => {
    const res = await fetch(`${API_URL}/auth/me`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Unauthorized");
    return res.json();
  },
  getTransactions: async () => {
    const res = await fetch(`${API_URL}/transactions`, {
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Unauthorized");
    return res.json();
  },
  addTransaction: async (data: any) => {
    const res = await fetch(`${API_URL}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to add transaction");
    return res.json();
  },
  deleteTransaction: async (id: number) => {
    const res = await fetch(`${API_URL}/transactions/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    if (!res.ok) throw new Error("Failed to delete transaction");
    return res.json();
  },
  parseSpeech: async (data: {text: string, business_type: string, language: string}) => {
    const res = await fetch(`${API_URL}/api/speech/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to parse speech");
    return res.json();
  },
  askChat: async (data: { query: string; language?: string; context?: any; history?: any[] }) => {
    const res = await fetch(`${API_URL}/api/chat/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to get chat response");
    return res.json();
  },
  sendWhatsAppNotification: async (data: {
    phone: string;
    type: 'new_udhar' | 'payment_receipt';
    customer_name: string;
    amount: number;
    previous_balance: number;
    new_balance: number;
    payment_method?: 'cash' | 'upi';
    payment_status?: string;
    receipt_id?: string;
    shop_name?: string;
    language?: string;
  }) => {
    const res = await fetch(`${API_URL}/api/whatsapp/send-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error("Failed to send WhatsApp notification");
    return res.json();
  }
};


