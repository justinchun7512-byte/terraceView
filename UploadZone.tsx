'use client'
import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, ImageIcon } from 'lucide-react'

interface Props {
  onUpload: (src: string) => void
}

export default function UploadZone({ onUpload }: Props) {
  const [error, setError] = useState<string>('')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError('')
    const file = acceptedFiles[0]
    if (!file) return
    if (file.size > 20 * 1024 * 1024) {
      setError('파일 크기가 20MB를 초과합니다.')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      onUpload(e.target?.result as string)
    }
    reader.readAsDataURL(file)
  }, [onUpload])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [], 'image/heic': [] },
    maxFiles: 1,
  })

  return (
    <div className="w-full max-w-2xl">
      <div
        {...getRootProps()}
        className={`
          border-2 border-dashed rounded-2xl p-16 text-center cursor-pointer transition-all
          ${isDragActive
            ? 'border-emerald-400 bg-emerald-50'
            : 'border-gray-200 bg-white hover:border-emerald-300 hover:bg-gray-50'
          }
        `}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center">
            <Upload className="w-8 h-8 text-emerald-600" />
          </div>
          {isDragActive ? (
            <p className="text-emerald-600 font-medium">여기에 놓으세요!</p>
          ) : (
            <>
              <div>
                <p className="text-gray-800 font-semibold text-lg">테라스 사진 업로드</p>
                <p className="text-gray-400 text-sm mt-1">클릭하거나 파일을 드래그하세요</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <ImageIcon className="w-3 h-3" />
                <span>JPG, PNG, WEBP, HEIC · 최대 20MB</span>
              </div>
            </>
          )}
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-500 text-center">{error}</p>}

      {/* 예시 이미지 힌트 */}
      <div className="mt-6 p-4 bg-amber-50 border border-amber-100 rounded-xl">
        <p className="text-xs text-amber-700 font-medium mb-2">💡 좋은 결과를 위한 팁</p>
        <ul className="text-xs text-amber-600 space-y-1 list-disc list-inside">
          <li>바닥이 넓게 보이는 각도에서 찍은 사진이 좋습니다</li>
          <li>자연광 아래에서 찍으면 합성이 더 자연스럽습니다</li>
          <li>바닥 위에 물건이 없을수록 정확도가 높아집니다</li>
        </ul>
      </div>
    </div>
  )
}
