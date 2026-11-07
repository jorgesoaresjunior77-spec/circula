import { Config } from '@remotion/cli/config'

// Configuração do Remotion (vídeos do Círcula). Os vídeos ficam na pasta
// `remotion/`; as imagens e fontes vêm da pasta `public/` do app (staticFile).
Config.setVideoImageFormat('jpeg')
Config.setOverwriteOutput(true)
Config.setEntryPoint('./remotion/index.ts')
