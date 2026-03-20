import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Project, CommunityProject, AgentMessage, FileTreeEntry } from '@/types'

interface CommunityProjectsParams {
  search?: string
  software?: string
  language?: string
  sort?: 'newest' | 'oldest'
}

export function useCommunityProjects(params: CommunityProjectsParams) {
  const qs = new URLSearchParams()
  if (params.search) qs.set('search', params.search)
  if (params.software) qs.set('software', params.software)
  if (params.language) qs.set('language', params.language)
  if (params.sort) qs.set('sort', params.sort)

  const { data, isLoading } = useQuery({
    queryKey: ['community', 'projects', params],
    queryFn: () => {
      const str = qs.toString()
      return api.get<CommunityProject[]>(`/community/projects${str ? `?${str}` : ''}`)
    },
  })

  return {
    projects: data ?? [],
    isLoading,
  }
}

export function useCommunityProject(id: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['community', 'projects', id],
    queryFn: () => api.get<CommunityProject>(`/community/projects/${id}`),
    enabled: !!id,
  })

  return {
    project: data ?? null,
    isLoading,
  }
}

export function useCommunityProjectFiles(projectId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['community', 'projects', projectId, 'files'],
    queryFn: () => api.get<{ files: FileTreeEntry[] }>(`/community/projects/${projectId}/files`),
    enabled: !!projectId,
  })

  return {
    files: data?.files ?? [],
    isLoading,
  }
}

export function useCommunityFileContent(projectId: string, filePath: string | null) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['community', 'projects', projectId, 'files', 'content', filePath],
    queryFn: () => api.get<{ content: string; path: string }>(`/community/projects/${projectId}/files/content?path=${encodeURIComponent(filePath!)}`),
    enabled: !!projectId && !!filePath,
  })

  return {
    content: data?.content ?? null,
    isLoading,
    error,
  }
}

export function useCommunityMessages(projectId: string) {
  const { data, isLoading } = useQuery({
    queryKey: ['community', 'projects', projectId, 'messages'],
    queryFn: () => api.get<{ messages: AgentMessage[] }>(`/community/projects/${projectId}/messages`),
    enabled: !!projectId,
  })

  return {
    messages: data?.messages ?? [],
    isLoading,
  }
}

export function useForkProject() {
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: (projectId: string) =>
      api.post<Project>(`/community/projects/${projectId}/fork`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] })
    },
  })

  return {
    forkProject: mutation.mutateAsync,
    isForking: mutation.isPending,
  }
}
