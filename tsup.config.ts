import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts', 'preset/index': 'src/preset/index.ts' },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  external: ['react', 'react-dom'],
  publicDir: 'src/styles', // copies aichat.css → dist/aichat.css
});
