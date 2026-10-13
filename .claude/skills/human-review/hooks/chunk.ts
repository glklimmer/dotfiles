/** One line of a unified-diff hunk with its numbers in the old and new file. */
export type DiffLine = {
  kind: ' ' | '+' | '-'
  text: string
  oldNo: number
  newNo: number
}

export type Hunk = { lines: DiffLine[] }

export type ParsedDiff = { isNewFile: boolean; hunks: Hunk[] }

/**
 * The lines a chunk covers. New-file lines decide for context and added lines;
 * removed lines count when their old number is in the old range, or, without
 * one, when they sit right before a new line inside the new range.
 */
export type ChunkRange = {
  newStart: number
  newEnd: number
  oldStart?: number
  oldEnd?: number
}

/**
 * What `show_chunk` draws: a unified diff of the trimmed hunks, or for a file
 * the MR adds, the added lines as plain source numbered from `firstLine`.
 */
export type Chunk = { format: 'diff' | 'source'; source: string; firstLine: number; lastLine: number }

const HUNK_HEADER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

/**
 * The number the hunk's first line on that side would carry. Git writes the
 * line before for an empty side (`+4,0` follows new line 4), so the lines of
 * such a hunk are numbered by the next one, as removed lines inside a hunk are.
 */
function firstNumber(start: string, count: string | undefined): number {
  return count === '0' ? Number(start) + 1 : Number(start)
}

/**
 * Parses `git diff` output for a single file. Everything before the first
 * hunk header (`diff --git`, `index`, `---`/`+++`) is read for the new-file
 * marker and otherwise dropped, since the `Code` element only parses hunks.
 * A bare empty line inside a hunk is a blank context line whose leading space
 * was lost (hand-written proposals, trimmed editors); empty lines that end a
 * hunk, like the one after the final newline, are dropped. Other lines that
 * are neither context, addition nor removal (`\ No newline at end of file`)
 * are skipped.
 */
export function parseDiff(text: string): ParsedDiff {
  const hunks: Hunk[] = []
  let isNewFile = false
  let current: Hunk | undefined
  let oldNo = 0
  let newNo = 0
  let pendingBlanks = 0

  for (const raw of text.split('\n')) {
    const header = HUNK_HEADER.exec(raw)
    if (header) {
      pendingBlanks = 0
      oldNo = firstNumber(header[1]!, header[2])
      newNo = firstNumber(header[3]!, header[4])
      current = { lines: [] }
      hunks.push(current)
      continue
    }
    if (!current) {
      if (raw.startsWith('--- /dev/null') || raw.startsWith('new file mode')) isNewFile = true
      continue
    }
    if (raw === '') {
      pendingBlanks++
      continue
    }
    const kind = raw[0]
    if (kind === ' ' || kind === '+' || kind === '-') {
      for (; pendingBlanks > 0; pendingBlanks--) {
        current.lines.push({ kind: ' ', text: '', oldNo, newNo })
        oldNo++
        newNo++
      }
    }
    if (kind === ' ') {
      current.lines.push({ kind: ' ', text: raw.slice(1), oldNo, newNo })
      oldNo++
      newNo++
    } else if (kind === '+') {
      current.lines.push({ kind: '+', text: raw.slice(1), oldNo, newNo })
      newNo++
    } else if (kind === '-') {
      current.lines.push({ kind: '-', text: raw.slice(1), oldNo, newNo })
      oldNo++
    }
  }

  return { isNewFile, hunks }
}

function isInRange(line: DiffLine, range: ChunkRange): boolean {
  if (line.kind === '-') {
    if (range.oldStart !== undefined && range.oldEnd !== undefined) {
      return line.oldNo >= range.oldStart && line.oldNo <= range.oldEnd
    }
    return line.newNo >= range.newStart && line.newNo <= range.newEnd
  }
  return line.newNo >= range.newStart && line.newNo <= range.newEnd
}

/**
 * Keeps the part of the hunk from the first to the last in-range line plus
 * `context` lines either side, never past the hunk's own edges. Context lines
 * alone never make a hunk count as touched.
 */
function trimHunk(hunk: Hunk, range: ChunkRange, context: number): DiffLine[] {
  const touched = hunk.lines
    .map((line, index) => (line.kind !== ' ' && isInRange(line, range) ? index : -1))
    .filter(index => index >= 0)
  const first = touched[0]
  const last = touched.at(-1)
  if (first === undefined || last === undefined) return []

  return hunk.lines.slice(Math.max(0, first - context), last + context + 1)
}

/** Renders lines as one hunk with a header recomputed from what is kept. */
function formatHunk(lines: DiffLine[]): string {
  const first = lines[0]!
  const oldCount = lines.filter(line => line.kind !== '+').length
  const newCount = lines.filter(line => line.kind !== '-').length
  const oldStart = oldCount === 0 ? first.oldNo - 1 : first.oldNo
  const newStart = newCount === 0 ? first.newNo - 1 : first.newNo
  const header = `@@ -${oldStart},${oldCount} +${newStart},${newCount} @@`

  return [header, ...lines.map(line => line.kind + line.text)].join('\n')
}

/**
 * Cuts the chunk out of one file's diff. Answers undefined when no added or
 * removed line falls in the range, so the caller can tell the model its
 * coordinates are off instead of drawing an empty card. A new file, or a
 * single unbroken run of added lines, is drawn as source: it reads like the
 * code it is and keeps full syntax highlighting.
 */
export function selectChunk(diff: ParsedDiff, range: ChunkRange, context = 3): Chunk | undefined {
  const touched = diff.hunks.flatMap(hunk => trimHunk(hunk, range, 0)).filter(line => line.kind !== ' ')
  if (touched.length === 0) return undefined
  if (diff.isNewFile || isContiguousAddition(touched)) return asSource(touched)

  const kept = diff.hunks.map(hunk => trimHunk(hunk, range, context)).filter(lines => lines.length > 0)
  const allLines = kept.flat()
  const newNumbers = allLines.filter(line => line.kind !== '-').map(line => line.newNo)
  const firstLine = newNumbers[0] ?? allLines[0]!.oldNo
  const lastLine = newNumbers.at(-1) ?? allLines.at(-1)!.oldNo

  return { format: 'diff', source: kept.map(formatHunk).join('\n'), firstLine, lastLine }
}

/** True when the lines are all additions with consecutive new-file numbers. */
function isContiguousAddition(lines: DiffLine[]): boolean {
  return lines.every((line, index) => line.kind === '+' && line.newNo === lines[0]!.newNo + index)
}

function asSource(lines: DiffLine[]): Chunk {
  const added = lines.filter(line => line.kind === '+')
  return {
    format: 'source',
    source: added.map(line => line.text).join('\n'),
    firstLine: added[0]!.newNo,
    lastLine: added.at(-1)!.newNo,
  }
}

/** Consecutive lines of one kind, numbered from `firstLine` in the file they exist in. */
export type DiffRun = { kind: DiffLine['kind']; firstLine: number; text: string }

/**
 * Groups each hunk of a diff into runs of context, removed and added lines, so
 * every run can be drawn as one highlighted block on its own background.
 * Removed lines are numbered in the old file, all others in the new one.
 */
export function toRuns(diffSource: string): DiffRun[][] {
  return parseDiff(diffSource).hunks.map(hunk => {
    const runs: DiffRun[] = []
    let previous: DiffLine | undefined
    for (const line of hunk.lines) {
      const last = runs.at(-1)
      if (last && previous?.kind === line.kind) {
        last.text += `\n${line.text}`
      } else {
        runs.push({ kind: line.kind, firstLine: line.kind === '-' ? line.oldNo : line.newNo, text: line.text })
      }
      previous = line
    }
    return runs
  })
}
