import { expect, test } from 'claude-code/testing'

import { parseDiff, selectChunk, toRuns } from '../hooks/chunk'

const MODIFIED = [
  'diff --git a/app/x.rb b/app/x.rb',
  'index 1111111..2222222 100644',
  '--- a/app/x.rb',
  '+++ b/app/x.rb',
  '@@ -10,12 +10,13 @@ class X',
  ' a',
  ' b',
  ' c',
  '-old_one',
  '+new_one',
  ' d',
  ' e',
  ' f',
  ' g',
  ' h',
  ' i',
  '+added',
  ' j',
  ' k',
  '@@ -40,3 +41,4 @@ class X',
  ' p',
  '+q',
  ' r',
  ' s',
  '',
].join('\n')

test('keeps only the touched part of a hunk and recomputes its header', () => {
  const chunk = selectChunk(parseDiff(MODIFIED), { newStart: 13, newEnd: 13 })

  expect(chunk?.format).toBe('diff')
  expect(chunk?.source).toBe(['@@ -10,7 +10,7 @@', ' a', ' b', ' c', '-old_one', '+new_one', ' d', ' e', ' f'].join('\n'))
})

test('an unbroken run of added lines in a modified file is drawn as source', () => {
  expect(selectChunk(parseDiff(MODIFIED), { newStart: 20, newEnd: 20 })).toEqual({
    format: 'source',
    source: 'added',
    firstLine: 20,
    lastLine: 20,
  })
})

test('a range spanning two hunks keeps both, each with its own header', () => {
  const chunk = selectChunk(parseDiff(MODIFIED), { newStart: 20, newEnd: 42 })

  expect(chunk?.source.split('\n').filter(line => line.startsWith('@@'))).toEqual(['@@ -17,5 +17,6 @@', '@@ -40,3 +41,4 @@'])
})

test('context lines alone do not select a hunk', () => {
  expect(selectChunk(parseDiff(MODIFIED), { newStart: 15, newEnd: 18 })).toBeUndefined()
})

test('a removed line counts by its old number when an old range is given', () => {
  const chunk = selectChunk(parseDiff(MODIFIED), { newStart: 0, newEnd: 0, oldStart: 13, oldEnd: 13 })

  expect(chunk?.source).toContain('-old_one')
})

test('a new file is drawn as source numbered from its first added line', () => {
  const diff = ['--- /dev/null', '+++ b/app/y.rb', '@@ -0,0 +1,4 @@', '+one', '+two', '+three', '+four', ''].join('\n')

  expect(selectChunk(parseDiff(diff), { newStart: 2, newEnd: 3 })).toEqual({
    format: 'source',
    source: 'two\nthree',
    firstLine: 2,
    lastLine: 3,
  })
})

test('runs number removed lines in the old file and the rest in the new one', () => {
  const runs = toRuns(['@@ -10,4 +10,4 @@', ' a', '-b', '-c', '+B', '+C', ' d'].join('\n'))

  expect(runs).toEqual([
    [
      { kind: ' ', firstLine: 10, text: 'a' },
      { kind: '-', firstLine: 11, text: 'b\nc' },
      { kind: '+', firstLine: 11, text: 'B\nC' },
      { kind: ' ', firstLine: 13, text: 'd' },
    ],
  ])
})
