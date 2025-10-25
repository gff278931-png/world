import ASSETS, { type AssetsManifest } from './assets'

// Simple preloader for images and audio with timeout and retry
export interface LoadResult {
  url: string
  ok: boolean
  reason?: string
}

export interface PreloadSummary {
  loaded: number
  failed: number
  details: LoadResult[]
  manifest: AssetsManifest
}

const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']
const AUDIO_EXTENSIONS = ['.mp3', '.ogg', '.wav', '.m4a']

let activeManifest: AssetsManifest = ASSETS

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

function pickStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {}
  const result: Record<string, string> = {}
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === 'string' && entry.length > 0) {
      result[key] = entry
    }
  }
  return result
}

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0)
  }
  if (typeof value === 'string' && value.length > 0) return [value]
  return []
}

function normalizeManifest(input: any): AssetsManifest {
  const cards = asStringArray(input?.images?.cards).length
    ? asStringArray(input.images.cards)
    : (asStringArray(input?.cards).length ? asStringArray(input.cards) : ASSETS.cards)

  const cards2x = asStringArray(input?.images?.cards2x).length
    ? asStringArray(input.images.cards2x)
    : (asStringArray(input?.cards2x).length ? asStringArray(input.cards2x) : ASSETS.cards2x)

  const uiImages = isRecord(input?.images?.ui)
    ? input.images.ui
    : (isRecord(input?.ui) ? input.ui : {})

  const imagesUi: AssetsManifest['images']['ui'] = {
    ...ASSETS.images.ui,
    ...pickStringRecord(uiImages),
  }

  const normalizedImages: AssetsManifest['images'] = {
    cards,
    cards2x,
    ui: imagesUi,
  }

  const normalizedAudio: AssetsManifest['audio'] = {
    ...ASSETS.audio,
    ...pickStringRecord(input?.audio),
  }

  return {
    cards,
    cards2x,
    images: normalizedImages,
    audio: normalizedAudio,
  }
}

function collectUrls(source: unknown, predicate: (url: string) => boolean): string[] {
  const queue: unknown[] = []
  if (Array.isArray(source)) queue.push(...source)
  else queue.push(source)

  const result: string[] = []
  const seen = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()
    if (current == null) continue
    if (Array.isArray(current)) {
      queue.push(...current)
      continue
    }
    if (isRecord(current)) {
      queue.push(...Object.values(current))
      continue
    }
    if (typeof current === 'string' && predicate(current) && !seen.has(current)) {
      seen.add(current)
      result.push(current)
    }
  }

  return result
}

const isImageUrl = (url: string) => IMAGE_EXTENSIONS.some(ext => url.toLowerCase().endsWith(ext))
const isAudioUrl = (url: string) => AUDIO_EXTENSIONS.some(ext => url.toLowerCase().endsWith(ext))

export function getActiveManifest(): AssetsManifest {
  return activeManifest
}

export async function preloadAll(options?: { onProgress?: (p: { loaded: number; total: number; percent: number }) => void }): Promise<PreloadSummary> {
  // Backwards-compatible: preload assets listed in ASSETS constant
  return preloadManifest(ASSETS as any, options)
}

export async function preloadManifest(
  manifest: any,
  options?: { onProgress?: (p: { loaded: number; total: number; percent: number }) => void }
): Promise<PreloadSummary> {
  activeManifest = normalizeManifest(manifest)

  const imagesToLoad = collectUrls(
    [activeManifest.cards, activeManifest.cards2x, activeManifest.images, manifest?.images, manifest?.ui],
    isImageUrl,
  )

  const audioToLoad = collectUrls([activeManifest.audio, manifest?.audio], isAudioUrl)

  const results: LoadResult[] = []
  const total = imagesToLoad.length + audioToLoad.length
  let completed = 0

  const report = () => {
    options?.onProgress?.({ loaded: completed, total, percent: total === 0 ? 1 : completed / Math.max(1, total) })
  }

  report()

  // load images first
  for (const url of imagesToLoad) {
    try {
      const r = await loadImage(url)
      results.push(r)
    } catch (e) {
      const placeholder = activeManifest.images.ui.placeholder || '/assets/ui/placeholder.webp'
      if (placeholder && placeholder !== url) {
        try {
          await loadImage(placeholder)
          results.push({ url, ok: false, reason: 'fallback to placeholder' })
        } catch {
          results.push({ url, ok: false, reason: (e as any)?.message || 'image load failed' })
        }
      } else {
        results.push({ url, ok: false, reason: (e as any)?.message || 'image load failed' })
      }
    }
    completed++
    report()
  }

  // audio
  for (const url of audioToLoad) {
    try {
      const r = await loadAudio(url)
      results.push(r)
    } catch (e) {
      const silent = activeManifest.audio.silent || '/assets/audio/silent.mp3'
      if (silent && silent !== url) {
        try {
          await loadAudio(silent)
          results.push({ url, ok: false, reason: 'fallback to silent' })
        } catch {
          results.push({ url, ok: false, reason: (e as any)?.message || 'audio load failed' })
        }
      } else {
        results.push({ url, ok: false, reason: (e as any)?.message || 'audio load failed' })
      }
    }
    completed++
    report()
  }

  const loaded = results.filter(r => r.ok).length
  const failed = results.length - loaded
  if (failed > 0) console.warn('[loader] some assets failed to preload', results.filter(r => !r.ok))
  else console.log('[loader] all assets preloaded')

  return { loaded, failed, details: results, manifest: activeManifest }
}

export async function preloadFromUrl(
  manifestUrl = '/assets/manifest.json',
  options?: { onProgress?: (p: { loaded: number; total: number; percent: number }) => void }
) {
  try {
    const resp = await fetch(manifestUrl)
    if (!resp.ok) throw new Error(`Failed to fetch manifest: ${resp.status}`)
    const manifest = await resp.json()
    return preloadManifest(manifest, options)
  } catch (e) {
    console.error('[loader] preloadFromUrl failed', e)
    // fallback to ASSETS constant
    return preloadManifest(ASSETS as any, options)
  }
}

export default { loadImage, loadAudio, preloadAll, preloadManifest, preloadFromUrl, getActiveManifest }
