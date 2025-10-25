<template>
  <div class="game-container">
    <div class="control-panel">
      <div
        v-if="loadInProgress"
        class="load-status"
      >
        加载资源: {{ loadProgress }}% / {{ loadTotal }}
        <span v-if="loadFailed"> · 失败 {{ loadFailed }}</span>
      </div>
      <div v-if="loadFailed" class="load-warning">部分资源加载失败，将使用占位图</div>

      <div class="level-header">
        <div class="level-title">
          第 {{ game.levelIndex + 1 }} 关 · {{ levelName }}
        </div>
        <div class="level-progress" :class="{ pulse: scorePulse }">
          <div class="progress-bar">
            <div
              class="progress-bar__fill"
              :style="{ width: `${levelProgress}%` }"
            />
          </div>
          <span>{{ game.levelScore }} / {{ game.targetScore }}</span>
        </div>
      </div>

      <div class="stat-grid">
        <div class="stat-item">
          <label>总分</label>
          <span>
            {{ game.score }}
            <transition name="fade">
              <small v-if="lastGain > 0" class="gain">+{{ lastGain }}</small>
            </transition>
          </span>
        </div>
        <div class="stat-item">
          <label>{{ limitLabel }}</label>
          <span>{{ limitDisplay }}</span>
        </div>
        <div class="stat-item">
          <label>目标分</label>
          <span>{{ game.targetScore }}</span>
        </div>
        <div class="stat-item">
          <label>连击</label>
          <span>{{ comboStatus }}</span>
        </div>
        <div class="stat-item">
          <label>洗牌剩余</label>
          <span>{{ game.shufflesLeft }}</span>
        </div>
        <div class="stat-item">
          <label>提示剩余</label>
          <span>{{ game.hintsLeft }}</span>
        </div>
      </div>

      <div class="actions">
        <button class="control-btn" @click="togglePause">
          {{ game.isPaused ? '继续' : '暂停' }}
        </button>
        <button class="control-btn" @click="game.toggleSound()">
          {{ game.isSoundEnabled ? '🔊' : '🔈' }}
        </button>
        <button
          class="control-btn"
          :disabled="game.shufflesLeft === 0"
          @click="handleShuffle"
        >
          洗牌 ({{ game.shufflesLeft }})
        </button>
        <button
          class="control-btn"
          :disabled="game.hintsLeft === 0"
          @click="handleHint"
        >
          提示 ({{ game.hintsLeft }})
        </button>
        <button class="control-btn" @click="restartGame">
          重开本关
        </button>
      </div>
    </div>

    <div
      class="game-board"
      ref="gameBoardRef"
      :class="{ paused: game.isPaused }"
      :style="boardStyle"
    >
      <template v-for="node in game.nodes" :key="node.id">
        <div
          class="card"
          :class="{
            selected: node.state === 2,
            removed: node.state === 3,
            hinted: node.isHinted,
            trap: node.isTrap,
          }"
          :style="{
            left: `${node.left}px`,
            top: `${node.top}px`,
            zIndex: node.zIndex,
            opacity: node.state === 3 ? 0 : 1,
          }"
          @click="handleCardClick(node)"
        >
          <img
            class="card-img"
            :src="node.sprite || placeholder"
            :srcset="node.sprite2x ? `${node.sprite2x} 2x` : undefined"
            draggable="false"
            alt="card"
          >
          <div v-if="node.isTrap" class="trap-badge">陷阱</div>
        </div>
      </template>
    </div>

    <transition name="fade">
      <div v-if="game.isGameOver" class="game-modal">
        <div class="modal-content">
          <h2>{{ modalTitle }}</h2>
          <p class="modal-score">关卡得分：{{ game.levelScore }} / {{ game.targetScore }}</p>
          <p class="modal-total">总分：{{ game.score }}</p>
          <div class="modal-actions">
            <button v-if="game.lastResult === 'lose'" @click="handleRetry">重试本关</button>
            <button v-if="game.lastResult === 'win' && !isFinalLevel" @click="handleNextLevel">
              下一关
            </button>
            <button v-if="game.lastResult === 'win' && isFinalLevel" @click="handleRetry">
              再挑战一次
            </button>
          </div>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import bridge from '../world/bridge'
import loader, { type PreloadSummary } from '../core/loader'
import { useGame } from '../core/useGame'
import ASSETS from '../core/assets'

const TILE_SIZE = 40
const placeholder = ASSETS.images.ui.placeholder || '/assets/ui/placeholder.webp'

const gameBoardRef = ref<HTMLElement | null>(null)
const loadProgress = ref(0)
const loadTotal = ref(0)
const loadFailed = ref(0)
const scorePulse = ref(false)
const lastGain = ref(0)
let scoreTimer: number | null = null

const loadInProgress = computed(() => loadProgress.value < 100 || loadFailed.value > 0)

const handleProgress = ({ total, percent }: { loaded: number; total: number; percent: number }) => {
  loadProgress.value = Math.round(percent * 100)
  loadTotal.value = total
}

let preloadResult: PreloadSummary | undefined
try {
  preloadResult = await loader.preloadFromUrl('/assets/manifest.json', { onProgress: handleProgress })
} catch {
  preloadResult = await loader.preloadAll({ onProgress: handleProgress })
}

loadFailed.value = preloadResult?.failed ?? 0

const game = useGame({
  events: {
    scoreCallback: (_total: number, payload?: { gained?: number }) => {
      if (scoreTimer != null) {
        clearTimeout(scoreTimer)
        scoreTimer = null
      }
      scorePulse.value = true
      lastGain.value = payload?.gained ?? 0
      scoreTimer = window.setTimeout(() => {
        scorePulse.value = false
        lastGain.value = 0
        scoreTimer = null
      }, 420)
    },
    winCallback: (_score: number, payload?: any) => {
      console.log('关卡胜利', payload)
    },
    loseCallback: (_score: number, payload?: any) => {
      console.log('关卡失败', payload)
    },
  },
})

const levelName = computed(() => game.currentLevel.value.name ?? '挑战')

const levelProgress = computed(() => {
  const target = game.targetScore.value || 1
  if (!target) return 0
  return Math.min(100, Math.round((game.levelScore.value / target) * 100))
})

const hasTimeLimit = computed(() => game.remainingTime.value !== null)

const limitLabel = computed(() => (hasTimeLimit.value ? '剩余时间' : '剩余步数'))

const limitDisplay = computed(() => {
  if (hasTimeLimit.value && typeof game.remainingTime.value === 'number') {
    return formatTime(game.remainingTime.value)
  }
  if (typeof game.remainingMoves.value === 'number') return game.remainingMoves.value
  return '∞'
})

const comboStatus = computed(() => {
  if (game.comboStreak.value === 0) return '0'
  const multiplier = (1 + game.comboStreak.value * game.comboBonus.value).toFixed(2)
  return `${game.comboStreak.value} 连 (x${multiplier})`
})

const boardStyle = computed(() => {
  const { rows, cols } = game.currentLevel.value.gridSize
  return {
    width: `${cols * TILE_SIZE}px`,
    height: `${rows * TILE_SIZE}px`,
  }
})

const modalTitle = computed(() => {
  if (game.lastResult.value === 'win') {
    return isFinalLevel.value ? '全关通关！' : '关卡完成'
  }
  if (game.lastResult.value === 'lose') return '挑战失败'
  return '本局结束'
})

const isFinalLevel = computed(() => game.levelIndex.value >= game.levels.length - 1)

onMounted(async () => {
  try {
    await bridge.init({ level: game.currentLevel.id })
  } catch (e) {
    console.warn('bridge.init failed', e)
  }
})

function formatTime(sec: number) {
  const minutes = Math.floor(sec / 60)
  const seconds = Math.floor(Math.max(0, sec % 60))
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

function handleCardClick(node: CardNode) {
  if (node.state === 1 || node.state === 2) {
    game.handleSelect(node)
  }
}

function togglePause() {
  game.togglePause()
  if (game.isPaused.value) bridge.onPause()
  else bridge.onResume()
}

function handleShuffle() {
  game.useShuffle()
}

function handleHint() {
  game.useHint()
}

function restartGame() {
  game.retryLevel()
}

function handleRetry() {
  game.retryLevel()
}

function handleNextLevel() {
  game.nextLevel()
}
</script>

<style scoped>
.game-container {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  padding: 32px 16px 64px;
  gap: 24px;
  background: linear-gradient(180deg, #f2fbff 0%, #eef7ff 100%);
}

.control-panel {
  width: min(420px, 100%);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.load-status,
.load-warning {
  text-align: center;
  font-size: 14px;
}

.load-status {
  color: #4b5563;
}

.load-warning {
  color: #d97706;
}

.level-header {
  background: white;
  padding: 16px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.05);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.level-title {
  font-size: 18px;
  font-weight: 600;
  color: #1f2937;
}

.level-progress {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  color: #374151;
}

.level-progress.pulse .progress-bar__fill {
  animation: pulse 0.4s ease;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #e5e7eb;
  border-radius: 999px;
  overflow: hidden;
}

.progress-bar__fill {
  height: 100%;
  background: linear-gradient(90deg, #60a5fa, #3b82f6);
  width: 0%;
  transition: width 0.25s ease-out;
}

.stat-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.stat-item {
  background: white;
  padding: 12px 16px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.stat-item label {
  font-size: 12px;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #6b7280;
}

.stat-item span {
  font-size: 18px;
  font-weight: 600;
  color: #111827;
}

.gain {
  display: inline-block;
  margin-left: 6px;
  color: #059669;
  font-size: 12px;
}

.actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
}

.actions .control-btn:nth-last-child(-n+2) {
  grid-column: span 3;
}

.control-btn {
  padding: 12px;
  font-size: 15px;
  border: none;
  border-radius: 10px;
  background: #3b82f6;
  color: white;
  cursor: pointer;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
}

.control-btn:disabled {
  background: #93c5fd;
  cursor: not-allowed;
  box-shadow: none;
}

.control-btn:not(:disabled):hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 14px rgba(59, 130, 246, 0.3);
}

.game-board {
  position: relative;
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 24px rgba(15, 23, 42, 0.08);
  padding: 16px;
  display: grid;
  place-items: center;
}

.game-board.paused::after {
  content: '已暂停';
  position: absolute;
  inset: 16px;
  border-radius: 12px;
  background: rgba(15, 23, 42, 0.5);
  color: white;
  font-size: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2;
}

.card {
  position: absolute;
  width: 40px;
  height: 40px;
  transition: transform 0.2s ease, opacity 0.3s ease;
  cursor: pointer;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 8px rgba(15, 23, 42, 0.2);
}

.card.selected {
  transform: scale(0.96);
}

.card.hinted {
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.45);
}

.card.trap {
  box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.65);
}

.card.removed {
  pointer-events: none;
  transform: translateY(20px);
}

.card-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  pointer-events: none;
}

.trap-badge {
  position: absolute;
  bottom: 4px;
  right: 4px;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  font-size: 10px;
  padding: 2px 4px;
  border-radius: 4px;
  letter-spacing: 0.05em;
}

.game-modal {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.modal-content {
  width: min(320px, 90%);
  background: white;
  border-radius: 16px;
  padding: 24px;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 12px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.25);
}

.modal-content h2 {
  margin: 0;
  font-size: 22px;
  color: #1f2937;
}

.modal-score,
.modal-total {
  margin: 0;
  color: #4b5563;
}

.modal-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
  margin-top: 8px;
}

.modal-actions button {
  flex: 1;
  padding: 10px 12px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 15px;
  cursor: pointer;
  transition: background 0.2s ease;
}

.modal-actions button:hover {
  background: #2563eb;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes pulse {
  0%,
  100% {
    transform: scaleX(1);
  }
  50% {
    transform: scaleX(1.015);
  }
}

@media (max-width: 640px) {
  .control-panel {
    width: 100%;
  }

  .actions {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .actions .control-btn:nth-last-child(-n+2) {
    grid-column: span 2;
  }
}
</style>
