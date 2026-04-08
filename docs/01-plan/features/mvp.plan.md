# Plan: TerraceView MVP

> 테라스/발코니 사진에 바닥재 텍스처를 실시간 합성하여 시공 전 미리보기 제공

## 1. 개요

| 항목 | 내용 |
|------|------|
| Feature | MVP (수동 바닥재 합성 미리보기) |
| 우선순위 | P0 |
| 목표 | 사진 업로드 → 바닥 영역 수동 지정 → 바닥재 선택 → 합성 미리보기 → PNG 다운로드 |
| 대상 사용자 | 테라스 리모델링 계획 중인 홈오너, 인테리어 시공업체, 디자이너 |

## 2. 핵심 기능 (P0)

| # | 기능 | 설명 | 컴포넌트 |
|---|------|------|----------|
| F1 | 이미지 업로드 | 드래그앤드롭, JPG/PNG/WEBP/HEIC, 최대 20MB | UploadZone |
| F2 | 수동 폴리곤 바닥 영역 선택 | SVG 클릭 기반 다각형 그리기 (최소 3점) | PolygonEditor |
| F3 | 바닥재 라이브러리 | 4개 카테고리, 10종 바닥재, 카테고리 필터 | MaterialPanel |
| F4 | Canvas 실시간 합성 | multiply+screen blend, 불투명도 조절 (30~100%) | canvas-engine.ts |
| F5 | 결과 PNG 다운로드 | 합성 결과를 PNG로 저장 | PreviewEditor |

## 3. 기능 상세

### F1. 이미지 업로드 (UploadZone)
- react-dropzone 기반 드래그앤드롭
- 허용 포맷: JPEG, PNG, WEBP, HEIC
- 파일 크기 제한: 20MB
- FileReader.readAsDataURL로 클라이언트 로컬 처리
- 업로드 팁 UI 제공 (촬영 각도, 조명, 장애물 안내)

### F2. 폴리곤 바닥 영역 선택 (PolygonEditor)
- SVG 오버레이 위에서 클릭으로 꼭짓점 추가
- viewBox 100x100 + 실제 이미지 좌표 변환 (scaleX/scaleY)
- 실시간 다각형 미리보기 (반투명 emerald)
- Undo 기능 (마지막 점 제거)
- 최소 3점 이상 시 완료 가능

### F3. 바닥재 라이브러리 (MaterialPanel)
- 카테고리: 자갈/조약돌(4), 타일(2), 목재(2), 콘크리트(2)
- MVP 단계: 텍스처 이미지 없이 색상 미리보기 (color 속성)
- 텍스처 이미지 로드 실패 시 단색 폴백 합성
- 바닥 영역 미지정 시 비활성화 + 안내 메시지

### F4. Canvas 합성 엔진 (TerraceCanvasEngine)
- 텍스처 타일링: 캔버스 35% 단위, 최대 320px
- 합성 파이프라인:
  1. 오프스크린 캔버스에 텍스처 타일링
  2. 폴리곤 클리핑
  3. multiply blend (기본 opacity 0.72) - 조명/그림자 보존
  4. screen blend (opacity 0.20) - 어두운 영역 보정
- 불투명도 슬라이더 (30~100%) 실시간 반영
- 폴백: 텍스처 이미지 없으면 colorMap 기반 단색 multiply

### F5. 결과 다운로드
- canvas.toDataURL('image/png')로 변환
- 파일명: terrace-preview.png

## 4. 비기능 요구사항

| 항목 | 목표 |
|------|------|
| 합성 응답 속도 | < 200ms (클라이언트 사이드) |
| 최대 이미지 크기 | 20MB |
| 브라우저 지원 | Chrome, Safari, Edge 최신 |
| 모바일 | 반응형 (Phase 3에서 최적화) |

## 5. 현재 구현 상태

| 컴포넌트 | 파일 | 상태 |
|----------|------|------|
| UploadZone | `UploadZone.tsx` | 코드 작성 완료, 프로젝트 구조 미정리 |
| PolygonEditor | `PolygonEditor.tsx` | 코드 작성 완료, 프로젝트 구조 미정리 |
| MaterialPanel | `MaterialPanel.tsx` | 코드 작성 완료, 프로젝트 구조 미정리 |
| PreviewEditor | `PreviewEditor.tsx` | 코드 작성 완료, 프로젝트 구조 미정리 |
| canvas-engine | `canvas-engine.ts` | 코드 작성 완료, 프로젝트 구조 미정리 |
| FastAPI backend | `main.py`, `segmentation.py` | 코드 작성 완료, 프로젝트 구조 미정리 |
| Next.js 프로젝트 | `frontend/` | 미생성 (npm init 필요) |
| 바닥재 텍스처 | `public/materials/` | 미생성 (색상 폴백으로 MVP 동작 가능) |

## 6. 구현 우선순위

```
Step 1: 프로젝트 구조 셋업
  - frontend/ Next.js 14 프로젝트 생성 (App Router)
  - backend/ FastAPI 구조 정리
  - 소스 파일을 올바른 위치로 이동

Step 2: 프론트엔드 핵심 플로우
  - page.tsx (메인 페이지: 업로드 → 에디터 전환)
  - layout.tsx (공통 레이아웃)
  - 컴포넌트 배치 및 import 경로 확인

Step 3: 통합 테스트
  - 업로드 → 폴리곤 그리기 → 바닥재 선택 → 합성 → 다운로드 전체 플로우
  - 텍스처 폴백 (색상) 동작 확인
  - 불투명도 조절 동작 확인

Step 4: 바닥재 텍스처 이미지 추가 (선택)
  - public/materials/{category}/ 에 512x512 seamless JPG 배치
  - MATERIALS 배열의 src 경로와 일치 확인
```

## 7. MVP 이후 (Phase 2~3)

| Phase | 기능 | 의존성 |
|-------|------|--------|
| Phase 2 | AI 자동 바닥 인식 (SAM) | backend 연동, SAM 모델 다운로드 |
| Phase 3 | Before/After 슬라이더 | MVP 완료 |
| Phase 3 | 공유 링크 생성 | Supabase Storage |
| Phase 3 | 모바일 최적화 | MVP 완료 |
| Phase 3 | 커스텀 텍스처 업로드 | MVP 완료 |

## 8. 성공 지표

- 전체 플로우 (업로드→합성→다운로드) 정상 동작
- 합성 응답 속도 < 200ms
- 이미지 다운로드 전환율 목표: 40% 이상
