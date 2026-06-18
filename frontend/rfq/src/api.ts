import axios from 'axios';

const api = axios.create({ baseURL: '/' });

api.interceptors.request.use((cfg) => {
  const token = localStorage.getItem('access_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401) {
      const refresh = localStorage.getItem('refresh_token');
      if (refresh) {
        try {
          const { data } = await axios.post('/auth/refresh', { refresh_token: refresh });
          localStorage.setItem('access_token', data.access_token);
          err.config.headers.Authorization = `Bearer ${data.access_token}`;
          return axios(err.config);
        } catch {
          localStorage.clear();
          window.location.href = '/login';
        }
      }
    }
    return Promise.reject(err);
  }
);

export default api;

export const authApi = {
  login: (email: string, password: string) => {
    const body = new URLSearchParams({ username: email, password });
    return api.post('/auth/login', body);
  },
  me: () => api.get('/auth/me'),
};

export const rfqApi = {
  submitText: (text: string) => api.post('/rfqs/text', { text }),
  submitFile: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return api.post('/rfqs/file', fd);
  },
  list: () => api.get('/rfqs'),
  get: (id: string) => api.get(`/rfqs/${id}`),

  // Three-step flow
  extract: (file: File, productName?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (productName) fd.append('product_name', productName);
    return api.post('/rfqs/extract', fd);
  },
  extractText: (text: string, productName?: string) =>
    api.post('/rfqs/extract-text', { text, product_name: productName ?? null }),
  confirm: (
    runId: string,
    meta: {
      meta_company_name?: string | null;
      meta_product?: string | null;
      meta_rfq_date?: string | null;
      meta_rfq_number?: string | null;
      data_points?: { key: string; value: string | null }[];
    }
  ) => api.post(`/rfqs/${runId}/confirm`, meta),
  submitData: (runId: string, dataPoints: { key: string; value: string | null }[]) =>
    api.post(`/rfqs/${runId}/submit-data`, { data_points: dataPoints }),
  saveContent: (runId: string, content: string) =>
    api.patch(`/rfqs/${runId}/content`, { content }),
  exportDocx: (runId: string) =>
    api.get(`/rfqs/${runId}/export`, { responseType: 'blob' }),
  markSent: (runId: string) =>
    api.post(`/rfqs/${runId}/mark-sent`),
  markCustomerApproved: (runId: string, body: { customer_approved_at: string; customer_po_reference?: string }) =>
    api.post(`/rfqs/${runId}/mark-customer-approved`, body),
};

export const promptApi = {
  list: () => api.get('/prompts'),
  versions: (key: string, productName?: string) =>
    api.get(`/prompts/${key}/versions`, { params: productName ? { product_name: productName } : {} }),
  addVersion: (key: string, content: string, note: string, productName?: string) =>
    api.post(`/prompts/${key}/versions`, { content, note },
      { params: productName ? { product_name: productName } : {} }),
  activate: (key: string, version_id: string, productName?: string) =>
    api.post(`/prompts/${key}/activate`, { version_id },
      { params: productName ? { product_name: productName } : {} }),
};

export const metricsApi = {
  get: () => api.get('/metrics'),
};

export const usersApi = {
  list: () => api.get('/users'),
  create: (email: string, full_name: string, role: string, password: string) =>
    api.post('/users', { email, full_name, role, password }),
  update: (id: string, patch: Record<string, unknown>) =>
    api.patch(`/users/${id}`, patch),
};

export const productsApi = {
  list: () => api.get('/products'),
  get: (productName: string) => api.get(`/products/${productName}`),
  upsert: (productName: string, fields: unknown[]) =>
    api.put(`/products/${productName}`, { fields }),
  delete: (productName: string) => api.delete(`/products/${productName}`),
};

export const approvalApi = {
  queue: () => api.get('/approvals/queue'),
  reviewed: () => api.get('/approvals/reviewed'),
  decide: (assignmentId: string, decision: 'approved' | 'rejected', comment?: string) =>
    api.post(`/approvals/${assignmentId}/decide`, { decision, comment }),
  requestTree: (runId: string) => api.get(`/rfqs/${runId}/approval`),
  submit: (runId: string, stages: { name: string; required_count: number; approver_ids: string[] }[], templateId?: string | null) =>
    api.post(`/rfqs/${runId}/submit-approval`, { stages, template_id: templateId ?? null }),
  approvers: () => api.get('/users/approvers'),
};

type TemplateStageBody = { name: string; required_count: number; department_hint?: string; approver_ids?: string[] };
type TemplateBody = { name: string; description?: string; stages: TemplateStageBody[]; is_active: boolean };

export const approvalTemplateApi = {
  list: () => api.get('/approval-templates'),
  listAll: () => api.get('/approval-templates/all'),
  create: (body: TemplateBody) => api.post('/approval-templates', body),
  update: (id: string, body: TemplateBody) => api.put(`/approval-templates/${id}`, body),
  delete: (id: string) => api.delete(`/approval-templates/${id}`),
};

export const docxTemplateApi = {
  get: () => api.get<{ active: boolean; name?: string; uploaded_at?: string; uploaded_by?: string }>('/docx-template'),
  upload: (file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<{ name: string; uploaded_at: string; active: boolean }>('/docx-template', form);
  },
  remove: () => api.delete('/docx-template'),
};

export interface AppConfigItem {
  id: string;
  key: string;
  label: string;
  value: string;
  field_type: 'text' | 'textarea' | 'list';
  required: boolean;
  enabled: boolean;
  sort_order: number;
}

export interface AppConfigItemUpdate {
  id: string | null;
  key: string;
  label: string;
  value: string;
  field_type: 'text' | 'textarea' | 'list';
  required: boolean;
  enabled: boolean;
  sort_order: number;
}

export const configApi = {
  list: () => api.get<AppConfigItem[]>('/app-config'),
  save: (items: AppConfigItemUpdate[]) => api.put<AppConfigItem[]>('/app-config', { items }),
  remove: (id: string) => api.delete(`/app-config/${id}`),
};
