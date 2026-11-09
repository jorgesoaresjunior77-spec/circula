// Playlist: o espaço de músicas para relaxar e cuidar de si. Ainda não há
// playlists cadastradas, então a tela avisa com honestidade em vez de
// mostrar conteúdo inventado.

export function PlaylistPage() {
  return (
    <section className="playlist-page">
      <h2>Playlist</h2>
      <p className="home-muted">
        Em breve, aqui vão ficar as playlists da comunidade para respirar, relaxar e começar o dia com calma.
        Ainda não há nenhuma publicada.
      </p>
    </section>
  )
}
