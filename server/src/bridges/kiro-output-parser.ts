import type { MessagePart, TodoItem } from './types.js'

// ── ANSI escape code stripping ───────────────────────────────────────

const ANSI_RE = /\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b\([A-Z]|\r/g

export function stripAnsi(input: string): string {
  return input.replace(ANSI_RE, '')
}

// ── Patterns for detecting structured blocks in Kiro CLI output ──────

const THINKING_BLOCK_RE = /<thinking>([\s\S]*?)<\/thinking>/gi
const REASONING_BLOCK_RE = /<reasoning>([\s\S]*?)<\/reasoning>/gi

const FILE_CREATED_RE = /(?:Created?\s+file|New\s+file|Writing\s+to|Wrote)\s*:\s*(.+)/gi
const FILE_UPDATED_RE = /(?:Updated?\s+file|Modified|Edited|Patched)\s*:\s*(.+)/gi
const FILE_DELETED_RE = /(?:Deleted?|Removed?)\s*:\s*(.+)/gi
const FILE_RENAMED_RE = /(?:Renamed?|Moved?)\s*:\s*(.+?)\s*(?:→|->|to)\s*(.+)/gi
const FILE_READ_RE = /(?:Reading|Read\s+file)\s*:\s*(.+)/gi

const TOOL_EXEC_RE = /(?:Running\s+command|Executing|Ran|Execute)\s*:\s*(.+)/gi
const TOOL_CALL_RE = /(?:Tool\s+call|Using\s+tool|Calling)\s*:\s*(\S+)\s*(?:on|for|with)?\s*(.*)/gi

const TODO_BLOCK_RE = /(?:^|\n)\s*(?:TODO|Tasks?|Checklist)\s*:\s*\n((?:\s*[-*\[\]✓✗☐☑xX●○]\s*.+\n?)+)/gi
const TODO_ITEM_RE = /\s*[-*]\s*\[([xX✓✗ ])\]\s*(.+)|[-*●○]\s*(.+)/g

// ── Helpers ──────────────────────────────────────────────────────────

interface RawBlock {
  type: 'thinking' | 'file' | 'tool' | 'todo-list'
  start: number
  end: number
  part: MessagePart
}

function parseTodoStatus(marker: string): TodoItem['status'] {
  const m = marker.trim().toLowerCase()
  if (m === 'x' || m === '✓' || m === '✗') return 'completed'
  return 'pending'
}

function parseTodoItems(block: string): TodoItem[] {
  const items: TodoItem[] = []
  let match: RegExpExecArray | null
  const re = new RegExp(TODO_ITEM_RE.source, 'g')

  while ((match = re.exec(block)) !== null) {
    if (match[1] !== undefined && match[2]) {
      items.push({ text: match[2].trim(), status: parseTodoStatus(match[1]) })
    } else if (match[3]) {
      items.push({ text: match[3].trim(), status: 'pending' })
    }
  }

  return items
}

function trimPath(raw: string): string {
  return raw.trim().replace(/[`'"]/g, '').trim()
}

function collectPatternBlocks(
  raw: string,
  regex: RegExp,
  buildPart: (match: RegExpExecArray) => MessagePart | null,
): RawBlock[] {
  const blocks: RawBlock[] = []
  const re = new RegExp(regex.source, regex.flags)
  let match: RegExpExecArray | null

  while ((match = re.exec(raw)) !== null) {
    const part = buildPart(match)
    if (part) {
      blocks.push({
        type: part.type as RawBlock['type'],
        start: match.index,
        end: match.index + match[0].length,
        part,
      })
    }
  }

  return blocks
}

// ── Main parser ──────────────────────────────────────────────────────

/**
 * Parse raw Kiro CLI stdout output into structured MessagePart[] arrays.
 *
 * Detects thinking/reasoning blocks, file operations, tool executions,
 * and todo lists within the output. Everything that doesn't match a
 * known pattern is returned as a text part.
 *
 * Defensive: if parsing fails for any reason, the entire raw output is
 * returned as a single text part.
 */
export function parseKiroOutput(rawOutput: string): MessagePart[] {
  if (!rawOutput || typeof rawOutput !== 'string') {
    return []
  }

  try {
    rawOutput = stripAnsi(rawOutput)
    const blocks: RawBlock[] = []

    // ── Thinking / reasoning blocks ────────────────────────────────
    blocks.push(
      ...collectPatternBlocks(rawOutput, THINKING_BLOCK_RE, (m) => ({
        type: 'thinking',
        content: m[1].trim(),
      })),
    )
    blocks.push(
      ...collectPatternBlocks(rawOutput, REASONING_BLOCK_RE, (m) => ({
        type: 'thinking',
        content: m[1].trim(),
      })),
    )

    // ── File operations ────────────────────────────────────────────
    blocks.push(
      ...collectPatternBlocks(rawOutput, FILE_CREATED_RE, (m) => {
        const path = trimPath(m[1])
        return path ? { type: 'file', action: 'create', path } : null
      }),
    )
    blocks.push(
      ...collectPatternBlocks(rawOutput, FILE_UPDATED_RE, (m) => {
        const path = trimPath(m[1])
        return path ? { type: 'file', action: 'update', path } : null
      }),
    )
    blocks.push(
      ...collectPatternBlocks(rawOutput, FILE_DELETED_RE, (m) => {
        const path = trimPath(m[1])
        return path ? { type: 'file', action: 'delete', path } : null
      }),
    )
    blocks.push(
      ...collectPatternBlocks(rawOutput, FILE_RENAMED_RE, (m) => {
        const path = trimPath(m[1])
        const newPath = trimPath(m[2])
        return path ? { type: 'file', action: 'rename', path, newPath: newPath || undefined } : null
      }),
    )
    blocks.push(
      ...collectPatternBlocks(rawOutput, FILE_READ_RE, (m) => {
        const path = trimPath(m[1])
        return path ? { type: 'file', action: 'read', path } : null
      }),
    )

    // ── Tool executions ────────────────────────────────────────────
    blocks.push(
      ...collectPatternBlocks(rawOutput, TOOL_EXEC_RE, (m) => {
        const command = m[1].trim()
        return command ? { type: 'tool', tool: 'command', path: command } : null
      }),
    )
    blocks.push(
      ...collectPatternBlocks(rawOutput, TOOL_CALL_RE, (m) => {
        const tool = m[1].trim()
        const path = m[2]?.trim() || tool
        return tool ? { type: 'tool', tool, path } : null
      }),
    )

    // ── Todo lists ─────────────────────────────────────────────────
    blocks.push(
      ...collectPatternBlocks(rawOutput, TODO_BLOCK_RE, (m) => {
        const items = parseTodoItems(m[1])
        return items.length > 0 ? { type: 'todo-list', items } : null
      }),
    )

    // If no structured blocks were found, return the whole output as text
    if (blocks.length === 0) {
      const trimmed = rawOutput.trim()
      return trimmed ? [{ type: 'text', content: trimmed }] : []
    }

    // ── Sort blocks by position and interleave text parts ──────────
    blocks.sort((a, b) => a.start - b.start)

    // Deduplicate overlapping blocks (keep the one that starts first)
    const deduped: RawBlock[] = []
    let lastEnd = 0
    for (const block of blocks) {
      if (block.start >= lastEnd) {
        deduped.push(block)
        lastEnd = block.end
      }
    }

    const parts: MessagePart[] = []
    let cursor = 0

    for (const block of deduped) {
      // Emit any text between the previous block and this one
      if (block.start > cursor) {
        const text = rawOutput.slice(cursor, block.start).trim()
        if (text) {
          parts.push({ type: 'text', content: text })
        }
      }

      parts.push(block.part)
      cursor = block.end
    }

    // Emit trailing text after the last block
    if (cursor < rawOutput.length) {
      const text = rawOutput.slice(cursor).trim()
      if (text) {
        parts.push({ type: 'text', content: text })
      }
    }

    return parts
  } catch {
    // Defensive fallback: return raw output as a single text part
    return [{ type: 'text', content: rawOutput.trim() }]
  }
}

// ── Text extraction ──────────────────────────────────────────────────

/**
 * Strip metadata markers, thinking blocks, and structural patterns from
 * Kiro CLI output, returning only the clean human-readable text content.
 */
export function extractTextContent(rawOutput: string): string {
  if (!rawOutput || typeof rawOutput !== 'string') {
    return ''
  }

  try {
    let text = stripAnsi(rawOutput)

    // Remove thinking/reasoning blocks entirely
    text = text.replace(THINKING_BLOCK_RE, '')
    text = text.replace(REASONING_BLOCK_RE, '')

    // Remove file operation lines
    text = text.replace(FILE_CREATED_RE, '')
    text = text.replace(FILE_UPDATED_RE, '')
    text = text.replace(FILE_DELETED_RE, '')
    text = text.replace(FILE_RENAMED_RE, '')
    text = text.replace(FILE_READ_RE, '')

    // Remove tool execution lines
    text = text.replace(TOOL_EXEC_RE, '')
    text = text.replace(TOOL_CALL_RE, '')

    // Remove todo blocks
    text = text.replace(TODO_BLOCK_RE, '')

    // Collapse excessive blank lines
    text = text.replace(/\n{3,}/g, '\n\n')

    return text.trim()
  } catch {
    // Defensive fallback
    return rawOutput.trim()
  }
}
