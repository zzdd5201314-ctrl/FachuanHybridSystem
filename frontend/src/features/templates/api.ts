import { createFeatureApiClient } from '@/lib/api'
import type { Template } from './types'

const api = createFeatureApiClient('documents')

export interface LibraryFile {
  path: string
  name: string
}

export const templateApi = {
  list: () => api.get('templates').json<Template[]>(),
  get: (id: number) => api.get(`templates/${id}`).json<Template>(),
  create: (data: unknown) => api.post('templates', { json: data }).json<Template>(),
  update: (id: number, data: unknown) => api.put(`templates/${id}`, { json: data }).json<Template>(),
  delete: async (id: number) => { await api.delete(`templates/${id}`) },
  listLibraryFiles: () => api.get('templates/library-files').json<LibraryFile[]>(),
}
