import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages: app servido em https://jorgesoaresjunior77-spec.github.io/circula/
  base: '/circula/',
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        // Bibliotecas que quase nunca mudam ficam em arquivos próprios: baixam
        // em paralelo e continuam no cache do celular entre uma publicação e outra.
        codeSplitting: {
          groups: [
            { name: 'vendor-react', test: /node_modules[\/](react|react-dom|scheduler)[\/]/ },
            { name: 'vendor-supabase', test: /node_modules[\/]@supabase[\/]/ },
          ],
        },
      },
    },
  },
})
