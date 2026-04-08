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
