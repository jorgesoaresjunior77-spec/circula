import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

// Config separada de vite.config.ts (usado por `dev`/`build`) para não
// misturar configuração de teste com a de build/produção — nada aqui
// afeta `npm run dev`/`npm run build`.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
