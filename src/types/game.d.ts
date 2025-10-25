export interface GameConfig {
  cardNum?: number
  gridSize?: {
    rows: number
    cols: number
  }
  minMatch?: number
  delNode?: boolean
  sound?: boolean
  container?: HTMLElement
  events?: {
    scoreCallback?: (score: number) => void
    winCallback?: (score: number) => void
    loseCallback?: (score: number) => void
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