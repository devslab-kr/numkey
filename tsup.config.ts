import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      vue: 'src/vue.ts',
      react: 'src/react.ts'
    },
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    target: 'es2020',
    sourcemap: true
  },
  {
    entry: { numkey: 'src/browser.ts' },
    format: ['iife'],
    globalName: 'numkey',
    target: 'es2017',
    minify: true,
    sourcemap: true,
    outExtension: () => ({ js: '.global.js' })
  }
])
