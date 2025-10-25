export interface GameConfig {
  cardNum?: number
  gridSize?: {
    rows: number
    cols: number
  }
  layerNum?: number
  trap?: boolean
  minMatch?: number
  delNode?: boolean
  sound?: boolean
  container?: HTMLElement
  events?: {
    // common event callbacks used across the app
    scoreCallback?: (score: number) => void
    winCallback?: (score: number) => void
    loseCallback?: (score: number) => void
    clickCallback?: () => void
    dropCallback?: () => void
    // allow extra custom events
    [k: string]: any
  }
}

export interface CardNode {
  id: string
  type: number
  state: number // 1: normal, 2: selected, 3: removed
  row: number
  column: number
  top: number
  left: number
  zIndex: number
}

export interface Game {
  nodes: import('vue').Ref<CardNode[]>
  selectedNodes: import('vue').Ref<CardNode[]>
  removeList: import('vue').Ref<CardNode[]>
  removeFlag: import('vue').Ref<boolean>
  backFlag: import('vue').Ref<boolean>
  score: import('vue').Ref<number>
  isGameOver: import('vue').Ref<boolean>
  isPaused: import('vue').Ref<boolean>
  isSoundEnabled: import('vue').Ref<boolean>
  handleSelect: (n: CardNode) => void
  handleSelectRemove: (n: CardNode) => void
  handleBack: () => void
  handleRemove: () => void
  pause: () => void
  resume: () => void
  togglePause: () => void
  toggleSound: () => void
  restart: () => void
  setVolume?: (v: number) => void
  getVolume?: () => number
  initData: (config?: GameConfig) => void
}