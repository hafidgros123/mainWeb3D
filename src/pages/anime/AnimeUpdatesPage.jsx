import './AnimeUpdatesPage.css'

function AnimeUpdatesPage() {
  return (
    <main className="game-page anime-updates-page">
      <p className="eyebrow">Episode releases and anime catalog</p>
      <h1>Anime Updates</h1>
      <p className="anime-updates-intro">
        See the newest episode releases and browse the anime catalog. Sign-in will be required to comment.
      </p>
      <section className="recent-episode" aria-labelledby="recent-episode-title">
        <h2 id="recent-episode-title">Recent Episode</h2>
        <p>The latest episode release will appear here.</p>
      </section>

      <section className="anime-list-area" aria-labelledby="anime-list-title">
        <h2 id="anime-list-title">Anime List</h2>
        <p>The anime catalog will appear here.</p>
      </section>
    </main>
  )
}

export default AnimeUpdatesPage