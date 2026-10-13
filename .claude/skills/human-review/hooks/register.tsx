import type { EngineInterface, Register } from 'claude-code'

import { parseDiff, selectChunk, toRuns } from './chunk'
import type { Chunk, DiffRun } from './chunk'

/** Numbers a finding `<chunk>.<n>`, or just `<n>` on a card without a chunk index, so the reviewer can refer to it. */
function findingNumber(chunkIndex: number | undefined, position: number): string {
  const number = position + 1
  return chunkIndex ? `${chunkIndex}.${number}` : `${number}`
}

/** The model-facing names of the tools: `mcp__<plugin>__<name>`. */
export const CHUNK_TOOL = 'mcp__human-review__show_chunk'
export const PROPOSAL_TOOL = 'mcp__human-review__show_proposal'

const SHA = /^[0-9a-f]{7,40}$/

export type Finding = { severity: string; line?: number; title?: string; text: string }

/** What the model sends for a chunk: where it is, never the code itself. */
export type ShowChunkInput = {
  index: number
  total: number
  path: string
  base_sha: string
  head_sha: string
  new_start: number
  new_end: number
  old_start?: number
  old_end?: number
  summary?: string
  findings?: Finding[]
}

/** What the model sends for a change it proposes: the diff it wrote. */
export type ShowProposalInput = {
  path: string
  diff: string
  summary?: string
}

/** What both cards read from the call's input. */
type CardInput = { path: string; index?: number; summary?: string; findings?: Finding[] }

const CHUNK_SCHEMA = {
  type: 'object',
  properties: {
    index: { type: 'integer', description: '1-based chunk number.' },
    total: { type: 'integer', description: 'Current estimate of the chunk count.' },
    path: { type: 'string', description: 'Repo-relative path of the file.' },
    base_sha: { type: 'string', description: 'Merge-base SHA of the MR.' },
    head_sha: { type: 'string', description: 'Head SHA of the MR.' },
    new_start: { type: 'integer', description: 'First line of the chunk in the new file.' },
    new_end: { type: 'integer', description: 'Last line of the chunk in the new file.' },
    old_start: { type: 'integer', description: 'First old-file line, only for chunks that remove lines outside the new range (e.g. a deleted file).' },
    old_end: { type: 'integer', description: 'Last old-file line, paired with old_start.' },
    summary: { type: 'string', description: 'One or two sentences: what the change does, how it relates to other chunks, callers and domain terms.' },
    findings: {
      type: 'array',
      description: 'Verified quality findings for this chunk. Each is shown numbered `<chunk>.<n>` so the reviewer can refer to it.',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string' },
          line: { type: 'integer' },
          title: { type: 'string', description: 'The problem in a few words, shown as the heading.' },
          text: { type: 'string', description: 'Problem and remedy, shown indented under the heading.' },
        },
        required: ['severity', 'text'],
      },
    },
  },
  required: ['index', 'total', 'path', 'base_sha', 'head_sha', 'new_start', 'new_end'],
}

const PROPOSAL_SCHEMA = {
  type: 'object',
  properties: {
    path: { type: 'string', description: 'Repo-relative path of the file the change is for.' },
    diff: {
      type: 'string',
      description: 'Unified-diff hunks: each starts with a header holding the real line numbers (`@@ -12,3 +12,4 @@`, counts optional; `@@ -0,0 +1 @@` for a new file), then lines prefixed with a space, `+` or `-`. Skip unchanged stretches by starting a new hunk.',
    },
    summary: { type: 'string', description: 'One sentence on what the change does.' },
  },
  required: ['path', 'diff'],
}

const CHUNK_DESCRIPTION = [
  'Shows one chunk of an MR/PR diff to the human reviewer during /human-review.',
  'Pass line coordinates; the tool reads the code from git and draws it highlighted with real line numbers.',
  'The result holds the same code for you to reason about: do not repeat it in your reply.',
].join(' ')

const PROPOSAL_DESCRIPTION = [
  'Shows a code change you propose (a fix, an alternative) to the human reviewer during /human-review,',
  'drawn like an MR diff. One call per file. Use it instead of a ```diff block.',
].join(' ')

/**
 * The pastel line backgrounds Claude Code's own diff draws on a light theme
 * (256-colour 194 and 224). The theme keys can't stand in: on a 256-colour
 * terminal `diffAddedDimmed` rounds to grey, and a mod can't read whether
 * `auto` resolved to light or dark. Tuned for a light terminal.
 */
const RUN_BACKGROUND: Record<DiffRun['kind'], string | undefined> = {
  ' ': undefined,
  '+': '#d7ffd7',
  '-': '#ffd7d7',
}

/** A stored result read back: the card's title line, the code and how to draw it. */
export type ShownCode = { title: string; format: Chunk['format']; firstLine: number; source: string }

/**
 * Splits a stored result back into its title and the code under it. The first
 * line ends in `(diff)` or `(source)`; anything else (an error text) answers
 * undefined, so the card leaves the row to the engine.
 */
export function readResult(output: unknown): ShownCode | undefined {
  if (typeof output !== 'string') return undefined
  const newline = output.indexOf('\n')
  if (newline < 0) return undefined
  const header = output.slice(0, newline)
  const format = header.endsWith('(diff)') ? 'diff' : header.endsWith('(source)') ? 'source' : undefined
  if (!format) return undefined
  const firstLine = Number(/ L(\d+)–/.exec(header)?.[1] ?? 1)
  return { title: header.replace(/ \((diff|source)\)$/, ''), format, firstLine, source: output.slice(newline + 1) }
}

function isCardInput(value: unknown): value is CardInput {
  return typeof (value as Partial<CardInput> | null)?.path === 'string'
}

/**
 * One line's number and marker, padded to one width for the whole card. Each
 * line is its own row beside its own `Code`: a gutter spanning a multi-line
 * `Code` drifts, since `Code` draws no row for an empty line and wraps long ones.
 */
function gutter(lineNumber: number, kind: DiffRun['kind'], width: number): string {
  return `${String(lineNumber).padStart(width)} ${kind}`
}

function gutterWidth(hunks: DiffRun[][]): number {
  const lastNumbers = hunks.flat().map(run => run.firstLine + run.text.split('\n').length - 1)
  return String(Math.max(...lastNumbers)).length
}

/** Reads the chunk's hunks from git and cuts them to the requested range. */
async function showChunk($: EngineInterface, input: ShowChunkInput) {
  if (!SHA.test(input.base_sha) || !SHA.test(input.head_sha)) {
    return { deny: 'base_sha and head_sha must be commit SHAs.' }
  }
  if (input.path.startsWith('-')) return { deny: `Invalid path: ${input.path}` }

  const run = await $.process.run(
    ['git', 'diff', '--no-color', '--no-ext-diff', '-U3', `${input.base_sha}..${input.head_sha}`, '--', input.path],
  )
  if (run.exitCode !== 0) {
    return { deny: `git diff failed: ${run.stderr.trim()}. Fall back to fenced code blocks.` }
  }

  const chunk = selectChunk(parseDiff(run.stdout), {
    newStart: input.new_start,
    newEnd: input.new_end,
    oldStart: input.old_start,
    oldEnd: input.old_end,
  })
  if (!chunk) {
    return { deny: `No changed lines of ${input.path} fall in new L${input.new_start}–${input.new_end}. Check the range against the diff.` }
  }

  const header = `Chunk ${input.index}/~${input.total} · ${input.path} L${chunk.firstLine}–${chunk.lastLine} (${chunk.format})`
  return { result: `${header}\n${chunk.source}` }
}

function showProposal(input: ShowProposalInput) {
  if (parseDiff(input.diff).hunks.length === 0) {
    return { deny: 'The diff has no hunk: start each hunk with a header like `@@ -12,3 +12,4 @@` holding the real line numbers.' }
  }
  return { result: `Proposed change · ${input.path} (diff)\n${input.diff}` }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({ name: 'show_chunk', description: CHUNK_DESCRIPTION, inputSchema: CHUNK_SCHEMA, isDeferred: false })
    await $.tool.register({ name: 'show_proposal', description: PROPOSAL_DESCRIPTION, inputSchema: PROPOSAL_SCHEMA, isDeferred: false })
    return next(e)
  })

  on('tool.call', { tool: CHUNK_TOOL }, ($, e) => showChunk($, e as unknown as ShowChunkInput)).catch(() => ({
    deny: 'show_chunk failed. Fall back to fenced code blocks.',
  }))

  on('tool.call', { tool: PROPOSAL_TOOL }, ($, e) => showProposal(e as unknown as ShowProposalInput)).catch(() => ({
    deny: 'show_proposal failed. Fall back to a ```diff block.',
  }))

  for (const tool of [CHUNK_TOOL, PROPOSAL_TOOL]) {
    on('ui.render', { component: 'ToolUse', props: { tool } }, ($, e, next) => {
      const shown = readResult(e.props.output)
      if (e.props.isRunning || e.props.isErrored || !shown || !isCardInput(e.props.input)) return next(e)

      const input = e.props.input
      const { Box, Text, Code } = $.ui.resolve(e)
      const code =
        shown.format === 'source' ? (
          <Code source={shown.source} path={input.path} startLine={shown.firstLine} />
        ) : (
          toRuns(shown.source).map((runs, index, hunks) => (
            <Box flexDirection="column">
              {index > 0 ? <Text dimColor>⋯</Text> : null}
              {runs.flatMap(run =>
                run.text.split('\n').map((text, offset) => (
                  <Box flexDirection="row" backgroundColor={RUN_BACKGROUND[run.kind]}>
                    <Text dimColor>{gutter(run.firstLine + offset, run.kind, gutterWidth(hunks))} </Text>
                    <Box flexGrow={1}>
                      <Code source={text} path={input.path} />
                    </Box>
                  </Box>
                )),
              )}
            </Box>
          ))
        )

      return (
        <Box flexDirection="column" marginTop={1} marginLeft={2}>
          <Text bold>{shown.title}</Text>
          {input.summary ? <Text>{input.summary}</Text> : null}
          <Box flexDirection="column" marginTop={1}>
            {code}
          </Box>
          {input.findings?.length ? (
            <Box flexDirection="column" marginTop={1}>
              {input.findings.map((finding, number) => (
                <Box flexDirection="column">
                  <Text>
                    <Text bold>{findingNumber(input.index, number)} </Text>
                    <Text bold color="warning">
                      {finding.severity}
                      {finding.line ? ` L${finding.line}` : ''}
                    </Text>
                    {finding.title ? <Text bold> · {finding.title}</Text> : null}
                  </Text>
                  <Box marginLeft={2}>
                    <Text>{finding.text}</Text>
                  </Box>
                </Box>
              ))}
            </Box>
          ) : null}
        </Box>
      )
    })

    on('ui.render', { component: 'ToolResult', props: { tool } }, ($, e, next) => {
      if (e.props.isErrored || !readResult(e.props.output)) return next(e)
      const { Box } = $.ui.resolve(e)
      return <Box />
    })
  }
}
