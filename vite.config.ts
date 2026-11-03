/// <reference types="vitest" />
import { defineConfig } from 'vite';
import { configDefaults } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST }), svelteTesting()],
  // separate.worker.ts is a module worker: it dynamic-imports onnxruntime-web and demucs-web.
  worker: { format: 'es' },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test-setup.ts'],
    // Agent worktrees live under .claude/; don't collect their tests.
    exclude: [...configDefaults.exclude, '.claude/**']
  }
});
