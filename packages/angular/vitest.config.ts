import angular from '@analogjs/vite-plugin-angular';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Applies Angular's compiler transforms (signal inputs, templates) so JIT
  // tests see the same component metadata as AOT builds. Without it,
  // input()/model() declarations are invisible to reflectComponentType and
  // setInput in vitest.
  plugins: [angular({ jit: true, tsconfig: './tsconfig.json' })],
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./src/test-setup.ts'],
  },
  resolve: {
    alias: {
      '@angflow/system': new URL('../system/src/index.ts', import.meta.url).pathname,
    },
  },
});
