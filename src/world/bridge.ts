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
  _volumeHandler: undefined as ((v: number) => void) | undefined,

  async init(opts: BridgeInitOptions = {}) {
    try {
      console.log('[bridge] init', opts)
      // 初始化逻辑
      this.ready = true
      return { ok: true, code: 0 }
    } catch (error) {
      console.error('[bridge] init failed:', error)
      return {
        ok: false,
        code: -1,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
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
    } catch (error) {
      console.error('[bridge] postScore failed:', error)
      return {
        ok: false,
        code: -1,
        message: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },

  onPause() {
    if (!this.ready)
      return

    console.log('[bridge] onPause')
    // 暂停回调
  },

  onResume() {
    if (!this.ready)
      return

    console.log('[bridge] onResume')
    // 恢复回调
  },

  setVolume(v: number) {
    if (!this.ready)
      return

    console.log('[bridge] setVolume', v)
    // call registered handler (if host wants to control in-app audio)
    if (typeof this._volumeHandler !== 'function')
      return

    try {
      this._volumeHandler(v)
    } catch (error) {
      console.warn('[bridge] volume handler error', error)
    }
  },

  onVolumeChange(fn: (v: number) => void) {
    this._volumeHandler = fn
  },

  isReady() {
    return this.ready
  },
}

export default bridge
