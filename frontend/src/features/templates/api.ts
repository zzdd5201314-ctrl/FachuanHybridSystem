import { createApiClient } from '@/lib/api'

const api = createApiClient({
  prefixUrl: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002/api/v1'}/documents`,
})

export const templateApi = {
  list: () => api.get('templates').json(),
  get: (id: number) => api.get(`templates/${id}`).json(),
  create: (data: unknown) => api.post('templates', { json: data }).json(),
  update: (id: number, data: unknown) => api.put(`templates/${id}`, { json: data }).json(),
  delete: (id: number) => api.delete(`templates/${id}`),
}
