import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Project, CreateProjectInput, UpdateProjectInput, ProjectStats } from '@/types'

export function useProjects() {
  const queryClient = useQueryClient()

  const { data: projects, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.get<Project[]>('/projects'),
  })

  const createMutation = useMutation({
    mutationFn: (input: CreateProjectInput) =>
      api.post<Project>('/projects', input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: UpdateProjectInput & { id: string }) =>
      api.patch<Project>(`/projects/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api.delete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  return {
    projects: projects ?? [],
    isLoading,
    createProject: createMutation.mutateAsync,
    isCreating: createMutation.isPending,
    createError: createMutation.error,
    updateProject: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,
    deleteProject: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
    deleteError: deleteMutation.error,
  }
}

export function useProject(id: string) {
  const queryClient = useQueryClient()

  const { data: project, isLoading } = useQuery({
    queryKey: ['projects', id],
    queryFn: () => api.get<Project>(`/projects/${id}`),
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: (data: UpdateProjectInput) =>
      api.patch<Project>(`/projects/${id}`, data),
    onSuccess: (updated) => {
      queryClient.setQueryData(['projects', id], updated)
      queryClient.invalidateQueries({ queryKey: ['projects'], exact: true })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete(`/projects/${id}`),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['projects', id] })
      queryClient.invalidateQueries({ queryKey: ['projects'], exact: true })
    },
  })

  return {
    project: project ?? null,
    isLoading,
    updateProject: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    deleteProject: deleteMutation.mutateAsync,
    isDeleting: deleteMutation.isPending,
  }
}

export function useProjectStats(projectId: string) {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['projects', projectId, 'stats'],
    queryFn: () => api.get<ProjectStats>(`/projects/${projectId}/stats`),
    enabled: !!projectId,
  })

  return {
    stats: stats ?? null,
    isLoading,
  }
}
