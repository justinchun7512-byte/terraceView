'use client'
import { useState, useEffect } from 'react'
import { Clock, Trash2 } from 'lucide-react'
import { getHistory, clearHistory, type HistoryItem } from '@/lib/history'

interface Props {
  onSelect: (thumbnail: string) => void
}

export default function HistoryPanel({ onSelect }: Props) {
  const [items, setItems] = useState<HistoryItem[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    setItems(getHistory())
  }, [])

  // 외부에서 이력 추가 후 갱신할 수 있도록
  useEffect(() => {
    const handler = () => setItems(getHistory())
    window.addEventListener('history-updated', handler)
    return () => window.removeEventListener('history-updated', handler)
  }, [])

  if (items.length === 0) return null

  const formatDate = (iso: string) => {
    const d = new Date(iso)
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-800">합성 이력</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{items.length}</span>
        </div>
        <span className="text-xs text-gray-400">{expanded ? '접기' : '펼치기'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100">
          <div className="grid grid-cols-3 gap-2 p-3 max-h-64 overflow-y-auto">
            {items.map(item => (
              <button
                key={item.id}
                onClick={() => onSelect(item.thumbnail)}
                className="rounded-lg overflow-hidden border border-gray-100 hover:border-violet-300 transition-colors text-left group"
              >
                <img
                  src={item.thumbnail}
                  alt={item.materialName}
                  className="w-full h-20 object-cover"
                />
                <div className="px-1.5 py-1 bg-gray-50">
                  <p className="text-xs font-medium text-gray-700 truncate">{item.materialName}</p>
                  <p className="text-xs text-gray-400">{formatDate(item.createdAt)}</p>
                </div>
              </button>
            ))}
          </div>
          <div className="px-3 pb-3">
            <button
              onClick={() => { clearHistory(); setItems([]) }}
              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-500 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              이력 전체 삭제
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
