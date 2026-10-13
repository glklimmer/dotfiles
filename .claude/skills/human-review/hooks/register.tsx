import type { EngineInterface, Register } from 'claude-code'

import { chunkLanguage, parseDiff, selectChunk, toRuns, vueLineLanguages } from './chunk'
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
export type ShownCode = { title: string; format: Chunk['format']; language?: string; firstLine: number; source: string }

const RESULT_HEADER = / \((diff|source)(?:, ([\w+-]+))?\)$/

/** The result's first line: the title, then the format and any language the highlighter is told. */
function resultHeader(title: string, format: Chunk['format'], language: string | undefined): string {
  return `${title} (${language ? `${format}, ${language}` : format})`
}

/**
 * Splits a stored result back into its title and the code under it. The first
 * line ends in `(diff)` or `(source)`, either with `, <language>` before the
 * paren; anything else (an error text) answers undefined, so the card leaves
 * the row to the engine.
 */
export function readResult(output: unknown): ShownCode | undefined {
  if (typeof output !== 'string') return undefined
  const newline = output.indexOf('\n')
  if (newline < 0) return undefined
  const header = output.slice(0, newline)
  const match = RESULT_HEADER.exec(header)
  if (!match) return undefined
  const firstLine = Number(/ L(\d+)–/.exec(header)?.[1] ?? 1)
  return {
    title: header.slice(0, match.index),
    format: match[1] as Chunk['format'],
    language: match[2],
    firstLine,
    source: output.slice(newline + 1),
  }
}

/** `language` only when one was decided: a prop left undefined can make the engine refuse the tree. */
function languageProp(language: string | undefined): { language?: string } {
  return language ? { language } : {}
}

function isCardInput(value: unknown): value is CardInput {
  return typeof (value as Partial<CardInput> | null)?.path === 'string'
}

/** One drawn line: its number, its diff marker (none on a source card) and the language it is highlighted in. */
type CardRow = { lineNumber: number; kind?: DiffRun['kind']; text: string; language?: string }

/**
 * The card's lines, one list per hunk. A `.vue` card walks its block tags, so
 * a chunk spanning `<template>` and `<script>` highlights each in its own language.
 */
function cardRows(shown: ShownCode, path: string): CardRow[][] {
  const hunks: CardRow[][] =
    shown.format === 'source'
      ? [shown.source.split('\n').map((text, offset) => ({ lineNumber: shown.firstLine + offset, text }))]
      : toRuns(shown.source).map(runs =>
          runs.flatMap(run => run.text.split('\n').map((text, offset) => ({ lineNumber: run.firstLine + offset, kind: run.kind, text }))),
        )
  if (!path.endsWith('.vue')) return hunks.map(rows => rows.map(row => ({ ...row, language: shown.language })))

  const languages = vueLineLanguages(hunks.flat().map(row => row.text), shown.language ?? 'xml')
  let index = 0
  return hunks.map(rows => rows.map(row => ({ ...row, language: languages[index++] })))
}

/**
 * One line's number and marker, padded to one width for the whole card. Each
 * line is its own row beside its own `Code`: a gutter spanning a multi-line
 * `Code` drifts, since `Code` draws no row for an empty line and wraps long ones.
 */
function gutter(row: CardRow, width: number): string {
  const number = String(row.lineNumber).padStart(width)
  return row.kind ? `${number} ${row.kind}` : number
}

function gutterWidth(hunks: CardRow[][]): number {
  return String(Math.max(...hunks.flat().map(row => row.lineNumber))).length
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

  const file = await vueFile(input.path, () => $.process.run(['git', 'show', `${input.head_sha}:${input.path}`]).then(shown => shown.stdout))
  const language = chunkLanguage(input.path, chunk.firstLine, file)
  const header = resultHeader(`Chunk ${input.index}/~${input.total} · ${input.path} L${chunk.firstLine}–${chunk.lastLine}`, chunk.format, language)
  return { result: `${header}\n${chunk.source}` }
}

/** A `.vue` file's text, so its blocks can be told apart; undefined for other files or when it cannot be read. */
async function vueFile(path: string, read: () => Promise<string>): Promise<string | undefined> {
  if (!path.endsWith('.vue')) return undefined
  return read().catch(() => undefined)
}

/** Proposals carry no SHA, so a `.vue` file's blocks are read from the working tree. */
async function showProposal($: EngineInterface, input: ShowProposalInput) {
  const diff = parseDiff(input.diff)
  if (diff.hunks.length === 0) {
    return { deny: 'The diff has no hunk: start each hunk with a header like `@@ -12,3 +12,4 @@` holding the real line numbers.' }
  }
  const firstLine = diff.hunks[0]!.lines[0]?.newNo ?? 1
  const file = await vueFile(input.path, () => $.fs.read(input.path) as Promise<string>)
  const header = resultHeader(`Proposed change · ${input.path}`, 'diff', chunkLanguage(input.path, firstLine, file))
  return { result: `${header}\n${input.diff}` }
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

  on('tool.call', { tool: PROPOSAL_TOOL }, ($, e) => showProposal($, e as unknown as ShowProposalInput)).catch(() => ({
    deny: 'show_proposal failed. Fall back to a ```diff block.',
  }))

  for (const tool of [CHUNK_TOOL, PROPOSAL_TOOL]) {
    on('ui.render', { component: 'ToolUse', props: { tool } }, ($, e, next) => {
      const shown = readResult(e.props.output)
      if (e.props.isRunning || e.props.isErrored || !shown || !isCardInput(e.props.input)) return next(e)

      const input = e.props.input
      const { Box, Text, Code } = $.ui.resolve(e)
      const hunks = cardRows(shown, input.path)
      const width = gutterWidth(hunks)
      const code =
        shown.format === 'source' && !input.path.endsWith('.vue') ? (
          <Code source={shown.source} path={input.path} startLine={shown.firstLine} {...languageProp(shown.language)} />
        ) : (
          hunks.map((rows, index) => (
            <Box flexDirection="column">
              {index > 0 ? <Text dimColor>⋯</Text> : null}
              {rows.map(row => (
                <Box flexDirection="row" backgroundColor={row.kind ? RUN_BACKGROUND[row.kind] : undefined}>
                  <Text dimColor>{gutter(row, width)} </Text>
                  <Box flexGrow={1}>
                    <Code source={row.text} path={input.path} {...languageProp(row.language)} />
                  </Box>
                </Box>
              ))}
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
