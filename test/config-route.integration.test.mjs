import assert from 'node:assert/strict'
import { once } from 'node:events'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { apply, createSettingsStore } from '../dsh/index.js'

async function listen(server) {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  return `http://127.0.0.1:${server.address().port}`
}

async function closeServer(server) {
  if (!server.listening) return
  server.close()
  await once(server, 'close')
}

function hostHarness(settingsStore, models) {
  const routes = []
  const cleanups = []
  const profiles = []
  const disposedProfiles = new Set()
  const scope = {
    realtimeModelRuntime: {
      registerProfile(value) {
        profiles.push(value)
        return () => { disposedProfiles.add(value.id) }
      },
      async publicModels() { return models },
    },
    webServer: { register(route) { routes.push(route); return () => {} } },
    effect(callback) { cleanups.push(callback()) },
  }
  apply({
    inject(names, callback) {
      assert.deepEqual(names, ['webServer', 'realtimeModelRuntime'])
      callback(scope)
    },
  }, { autoSpeak: true }, { settingsStore })
  const server = createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname
    const route = routes.find(candidate => candidate.path === path)
    if (!route) {
      res.writeHead(404)
      res.end()
      return
    }
    void route.handler(req, res)
  })
  return {
    server,
    profile: id => profiles.find(profile => profile.id === (id || 'session-assistant')),
    disposed: () => disposedProfiles.size === profiles.length,
    async close() {
      for (const cleanup of cleanups.reverse()) cleanup()
      await closeServer(server)
    },
  }
}

test('settings route migrates legacy state, selects usable defaults, persists normalized choices, and disposes its profile', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'dsh-session-assistant-'))
  const currentPath = join(directory, 'session-assistant.json')
  const legacyPath = join(directory, 'talk-to-text.json')
  await writeFile(legacyPath, JSON.stringify({ recognitionProvider: 'browser', rate: 0.75 }), 'utf8')
  const settingsStore = createSettingsStore(currentPath, [legacyPath])
  const models = [
    { id: 'openai/missing', model: 'gpt-realtime-preview', displayName: 'GPT missing', provider: 'openai', source: 'task-model', protocol: 'openai-webrtc', available: false, missingCredential: 'OPENAI_API_KEY' },
    { id: 'openai/ready', model: 'gpt-realtime', displayName: 'GPT ready', provider: 'openai', source: 'task-model', protocol: 'openai-webrtc', available: true },
    { id: 'doubao/ready', model: '1.2.6.1', displayName: 'Doubao ready', provider: 'doubao-speech', source: 'task-model', protocol: 'doubao-realtime-duplex', available: true },
  ]
  const harness = hostHarness(settingsStore, models)
  const baseURL = await listen(harness.server)
  try {
    const initialResponse = await fetch(`${baseURL}/dsh-session-assistant/config`)
    assert.equal(initialResponse.status, 200)
    const initial = await initialResponse.json()
    assert.equal(initial.value.recognitionProvider, 'browser')
    assert.equal(initial.value.rate, 0.75)
    assert.equal(initial.value.autoSpeak, true)
    assert.equal(initial.value.openaiRealtimeModel, 'openai/ready')
    assert.equal(initial.value.openaiRealtimeVoice, 'marin')
    assert.equal(initial.value.doubaoRealtimeModel, 'doubao/ready')
    assert.equal(initial.capabilities.openaiRealtime, true)
    assert.equal(initial.capabilities.doubaoRealtime, true)
    assert.equal(initial.capabilities.realtimeModels.length, 3)
    assert.equal(initial.capabilities.openaiVoiceOptions.some(voice => voice.id === 'cedar' && voice.recommended), true)
    assert.equal('available' in initial.capabilities.realtimeModels[0], false)
    assert.equal(harness.profile().id, 'session-assistant')

    const savedResponse = await fetch(`${baseURL}/dsh-session-assistant/config`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        config: {
          recognitionProvider: 'invalid-provider',
          openaiRealtimeModel: 'openai/missing',
          rate: 9,
          realtimeModels: [{ credential: 'must-not-persist' }],
          openaiRealtimeAvailable: true,
        },
      }),
    })
    assert.equal(savedResponse.status, 200)
    const saved = await savedResponse.json()
    assert.equal(saved.value.recognitionProvider, 'doubao-realtime')
    assert.equal(saved.value.openaiRealtimeModel, 'openai/missing')
    assert.equal(saved.value.rate, 2)
    assert.equal(saved.capabilities.openaiRealtime, false)
    const persisted = JSON.parse(await readFile(currentPath, 'utf8'))
    assert.equal(persisted.rate, 2)
    assert.equal('realtimeModels' in persisted, false)
    assert.equal('openaiRealtimeAvailable' in persisted, false)

    const invalid = await fetch(`${baseURL}/dsh-session-assistant/config`, { method: 'POST', body: '{' })
    assert.equal(invalid.status, 400)
    assert.match((await invalid.json()).error, /JSON/)

    const oversized = await fetch(`${baseURL}/dsh-session-assistant/config`, {
      method: 'POST',
      body: JSON.stringify({ config: { voiceName: 'x'.repeat(70_000) } }),
    })
    assert.equal(oversized.status, 400)
    assert.match((await oversized.json()).error, /too large/)

    const method = await fetch(`${baseURL}/dsh-session-assistant/config`, { method: 'DELETE' })
    assert.equal(method.status, 405)
    assert.equal(method.headers.get('allow'), 'GET, POST')
  } finally {
    await harness.close()
    await rm(directory, { recursive: true, force: true })
  }
  assert.equal(harness.disposed(), true)
})
