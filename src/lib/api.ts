// API client for Vercel Postgres backend
const API_BASE = '/api';

async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Request failed' }));
    throw new Error(error.error || 'Request failed');
  }

  return response.json();
}

// Members API
export const membersApi = {
  getAll: () => fetchApi<import('./types').Person[]>('/members'),

  create: (member: Omit<import('./types').Person, 'id'>) =>
    fetchApi<import('./types').Person>('/members', {
      method: 'POST',
      body: JSON.stringify(member),
    }),

  update: (id: string, updates: Partial<import('./types').Person>) =>
    fetchApi<{ success: boolean }>('/members', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/members?id=${id}`, {
      method: 'DELETE',
    }),
};

// Bills API
export const billsApi = {
  getAll: () => fetchApi<import('./types').Bill[]>('/bills'),

  create: (bill: Omit<import('./types').Bill, 'id' | 'createdAt' | 'updatedAt'>) =>
    fetchApi<import('./types').Bill>('/bills', {
      method: 'POST',
      body: JSON.stringify(bill),
    }),

  update: (id: string, updates: Partial<import('./types').Bill>) =>
    fetchApi<import('./types').Bill>('/bills', {
      method: 'PUT',
      body: JSON.stringify({ id, ...updates }),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/bills?id=${id}`, {
      method: 'DELETE',
    }),

  bulkDelete: (cutoffDate: string) =>
    fetchApi<{ deleted: number }>('/bills/bulk-delete', {
      method: 'POST',
      body: JSON.stringify({ cutoffDate }),
    }),
};

// Settlements API
export const settlementsApi = {
  getAll: () => fetchApi<import('./types').SettlementRecord[]>('/settlements'),

  create: (record: Omit<import('./types').SettlementRecord, 'id' | 'createdAt'>) =>
    fetchApi<import('./types').SettlementRecord>('/settlements', {
      method: 'POST',
      body: JSON.stringify(record),
    }),

  delete: (id: string) =>
    fetchApi<{ success: boolean }>(`/settlements?id=${id}`, {
      method: 'DELETE',
    }),

  clearAll: () =>
    fetchApi<{ success: boolean }>('/settlements?clearAll=true', {
      method: 'DELETE',
    }),
};

// Migration API
export const migrationApi = {
  migrate: (data: {
    members?: import('./types').Person[];
    bills?: import('./types').Bill[];
    settlements?: import('./types').SettlementRecord[];
  }) =>
    fetchApi<{ success: boolean; imported: { members: number; bills: number; settlements: number } }>(
      '/migrate',
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    ),
};
