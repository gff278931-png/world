// Simple preloader for images and audio with timeout and retry
export interface LoadResult {
  url: string
  ok: boolean
  reason?: string
}

function withTimeout<T>(p: Promise<T>, ms: number, onTimeout?: () => void) {
  return new Promise<T>((resolve, reject) => {
    const id = setTimeout(() => {
      onTimeout?.()
      reject(new Error('timeout'))
    }, ms)
    p.then((v) => {
      clearTimeout(id)
      resolve(v)
    }, (e) => {
      clearTimeout(id)
      reject(e)
    })
  })
}

export async function loadImage(url: string, timeout = 8000): Promise<LoadResult> {
  let attempts = 0
  while (attempts < 2) {
    attempts++
    try {
      await withTimeout(new Promise<void>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve()
        img.onerror = () => reject(new Error('image load error'))
        img.crossOrigin = 'anonymous'
        img.src = url
      }), timeout)
      return { url, ok: true }
    } catch (e: any) {
      if (attempts >= 2) return { url, ok: false, reason: e?.message }
      // retry once
    }
  }
  return { url, ok: false, reason: 'unknown' }
}

export async function loadAudio(url: string, timeout = 8000): Promise<LoadResult> {
  let attempts = 0
  while (attempts < 2) {
    attempts++
    try {
      await withTimeout(new Promise<void>((resolve, reject) => {
        const a = new Audio()
        let handled = false
        const onOK = () => { if (!handled) { handled = true; resolve() } }
        const onErr = () => { if (!handled) { handled = true; reject(new Error('audio load error')) } }
        a.addEventListener('canplaythrough', onOK, { once: true })
        a.addEventListener('error', onErr, { once: true })
        a.preload = 'auto'
        a.src = url
      }), timeout)
      return { url, ok: true }
    } catch (e: any) {
      if (attempts >= 2) return { url, ok: false, reason: e?.message }
    }
  }
  return { url, ok: false, reason: 'unknown' }
}

import ASSETS from './assets'

export async function preloadAll(): Promise<{ loaded: number; failed: number; details: LoadResult[] }> {
  const toLoad: string[] = []
  ;(ASSETS.cards as string[]).forEach(s => toLoad.push(s))
  ;(ASSETS.cards2x as string[]).forEach(s => toLoad.push(s))
  Object.values(ASSETS.ui).forEach(s => toLoad.push(s))
  Object.values(ASSETS.audio).forEach(s => toLoad.push(s))

  const results: LoadResult[] = []

  // load images first
  const imageUrls = toLoad.filter(u => u.endsWith('.webp') || u.endsWith('.png'))
  for (const url of imageUrls) {
    // stop-gap: if resource missing, loader will return ok=false
    const r = await loadImage(url).catch(e => ({ url, ok: false, reason: e?.message }))
    results.push(r)
  }

  // audio
  const audioUrls = Object.values(ASSETS.audio)
  for (const url of audioUrls) {
    const r = await loadAudio(url).catch(e => ({ url, ok: false, reason: e?.message }))
    results.push(r)
  }

  const loaded = results.filter(r => r.ok).length
  const failed = results.length - loaded
  if (failed > 0) console.warn('[loader] some assets failed to preload', results.filter(r => !r.ok))
  else console.log('[loader] all assets preloaded')

  return { loaded, failed, details: results }
}

export default { loadImage, loadAudio, preloadAll }
