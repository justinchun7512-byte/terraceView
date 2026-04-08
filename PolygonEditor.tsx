'use client'
/**
 * Fabric.js 기반 폴리곤 드로잉 에디터
 * 사용자가 캔버스 위에서 클릭으로 바닥 영역 다각형을 그립니다
 */
import { useEffect, useRef, useState } from 'react'
import type { Point } from '@/lib/canvas-engine'
import { Check, X, Undo2 } from 'lucide-react'

interface Props {
  imageWidth: number
  imageHeight: number
  initialPolygon: Point[]
  onDone: (points: Point[]) => void
  onCancel: () => void
}

export default function PolygonEditor({ imageWidth, imageHeight, initialPolygon, onDone, onCancel }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [points, setPoints] = useState<Point[]>(initialPolygon)
  const [preview, setPreview] = useState<Point | null>(null)

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const scaleX = imageWidth / rect.width
    const scaleY = imageHeight / rect.height
    const x = (e.clientX - rect.left) * scaleX
    const y = (e.clientY - rect.top) * scaleY
    setPoints(prev => [...prev, { x: Math.round(x), y: Math.round(y) }])
  }

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = svgRef.current!.getBoundingClientRect()
    const scaleX = imageWidth / rect.width
    const scaleY = imageHeight / rect.height
    setPreview({
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    })
  }

  const toSvgCoord = (pt: Point) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return pt
    return {
      x: (pt.x / imageWidth) * rect.width,
      y: (pt.y / imageHeight) * rect.height,
    }
  }

  const svgPoints = points.map(p => {
    const c = toSvgCoord(p)
    return `${c.x},${c.y}`
  }).join(' ')

  return (
    <div className="absolute inset-0">
      {/* 반투명 오버레이 */}
      <svg
        ref={svgRef}
        className="w-full h-full cursor-crosshair"
        onClick={handleSvgClick}
        onMouseMove={handleMouseMove}
        style={{ position: 'absolute', inset: 0 }}
        viewBox={`0 0 100 100`}
        preserveAspectRatio="none"
      >
        {/* 다각형 미리보기 */}
        {points.length >= 2 && (
          <polygon
            points={points.map(p => `${(p.x/imageWidth)*100},${(p.y/imageHeight)*100}`).join(' ')}
            fill="rgba(16,185,129,0.25)"
            stroke="#10b981"
            strokeWidth="0.3"
            strokeDasharray="1,0.5"
          />
        )}
        {/* 점들 */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={(p.x / imageWidth) * 100}
            cy={(p.y / imageHeight) * 100}
            r="1.2"
            fill="#10b981"
            stroke="white"
            strokeWidth="0.4"
          />
        ))}
        {/* 첫 번째 점 강조 */}
        {points.length > 0 && (
          <circle
            cx={(points[0].x / imageWidth) * 100}
            cy={(points[0].y / imageHeight) * 100}
            r="1.8"
            fill="none"
            stroke="#10b981"
            strokeWidth="0.5"
          />
        )}
      </svg>

      {/* 컨트롤 버튼 */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
        <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full">
          {points.length < 3
            ? `${points.length}개 점 선택 (최소 3개 필요)`
            : `${points.length}개 점 선택됨 — 완료를 눌러 적용`}
        </div>
        <button
          onClick={() => setPoints(p => p.slice(0, -1))}
          disabled={points.length === 0}
          className="bg-white/90 text-gray-700 p-2 rounded-full hover:bg-white disabled:opacity-40 shadow"
        >
          <Undo2 className="w-4 h-4" />
        </button>
        <button
          onClick={onCancel}
          className="bg-white/90 text-gray-700 p-2 rounded-full hover:bg-white shadow"
        >
          <X className="w-4 h-4" />
        </button>
        <button
          onClick={() => onDone(points)}
          disabled={points.length < 3}
          className="bg-emerald-600 text-white p-2 rounded-full hover:bg-emerald-700 disabled:opacity-40 shadow"
        >
          <Check className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
