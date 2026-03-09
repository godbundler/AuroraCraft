import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import type { User } from '@/types'
import { useEffect } from 'react'

interface LoginInput {
  login: string
  password: string
}

interface RegisterInput {
  username: string
  email: string
  password: string
}

export function useAuth() {
  const { setUser, logout: clearAuth } = useAuthStore()
  const queryClient = useQueryClient()

  const { data: user, isLoading, isError } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: async () => {
      try {
        return await api.get<User>('/auth/me')
      } catch (error: any) {
        // If it's a 401 Not Authenticated, we just want to return null to avoid query errors
        if (error.statusCode === 401) {
          return null
        }
        throw error
      }
    },
    retry: false,
    staleTime: 10 * 60 * 1000,
  })

  useEffect(() => {
    if (user !== undefined) {
      setUser(user)
    }
  }, [user, setUser])

  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) =>
      api.post<User>('/auth/login', input),
    onSuccess: (data) => {
      setUser(data)
      queryClient.setQueryData(['auth', 'me'], data)
    },
  })

  const registerMutation = useMutation({
    mutationFn: (input: RegisterInput) =>
      api.post<User>('/auth/register', input),
    onSuccess: (data) => {
      setUser(data)
      queryClient.setQueryData(['auth', 'me'], data)
    },
  })

  const logoutMutation = useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: () => {
      clearAuth()
      queryClient.setQueryData(['auth', 'me'], null)
      queryClient.clear()
    },
  })

  return {
    user: user ?? null,
    isLoading,
    isAuthenticated: !!user,
    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    register: registerMutation.mutateAsync,
    registerError: registerMutation.error,
    isRegistering: registerMutation.isPending,
    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
  }
}
