import { expect, test } from 'claude-code/testing'

const INPUT = {
  index: 3,
  total: 12,
  path: 'app/x.rb',
  base_sha: 'abc1234',
  head_sha: 'def5678',
  new_start: 10,
  new_end: 16,
  summary: 'Renames the scope.',
  findings: [{ severity: 'major', line: 13, title: 'Dead code', text: 'unused variable' }],
}

const OUTPUT = 'Chunk 3/~12 · app/x.rb L10–11 (diff)\n@@ -10,2 +10,2 @@\n-old\n+new\n a'

function toolUse(output: unknown) {
  return {
    plugin: 'human-review',
    component: 'ToolUse' as const,
    props: {
      tool_use_id: 'toolu_1',
      tool: 'mcp__human-review__show_chunk',
      input: INPUT,
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
      output,
    },
  }
}

test('the card draws each diff run as highlighted code beside its numbered gutter', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ surface, ...toolUse(OUTPUT) })

    const removed = await ui.find({ type: 'Code' })
    expect(removed?.props).toMatchObject({ source: 'old', path: 'app/x.rb' })
    expect(await ui.find({ type: 'Text', text: '10 - ' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '11   ' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Chunk 3/~12 · app/x.rb L10–11' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /unused variable/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /3\.1/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /Dead code/ })).toBeDefined()
    await ui.unmount()
  }
})

test('a new-file chunk is numbered from its first line', async $ => {
  const ui = await $.ui.mount({ surface: 'terminal', ...toolUse('Chunk 1/~4 · app/y.rb L5–9 (source)\nfoo') })

  expect((await ui.find({ type: 'Code' }))?.props.startLine).toBe(5)
  await ui.unmount()
})

test('a proposed change draws like a chunk, numbered from its hunk header', async $ => {
  const ui = await $.ui.mount({
    plugin: 'human-review',
    surface: 'terminal',
    component: 'ToolUse',
    props: {
      tool_use_id: 'toolu_2',
      tool: 'mcp__human-review__show_proposal',
      input: { path: 'app/x.rb', diff: '@@ -40,1 +40,1 @@\n-old\n+new' },
      isRunning: false,
      isErrored: false,
      isInterrupted: false,
      output: 'Proposed change · app/x.rb (diff)\n@@ -40,1 +40,1 @@\n-old\n+new',
    },
  })

  expect(await ui.find({ type: 'Text', text: 'Proposed change · app/x.rb' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '40 + ' })).toBeDefined()
  await ui.unmount()
})

test('every diff line gets its own row, so blank lines keep their number', async $ => {
  const output = 'Chunk 3/~12 · app/x.rb L10–12 (diff)\n@@ -9,0 +10,3 @@\n+a\n+\n+b'
  const ui = await $.ui.mount({ surface: 'terminal', ...toolUse(output) })

  const sources = (await ui.findAll({ type: 'Code' })).map(code => code.props.source)
  expect(sources).toEqual(['a', '', 'b'])
  expect(await ui.find({ type: 'Text', text: '11 + ' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '12 + ' })).toBeDefined()
  await ui.unmount()
})

test('a language in the result header reaches the highlighter', async $ => {
  const output = 'Chunk 3/~12 · app/x.vue L10–11 (diff, typescript)\n@@ -10,2 +10,2 @@\n-old\n+new\n a'
  const ui = await $.ui.mount({ surface: 'terminal', ...toolUse(output) })

  expect((await ui.find({ type: 'Code' }))?.props.language).toBe('typescript')
  expect(await ui.find({ type: 'Text', text: 'Chunk 3/~12 · app/x.vue L10–11' })).toBeDefined()
  await ui.unmount()
})

test('a new .vue file highlights each block in its own language', async $ => {
  const source = ['<template>', '  <div />', '</template>', '<script setup lang="ts">', 'const a = 1', '</script>'].join('\n')
  const card = toolUse(`Chunk 1/~4 · app/x.vue L1–6 (source, xml)\n${source}`)
  const ui = await $.ui.mount({ surface: 'terminal', ...card, props: { ...card.props, input: { ...INPUT, path: 'app/x.vue' } } })

  const languages = (await ui.findAll({ type: 'Code' })).map(code => code.props.language)
  expect(languages).toEqual(['xml', 'xml', 'xml', 'xml', 'typescript', 'xml'])
  expect(await ui.find({ type: 'Text', text: '5 ' })).toBeDefined()
  await ui.unmount()
})

test('each hunk of a .vue card starts in its own language', async $ => {
  const output = 'Chunk 3/~12 · app/x.vue L2–21 (diff, xml scss)\n@@ -2,1 +2,1 @@\n-<div />\n+<span />\n@@ -20,1 +20,1 @@\n-.a { b: c }\n+.a { b: d }'
  const card = toolUse(output)
  const ui = await $.ui.mount({ surface: 'terminal', ...card, props: { ...card.props, input: { ...INPUT, path: 'app/x.vue' } } })

  const languages = (await ui.findAll({ type: 'Code' })).map(code => code.props.language)
  expect(languages).toEqual(['xml', 'xml', 'scss', 'scss'])
  await ui.unmount()
})
