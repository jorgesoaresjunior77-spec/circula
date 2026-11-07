import { Composition } from 'remotion'
import { FORMATS, FPS } from './brand'
import { MensagemDoDia, mensagemDoDiaDefaults } from './MensagemDoDia'

// Lista de vídeos (composições). Para criar um novo: crie o componente em
// remotion/, registre aqui com um id único e rode `npm run remotion:studio`.
export const RemotionRoot: React.FC = () => {
  return (
    <Composition
      id="MensagemDoDia"
      component={MensagemDoDia}
      durationInFrames={FPS * 6}
      fps={FPS}
      width={FORMATS.story.width}
      height={FORMATS.story.height}
      defaultProps={mensagemDoDiaDefaults}
    />
  )
}
