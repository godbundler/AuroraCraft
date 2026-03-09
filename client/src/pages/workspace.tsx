import { useState } from 'react'
import { Link } from 'react-router'
import {
  ArrowLeft,
  ChevronRight,
  ChevronDown,
  File,
  Folder,
  Play,
  Globe,
  Lock,
  Settings,
  Send,
  MessageSquare,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface FileNode {
  name: string
  type: 'file' | 'folder'
  children?: FileNode[]
}

const mockFileTree: FileNode[] = [
  {
    name: 'src',
    type: 'folder',
    children: [
      {
        name: 'main',
        type: 'folder',
        children: [
          {
            name: 'java',
            type: 'folder',
            children: [
              {
                name: 'com.example.plugin',
                type: 'folder',
                children: [
                  { name: 'Main.java', type: 'file' },
                  { name: 'CommandHandler.java', type: 'file' },
                  { name: 'EventListener.java', type: 'file' },
                ],
              },
            ],
          },
          {
            name: 'resources',
            type: 'folder',
            children: [
              { name: 'plugin.yml', type: 'file' },
              { name: 'config.yml', type: 'file' },
            ],
          },
        ],
      },
    ],
  },
  { name: 'pom.xml', type: 'file' },
  { name: 'README.md', type: 'file' },
]

function FileTreeNode({ node, depth = 0 }: { node: FileNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 3)

  return (
    <div>
      <button
        onClick={() => node.type === 'folder' && setOpen(!open)}
        className={cn(
          'flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-xs transition-colors hover:bg-surface-hover',
          node.type === 'file' ? 'text-text-muted' : 'text-text'
        )}
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        {node.type === 'folder' ? (
          open ? <ChevronDown className="h-3 w-3 shrink-0 text-text-dim" /> : <ChevronRight className="h-3 w-3 shrink-0 text-text-dim" />
        ) : (
          <span className="w-3" />
        )}
        {node.type === 'folder' ? (
          <Folder className="h-3.5 w-3.5 shrink-0 text-primary/70" />
        ) : (
          <File className="h-3.5 w-3.5 shrink-0 text-text-dim" />
        )}
        <span className="truncate">{node.name}</span>
      </button>
      {node.type === 'folder' && open && node.children?.map((child) => (
        <FileTreeNode key={child.name} node={child} depth={depth + 1} />
      ))}
    </div>
  )
}

export default function WorkspacePage() {
  const [chatMessage, setChatMessage] = useState('')
  const [isPublic, setIsPublic] = useState(true)

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex h-12 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="text-text-dim hover:text-text-muted">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <span className="text-sm font-medium text-text">EconomyPlus</span>
          <span className="rounded bg-accent px-2 py-0.5 text-xs text-text-dim">Paper</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-1.5 rounded-md bg-success/10 px-3 py-1.5 text-xs font-medium text-success opacity-50"
            disabled
          >
            <Play className="h-3 w-3" />
            Compile
          </button>
          <button
            onClick={() => setIsPublic(!isPublic)}
            className="rounded-md border border-border p-1.5 text-text-dim hover:text-text-muted"
          >
            {isPublic ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
          </button>
          <button className="rounded-md border border-border p-1.5 text-text-dim hover:text-text-muted">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* File tree */}
        <aside className="w-56 shrink-0 overflow-y-auto border-r border-border bg-surface py-2">
          <p className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-text-dim">
            Files
          </p>
          {mockFileTree.map((node) => (
            <FileTreeNode key={node.name} node={node} />
          ))}
        </aside>

        {/* Editor */}
        <main className="flex-1 overflow-hidden">
          <div className="flex h-full flex-col">
            <div className="flex h-9 items-center border-b border-border bg-surface px-4">
              <div className="flex items-center gap-2 rounded bg-surface-hover px-2 py-1 text-xs text-text-muted">
                <File className="h-3 w-3" />
                Main.java
              </div>
            </div>
            <div className="flex flex-1 items-center justify-center bg-background text-sm text-text-dim">
              Monaco Editor will be loaded here
            </div>
          </div>
        </main>

        {/* Chat panel */}
        <aside className="flex w-80 shrink-0 flex-col border-l border-border bg-surface">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-text">AI Assistant</span>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 rounded-xl bg-primary/10 p-3">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm font-medium text-text">Start a conversation</p>
              <p className="mt-1 text-xs text-text-dim">
                Describe what you want to build and the AI agent will help you create it.
              </p>
            </div>
          </div>
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Describe your plugin idea..."
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text placeholder:text-text-dim focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <button className="rounded-lg bg-primary p-2 text-primary-foreground transition-colors hover:bg-primary-hover">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
