// Auto-generated assets manifest for game
export const ASSETS = {
  cards: Array.from({ length: 24 }).map((_, i) => `/assets/cards/card-${String(i + 1).padStart(2, '0')}.webp`),
  cards2x: Array.from({ length: 24 }).map((_, i) => `/assets/cards/card-${String(i + 1).padStart(2, '0')}@2x.webp`),
  ui: {
    undo: '/assets/ui/undo.webp',
    hint: '/assets/ui/hint.webp',
    shuffle: '/assets/ui/shuffle.webp',
    restart: '/assets/ui/restart.webp',
    pause: '/assets/ui/pause.webp',
    play: '/assets/ui/play.webp',
    soundOn: '/assets/ui/sound-on.webp',
    soundOff: '/assets/ui/sound-off.webp',
    placeholder: '/assets/ui/placeholder.webp'
  },
  audio: {
    select: '/assets/audio/select.mp3',
    match: '/assets/audio/match.mp3',
    win: '/assets/audio/win.mp3',
    lose: '/assets/audio/lose.mp3',
    silent: '/assets/audio/silent.mp3'
  }
}

export type AssetsManifest = typeof ASSETS

export default ASSETS
