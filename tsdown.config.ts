import { defineConfig } from 'tsdown'

const id = 'dsh-session-assistant'
const clientExternals = ['react']

export default defineConfig([
  {
    entry: { index: 'lib/types/index.js', controller: 'lib/types/client/controller.js', 'typert.host': 'lib/types/typert-host.js', 'typert.remote-client': 'lib/types/typert-remote.js' },
    outDir: 'lib', format: ['esm'], platform: 'node', target: 'es2024', dts: false, clean: false, fixedExtension: false,
  },
  {
    entry: { client: 'lib/types/client/index.js' }, outDir: 'lib', format: 'cjs', platform: 'browser', target: 'es2022',
    deps: {
      neverBundle: clientExternals,
      alwaysBundle: id => !clientExternals.includes(id),
      onlyBundle: ['zod'],
    },
    dts: false, sourcemap: true, minify: true, clean: false,
    outputOptions: {
      entryFileNames: 'client.js',
      banner: `window.__ModuleLoader__.load({ id: ${JSON.stringify(id)}, factory: (require) => {`,
      footer: 'return module.exports; } });',
      intro: 'var module = { exports: {} }; var exports = module.exports;',
    },
  },
])
