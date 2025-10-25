// Centralised manifest of in-app assets with sane defaults.

export type AssetsManifest = {
  cards: string[]
  cards2x: string[]
  images: {
    cards: string[]
    cards2x: string[]
    ui: Record<string, string>
  }
  audio: Record<string, string>
}

const CARD_VARIANTS = 24

const cardSprites = Array.from({ length: CARD_VARIANTS }, (_, i) => {
  const id = String(i + 1).padStart(2, '0')
  return `/assets/cards/card-${id}.webp`
})

const cardSprites2x = Array.from({ length: CARD_VARIANTS }, (_, i) => {
  const id = String(i + 1).padStart(2, '0')
  return `/assets/cards/card-${id}@2x.webp`
})

const uiIcons = {
  undo: '/assets/ui/undo.webp',
  hint: '/assets/ui/hint.webp',
  shuffle: '/assets/ui/shuffle.webp',
  restart: '/assets/ui/restart.webp',
  pause: '/assets/ui/pause.webp',
  play: '/assets/ui/play.webp',
  soundOn: '/assets/ui/sound-on.webp',
  soundOff: '/assets/ui/sound-off.webp',
  placeholder: '/assets/ui/placeholder.webp',
} satisfies Record<string, string>

const audioManifest = {
  select: '/assets/audio/select.mp3',
  match: '/assets/audio/match.mp3',
  win: '/assets/audio/win.mp3',
  lose: '/assets/audio/lose.mp3',
  silent: '/assets/audio/silent.mp3',
} satisfies Record<string, string>

export const ASSETS: AssetsManifest = {
  cards: [...cardSprites],
  cards2x: [...cardSprites2x],
  images: {
    cards: [...cardSprites],
    cards2x: [...cardSprites2x],
    ui: { ...uiIcons },
  },
  audio: { ...audioManifest },
}

export default ASSETS
