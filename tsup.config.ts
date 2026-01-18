import { defineConfig } from 'tsup'
import pkg from './package.json'

export default defineConfig({
  entry: {
    cli: 'src/index.ts',
    index: 'src/lib/index.ts',
  },
  outDir: 'dist',
  format: ['cjs', 'esm'],
  clean: true,
  shims: true,
  target: 'node20',
  platform: 'node',
  sourcemap: false,
  dts: true,
  splitting: false,
  external: Object.keys(pkg.devDependencies || {})
})
