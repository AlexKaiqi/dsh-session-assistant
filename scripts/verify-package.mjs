import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const result = spawnSync('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
})

if (result.status !== 0) {
  process.stderr.write(result.stderr)
  process.exit(result.status ?? 1)
}

const [packed] = JSON.parse(result.stdout)
assert.ok(packed, 'npm pack returned no package result')

const paths = new Set(packed.files.map(file => file.path))
for (const path of [
  'README.md',
  'README.en.md',
  'docs/design.md',
  'lib/index.js',
  'lib/client.js',
  'lib/types/index.d.ts',
  'plugin-spec.json',
  'spec/session-assistant-contract.json',
]) assert.ok(paths.has(path), `published package is missing ${path}`)

for (const path of paths) {
  assert.ok(!path.endsWith('.map'), `published package must not include source map ${path}`)
  assert.ok(!path.endsWith('.gif'), `published package must not include unreferenced demo ${path}`)
  assert.ok(!/^lib\/types\/.*\.js$/.test(path), `published package must not include build intermediate ${path}`)
}

assert.ok(packed.size < 500_000, `packed tarball is unexpectedly large: ${packed.size} bytes`)

const settingsDeclaration = readFileSync(new URL('../lib/types/settings.d.ts', import.meta.url), 'utf8')
assert.ok(!/\bBranded<.+>/.test(settingsDeclaration), 'published settings declaration contains an unimported Branded type')
console.log(`verified ${packed.id}: ${packed.entryCount} files, ${packed.size} bytes`)
