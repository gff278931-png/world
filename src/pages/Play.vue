<template>
  <div class="game-container">
    <!-- 游戏控制面板 -->
    <div class="control-panel">
      <div class="score-panel" :class="{ 'animate-score': isScoreAnimating }">
        <div class="score">得分: {{ game.score }}</div>
      </div>
      <div class="control-buttons">
        <button class="control-btn" @click="togglePause">
          {{ game.isPaused ? '继续' : '暂停' }}
        </button>
        <button class="control-btn" @click="game.toggleSound()">
          {{ game.isSoundEnabled ? '🔊' : '🔈' }}
        </button>
        <button class="control-btn" @click="restartGame">
          重新开始
        </button>
      </div>
    </div>

    <!-- 游戏区域 -->
    <div class="game-board" ref="gameBoardRef" :class="{ 'paused': game.isPaused }">
      <template v-for="node in game.nodes" :key="node.id">
        <div
          class="card"
          :class="{
            'selected': node.state === 2,
            'removed': node.state === 3,
            'can-click': node.state === 1
          }"
          :style="{
            left: `${node.left}px`,
            top: `${node.top}px`,
            zIndex: node.zIndex,
            transform: `translate3d(0, ${node.state === 3 ? '20px' : '0'}, 0)`,
            opacity: node.state === 3 ? 0 : 1
          }"
          @click="handleCardClick(node)"
        >
          <div class="card-inner" :class="'type-' + node.type">
            {{ node.type }}
          </div>
        </div>
      </template>
    </div>

    <!-- 游戏胜利弹窗 -->
    <div v-if="game.isGameOver" class="game-over-modal">
      <div class="modal-content">
        <h2>游戏胜利！</h2>
        <p>最终得分：{{ game.score }}</p>
        <button @click="restartGame">再玩一次</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGame } from '../core/useGame'
import bridge from '../world/bridge'
import ASSETS from '../core/assets'
import loader from '../core/loader'

const gameBoardRef = ref<HTMLElement | null>(null)
const isScoreAnimating = ref(false)

// 先预加载资源，再 init bridge 与游戏
await loader.preloadAll()

const game = useGame({
  cardNum: 5,
  gridSize: { rows: 8, cols: 8 },
  events: {
    scoreCallback: (score: number) => {
      // 添加分数动画
      isScoreAnimating.value = true
      setTimeout(() => {
        isScoreAnimating.value = false
      }, 300)
    },
    winCallback: async (score: number) => {
      console.log(`游戏胜利！最终得分：${score}`)
      try {
        await bridge.postScore({ score, level: 1, result: 'win' })
      } catch (e) {
        console.warn('bridge.postScore failed', e)
      }
    },
    loseCallback: async (score: number) => {
      console.log(`游戏失败，得分：${score}`)
      try {
        await bridge.postScore({ score, level: 1, result: 'lose' })
      } catch (e) {
        console.warn('bridge.postScore failed', e)
      }
    }
  }
})

onMounted(async () => {
  try {
    await bridge.init({ level: 1 })
  } catch (e) {
    console.warn('bridge.init failed', e)
  }
})

// 处理卡片点击
function handleCardClick(node: CardNode) {
  if (node.state === 1) {
    game.handleSelect(node)
  }
}

function togglePause() {
  game.togglePause()
  // call bridge hooks
  if (game.isPaused) bridge.onPause()
  else bridge.onResume()
}

// 重新开始游戏
function restartGame() {
  game.initData()
  // re-init bridge session optionally
  bridge.init({ level: 1 }).catch(() => {})
}
</script>

<style scoped>
.game-container {
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #f0f0f0;
  padding: 20px;
  box-sizing: border-box;
}

.control-panel {
  width: 100%;
  max-width: 420px;
  margin-bottom: 20px;
}

.score-panel {
  padding: 15px;
  font-size: 24px;
  font-weight: bold;
  text-align: center;
  background: white;
  border-radius: 12px;
  margin-bottom: 15px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.animate-score {
  transform: scale(1.1);
}

.control-buttons {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 0 10px;
}

.control-btn {
  flex: 1;
  padding: 12px;
  font-size: 16px;
  border: none;
  border-radius: 8px;
  background: #4a90e2;
  color: white;
  cursor: pointer;
  transition: all 0.2s ease;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.control-btn:hover {
  background: #357abd;
  transform: translateY(-1px);
}

.control-btn:active {
  transform: translateY(1px);
}

.game-board {
  position: relative;
  width: 320px;
  height: 320px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.card {
  position: absolute;
  width: 40px;
  height: 40px;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  cursor: pointer;
  will-change: transform, opacity;
}

.card-inner {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  color: white;
  background: #4a90e2;
  transition: all 0.3s ease;
}

.selected .card-inner {
  transform: scale(0.9);
  box-shadow: 0 0 10px rgba(74, 144, 226, 0.5);
}

.removed {
  pointer-events: none;
}

.can-click {
  cursor: pointer;
}

.can-click:hover .card-inner {
  transform: scale(1.05);
}

/* 卡片类型颜色 */
.type-1 { background: #4a90e2; }
.type-2 { background: #50e3c2; }
.type-3 { background: #f5a623; }
.type-4 { background: #d0021b; }
.type-5 { background: #9013fe; }

.game-over-modal {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 40px;
  border-radius: 12px;
  text-align: center;
}

.modal-content h2 {
  margin: 0 0 20px;
  color: #333;
}

.modal-content button {
  margin-top: 20px;
  padding: 10px 20px;
  font-size: 16px;
  border: none;
  border-radius: 6px;
  background: #4a90e2;
  color: white;
  cursor: pointer;
  transition: background 0.3s ease;
}

.modal-content button:hover {
  background: #357abd;
}
</style>