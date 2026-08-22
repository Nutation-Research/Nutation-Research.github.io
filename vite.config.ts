import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { port: 5199, strictPort: true },
  preview: { port: 5199, strictPort: true },
  build: {
    outDir: 'docs',
    // The prebuilt Yuna viewer under public/viewer already has its own hashed asset
    // filenames; a large public/runs corpus also lives there. Neither needs bundling,
    // so keep Vite's default (copy-through) behavior — nothing to override here.
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
