'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { RotateCcw, Download, Sliders, MousePointer, Wand2 } from 'lucide-react'
import MaterialPanel from './MaterialPanel'
import PolygonEditor from './PolygonEditor'
import { TerraceCanvasEngine } from '@/lib/canvas-engine'
import type { Point } from '@/lib/canvas-engine'
import { segmentFloor } from '@/lib/api'

interface Props {
  imageSrc: string
  onReset: () => void
}

type Mode = 'auto' | 'manual'

export default function PreviewEditor({ imageSrc, onReset }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<TerraceCanvasEngine | null>(null)
  const [polygon, setPolygon] = useState<Point[]>([])
  const [opacity, setOpacity] = useState(72)
  const [mode, setMode] = useState<Mode>('manual')
  const [isSegmenting, setIsSegmenting] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null)
  const [editingPolygon, setEditingPolygon] = useState(false)
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 })

  // 이미지 로드 및 엔진 초기화
  useEffect(() => {
    if (!canvasRef.current) return
    const engine = new TerraceCanvasEngine(canvasRef.current)
    engineRef.current = engine
    engine.loadBaseImage(imageSrc).then(() => {
      const c = canvasRef.current!
      setImageSize({ w: c.width, h: c.height })
    })
  }, [imageSrc])

  // AI 자동 세그멘테이션
  const handleAutoSegment = useCallback(async () => {
    setIsSegmenting(true)
    try {
      const blob = await fetch(imageSrc).then(r => r.blob())
      const file = new File([blob], 'terrace.jpg', { type: 'image/jpeg' })
      const result = await segmentFloor(file)
      setPolygon(result.polygon)
      engineRef.current?.setMaskPolygon(result.polygon)
      setMode('auto')
    } catch (e) {
      console.error(e)
      alert('자동 인식에 실패했습니다. 수동으로 영역을 그려주세요.')
      setMode('manual')
    } finally {
      setIsSegmenting(false)
    }
  }, [imageSrc])

  // 바닥재 선택
  const handleMaterialSelect = useCallback((src: string) => {
    setSelectedMaterial(src)
    engineRef.current?.setMaskPolygon(polygon)
    engineRef.current?.applyMaterial(src, opacity / 100)
  }, [polygon, opacity])

  // 불투명도 변경
  const handleOpacityChange = useCallback((val: number) => {
    setOpacity(val)
    engineRef.current?.updateOpacity(val / 100)
  }, [])

  // 폴리곤 수동 편집 완료
  const handlePolygonDone = useCallback((pts: Point[]) => {
    setPolygon(pts)
    setEditingPolygon(false)
    engineRef.current?.setMaskPolygon(pts)
    if (selectedMaterial) {
      engineRef.current?.applyMaterial(selectedMaterial, opacity / 100)
    }
  }, [selectedMaterial, opacity])

  return (
    <div className="flex flex-col gap-4">
      {/* 상단 툴바 */}
      <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onReset}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-100"
          >
            <RotateCcw className="w-4 h-4" />
            새 사진
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <button
            onClick={handleAutoSegment}
            disabled={isSegmenting}
            className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium px-3 py-1.5 rounded-lg hover:bg-emerald-50 transition-colors disabled:opacity-50"
          >
            <Wand2 className="w-4 h-4" />
            {isSegmenting ? 'AI 인식 중...' : 'AI 자동 인식'}
          </button>
          <button
            onClick={() => setEditingPolygon(true)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <MousePointer className="w-4 h-4" />
            수동 선택
          </button>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-gray-400" />
            <input
              type="range"
              min={30}
              max={100}
              value={opacity}
              onChange={e => handleOpacityChange(Number(e.target.value))}
              className="w-24"
            />
            <span className="text-xs text-gray-400 w-8">{opacity}%</span>
          </div>
          <button
            onClick={() => engineRef.current?.download()}
            className="flex items-center gap-1.5 text-sm bg-emerald-600 text-white px-4 py-2 rounded-lg hover:bg-emerald-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            저장
          </button>
        </div>
      </div>

      {/* 메인 에디터 영역 */}
      <div className="grid grid-cols-[1fr_280px] gap-4">
        {/* 캔버스 영역 */}
        <div className="relative bg-gray-100 rounded-xl overflow-hidden" style={{ minHeight: 400 }}>
          <canvas
            ref={canvasRef}
            className="w-full h-auto block"
          />
          {editingPolygon && (
            <PolygonEditor
              imageWidth={imageSize.w}
              imageHeight={imageSize.h}
              initialPolygon={polygon}
              onDone={handlePolygonDone}
              onCancel={() => setEditingPolygon(false)}
            />
          )}
          {polygon.length === 0 && !editingPolygon && (
            <div className="absolute inset-0 flex items-end justify-center pb-4 pointer-events-none">
              <div className="bg-black/50 text-white text-sm px-4 py-2 rounded-full">
                AI 자동 인식 또는 수동 선택으로 바닥 영역을 지정하세요
              </div>
            </div>
          )}
          {isSegmenting && (
            <div className="absolute inset-0 bg-white/60 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
                <p className="text-sm text-gray-600">AI가 바닥 영역을 인식하는 중...</p>
              </div>
            </div>
          )}
        </div>

        {/* 바닥재 패널 */}
        <MaterialPanel
          selected={selectedMaterial}
          onSelect={handleMaterialSelect}
          disabled={polygon.length === 0}
        />
      </div>
    </div>
  )
}
