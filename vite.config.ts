import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

const root = import.meta.dirname

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'docs',
    rollupOptions: {
      input: {
        main: resolve(root, 'index.html'),
        about: resolve(root, 'about.html'),
        products: resolve(root, 'products.html'),
        join: resolve(root, 'join.html'),
      },
    },
  },
})
