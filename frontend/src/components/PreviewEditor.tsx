'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { RotateCcw, Download, Sliders, MousePointer, ZoomIn, Sparkles } from 'lucide-react'
import MaterialPanel from './MaterialPanel'
import PolygonEditor from './PolygonEditor'
import HistoryPanel from './HistoryPanel'
import { TerraceCanvasEngine } from '@/lib/canvas-engine'
import type { Point } from '@/lib/canvas-engine'
import { compositeFloor } from '@/lib/api'
import { addHistory } from '@/lib/history'

interface Props {
  imageSrc: string
  onReset: () => void
}

interface UploadedMaterial {
  id: string
  name: string
  src: string
  thumbnail: string
}

export default function PreviewEditor({ imageSrc, onReset }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef<TerraceCanvasEngine | null>(null)
  const [polygon, setPolygon] = useState<Point[]>([])
  const [opacity, setOpacity] = useState(72)
  const [scale, setScale] = useState(35)
  const [isSegmenting] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<string | null>(null)
  const [editingPolygon, setEditingPolygon] = useState(false)
  const [imageSize, setImageSize] = useState({ w: 0, h: 0 })
  const [materials, setMaterials] = useState<UploadedMaterial[]>([])
  const [isCompositing, setIsCompositing] = useState(false)
  const [compositeInfo, setCompositeInfo] = useState<{ provider: string; time: number } | null>(null)
  const [selectedMaterialName, setSelectedMaterialName] = useState<string>('')

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

  // 바닥재 선택 (빠른 미리보기: Canvas blend)
  const handleMaterialSelect = useCallback((src: string, name?: string) => {
    setSelectedMaterial(src)
    if (name) setSelectedMaterialName(name)
    setCompositeInfo(null)
    engineRef.current?.setMaskPolygon(polygon)
    engineRef.current?.applyMaterial(src, opacity / 100)
  }, [polygon, opacity])

  // AI 실사 합성
  const handleAiComposite = useCallback(async () => {
    if (!polygon.length || !selectedMaterial) return
    setIsCompositing(true)
    setCompositeInfo(null)
    try {
      // 원본 이미지를 base64로 변환
      const blob = await fetch(imageSrc).then(r => r.blob())
      const imageB64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })

      // 텍스처 이미지 (사용자 업로드 바닥재)
      let materialImageB64: string | undefined
      if (selectedMaterial.startsWith('data:')) {
        materialImageB64 = selectedMaterial
      }

      if (!materialImageB64) {
        alert('바닥재 텍스처 이미지를 업로드해주세요')
        setIsCompositing(false)
        return
      }

      const result = await compositeFloor(
        imageB64,
        polygon,
        selectedMaterialName || 'flooring',
        materialImageB64,
        scale / 100, // 배율 슬라이더 값을 tile_scale로 전달
        opacity / 100, // 불투명도 전달
      )

      // AI 결과를 캔버스에 표시
      const resultSrc = `data:image/png;base64,${result.result_image}`
      await engineRef.current?.loadBaseImage(resultSrc)
      setCompositeInfo({ provider: result.provider, time: result.processing_time })

      // 합성 이력 저장
      await addHistory(
        resultSrc,
        selectedMaterialName || 'flooring',
        result.provider,
        result.processing_time,
        scale / 100,
      )
      window.dispatchEvent(new Event('history-updated'))
    } catch (e) {
      console.error('AI composite failed:', e)
      alert(`AI 합성 실패: ${e instanceof Error ? e.message : '알 수 없는 오류'}`)
    } finally {
      setIsCompositing(false)
    }
  }, [imageSrc, polygon, selectedMaterial, selectedMaterialName, scale])

  // 불투명도 변경
  const handleOpacityChange = useCallback((val: number) => {
    setOpacity(val)
    engineRef.current?.updateOpacity(val / 100)
  }, [])

  // 배율 변경
  const handleScaleChange = useCallback((val: number) => {
    setScale(val)
    engineRef.current?.updateScale(val / 100)
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

  // 바닥재 추가/삭제
  const handleAddMaterial = useCallback((mat: UploadedMaterial) => {
    setMaterials(prev => [...prev, mat])
  }, [])

  const handleRemoveMaterial = useCallback((id: string) => {
    setMaterials(prev => prev.filter(m => m.id !== id))
  }, [])

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
            onClick={() => setEditingPolygon(true)}
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <MousePointer className="w-4 h-4" />
            수동 선택
          </button>
        </div>
        <div className="flex items-center gap-4">
          {/* 불투명도 */}
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-gray-400" />
            <input
              type="range"
              min={30}
              max={100}
              value={opacity}
              onChange={e => handleOpacityChange(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-xs text-gray-400 w-8">{opacity}%</span>
          </div>
          {/* 타일 크기 */}
          <div className="flex items-center gap-2">
            <ZoomIn className="w-4 h-4 text-gray-400" />
            <span className="text-xs text-gray-500">타일</span>
            <input
              type="range"
              min={5}
              max={80}
              value={scale}
              onChange={e => handleScaleChange(Number(e.target.value))}
              className="w-20"
            />
            <span className="text-xs text-gray-400 w-8">{scale}%</span>
          </div>
          {/* AI 실사 합성 */}
          <button
            onClick={handleAiComposite}
            disabled={isCompositing || polygon.length === 0 || !selectedMaterial}
            className="flex items-center gap-1.5 text-sm bg-violet-600 text-white px-4 py-2 rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Sparkles className="w-4 h-4" />
            {isCompositing ? 'AI 합성 중...' : 'AI 실사 합성'}
          </button>
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
                수동 선택으로 바닥 영역을 지정하세요
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
          {isCompositing && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 bg-white rounded-2xl px-8 py-6 shadow-lg">
                <div className="w-12 h-12 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
                <p className="text-sm font-medium text-gray-700">AI 실사 합성 중...</p>
                <p className="text-xs text-gray-400">15~30초 소요됩니다</p>
              </div>
            </div>
          )}
          {compositeInfo && (
            <div className="absolute top-3 left-3 bg-violet-600 text-white text-xs px-3 py-1.5 rounded-full">
              AI 합성 완료 ({compositeInfo.time}초)
            </div>
          )}
        </div>

        {/* 바닥재 패널 */}
        <MaterialPanel
          materials={materials}
          onAdd={handleAddMaterial}
          onRemove={handleRemoveMaterial}
          selected={selectedMaterial}
          onSelect={handleMaterialSelect}
          disabled={polygon.length === 0}
        />
      </div>

      {/* 합성 이력 */}
      <HistoryPanel
        onSelect={async (thumbnail) => {
          await engineRef.current?.loadBaseImage(thumbnail)
        }}
      />
    </div>
  )
}
