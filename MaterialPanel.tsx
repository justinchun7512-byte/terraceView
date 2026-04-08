'use client'
import { useState } from 'react'

interface Material {
  id: string
  name: string
  category: string
  src: string
  color: string  // MVP: 실제 텍스처 이미지 대신 색상 미리보기
}

const MATERIALS: Material[] = [
  // 자갈·조약돌
  { id: 'gravel/mix-pastel', name: '믹스 파스텔 자갈', category: '자갈·조약돌', src: '/materials/gravel/mix_pastel.jpg', color: '#d4b8d0' },
  { id: 'gravel/dark-gray', name: '다크 그레이 자갈', category: '자갈·조약돌', src: '/materials/gravel/dark_gray.jpg', color: '#6b6b72' },
  { id: 'gravel/pink-marble', name: '핑크 마블 자갈', category: '자갈·조약돌', src: '/materials/gravel/pink_marble.jpg', color: '#c8a0a0' },
  { id: 'gravel/white-pebble', name: '화이트 자갈', category: '자갈·조약돌', src: '/materials/gravel/white_pebble.jpg', color: '#e8e4e0' },
  // 타일
  { id: 'tile/natural-stone', name: '내추럴 스톤 타일', category: '타일', src: '/materials/tile/natural_stone.jpg', color: '#b8a890' },
  { id: 'tile/concrete', name: '콘크리트 타일', category: '타일', src: '/materials/tile/concrete.jpg', color: '#9a9a9a' },
  // 목재
  { id: 'wood/ipe', name: 'IPE 하드우드 데크', category: '목재', src: '/materials/wood/ipe.jpg', color: '#7a5a3a' },
  { id: 'wood/pine', name: '파인 우드 데크', category: '목재', src: '/materials/wood/pine.jpg', color: '#c8a070' },
  // 콘크리트
  { id: 'concrete/exposed', name: '노출 콘크리트', category: '콘크리트', src: '/materials/concrete/exposed.jpg', color: '#808080' },
  { id: 'concrete/polished', name: '폴리싱 콘크리트', category: '콘크리트', src: '/materials/concrete/polished.jpg', color: '#a0a0b0' },
]

const CATEGORIES = ['전체', '자갈·조약돌', '타일', '목재', '콘크리트']

interface Props {
  selected: string | null
  onSelect: (src: string) => void
  disabled?: boolean
}

export default function MaterialPanel({ selected, onSelect, disabled }: Props) {
  const [cat, setCat] = useState('전체')

  const filtered = cat === '전체' ? MATERIALS : MATERIALS.filter(m => m.category === cat)

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 pt-4 pb-3 border-b border-gray-100">
        <p className="text-sm font-semibold text-gray-800 mb-3">바닥재 선택</p>
        {disabled && (
          <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-2">
            먼저 바닥 영역을 지정해 주세요
          </p>
        )}
        {/* 카테고리 필터 */}
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`text-xs px-2.5 py-1 rounded-full transition-colors ${
                cat === c
                  ? 'bg-emerald-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      {/* 바닥재 목록 */}
      <div className="overflow-y-auto flex-1 p-3 grid grid-cols-2 gap-2">
        {filtered.map(mat => (
          <button
            key={mat.id}
            onClick={() => !disabled && onSelect(mat.src)}
            disabled={disabled}
            className={`
              rounded-xl overflow-hidden text-left transition-all border-2
              ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:scale-[1.02]'}
              ${selected === mat.src ? 'border-emerald-500' : 'border-transparent'}
            `}
          >
            {/* 색상 미리보기 (MVP: 실제 이미지로 교체) */}
            <div
              className="h-16 w-full"
              style={{ backgroundColor: mat.color }}
            />
            <div className="bg-gray-50 px-2 py-1.5">
              <p className="text-xs font-medium text-gray-700 leading-tight">{mat.name}</p>
              <p className="text-xs text-gray-400">{mat.category}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
