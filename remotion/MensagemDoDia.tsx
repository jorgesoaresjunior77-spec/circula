import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion'
import { COLORS, FONT_BODY, FONT_DISPLAY, FONT_LABEL } from './brand'
import './fonts'

// Vídeo de exemplo: a "Mensagem do dia" em 9:16. Texto e autor entram por
// props. Use SOMENTE frases cadastradas e revisadas no app (regra do produto:
// nada de conteúdo gerado por IA). Serve de modelo para os próximos vídeos.

// O Remotion exige `type` (não `interface`) para as props das composições.
export type MensagemDoDiaProps = {
  texto: string
  autor: string
}

export const mensagemDoDiaDefaults: MensagemDoDiaProps = {
  texto: 'Fale com você mesmo como falaria com alguém que ama.',
  autor: 'Brené Brown',
}

export const MensagemDoDia: React.FC<MensagemDoDiaProps> = ({ texto, autor }) => {
  const frame = useCurrentFrame()
  const { fps, durationInFrames } = useVideoConfig()

  const entrada = spring({ frame, fps, config: { damping: 200 } })
  const textoOpacity = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: 'clamp' })
  const textoY = interpolate(frame, [10, 40], [30, 0], { extrapolateRight: 'clamp' })
  const autorOpacity = interpolate(frame, [45, 70], [0, 1], { extrapolateRight: 'clamp' })
  const saida = interpolate(frame, [durationInFrames - 15, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  })

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(ellipse at center, ${COLORS.beigeLight} 0%, ${COLORS.beige} 100%)`,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 100,
        opacity: saida,
      }}
    >
      <div style={{ textAlign: 'center', transform: `scale(${0.96 + entrada * 0.04})` }}>
        <div
          style={{
            fontFamily: FONT_LABEL,
            fontSize: 34,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: COLORS.taupe,
            opacity: textoOpacity,
          }}
        >
          Mensagem do dia
        </div>
        <p
          style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 300,
            fontSize: 78,
            lineHeight: 1.25,
            color: COLORS.mocha,
            margin: '60px 0',
            opacity: textoOpacity,
            transform: `translateY(${textoY}px)`,
          }}
        >
          “{texto}”
        </p>
        <div
          style={{
            width: 80,
            height: 2,
            background: COLORS.champagne,
            margin: '0 auto 40px',
            opacity: autorOpacity,
          }}
        />
        <div style={{ fontFamily: FONT_BODY, fontSize: 40, color: COLORS.mocha, opacity: autorOpacity }}>
          {autor}
        </div>
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: 120,
          fontFamily: FONT_DISPLAY,
          fontSize: 44,
          color: COLORS.mocha,
          opacity: autorOpacity,
        }}
      >
        Círcula
      </div>
    </AbsoluteFill>
  )
}
