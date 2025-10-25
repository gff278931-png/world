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