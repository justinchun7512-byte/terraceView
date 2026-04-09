'use client'
import { useRef, useCallback, useState } from 'react'
import { Upload, X } from 'lucide-react'
import TextureCropper from './TextureCropper'

interface UploadedMaterial {
  id: string
  name: string
  src: string
  thumbnail: string
}

interface Props {
  materials: UploadedMaterial[]
  onAdd: (mat: UploadedMaterial) => void
  onRemove: (id: string) => void
  selected: string | null
  onSelect: (src: string, name?: string) => void
  disabled?: boolean
}

interface PendingFile {
  src: string
  name: string
}

export default function MaterialPanel({ materials, onAdd, onRemove, selected, onSelect, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const pending: PendingFile[] = []
    let loaded = 0
    const total = files.length

    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = (ev) => {
        pending.push({
          src: ev.target?.result as string,
          name: file.name.replace(/\.[^.]+$/, ''),
        })
        loaded++
        if (loaded === total) {
          setPendingFiles(pending)
        }
      }
      reader.readAsDataURL(file)
    })
    e.target.value = ''
  }, [])

  const handleCropConfirm = useCallback((croppedDataUrl: string, name: string) => {
    onAdd({
      id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      src: croppedDataUrl,
      thumbnail: croppedDataUrl,
    })
    setPendingFiles(prev => prev.slice(1))
  }, [onAdd])

  const handleCropCancel = useCallback(() => {
    setPendingFiles(prev => prev.slice(1))
  }, [])

  return (
    <>
      {/* 크롭 모달 */}
      {pendingFiles.length > 0 && (
        <TextureCropper
          imageSrc={pendingFiles[0].src}
          fileName={pendingFiles[0].name}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
        <div className="px-4 pt-4 pb-3 border-b border-gray-100">
          <p className="text-sm font-semibold text-gray-800 mb-3">바닥재 선택</p>
          {disabled && (
            <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-2">
              먼저 바닥 영역을 지정해 주세요
            </p>
          )}
          <button
            onClick={() => inputRef.current?.click()}
            className="w-full flex items-center justify-center gap-2 text-sm text-emerald-600 border border-dashed border-emerald-300 rounded-lg px-3 py-2.5 hover:bg-emerald-50 transition-colors"
          >
            <Upload className="w-4 h-4" />
            바닥재 이미지 추가
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>

        {/* 바닥재 목록 */}
        <div className="overflow-y-auto flex-1 p-3 grid grid-cols-2 gap-2">
          {materials.length === 0 && (
            <div className="col-span-2 text-center py-8 text-gray-400 text-xs">
              바닥재 이미지를 업로드하세요
            </div>
          )}
          {materials.map(mat => (
            <div key={mat.id} className="relative group">
              <button
                onClick={() => !disabled && onSelect(mat.src, mat.name)}
                disabled={disabled}
                className={`
                  w-full rounded-xl overflow-hidden text-left transition-all border-2
                  ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]'}
                  ${selected === mat.src ? 'border-emerald-500' : 'border-transparent'}
                `}
              >
                <img
                  src={mat.thumbnail}
                  alt={mat.name}
                  className="h-20 w-full object-cover"
                />
                <div className="bg-gray-50 px-2 py-1.5">
                  <p className="text-xs font-medium text-gray-700 leading-tight truncate">{mat.name}</p>
                </div>
              </button>
              <button
                onClick={() => onRemove(mat.id)}
                className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
