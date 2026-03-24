import type { MessagePart } from './types.js'

// ── ANSI escape code stripping ───────────────────────────────────────

const ANSI_RE = /\x1b\[[0-9;?]*[a-zA-Z]|\x1b\][^\x07]*\x07|\x1b\([A-Z]|\r/g

export function stripAnsi(input: string): string {
  return input.replace(ANSI_RE, '')
}

// ── Patterns for detecting structured blocks in Kiro CLI output ──────

const THINKING_BLOCK_RE = /<thinking>([\s\S]*?)<\/thinking>/gi
const REASONING_BLOCK_RE = /<reasoning>([\s\S]*?)<\/reasoning>/gi

// ── Kiro CLI output helpers ───────────────────────────────────────────

function isKiroMetadataLine(line: string): boolean {
  if (!line) return false
  if (line.includes('tools are now trusted')) return true
  if (/^I.ll (?:create|modify|update|edit|replace) the following/.test(line)) return true
  if (/^[+-]\s*\d+\s*:/.test(line)) return true
  if (/^\s+\d+,\s*\d+:/.test(line)) return true
  if (line.startsWith('✓')) return true
  if (/^(?:Reading (?:directory|file)|Creating|Replacing|Deleting|Renaming):/.test(line)) return true
  if (/^\s*-\s*Completed in/.test(line)) return true
  if (/[▸►].*Credits:/.test(line)) return true
  if (line.includes('(using tool:')) return true
  if (line.includes('Agents can sometimes do unexpected')) return true
  if (line.includes('Learn more at https://kiro')) return true
  if (/^\(?Purpose:/.test(line)) return true
  return false
}

function collapseScriptTokens(text: string): string {
  const lines = text.split('\n')
  const parts: string[] = []
  let token = ''

  for (const line of lines) {
    if (line === '') {
      if (token) {
        parts.push(token)
        token = ''
      }
    } else {
      token += line
    }
  }
  if (token) parts.push(token)

  return parts.join(' ')
}

function extractResponseText(rawOutput: string): string {
  const lines = rawOutput.split('\n')
  const responseChunks: string[][] = []
  let currentChunk: string[] | null = null

  for (const line of lines) {
    const trimmed = line.trim()

    if (trimmed.startsWith('> ') || trimmed === '>') {
      if (!currentChunk) currentChunk = []
      currentChunk.push(trimmed.length > 2 ? trimmed.slice(2) : '')
      continue
    }

    if (isKiroMetadataLine(trimmed)) {
      if (currentChunk && currentChunk.length > 0) {
        responseChunks.push(currentChunk)
        currentChunk = null
      }
      continue
    }

    if (currentChunk !== null) {
      currentChunk.push(trimmed)
    }
  }

  if (currentChunk && currentChunk.length > 0) {
    responseChunks.push(currentChunk)
  }

  return responseChunks
    .map((chunk) => collapseScriptTokens(chunk.join('\n')))
    .filter(Boolean)
    .join('\n\n')
}

// ── Main parser ──────────────────────────────────────────────────────

/**
 * Parse raw Kiro CLI stdout output into structured MessagePart[] arrays.
 *
 * Extracts thinking/reasoning blocks and clean response text,
 * stripping kiro-cli metadata (preamble, diff output, tool lines,
 * credits) and collapsing script PTY token artifacts.
 *
 * File operations are NOT extracted here — the KiroFileWatcher
 * provides accurate file change detection with relative paths.
 */
export function parseKiroOutput(rawOutput: string): MessagePart[] {
  if (!rawOutput || typeof rawOutput !== 'string') {
    return []
  }

  try {
    rawOutput = stripAnsi(rawOutput)
    const parts: MessagePart[] = []

    // Extract thinking / reasoning blocks
    const thinkingRe = new RegExp(THINKING_BLOCK_RE.source, THINKING_BLOCK_RE.flags)
    let match: RegExpExecArray | null
    while ((match = thinkingRe.exec(rawOutput)) !== null) {
      parts.push({ type: 'thinking', content: match[1].trim() })
    }
    const reasoningRe = new RegExp(REASONING_BLOCK_RE.source, REASONING_BLOCK_RE.flags)
    while ((match = reasoningRe.exec(rawOutput)) !== null) {
      parts.push({ type: 'thinking', content: match[1].trim() })
    }

    // Extract clean response text
    const responseText = extractResponseText(rawOutput)
    if (responseText) {
      parts.push({ type: 'text', content: responseText })
    }

    return parts
  } catch {
    return [{ type: 'text', content: rawOutput.trim() }]
  }
}

// ── Text extraction ──────────────────────────────────────────────────

/**
 * Extract clean human-readable text from Kiro CLI output.
 *
 * Strips preamble, tool blocks, diff output, metadata lines, and
 * credits. Extracts only `> ` response blocks and collapses script
 * PTY token artifacts back into flowing text.
 */
export function extractTextContent(rawOutput: string): string {
  if (!rawOutput || typeof rawOutput !== 'string') {
    return ''
  }

  try {
    return extractResponseText(stripAnsi(rawOutput))
  } catch {
    return rawOutput.trim()
  }
}
