// Filtro de cor único do app ("circula-grade"): mistura 40% de um mapa de tons feito com a paleta da foto do topo
// (sombra, meio e luz) sobre cada imagem cadastrada, para todas ficarem com a mesma temperatura de cor da capa.
// Os valores iniciais são o tom quente padrão; heroPalette.ts os troca pelos da foto de capa.
export function PaletteGrade() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }} aria-hidden="true" focusable="false">
      <filter id="circula-grade" colorInterpolationFilters="sRGB" x="0" y="0" width="100%" height="100%">
        <feColorMatrix type="saturate" values="0.95" in="SourceGraphic" result="base" />
        <feColorMatrix type="matrix" in="SourceGraphic" result="gray" values="0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0.33 0.33 0.33 0 0  0 0 0 1 0" />
        <feComponentTransfer in="gray" result="mapped">
          <feFuncR id="grade-r" type="table" tableValues="0.20 0.62 0.96" />
          <feFuncG id="grade-g" type="table" tableValues="0.13 0.50 0.90" />
          <feFuncB id="grade-b" type="table" tableValues="0.10 0.40 0.82" />
        </feComponentTransfer>
        <feComposite in="base" in2="mapped" operator="arithmetic" k1="0" k2="0.62" k3="0.38" k4="0" />
      </filter>
    </svg>
  )
}
