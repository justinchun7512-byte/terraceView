'use client'
import { useState } from 'react'
import UploadZone from '@/components/UploadZone'
import PreviewEditor from '@/components/PreviewEditor'

export default function Home() {
  const [imageSrc, setImageSrc] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">TerraceView</h1>
            <p className="text-sm text-gray-500">AI 바닥재 시공 미리보기</p>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {!imageSrc ? (
          <div className="flex flex-col items-center pt-12">
            <UploadZone onUpload={setImageSrc} />
          </div>
        ) : (
          <PreviewEditor
            imageSrc={imageSrc}
            onReset={() => setImageSrc(null)}
          />
        )}
      </main>
    </div>
  )
}
