/**
 * 합성 이력 관리 (localStorage 기반)
 * 썸네일(300px)만 저장하여 용량 절약
 */

export interface HistoryItem {
  id: string
  thumbnail: string       // base64 썸네일 (300px)
  materialName: string
  provider: string        // "gemini-refined" | "server-composite"
  processingTime: number
  tileScale: number
  createdAt: string       // ISO date
}

const STORAGE_KEY = 'terraceview_history'
const MAX_ITEMS = 30

function resizeToThumbnail(dataUrl: string, maxWidth = 300): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const ratio = maxWidth / img.width
      const canvas = document.createElement('canvas')
      canvas.width = maxWidth
      canvas.height = img.height * ratio
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      resolve(canvas.toDataURL('image/jpeg', 0.7))
    }
    img.src = dataUrl
  })
}

export function getHistory(): HistoryItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export async function addHistory(
  resultImageDataUrl: string,
  materialName: string,
  provider: string,
  processingTime: number,
  tileScale: number,
): Promise<void> {
  const thumbnail = await resizeToThumbnail(resultImageDataUrl)
  const item: HistoryItem = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    thumbnail,
    materialName,
    provider,
    processingTime,
    tileScale,
    createdAt: new Date().toISOString(),
  }

  const history = getHistory()
  history.unshift(item)
  if (history.length > MAX_ITEMS) history.pop()

  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY)
}
