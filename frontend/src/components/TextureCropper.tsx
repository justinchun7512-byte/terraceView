'use client'
import { useRef, useState, useCallback, useEffect } from 'react'
import { Check, X, RotateCcw } from 'lucide-react'

interface Props {
  imageSrc: string
  fileName: string
  onConfirm: (croppedDataUrl: string, name: string) => void
  onCancel: () => void
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export default function TextureCropper({ imageSrc, fileName, onConfirm, onCancel }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const [startPt, setStartPt] = useState({ x: 0, y: 0 })
  const [rect, setRect] = useState<Rect | null>(null)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [displayScale, setDisplayScale] = useState(1)
  const [materialName, setMaterialName] = useState(fileName)

  // 이미지 로드
  useEffect(() => {
    const img = new Image()
    img.onload = () => {
      imgRef.current = img
      setImgLoaded(true)
    }
    img.src = imageSrc
  }, [imageSrc])

  // 캔버스에 이미지 + 크롭 영역 그리기
  useEffect(() => {
    if (!imgLoaded || !canvasRef.current || !imgRef.current) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')!
    const img = imgRef.current

    // 캔버스를 컨테이너에 맞추기 (max 600px)
    const maxW = 560
    const scale = Math.min(maxW / img.naturalWidth, 500 / img.naturalHeight, 1)
    setDisplayScale(scale)
    canvas.width = img.naturalWidth * scale
    canvas.height = img.naturalHeight * scale

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

    if (rect) {
      // 어둡게 오버레이
      ctx.fillStyle = 'rgba(0,0,0,0.5)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)

      // 선택 영역만 밝게
      ctx.save()
      ctx.beginPath()
      ctx.rect(rect.x, rect.y, rect.w, rect.h)
      ctx.clip()
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      ctx.restore()

      // 선택 영역 테두리
      ctx.strokeStyle = '#10b981'
      ctx.lineWidth = 2
      ctx.setLineDash([6, 3])
      ctx.strokeRect(rect.x, rect.y, rect.w, rect.h)
      ctx.setLineDash([])

      // 크기 표시
      const realW = Math.round(Math.abs(rect.w) / scale)
      const realH = Math.round(Math.abs(rect.h) / scale)
      ctx.fillStyle = 'rgba(0,0,0,0.7)'
      const label = `${realW} x ${realH}px`
      const textW = ctx.measureText(label).width + 12
      const labelX = rect.x + rect.w / 2 - textW / 2
      const labelY = rect.y + rect.h + 4
      ctx.fillRect(labelX, labelY, textW, 20)
      ctx.fillStyle = '#fff'
      ctx.font = '12px sans-serif'
      ctx.fillText(label, labelX + 6, labelY + 14)
    }
  }, [imgLoaded, rect, displayScale])

  const getCanvasPos = (e: React.MouseEvent) => {
    const canvas = canvasRef.current!
    const r = canvas.getBoundingClientRect()
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    const pos = getCanvasPos(e)
    setStartPt(pos)
    setDragging(true)
    setRect(null)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return
    const pos = getCanvasPos(e)
    setRect({
      x: Math.min(startPt.x, pos.x),
      y: Math.min(startPt.y, pos.y),
      w: Math.abs(pos.x - startPt.x),
      h: Math.abs(pos.y - startPt.y),
    })
  }

  const handleMouseUp = () => {
    setDragging(false)
  }

  const handleReset = () => {
    setRect(null)
  }

  const handleConfirm = useCallback(() => {
    const img = imgRef.current
    if (!img) return

    // 크롭 영역이 없거나 너무 작으면 원본 사용
    if (!rect || rect.w < 10 || rect.h < 10) {
      onConfirm(imageSrc, materialName || fileName)
      return
    }

    // 실제 이미지 좌표로 변환
    const realX = rect.x / displayScale
    const realY = rect.y / displayScale
    const realW = rect.w / displayScale
    const realH = rect.h / displayScale

    const cropCanvas = document.createElement('canvas')
    cropCanvas.width = realW
    cropCanvas.height = realH
    const ctx = cropCanvas.getContext('2d')!
    ctx.drawImage(img, realX, realY, realW, realH, 0, 0, realW, realH)

    onConfirm(cropCanvas.toDataURL('image/jpeg', 0.92), materialName || fileName)
  }, [rect, displayScale, imageSrc, fileName, materialName, onConfirm])

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-[640px] w-full overflow-hidden">
        {/* 헤더 */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <p className="text-sm font-semibold text-gray-800">텍스처 영역 선택</p>
            <p className="text-xs text-gray-400 mt-0.5">사용할 영역을 드래그하세요 (선택하지 않으면 전체 사용)</p>
          </div>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 캔버스 */}
        <div className="p-4 flex justify-center bg-gray-50">
          <canvas
            ref={canvasRef}
            className="cursor-crosshair rounded-lg border border-gray-200"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </div>

        {/* 바닥재 이름 입력 */}
        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">바닥재 이름 (AI 합성 시 활용)</label>
          <input
            type="text"
            value={materialName}
            onChange={e => setMaterialName(e.target.value)}
            placeholder="예: 화이트 대리석 타일, IPE 원목 데크"
            className="w-full text-sm px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <p className="text-xs text-gray-400 mt-1">구체적으로 적을수록 AI 합성 결과가 정확해집니다</p>
        </div>

        {/* 하단 버튼 */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            초기화
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={onCancel}
              className="text-sm text-gray-500 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              취소
            </button>
            <button
              onClick={handleConfirm}
              className="flex items-center gap-1.5 text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              {rect ? '선택 영역 사용' : '전체 이미지 사용'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
