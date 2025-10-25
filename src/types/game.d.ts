export interface LevelDefinition {
  id: number
  name?: string
  gridSize: {
    rows: number
    cols: number
  }
  cardKinds: number
  minMatch: number
  trapRate: number
  timeLimit?: number
  moveLimit?: number
  targetScore: number
  shuffles: number
  hints: number
  comboBonus: number
}

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
  levelIndex?: number
  levels?: LevelDefinition[]
  container?: HTMLElement
  events?: {
    scoreCallback?: (score: number, payload?: any) => void
    winCallback?: (score: number, payload?: any) => void
    loseCallback?: (score: number, payload?: any) => void
    clickCallback?: () => void
    dropCallback?: () => void
    levelChangeCallback?: (payload: { level: LevelDefinition; index: number }) => void
    shuffleCallback?: (payload: { shufflesLeft: number }) => void
    hintCallback?: (payload: { hintsLeft: number }) => void
    [k: string]: any
  }
}

export interface CardNode {
  id: string
  type: number
  state: number // 1: normal, 2: selected, 3: removed
  sprite?: string
  sprite2x?: string
  isTrap?: boolean
  isHinted?: boolean
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
  levelScore: import('vue').Ref<number>
  levelIndex: import('vue').Ref<number>
  currentLevel: import('vue').ComputedRef<LevelDefinition>
  levels: LevelDefinition[]
  targetScore: import('vue').ComputedRef<number>
  comboStreak: import('vue').Ref<number>
  comboBonus: import('vue').Ref<number>
  remainingTime: import('vue').Ref<number | null>
  remainingMoves: import('vue').Ref<number | null>
  shufflesLeft: import('vue').Ref<number>
  hintsLeft: import('vue').Ref<number>
  lastResult: import('vue').Ref<'win' | 'lose' | null>
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
  retryLevel: () => void
  nextLevel: () => void
  useShuffle: () => void
  useHint: () => void
  setVolume?: (v: number) => void
  getVolume?: () => number
  initData: (config?: GameConfig) => void
}
