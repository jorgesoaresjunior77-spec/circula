import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Identificador desta publicação. Vai para dentro do app (__BUILD_ID__) e para
// o arquivo version.json, que o app consulta para saber se há versão mais nova
// (ver src/lib/appUpdate.ts).
const BUILD_ID = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14)

function versionFile(): Plugin {
  return {
    name: 'circula-version-file',
    apply: 'build',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages: app servido em https://jorgesoaresjunior77-spec.github.io/circula/
  base: '/circula/',
  plugins: [react(), versionFile()],
  define: {
    __BUILD_ID__: JSON.stringify(BUILD_ID),
  },
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
