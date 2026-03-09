import axios from 'axios'
import type { ApiError } from '@/types'

const API_BASE = '/api'

export const apiClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

export const api = {
  get: async <T>(path: string): Promise<T> => {
    try {
      const response = await apiClient.get<T>(path)
      return response.data
    } catch (error: any) {
      if (error.response?.status === 204) return undefined as T
      const apiError: ApiError = {
        message: error.response?.data?.message || 'An unexpected error occurred',
        statusCode: error.response?.status || 500,
      }
      throw apiError
    }
  },

  post: async <T>(path: string, body?: unknown): Promise<T> => {
    try {
      const response = await apiClient.post<T>(path, body)
      return response.data
    } catch (error: any) {
      if (error.response?.status === 204) return undefined as T
      const apiError: ApiError = {
        message: error.response?.data?.message || 'An unexpected error occurred',
        statusCode: error.response?.status || 500,
      }
      throw apiError
    }
  },

  put: async <T>(path: string, body?: unknown): Promise<T> => {
    try {
      const response = await apiClient.put<T>(path, body)
      return response.data
    } catch (error: any) {
      if (error.response?.status === 204) return undefined as T
      const apiError: ApiError = {
        message: error.response?.data?.message || 'An unexpected error occurred',
        statusCode: error.response?.status || 500,
      }
      throw apiError
    }
  },

  delete: async <T>(path: string): Promise<T> => {
    try {
      const response = await apiClient.delete<T>(path)
      return response.data
    } catch (error: any) {
      if (error.response?.status === 204) return undefined as T
      const apiError: ApiError = {
        message: error.response?.data?.message || 'An unexpected error occurred',
        statusCode: error.response?.status || 500,
      }
      throw apiError
    }
  },
}
