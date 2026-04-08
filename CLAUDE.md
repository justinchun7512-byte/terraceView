# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project: TerraceView — AI 바닥재 시공 미리보기

테라스/발코니 사진을 업로드하면 바닥 영역을 인식하고, 바닥재(자갈, 타일, 목재 등) 텍스처를 실제처럼 합성하여 시공 전에 미리 확인하는 서비스.

## Current State

프로젝트는 아직 디렉토리 구조 없이 루트에 소스 파일이 플랫하게 존재. `frontend/`, `backend/` 구조로 정리 필요.

**프론트엔드** (Next.js 14, App Router):
- `UploadZone.tsx` — react-dropzone 기반 이미지 업로드 (max 20MB, JPG/PNG/WEBP/HEIC)
- `PreviewEditor.tsx` — 메인 에디터 오케스트레이터 (캔버스 + 폴리곤 + 바닥재 패널)
- `MaterialPanel.tsx` — 바닥재 10종 선택 UI, 카테고리 필터 (자갈/타일/목재/콘크리트)
- `PolygonEditor.tsx` — SVG 기반 클릭 폴리곤 드로잉 (viewBox 100x100, 좌표 변환 포함)
- `canvas-engine.ts` — 핵심 합성 엔진 (`TerraceCanvasEngine` 클래스)

**백엔드** (FastAPI):
- `main.py` — `/api/segment` (SAM), `/api/materials` (바닥재 목록), `/health`
- `segmentation.py` — `SegmentationService` (SAM or 폴백)

## Architecture: 합성 파이프라인

핵심 데이터 흐름: 이미지 업로드 → 바닥 영역 지정(수동 폴리곤 or AI) → 바닥재 선택 → Canvas 합성 → 다운로드

**합성 알고리즘** (`TerraceCanvasEngine.compositeTexture`):
1. 텍스처를 오프스크린 캔버스에 타일링 (캔버스 35% 단위, max 320px)
2. 마스크 폴리곤으로 클리핑
3. `multiply` blend (opacity 0.72) — 원본 조명/그림자 보존
4. `screen` blend (opacity 0.20) — 어두운 영역 밝기 보정
5. 텍스처 이미지 로드 실패 시 `applyColorFallback`으로 단색 합성

**SAM 세그멘테이션** (`SegmentationService`):
- 힌트 포인트: 하단 중앙+좌우 4개 positive, 상단 1개 negative
- 신뢰도+면적 조합 점수로 최적 마스크 선택
- `_mask_to_polygon`: 모폴로지 → 컨투어 → Douglas-Peucker 단순화
- SAM 미설치 시 폴백: 하단 60% 사다리꼴 영역 반환 (confidence 0.5)

## Key Technical Decisions

- **Canvas 합성은 클라이언트 사이드**: 서버 왕복 없이 < 200ms 목표
- **SVG 폴리곤 에디터**: Fabric.js 대신 순수 SVG (의존성 최소화)
- **텍스처/SAM 폴백**: 텍스처 없으면 단색, SAM 없으면 하단 60% → MVP 항상 동작
- **바닥재 데이터**: `MaterialPanel.tsx`의 `MATERIALS` 배열에 하드코딩 (10종)

## Development Commands

```bash
# 프론트엔드 (구조 정리 후)
cd frontend && npm install && npm run dev  # localhost:3000

# 백엔드
cd backend && pip install -r requirements.txt && python main.py  # localhost:8000

# SAM 모델 (선택, ~2.5GB)
wget -P backend/models https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth
pip install git+https://github.com/facebookresearch/segment-anything.git
```

## Environment Variables

```
NEXT_PUBLIC_API_URL=http://localhost:8000
```

## Development Phases

1. **MVP (현재)**: UploadZone → PolygonEditor → MaterialPanel → 다운로드 (수동 방식)
2. **Phase 2**: SAM 백엔드 연동 (`handleAutoSegment` in PreviewEditor)
3. **Phase 3**: 텍스처 이미지 에셋, Before/After 슬라이더, 공유 기능

## Adding Materials

`MaterialPanel.tsx`의 `MATERIALS` 배열에 항목 추가. 텍스처 이미지는 `public/materials/{category}/` 에 512x512px 이상 seamless tileable JPG.
