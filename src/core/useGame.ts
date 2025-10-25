import { computed, ref } from 'vue'
import bridge from '../world/bridge'
import ASSETS, { type AssetsManifest } from './assets'
import { getActiveManifest } from './loader'
import LEVELS from './levels'
import type { LevelDefinition } from '../types/game'

const defaultGameConfig: GameConfig = {
  cardNum: 5,
  gridSize: { rows: 8, cols: 8 },
  minMatch: 3,
  delNode: false,
}

const fallbackGridSize = defaultGameConfig.gridSize ?? { rows: 8, cols: 8 }
const HINT_CLEAR_DELAY = 1800
const TILE_SIZE = 40

type LoseReason = 'time' | 'moves' | 'nomoves'

const SOUND_KEYS = ['match', 'win', 'lose', 'select'] as const
type SoundKey = typeof SOUND_KEYS[number]

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function coerceLevel(level: LevelDefinition, idx: number): LevelDefinition {
  return {
    ...level,
    id: level.id ?? idx + 1,
    cardKinds: Math.max(1, Math.floor(level.cardKinds)),
    minMatch: Math.max(3, Math.floor(level.minMatch)),
    trapRate: clamp(level.trapRate ?? 0, 0, 0.9),
    timeLimit: typeof level.timeLimit === 'number' ? Math.max(0, Math.floor(level.timeLimit)) : undefined,
    moveLimit: typeof level.moveLimit === 'number' ? Math.max(0, Math.floor(level.moveLimit)) : undefined,
    targetScore: Math.max(0, Math.floor(level.targetScore)),
    shuffles: Math.max(0, Math.floor(level.shuffles)),
    hints: Math.max(0, Math.floor(level.hints)),
    comboBonus: Math.max(0, level.comboBonus ?? 0),
  }
}

export function useGame(config: GameConfig): Game {
  const baseConfig = { ...defaultGameConfig, ...config }
  const _container = baseConfig.container
  const _delNode = baseConfig.delNode
  const sound = baseConfig.sound ?? true
  const events = baseConfig.events ?? {}

  const manifest: AssetsManifest = getActiveManifest()
  const fallbackCards = [...ASSETS.images.cards]
  const fallbackCards2x = [...ASSETS.images.cards2x]

  const levelSource = baseConfig.levels && baseConfig.levels.length > 0 ? baseConfig.levels : LEVELS
  const levels = levelSource.length > 0
    ? levelSource.map((lvl, idx) => coerceLevel(lvl, idx))
    : [coerceLevel({
      id: 1,
      name: '默认关卡',
      gridSize: baseConfig.gridSize ?? fallbackGridSize,
      cardKinds: baseConfig.cardNum ?? fallbackCards.length,
      minMatch: baseConfig.minMatch ?? 3,
      trapRate: 0,
      targetScore: 500,
      shuffles: 2,
      hints: 2,
      comboBonus: 0.1,
    }, 0)]

  const levelIndex = ref(clamp(baseConfig.levelIndex ?? 0, 0, Math.max(levels.length - 1, 0)))
  const currentLevel = computed<LevelDefinition>(() => levels[levelIndex.value] ?? levels[levels.length - 1])
  const targetScore = computed(() => currentLevel.value.targetScore)

  const nodes = ref<CardNode[]>([])
  const selectedNodes = ref<CardNode[]>([])
  const removeList = ref<CardNode[]>([])
  const removeFlag = ref(false)
  const backFlag = ref(false)
  const score = ref(0)
  const levelScore = ref(0)
  const isGameOver = ref(false)
  const lastResult = ref<'win' | 'lose' | null>(null)
  const isPaused = ref(false)
  const isSoundEnabled = ref(sound)
  const comboStreak = ref(0)
  const comboBonus = ref(0)
  const remainingTime = ref<number | null>(null)
  const remainingMoves = ref<number | null>(null)
  const shufflesLeft = ref(0)
  const hintsLeft = ref(0)

  const volume = ref(1)
  const grid = ref<CardNode[][]>([])
  const selectedCard = ref<CardNode | null>(null)
  const animationInProgress = ref(false)

  const sounds: Record<SoundKey, HTMLAudioElement> = SOUND_KEYS.reduce((acc, key) => {
    const source = manifest.audio[key] || ASSETS.audio[key]
    const audio = new Audio(source)
    audio.preload = 'auto'
    audio.volume = volume.value
    acc[key] = audio
    return acc
  }, {} as Record<SoundKey, HTMLAudioElement>)

  Object.values(sounds).forEach(s => { s.volume = volume.value })

  bridge.onVolumeChange?.((v: number) => setVolume(v))

  let timerId: number | null = null
  let hintTimerId: number | null = null
  let totalScoreCheckpoint = 0
  let activeGridSize: { rows: number; cols: number } = baseConfig.gridSize
    ? { rows: baseConfig.gridSize.rows, cols: baseConfig.gridSize.cols }
    : { rows: fallbackGridSize.rows, cols: fallbackGridSize.cols }
  let activeCardNum = Math.max(1, baseConfig.cardNum ?? fallbackCards.length)
  let activeMinMatch = baseConfig.minMatch ?? 3
  let activeTrapRate = clamp(baseConfig.trap ? 0.05 : 0, 0, 0.9)

  const manifestCards = Array.isArray(manifest.images.cards) && manifest.images.cards.length
    ? manifest.images.cards
    : fallbackCards

  const manifestCards2x = Array.isArray(manifest.images.cards2x) && manifest.images.cards2x.length
    ? manifest.images.cards2x
    : fallbackCards2x

  function playSound(key: SoundKey) {
    if (!isSoundEnabled.value) return
    const snd = sounds[key]
    if (!snd) return
    snd.currentTime = 0
    snd.play().catch(() => {})
  }

  function setVolume(v: number) {
    volume.value = clamp(v, 0, 1)
    Object.values(sounds).forEach(s => { s.volume = volume.value })
    isSoundEnabled.value = volume.value > 0
  }

  function stopTimer() {
    if (timerId != null) {
      clearInterval(timerId)
      timerId = null
    }
  }

  function startTimer() {
    if (remainingTime.value == null || timerId != null) return
    timerId = window.setInterval(() => {
      if (isPaused.value || isGameOver.value || remainingTime.value == null) return
      if (remainingTime.value > 0) {
        remainingTime.value -= 1
        if (remainingTime.value <= 0) {
          remainingTime.value = 0
          handleLose('time')
        }
      }
    }, 1000)
  }

  function clearHintHighlights() {
    if (hintTimerId != null) {
      clearTimeout(hintTimerId)
      hintTimerId = null
    }
    nodes.value.forEach(card => {
      if (card.isHinted) card.isHinted = false
    })
  }

  function scheduleHintClear(cards: CardNode[]) {
    if (cards.length === 0) return
    if (hintTimerId != null) clearTimeout(hintTimerId)
    hintTimerId = window.setTimeout(() => {
      cards.forEach(card => { card.isHinted = false })
      hintTimerId = null
    }, HINT_CLEAR_DELAY)
  }

  function applyLevel(index: number, options?: { resetTotal?: boolean }) {
    const safeIndex = clamp(index, 0, levels.length - 1)
    levelIndex.value = safeIndex
    const level = levels[safeIndex]

    activeGridSize = { rows: level.gridSize.rows, cols: level.gridSize.cols }
    activeCardNum = Math.max(1, level.cardKinds)
    activeMinMatch = Math.max(3, level.minMatch)
    activeTrapRate = clamp(level.trapRate ?? 0, 0, 0.9)
    comboBonus.value = level.comboBonus ?? 0
    remainingTime.value = level.timeLimit ?? null
    remainingMoves.value = level.moveLimit ?? null
    shufflesLeft.value = level.shuffles
    hintsLeft.value = level.hints
    comboStreak.value = 0
    levelScore.value = 0
    lastResult.value = null
    isGameOver.value = false
    animationInProgress.value = false
    selectedCard.value = null
    removeList.value = []
    removeFlag.value = false
    backFlag.value = false
    clearHintHighlights()
    stopTimer()
    if (options?.resetTotal) {
      score.value = 0
    } else {
      score.value = totalScoreCheckpoint
    }
    totalScoreCheckpoint = score.value
    events.levelChangeCallback?.({ level, index: safeIndex })
    initData()
    if (!isPaused.value) startTimer()
  }

  function consumeMove() {
    if (remainingMoves.value == null || isGameOver.value) return
    if (remainingMoves.value > 0) {
      remainingMoves.value -= 1
      if (remainingMoves.value === 0) {
        maybeEndDueToLimits()
      }
    } else {
      maybeEndDueToLimits()
    }
  }

  function maybeEndDueToLimits() {
    if (isGameOver.value) return
    if (remainingMoves.value === 0 && levelScore.value < targetScore.value) {
      handleLose('moves')
    }
  }

  function scoringPayload(matches: CardNode[][]) {
    const cardsMatched = matches.reduce((acc, group) => acc + group.length, 0)
    const base = cardsMatched * 10
    const currentCombo = comboStreak.value
    const multiplier = 1 + currentCombo * comboBonus.value
    const containsTrap = matches.some(group => group.some(card => card.isTrap))

    let gained = Math.round(base * multiplier)
    if (containsTrap) {
      gained = Math.round(gained * 0.5)
      comboStreak.value = 0
    } else {
      comboStreak.value += 1
    }

    levelScore.value += gained
    score.value += gained
    events.scoreCallback?.(score.value, {
      levelScore: levelScore.value,
      gained,
      base,
      combo: currentCombo,
      multiplier,
      containsTrap,
      target: targetScore.value,
    })
    return { gained, base, currentCombo, multiplier, containsTrap }
  }

  function handleWin() {
    if (isGameOver.value) return
    isGameOver.value = true
    lastResult.value = 'win'
    stopTimer()
    playSound('win')
    const level = currentLevel.value
    events.winCallback?.(score.value, {
      level,
      levelScore: levelScore.value,
      targetScore: targetScore.value,
      remainingTime: remainingTime.value,
      remainingMoves: remainingMoves.value,
    })
    bridge.postScore({
      score: score.value,
      level: level?.id,
      result: 'win',
      levelScore: levelScore.value,
      targetScore: targetScore.value,
      movesLeft: remainingMoves.value ?? undefined,
      timeLeft: remainingTime.value ?? undefined,
    }).catch((err) => {
      console.warn('[bridge] postScore error', err)
    })
  }

  function handleLose(reason: LoseReason) {
    if (isGameOver.value) return
    isGameOver.value = true
    lastResult.value = 'lose'
    stopTimer()
    playSound('lose')
    // rollback to level start total
    score.value = totalScoreCheckpoint
    events.loseCallback?.(score.value, {
      level: currentLevel.value,
      reason,
      levelScore: levelScore.value,
      targetScore: targetScore.value,
    })
    bridge.postScore({
      score: score.value,
      level: currentLevel.value?.id,
      result: 'lose',
      reason,
      levelScore: levelScore.value,
      targetScore: targetScore.value,
      movesLeft: remainingMoves.value ?? undefined,
      timeLeft: remainingTime.value ?? undefined,
    }).catch((err) => {
      console.warn('[bridge] postScore error', err)
    })
  }

  function isAdjacent(card1: CardNode, card2: CardNode): boolean {
    return (Math.abs(card1.row - card2.row) === 1 && card1.column === card2.column) ||
      (Math.abs(card1.column - card2.column) === 1 && card1.row === card2.row)
  }

  function swapCards(card1: CardNode, card2: CardNode) {
    const row1 = card1.row
    const col1 = card1.column
    const top1 = card1.top
    const left1 = card1.left

    card1.row = card2.row
    card1.column = card2.column
    card1.top = card2.top
    card1.left = card2.left

    card2.row = row1
    card2.column = col1
    card2.top = top1
    card2.left = left1

    grid.value[card1.row][card1.column] = card1
    grid.value[card2.row][card2.column] = card2
  }

  function findMatches(): CardNode[][] {
    const matches: CardNode[][] = []
    if (!grid.value || grid.value.length === 0) return matches

    const rows = grid.value.length
    const cols = grid.value[0].length
    const minMatch = Math.max(3, activeMinMatch)

    for (let r = 0; r < rows; r++) {
      let currentType = -1
      let currentMatch: CardNode[] = []
      for (let c = 0; c < cols; c++) {
        const card = grid.value[r][c]
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

    for (let c = 0; c < cols; c++) {
      let currentType = -1
      let currentMatch: CardNode[] = []
      for (let r = 0; r < rows; r++) {
        const card = grid.value[r][c]
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

  function detectSwapMatch(r1: number, c1: number, r2: number, c2: number): CardNode[][] {
    const a = grid.value[r1][c1]
    const b = grid.value[r2][c2]
    if (!a || !b) return []
    swapCards(a, b)
    const matches = findMatches()
    swapCards(a, b)
    return matches
  }

  function findHintPair(): [CardNode, CardNode] | null {
    if (!grid.value.length) return null
    const rows = grid.value.length
    const cols = grid.value[0].length

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (c + 1 < cols) {
          const horizontalMatches = detectSwapMatch(r, c, r, c + 1)
          if (horizontalMatches.length > 0) return [grid.value[r][c], grid.value[r][c + 1]]
        }
        if (r + 1 < rows) {
          const verticalMatches = detectSwapMatch(r, c, r + 1, c)
          if (verticalMatches.length > 0) return [grid.value[r][c], grid.value[r + 1][c]]
        }
      }
    }
    return null
  }

  function checkPossibleMoves(): boolean {
    return findHintPair() !== null
  }

  function createNewCard(row: number, col: number): CardNode {
    const availableSprites = manifestCards.length ? manifestCards : fallbackCards
    const availableSprites2x = manifestCards2x.length ? manifestCards2x : fallbackCards2x.length ? fallbackCards2x : availableSprites

    const poolSize = Math.max(1, Math.min(activeCardNum, availableSprites.length))
    const type = Math.floor(Math.random() * poolSize)
    const sprite = availableSprites[type] ?? availableSprites[type % availableSprites.length] ?? availableSprites[0]
    const sprite2x = availableSprites2x[type] ?? availableSprites2x[type % availableSprites2x.length] ?? sprite
    const isTrap = Math.random() < activeTrapRate

    return {
      id: `${row}-${col}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      type,
      sprite,
      sprite2x,
      isTrap,
      isHinted: false,
      row,
      column: col,
      top: row * TILE_SIZE,
      left: col * TILE_SIZE,
      state: 1,
      zIndex: 0,
      index: row * activeGridSize.cols + col,
      parents: [],
      dropDistance: 0,
      isNew: false,
    }
  }

  function updateState() {
    nodes.value.forEach((node) => {
      if (node.state !== 3) node.state = 1
    })
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
            card.row = writeRow
            card.top = writeRow * TILE_SIZE
          }
          writeRow--
        }
      }

      for (let r = writeRow; r >= 0; r--) {
        const newCard = createNewCard(r, col)
        newCard.isNew = true
        newCard.top = -TILE_SIZE
        grid.value[r][col] = newCard
      }
    }

    setTimeout(() => {
      grid.value.flat().forEach(card => {
        card.top = card.row * TILE_SIZE
        card.isNew = false
      })

      setTimeout(() => {
        animationInProgress.value = false
        nodes.value = grid.value.flat()
        updateState()
        if (!checkPossibleMoves()) {
          handleLose('nomoves')
        } else {
          maybeEndDueToLimits()
        }
      }, 200)
    }, 300)
  }

  function removeMatches(matches: CardNode[][]) {
    if (!matches.length) return

    const scoreMeta = scoringPayload(matches)
    matches.flat().forEach(card => {
      card.state = 3
      card.removeTime = Date.now()
      removeList.value.push(card)
    })

    if (levelScore.value >= targetScore.value) {
      handleWin()
      return
    }

    if (scoreMeta.containsTrap) {
      playSound('lose')
    } else {
      playSound('match')
    }

    setTimeout(() => {
      fillEmptySpaces()
    }, 300)
  }

  function handleSelect(node: CardNode) {
    if (animationInProgress.value || isGameOver.value || isPaused.value) return
    if (node.state === 3) return
    clearHintHighlights()

    if (node.state === 1) playSound('select')

    if (selectedCard.value === null) {
      selectedCard.value = node
      node.state = 2
      events.clickCallback?.()
      return
    }

    if (selectedCard.value === node) return

    if (isAdjacent(selectedCard.value, node)) {
      consumeMove()
      swapCards(selectedCard.value, node)
      const matches = findMatches()
      if (matches.length > 0) {
        removeMatches(matches)
      } else {
        swapCards(node, selectedCard.value)
        comboStreak.value = 0
      }
      if (selectedCard.value) selectedCard.value.state = 1
      selectedCard.value = null
    } else {
      if (selectedCard.value) selectedCard.value.state = 1
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
    // reserved for future power-up
  }

  function initData() {
    const { rows, cols } = activeGridSize

    removeFlag.value = false
    backFlag.value = false
    removeList.value = []
    selectedNodes.value = []
    nodes.value = []
    selectedCard.value = null
    isGameOver.value = false
    isPaused.value = false
    animationInProgress.value = false
    comboStreak.value = 0

    grid.value = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => createNewCard(r, c)),
    )
    nodes.value = grid.value.flat()

    const initialMatches = findMatches()
    if (initialMatches.length > 0) {
      removeMatches(initialMatches)
    } else {
      updateState()
    }
  }

  function pause() {
    if (isGameOver.value) return
    isPaused.value = true
    stopTimer()
  }

  function resume() {
    if (isGameOver.value || !isPaused.value) return
    isPaused.value = false
    startTimer()
  }

  function togglePause() {
    if (isPaused.value) resume()
    else pause()
  }

  function toggleSound() {
    isSoundEnabled.value = !isSoundEnabled.value
    volume.value = isSoundEnabled.value ? volume.value || 1 : 0
    Object.values(sounds).forEach(s => { s.volume = volume.value })
  }

  function restart() {
    retryLevel()
  }

  function retryLevel() {
    applyLevel(levelIndex.value, { resetTotal: false })
  }

  function nextLevel() {
    if (levelIndex.value >= levels.length - 1) {
      // final level replay
      applyLevel(levelIndex.value, { resetTotal: false })
    } else {
      applyLevel(levelIndex.value + 1, { resetTotal: false })
    }
  }

  function useShuffle() {
    if (shufflesLeft.value <= 0 || animationInProgress.value || isGameOver.value) return
    shufflesLeft.value -= 1
    comboStreak.value = 0

    const cards = grid.value.flat().filter(card => card.state !== 3)
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[cards[i], cards[j]] = [cards[j], cards[i]]
    }

    let idx = 0
    for (let r = 0; r < grid.value.length; r++) {
      for (let c = 0; c < grid.value[r].length; c++) {
        const card = cards[idx++]
        card.row = r
        card.column = c
        card.left = c * TILE_SIZE
        card.top = r * TILE_SIZE
        grid.value[r][c] = card
      }
    }
    nodes.value = grid.value.flat()
    events.shuffleCallback?.({ shufflesLeft: shufflesLeft.value })
    if (!checkPossibleMoves()) handleLose('nomoves')
  }

  function useHint() {
    if (hintsLeft.value <= 0 || isGameOver.value) return
    const pair = findHintPair()
    if (!pair) {
      handleLose('nomoves')
      return
    }
    hintsLeft.value -= 1
    clearHintHighlights()
    pair.forEach(card => { card.isHinted = true })
    scheduleHintClear(pair)
    events.hintCallback?.({ hintsLeft: hintsLeft.value })
  }

  function getVolumeRef() {
    return volume.value
  }

  applyLevel(levelIndex.value, { resetTotal: true })

  return {
    nodes,
    selectedNodes,
    removeList,
    removeFlag,
    backFlag,
    score,
    levelScore,
    levelIndex,
    currentLevel,
    levels,
    targetScore,
    comboStreak,
    comboBonus,
    remainingTime,
    remainingMoves,
    shufflesLeft,
    hintsLeft,
    lastResult,
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
    retryLevel,
    nextLevel,
    useShuffle,
    useHint,
    setVolume,
    getVolume: getVolumeRef,
    initData,
  }
}
