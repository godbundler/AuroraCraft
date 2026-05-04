export interface User {
  id: string
  username: string
  email: string
  role: 'user' | 'admin'
  createdAt: string
  updatedAt: string
}

export interface Project {
  id: string
  userId: string
  name: string
  linkId: string | null
  description: string | null
  logo: string | null
  versions: string | null
  layoutMode: string
  status: 'active' | 'archived'
  software: string
  language: 'java' | 'kotlin'
  javaVersion: string
  compiler: 'maven' | 'gradle' | 'both'
  visibility: 'public' | 'private'
  createdAt: string
  updatedAt: string
}

export interface CreateProjectInput {
  name: string
  description?: string
  logo?: string
  versions?: string
  software?: string
  language?: 'java' | 'kotlin'
  javaVersion?: string
  compiler?: 'maven' | 'gradle' | 'both'
}

export interface UpdateProjectInput {
  name?: string
  description?: string | null
  logo?: string | null
  versions?: string | null
  layoutMode?: string
  status?: 'active' | 'archived'
  software?: string
  language?: 'java' | 'kotlin'
  javaVersion?: string
  compiler?: 'maven' | 'gradle' | 'both'
  visibility?: 'public' | 'private'
}

export interface ProjectStats {
  userMessages: number
  aiMessages: number
  files: number
  tokensUsed: number
  createdAt: string
}

export interface CommunityProject {
  id: string
  name: string
  description: string | null
  logo: string | null
  versions: string | null
  layoutMode: string
  software: string
  language: 'java' | 'kotlin'
  javaVersion: string
  compiler: 'maven' | 'gradle' | 'both'
  visibility: 'public' | 'private'
  createdAt: string
  updatedAt: string
  ownerUsername: string
}

export type AgentStatus = 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'

export interface AgentSession {
  id: string
  projectId: string
  status: AgentStatus
  opencodeSessionId?: string | null
  bridge?: 'opencode' | 'kiro'
  kiroSessionId?: string | null
  createdAt: string
  updatedAt: string
}

export interface AgentSessionWithMessages extends AgentSession {
  messages: AgentMessage[]
}

export interface AgentMessage {
  id: string
  sessionId: string
  role: 'user' | 'agent' | 'system'
  content: string
  metadata?: MessageMetadata | null
  createdAt: string
}

export interface MessageMetadata {
  parts?: MessagePart[]
}

export type MessagePart =
  | { type: 'thinking'; content: string }
  | { type: 'text'; content: string }
  | { type: 'file'; action: 'create' | 'update' | 'delete' | 'rename' | 'read'; path: string; newPath?: string }
  | { type: 'tool'; tool: string; path: string }
  | { type: 'todo-list'; items: TodoItem[] }

export interface TodoItem {
  text: string
  status: 'pending' | 'in-progress' | 'completed'
}

export interface AgentLog {
  id: string
  sessionId: string
  logType: string
  message: string
  createdAt: string
}

export interface KiroAuthStatus {
  userId: string
  username: string
  systemUser: string
  systemUserExists: boolean
  authenticated: boolean
  configDir: string
  instructions?: string
}

export interface AdminStats {
  totalUsers: number
  totalProjects: number
  totalAgentSessions: number
}

export interface AdminProject {
  id: string
  name: string
  status: 'active' | 'archived'
  software: string
  language: 'java' | 'kotlin'
  compiler: 'maven' | 'gradle' | 'both'
  createdAt: string
  updatedAt: string
  ownerUsername: string | null
}

export interface AIModel {
  id: string
  name: string
  provider: string
  description: string
}

export const AI_MODELS: AIModel[] = [
  // OpenCode models (via OpenCode free tier)
  { id: 'opencode/minimax-m2.5-free', name: 'MiniMax M2.5', provider: 'OpenCode', description: 'Free AI model for coding tasks' },
  
  // Kiro CLI models (via Kiro.dev)
  { id: 'kiro/auto', name: 'Kiro Auto', provider: 'Kiro', description: 'Optimal model routing for best quality-to-cost ratio' },
  { id: 'kiro/claude-opus-4.7', name: 'Claude Opus 4.7', provider: 'Kiro', description: 'Latest Opus with stronger agentic coding and 3x higher resolution vision (experimental)' },
  { id: 'kiro/claude-opus-4.6', name: 'Claude Opus 4.6', provider: 'Kiro', description: 'Most capable model for complex multi-system problems' },
  { id: 'kiro/claude-opus-4.5', name: 'Claude Opus 4.5', provider: 'Kiro', description: 'Maximum reasoning depth for large codebases' },
  { id: 'kiro/claude-sonnet-4.6', name: 'Claude Sonnet 4.6', provider: 'Kiro', description: 'Near-Opus intelligence with better token efficiency' },
  { id: 'kiro/claude-sonnet-4.5', name: 'Claude Sonnet 4.5', provider: 'Kiro', description: 'Strong agentic coding with extended autonomous operation' },
  { id: 'kiro/claude-sonnet-4.0', name: 'Claude Sonnet 4.0', provider: 'Kiro', description: 'Consistent baseline with predictable behavior' },
  { id: 'kiro/claude-haiku-4.5', name: 'Claude Haiku 4.5', provider: 'Kiro', description: 'Near-frontier intelligence at fraction of cost' },
  { id: 'kiro/minimax-m2.5', name: 'MiniMax M2.5', provider: 'Kiro', description: 'Frontier coding at low cost (experimental)' },
  { id: 'kiro/glm-5', name: 'GLM-5', provider: 'Kiro', description: '200K context for repo-scale agentic work (experimental)' },
  { id: 'kiro/deepseek-3.2', name: 'DeepSeek 3.2', provider: 'Kiro', description: 'Agentic workflows at minimal cost (experimental)' },
  { id: 'kiro/minimax-m2.1', name: 'MiniMax M2.1', provider: 'Kiro', description: 'Multilingual programming and UI generation (experimental)' },
  { id: 'kiro/qwen3-coder-next', name: 'Qwen3 Coder Next', provider: 'Kiro', description: '256K context, most cost-effective option (experimental)' },
]

export const DEFAULT_MODEL_ID = AI_MODELS[0].id

// ── Streaming event types (mirroring server StreamEvent) ─────────────

export type StreamEvent =
  | { type: 'text-delta'; content: string }
  | { type: 'thinking'; id: string; content: string; done: boolean }
  | { type: 'file-op'; id: string; action: string; path: string; newPath?: string; status: 'running' | 'completed' | 'error'; tool: string }
  | { type: 'question'; id: string; question: string; status: 'running' | 'completed' | 'error' }
  | { type: 'todo'; items: StreamTodoItem[] }
  | { type: 'status'; status: string; message?: string }
  | { type: 'file-change'; file: string }
  | { type: 'error'; message: string }
  | { type: 'complete' }

export interface StreamTodoItem {
  id: string
  content: string
  status: string
  priority: string
}

export interface FileTreeEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileTreeEntry[]
}

// ── Streaming state for real-time rendering ──────────────────────────

export interface ThinkingBlock {
  id: string
  content: string
  done: boolean
  order: number
}

export interface FileOpBlock {
  id: string
  action: string
  path: string
  newPath?: string
  status: 'running' | 'completed' | 'error'
  tool: string
  order: number
}

export interface StreamingItem {
  id: string
  kind: 'thinking' | 'file-op' | 'text' | 'question'
  order: number
  // For thinking
  thinkingContent?: string
  thinkingDone?: boolean
  // For file-op
  fileAction?: string
  filePath?: string
  fileNewPath?: string
  fileStatus?: 'running' | 'completed' | 'error'
  fileTool?: string
  // For text
  textContent?: string
  // For question
  questionText?: string
  questionStatus?: 'running' | 'completed' | 'error'
}

export interface StreamingState {
  items: StreamingItem[]
  todos: StreamTodoItem[]
  isStreaming: boolean
  fileChanges: string[]
}

export interface ApiError {
  message: string
  statusCode: number
}
