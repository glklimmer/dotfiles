import { expect, test } from 'claude-code/testing'

import { chunkLanguage, parseDiff, selectChunk, toRuns } from '../hooks/chunk'

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

test('a bare empty line inside a hunk is a blank context line, and trailing ones are dropped', () => {
  const [hunk] = parseDiff('@@ -5,3 +5,3 @@\n a\n\n-b\n+c\n\n\n').hunks

  expect(hunk!.lines.map(line => line.kind + line.text)).toEqual([' a', ' ', '-b', '+c'])
  expect(hunk!.lines[2]).toMatchObject({ oldNo: 7, newNo: 7 })
})

test('a hunk with an empty side keeps git\'s header numbers', () => {
  const deleted = ['--- a/app/x.rb', '+++ /dev/null', '@@ -1,2 +0,0 @@', '-a', '-b', ''].join('\n')
  const removal = ['@@ -5,2 +4,0 @@', '-a', '-b', ''].join('\n')

  expect(selectChunk(parseDiff(deleted), { newStart: 1, newEnd: 1, oldStart: 1, oldEnd: 2 })?.source).toBe('@@ -1,2 +0,0 @@\n-a\n-b')
  expect(selectChunk(parseDiff(removal), { newStart: 1, newEnd: 1, oldStart: 5, oldEnd: 6 })?.source).toBe('@@ -5,2 +4,0 @@\n-a\n-b')
})

test('a .vue chunk is highlighted in the language of the block it sits in', () => {
  const file = ['<template>', '  <div />', '</template>', '', '<script setup lang="ts">', 'const a = 1', '</script>', '', '<style lang="scss" scoped>', '.a { b: c }', '</style>'].join('\n')

  expect(chunkLanguage('app/x.vue', 2, file)).toBe('html')
  expect(chunkLanguage('app/x.vue', 5, file)).toBe('html')
  expect(chunkLanguage('app/x.vue', 6, file)).toBe('typescript')
  expect(chunkLanguage('app/x.vue', 10, file)).toBe('scss')
})

test('rust is named outright and other files are left to the path', () => {
  expect(chunkLanguage('src/lib.rs', 1)).toBe('rust')
  expect(chunkLanguage('app/x.rb', 1)).toBeUndefined()
})
