export interface BridgeInitOptions {
  level?: number
  [k: string]: any
}

export interface PostScorePayload {
  score: number
  level?: number
  result?: 'win' | 'lose'
  [k: string]: any
}

export const bridge = {
  ready: false,

  async init(opts: BridgeInitOptions = {}) {
    try {
      console.log('[bridge] init', opts)
      // 初始化逻辑
      this.ready = true
      return { ok: true, code: 0 }
    } catch (e) {
      console.error('[bridge] init failed:', e)
      return { ok: false, code: -1, message: e instanceof Error ? e.message : 'Unknown error' }
    }
  },

  async postScore(payload: PostScorePayload) {
    if (!this.ready) {
      return { ok: false, code: -1, message: 'bridge not initialized' }
    }

    try {
      console.log('[bridge] postScore', payload)
      // 发送分数逻辑
      return { ok: true, code: 0 }
    } catch (e) {
      console.error('[bridge] postScore failed:', e)
      return { ok: false, code: -1, message: e instanceof Error ? e.message : 'Unknown error' }
    }
  },

  onPause() {
    if (!this.ready) return
    console.log('[bridge] onPause')
    // 暂停回调
  },

  onResume() {
    if (!this.ready) return
    console.log('[bridge] onResume')
    // 恢复回调
  },

  setVolume(v: number) {
    if (!this.ready) return
    console.log('[bridge] setVolume', v)
    // 设置音量逻辑
  },

  isReady() {
    return this.ready
  }
}

export default bridge
