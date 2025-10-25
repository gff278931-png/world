import { ref } from 'vue'
import { random } from 'lodash-es'
import bridge from '../world/bridge'

const defaultGameConfig: GameConfig = {
  cardNum: 5,
  gridSize: { rows: 8, cols: 8 },
  minMatch: 3,
  delNode: false,
}

export function useGame(config: GameConfig): Game {
  const { container, delNode, sound = true, events = {}, ...initConfig } = { ...defaultGameConfig, ...config }

  const nodes = ref<CardNode[]>([])
  const selectedNodes = ref<CardNode[]>([])
  const removeList = ref<CardNode[]>([])
  const removeFlag = ref(false)
  const backFlag = ref(false)
  const score = ref(0)
  const isGameOver = ref(false)
  const isPaused = ref(false)
  const isSoundEnabled = ref(sound)
  const volume = ref(1)
  const size = 40
  const grid = ref<CardNode[][]>([])
  const selectedCard = ref<CardNode | null>(null)
  const animationInProgress = ref(false)

  const sounds: Record<string, HTMLAudioElement> = {
    match: new Audio('/assets/audio/match.mp3'),
    win: new Audio('/assets/audio/win.mp3'),
    lose: new Audio('/assets/audio/lose.mp3'),
    select: new Audio('/assets/audio/select.mp3'),
  }

  // ensure audio elements follow volume state
  Object.values(sounds).forEach(s => { s.volume = volume.value })

  // handle volume control from bridge (host)
  bridge.onVolumeChange?.((v: number) => {
    setVolume(v)
  })

  function playSound(key: keyof typeof sounds) {
    if (!isSoundEnabled.value) return
    const s = sounds[key]
    if (!s) return
    s.currentTime = 0
    s.play().catch(() => {})
  }

  const ANIMATION_DURATION = {
    REMOVE: 300,
    DROP: 300,
    NEW_CARD: 200,
  }

  // helpers
  function isAdjacent(card1: CardNode, card2: CardNode): boolean {
    return (Math.abs(card1.row - card2.row) === 1 && card1.column === card2.column) ||
      (Math.abs(card1.column - card2.column) === 1 && card1.row === card2.row)
  }

  function swapCards(card1: CardNode, card2: CardNode) {
    const r1 = card1.row
    const c1 = card1.column
    const top1 = card1.top
    const left1 = card1.left

    card1.row = card2.row
    card1.column = card2.column
    card1.top = card2.top
    card1.left = card2.left

    card2.row = r1
    card2.column = c1
    card2.top = top1
    card2.left = left1

    grid.value[card1.row][card1.column] = card1
    grid.value[card2.row][card2.column] = card2
  }

  function findMatches(): CardNode[][] {
    const matches: CardNode[][] = []
    const { minMatch = 3 } = initConfig

    if (!grid.value || grid.value.length === 0) return matches

    // horizontal
    for (let row = 0; row < grid.value.length; row++) {
      let currentType = -1
      let currentMatch: CardNode[] = []
      for (let col = 0; col < grid.value[row].length; col++) {
        const card = grid.value[row][col]
        if (!card) continue
        if (card.type === currentType) {
          currentMatch.push(card)
        } else {
          if (currentMatch.length >= minMatch) matches.push([...currentMatch])
          currentMatch = [card]
          currentType = card.type
        }
      }
      if (currentMatch.length >= minMatch) matches.push([...currentMatch])
    }

    // vertical
    for (let col = 0; col < grid.value[0].length; col++) {
      let currentType = -1
      let currentMatch: CardNode[] = []
      for (let row = 0; row < grid.value.length; row++) {
        const card = grid.value[row][col]
        if (!card) continue
        if (card.type === currentType) {
          currentMatch.push(card)
        } else {
          if (currentMatch.length >= minMatch) matches.push([...currentMatch])
          currentMatch = [card]
          currentType = card.type
        }
      }
      if (currentMatch.length >= minMatch) matches.push([...currentMatch])
    }

    return matches
  }

  function isAllCleared(): boolean {
    return grid.value.flat().every((c) => c.state === 3)
  }

  function removeMatches(matches: CardNode[][]) {
    if (!matches || matches.length === 0) return

    // compute score per group
    let matchScore = 0
    matches.forEach(group => {
      const len = group.length
      matchScore += len + Math.max(0, len - 3)
    })

    score.value += matchScore
    events.scoreCallback?.(score.value)

    playSound('match')

    const totalMatches = matches.flat()
    totalMatches.forEach(card => {
      card.state = 3
      card.removeTime = Date.now()
      removeList.value.push(card)
    })

    // if everything cleared -> win
    if (isAllCleared()) {
      isGameOver.value = true
      playSound('win')
      events.winCallback?.(score.value)
      return
    }

    // wait for remove animation then fill
    setTimeout(() => {
      fillEmptySpaces()
    }, ANIMATION_DURATION.REMOVE)
  }

  function fillEmptySpaces() {
    animationInProgress.value = true

    const rows = grid.value.length
    const cols = grid.value[0].length

    for (let col = 0; col < cols; col++) {
      let writeRow = rows - 1
      for (let row = rows - 1; row >= 0; row--) {
        const card = grid.value[row][col]
        if (card && card.state !== 3) {
          if (writeRow !== row) {
            grid.value[writeRow][col] = card
            grid.value[writeRow][col].row = writeRow
            grid.value[writeRow][col].top = writeRow * size
          }
          writeRow--
        }
      }
      // fill remaining with new cards
      for (let r = writeRow; r >= 0; r--) {
        const newCard = createNewCard(r, col)
        newCard.isNew = true
        newCard.top = -size
        grid.value[r][col] = newCard
      }
    }

    // wait for drop animation
    setTimeout(() => {
      // settle new cards
      grid.value.flat().forEach(card => {
        card.top = card.row * size
        card.isNew = false
      })

      // after new cards settled, check possible moves
      setTimeout(() => {
        animationInProgress.value = false
        const hasMoves = checkPossibleMoves()
        if (!hasMoves && !isGameOver.value) {
          // no possible moves -> game over (lose)
          isGameOver.value = true
          playSound('lose')
          events.loseCallback?.(score.value)
        }
      }, ANIMATION_DURATION.NEW_CARD)
    }, ANIMATION_DURATION.DROP)
  }

  function checkPossibleMoves(): boolean {
    const rows = grid.value.length
    const cols = grid.value[0].length

    // horizontal swaps
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols - 1; c++) {
        // swap
        const a = grid.value[r][c]
        const b = grid.value[r][c + 1]
        grid.value[r][c] = b
        grid.value[r][c + 1] = a
        const matches = findMatches()
        // swap back
        grid.value[r][c + 1] = b
        grid.value[r][c] = a
        if (matches.length > 0) return true
      }
    }

    // vertical swaps
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols; c++) {
        const a = grid.value[r][c]
        const b = grid.value[r + 1][c]
        grid.value[r][c] = b
        grid.value[r + 1][c] = a
        const matches = findMatches()
        grid.value[r + 1][c] = b
        grid.value[r][c] = a
        if (matches.length > 0) return true
      }
    }

    return false
  }

  function createNewCard(row: number, col: number): CardNode {
    const { cardNum } = initConfig
    return {
      id: `${row}-${col}-${Date.now()}`,
      type: Math.floor(random() * cardNum),
      row,
      column: col,
      top: row * size,
      left: col * size,
      state: 1,
      zIndex: 0,
      index: row * grid.value[0].length + col,
      parents: [],
      dropDistance: 0,
      isNew: false,
    }
  }

  function handleSelect(node: CardNode) {
    if (animationInProgress.value || isGameOver.value || isPaused.value) return

    if (node.state === 1) playSound('select')

    if (selectedCard.value === null) {
      selectedCard.value = node
      node.state = 2
      return
    }

    // second selection
    if (isAdjacent(selectedCard.value, node)) {
      swapCards(selectedCard.value, node)
      const matches = findMatches()
      if (matches.length > 0) {
        removeMatches(matches)
      } else {
        // swap back
        swapCards(node, selectedCard.value)
      }
      selectedCard.value.state = 1
      selectedCard.value = null
    } else {
      // change selection
      selectedCard.value.state = 1
      selectedCard.value = node
      node.state = 2
    }

    events.clickCallback?.()
  }

  function handleSelectRemove(node: CardNode) {
    const index = removeList.value.findIndex(o => o.id === node.id)
    if (index > -1) removeList.value.splice(index, 1)
    handleSelect(node)
  }

  function handleBack() {
    if (selectedCard.value) {
      selectedCard.value.state = 1
      selectedCard.value = null
      backFlag.value = true
    }
  }

  function handleRemove() {
    return
  }

  function initData(config?: GameConfig) {
    const { cardNum, gridSize } = { ...initConfig, ...config }
    const { rows, cols } = gridSize

    removeFlag.value = false
    backFlag.value = false
    removeList.value = []
    selectedNodes.value = []
    nodes.value = []
    selectedCard.value = null
    score.value = 0
    isGameOver.value = false
    isPaused.value = false
    animationInProgress.value = false

    grid.value = Array(rows)
      .fill(null)
      .map((_, r) => Array(cols).fill(null).map((_, c) => createNewCard(r, c)))

    nodes.value = grid.value.flat()

    // remove any initial matches
    let initialMatches = findMatches()
    while (initialMatches.length > 0) {
      removeMatches(initialMatches)
      // after remove we fill; but to avoid complex timing in init, just break
      break
    }

    updateState()
  }

  function updateState() {
    nodes.value.forEach((node) => {
      node.state = node.state === 3 ? 3 : 1
    })
  }

  // start game
  initData(config)

  // rAF loop management for pause/resume
  let rafId: number | null = null
  function animationLoop() {
    rafId = requestAnimationFrame(() => {
      // placeholder for per-frame logic
      animationLoop()
    })
  }

  function pause() {
    if (isGameOver.value) return
    isPaused.value = true
    if (rafId != null) {
      cancelAnimationFrame(rafId)
      rafId = null
    }
  }

  function resume() {
    if (isGameOver.value) return
    if (!isPaused.value) return
    isPaused.value = false
    if (rafId == null) animationLoop()
  }

  function togglePause() {
    if (isPaused.value) resume()
    else pause()
  }

  function toggleSound() {
    isSoundEnabled.value = !isSoundEnabled.value
  }

  function setVolume(v: number) {
    volume.value = Math.max(0, Math.min(1, v))
    Object.values(sounds).forEach(s => { s.volume = volume.value })
    isSoundEnabled.value = volume.value > 0
  }

  function getVolume() {
    return volume.value
  }

  function restart() {
    initData(config)
    playSound('select')
    if (rafId == null && !isPaused.value) animationLoop()
  }

  return {
    nodes,
    selectedNodes,
    removeList,
    removeFlag,
    backFlag,
    score,
    isGameOver,
    isPaused,
    isSoundEnabled,
    handleSelect,
    handleSelectRemove,
    handleBack,
    handleRemove,
    pause,
    resume,
    togglePause,
    toggleSound,
    restart,
    setVolume,
    getVolume,
    initData,
  }
}