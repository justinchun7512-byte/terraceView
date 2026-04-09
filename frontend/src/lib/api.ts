const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

export interface SegmentResult {
  polygon: { x: number; y: number }[]
  confidence: number
  image_width: number
  image_height: number
}

export async function segmentFloor(file: File): Promise<SegmentResult> {
  const formData = new FormData()
  formData.append('file', file)

  const res = await fetch(`${API_URL}/api/segment`, {
    method: 'POST',
    body: formData,
  })

  if (!res.ok) throw new Error('Segmentation failed')
  return res.json()
}

export interface CompositeResult {
  result_image: string  // base64
  provider: string
  processing_time: number
}

export async function compositeFloor(
  imageBase64: string,
  polygon: { x: number; y: number }[],
  materialName: string,
  materialImageBase64?: string,
  tileScale?: number,
): Promise<CompositeResult> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 120_000) // 2분 타임아웃

  const res = await fetch(`${API_URL}/api/composite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      image: imageBase64,
      polygon,
      material_name: materialName,
      material_image: materialImageBase64 || null,
      tile_scale: tileScale ?? 0.25,
    }),
    signal: controller.signal,
  })
  clearTimeout(timeout)

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: 'AI 합성 실패' }))
    throw new Error(err.detail || 'AI 합성 실패')
  }
  return res.json()
}
