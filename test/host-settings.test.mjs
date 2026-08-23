import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const mod = await import('../lib/index.js')

test('model contract keeps the voice role bounded and exposes exact tool/result surfaces', () => {
  assert.match(mod.PROMPT, /cannot execute tasks/)
  assert.match(mod.PROMPT, /Only after an explicit spoken instruction/)
  assert.ok(mod.Config)
  assert.deepEqual(mod.SESSION_ASSISTANT_TOOLS.map(tool => tool.name), [
    'update_working_draft',
    'submit_to_agent',
    'end_voice_session',
    'organize_notes',
  ])
  assert.deepEqual(mod.SESSION_ASSISTANT_TOOL_OUTPUT, {
    update_working_draft: { required: ['draft', 'summary', 'status'] },
    submit_to_agent: { required: ['draft'] },
    end_voice_session: { required: [] },
    organize_notes: {},
  })
})

test('legacy migration uses first valid candidate, keeps only normalized declared fields, and never writes source files', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'session-assistant-'))
  const invalid = join(dir, 'invalid.json')
  const valid = join(dir, 'valid.json')
  await writeFile(invalid, '{', 'utf8')
  await writeFile(valid, JSON.stringify({ recognitionProvider: 'browser', rate: 9, realtimeModels: ['secret'] }), 'utf8')
  const replaced = []
  const settings = {
    describe() { return [{ ns: mod.SETTINGS_NAMESPACE, user: {}, revision: 4 }] },
    replace(...args) { replaced.push(args); return Promise.resolve() },
  }
  try {
    assert.equal(await mod.migrateLegacySettings(settings, [invalid, valid]), true)
    assert.deepEqual(replaced[0].slice(0, 1), [mod.SETTINGS_NAMESPACE])
    assert.equal(replaced[0][1].recognitionProvider, 'browser')
    assert.equal(replaced[0][1].rate, 2)
    assert.equal('realtimeModels' in replaced[0][1], false)
    assert.equal(replaced[0][2], 4)
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test('migration guard is idempotent and skips every legacy filesystem read after a user override exists', async () => {
  let read = false
  const settings = { describe() { return [{ ns: mod.SETTINGS_NAMESPACE, user: { rate: 1 } }] } }
  assert.equal(await mod.migrateLegacySettings(settings, ['legacy'], () => { read = true; return '{}' }), false)
  assert.equal(read, false)
})

test('Host registration source uses live settings, narrow Remote, profiles, and no HTTP', async () => {
  const source = await import('node:fs/promises').then(fs => fs.readFile(new URL('../src/index.ts', import.meta.url), 'utf8'))
  const settings = await import('node:fs/promises').then(fs => fs.readFile(new URL('../src/settings.ts', import.meta.url), 'utf8'))
  assert.match(source, /registerSessionAssistantSettings\(ctx, config\)/)
  assert.match(source, /new SessionAssistantSettingsRemote\(ctx, scope\)/)
  assert.match(source, /registerProfile\(profile\)/)
  assert.match(source, /ctx\.effect\(/)
  assert.match(settings, /applies: 'live'/)
  assert.equal(mod.sessionProfiles().length, (mod.OPENAI_REALTIME_VOICES.length + 1) * 2)
  assert.equal(mod.sessionProfiles().filter(profile => profile.id.includes('preview')).every(profile => profile.tools.length === 0), true)
  assert.doesNotMatch(source, /webServer|register\(\{\s*kind: 'exact'|writeFile/)
})

test('settings Remote saves a closed normalized schema with expected revision', async () => {
  const calls = []
  const scope = { get: () => mod.DEFAULT_SETTINGS }
  const ctx = {
    settings: {
      writable: true,
      describe: () => [{ ns: mod.SETTINGS_NAMESPACE, revision: 7 }],
      replace: (...args) => { calls.push(args); return Promise.resolve() },
    },
  }
  const Remote = mod.SessionAssistantSettingsRemote
  const remote = Object.create(Remote.prototype)
  remote.ctx = ctx
  remote.scope = scope
  const view = await remote.save({ expectedRevision: 7, settings: { ...mod.DEFAULT_SETTINGS, rate: 9, unknown: 'drop' } })
  assert.deepEqual(calls[0].slice(0, 1), [mod.SETTINGS_NAMESPACE])
  assert.equal(calls[0][1].rate, 2)
  assert.equal('unknown' in calls[0][1], false)
  assert.equal(calls[0][2], 7)
  assert.equal(view.revision, 7)
})

test('settings Remote projects optional Personal Knowledge with bounded inputs and honest absence', async () => {
  const calls = []
  const Remote = mod.SessionAssistantSettingsRemote
  const remote = Object.create(Remote.prototype)
  remote.ctx = {
    get(name) {
      if (name !== 'personalKnowledge') return undefined
      return { project(options) { calls.push(options); return { text: '# projection', sources: ['USER.md'] } } }
    },
  }
  const projected = await remote.context({ query: 'q'.repeat(3_000), sessionId: 's', cwd: '/workspace', maxChars: 99_999 })
  assert.deepEqual(projected, { available: true, text: '# projection', sources: ['USER.md'] })
  assert.equal(calls[0].query.length, 2_400)
  assert.equal(calls[0].maxChars, 12_000)

  remote.ctx = { get() { return undefined } }
  assert.deepEqual(await remote.context({}), { available: false, text: '', sources: [] })
})

test('settings Remote curate maps the knowledge-curator result to the CuratorView contract', async () => {
  const calls = []
  const Remote = mod.SessionAssistantSettingsRemote
  const remote = Object.create(Remote.prototype)
  remote.ctx = {
    get(name) {
      if (name !== 'personalKnowledgeMaintainer') return undefined
      return {
        async curate(sessionId, options) {
          calls.push({ sessionId, options })
          return { skipped: false, current: { path: '.pkb/current.md' }, proposals: ['p1', 'p2'], source: 'session:s1' }
        },
      }
    },
  }
  const view = await remote.curate({ sessionId: 's1', cwd: '/ws', instruction: '整理', extra: '讨论' })
  assert.deepEqual(view, { available: true, ok: true, proposals: ['p1', 'p2'], currentUpdated: true })
  assert.deepEqual(calls[0], { sessionId: 's1', options: { cwd: '/ws', instruction: '整理', extra: '讨论' } })

  // A skipped pass is honest failure with the reason.
  remote.ctx.get = name => name === 'personalKnowledgeMaintainer' ? { curate: async () => ({ skipped: true, reason: 'curate-cooldown' }) } : undefined
  assert.deepEqual(await remote.curate({ sessionId: 's1' }), { available: true, ok: false, proposals: [], currentUpdated: false, error: 'Knowledge curation skipped: curate-cooldown' })

  // A throwing curator never leaks: ok:false with the message.
  remote.ctx.get = name => name === 'personalKnowledgeMaintainer' ? { curate: async () => { throw new Error('upstream failed') } } : undefined
  assert.deepEqual(await remote.curate({ sessionId: 's1' }), { available: true, ok: false, proposals: [], currentUpdated: false, error: 'upstream failed' })

  // Honest absence when the knowledge base is not installed.
  remote.ctx = { get() { return undefined } }
  assert.deepEqual(await remote.curate({ sessionId: 's1' }), { available: false, ok: false, proposals: [], currentUpdated: false })
})
