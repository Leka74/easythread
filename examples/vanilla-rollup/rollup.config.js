import easythreadPlugin from '@easythread/rollup';
import typescript from 'rollup-plugin-typescript2';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

export default {
  input: ['src/index.ts', 'src/algorithms.ts'],
  output: {
    dir: 'dist',
    format: 'cjs',
    preserveModules: true,
    preserveModulesRoot: 'src',
    entryFileNames: '[name].cjs',
    chunkFileNames: '[name].cjs'
  },
  plugins: [
    easythreadPlugin(),
    typescript({
      typescript: require('typescript'),
      tsconfigOverride: {
        compilerOptions: {
          noUnusedLocals: false,
          noUnusedParameters: false,
          noImplicitAny: false,
          strict: false,
          exactOptionalPropertyTypes: false,
          strictNullChecks: false
        }
      }
    })
  ],
  external: ['worker_threads', 'fs', 'path']
};