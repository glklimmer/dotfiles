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
