import apiClient from './client';

export interface AdminWithRoles {
  user_id: number;
  telegram_id: number | null;
  username: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  role_names: string[];
}

export interface AuditLogEntry {
  id: number;
  user_id: number;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  status: string;
  request_method: string | null;
  request_path: string | null;
  created_at: string;
  user_first_name: string | null;
  user_email: string | null;
}

export interface AuditLogFilters {
  user_id?: number;
  action?: string;
  resource_type?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  offset?: number;
  limit?: number;
}

export interface AuditLogResponse {
  items: AuditLogEntry[];
  total: number;
  offset: number;
  limit: number;
}

const BASE = '/cabinet/admin/rbac';

export const rbacApi = {
  // --- RBAC Users (фильтр журнала) ---

  getRbacUsers: async (): Promise<AdminWithRoles[]> => {
    const response = await apiClient.get<AdminWithRoles[]>(`${BASE}/users`);
    return response.data;
  },

  // --- Audit Log ---

  getAuditLog: async (filters?: AuditLogFilters): Promise<AuditLogResponse> => {
    const response = await apiClient.get<AuditLogResponse>(`${BASE}/audit-log`, {
      params: filters,
    });
    return response.data;
  },

  exportAuditLog: async (filters?: AuditLogFilters): Promise<Blob> => {
    const response = await apiClient.get(`${BASE}/audit-log/export`, {
      params: filters,
      responseType: 'blob',
    });
    return response.data as Blob;
  },
};
