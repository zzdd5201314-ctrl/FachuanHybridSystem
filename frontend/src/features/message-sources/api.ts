import { createApiClient } from '@/lib/api'

const api = createApiClient({
  prefixUrl: `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8002/api/v1'}/message-hub`,
})

export const messageSourceApi = {
  list: () => api.get('sources').json(),
  get: (id: number) => api.get(`sources/${id}`).json(),
  create: (data: unknown) => api.post('sources', { json: data }).json(),
  update: (id: number, data: unknown) => api.put(`sources/${id}`, { json: data }).json(),
  delete: (id: number) => api.delete(`sources/${id}`),
  sync: (id: number) => api.post(`sources/${id}/sync`).json(),
}
