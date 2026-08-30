import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages: app servido em https://jorgesoaresjunior77-spec.github.io/circula/
  base: '/circula/',
  plugins: [react()],
})
