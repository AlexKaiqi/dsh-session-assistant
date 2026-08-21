import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

test('built client bundle executes with only declared loader modules', async () => {
  const source = await readFile(new URL('../lib/client.js', import.meta.url), 'utf8')
  const requested = []
  let exports
  const context = {
    window: {
      __ModuleLoader__: {
        load(entry) {
          exports = entry.factory(id => {
            requested.push(id)
            if (id === 'react') return {}
            throw new Error(`undeclared client module: ${id}`)
          })
        },
      },
    },
  }

  vm.runInNewContext(source, context, { filename: 'lib/client.js' })

  assert.deepEqual(requested, ['react'])
  assert.equal(typeof exports.apply, 'function')
})
