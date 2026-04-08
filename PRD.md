# TerraceView PRD — AI 바닥재 시공 미리보기 서비스

## 1. 서비스 개요

**서비스명**: TerraceView  
**핵심 가치**: 테라스/발코니 사진 1장으로, 시공 전에 바닥재가 어떻게 보일지 실시간 합성 미리보기

**타겟 사용자**
- 테라스 리모델링을 계획 중인 개인 홈오너
- 인테리어/조경 시공업체 (고객 제안 자료용)
- 건축/인테리어 디자이너

---

## 2. 핵심 기능 (MVP)

| # | 기능 | 우선순위 |
|---|------|---------|
| 1 | 테라스 사진 업로드 (드래그앤드롭) | P0 |
| 2 | 수동 폴리곤 바닥 영역 선택 | P0 |
| 3 | 바닥재 라이브러리 (10종) | P0 |
| 4 | Canvas 실시간 합성 미리보기 | P0 |
| 5 | 결과 PNG 다운로드 | P0 |
| 6 | AI 자동 바닥 영역 감지 (SAM) | P1 |
| 7 | 불투명도 조절 슬라이더 | P1 |
| 8 | Before/After 비교 슬라이더 | P2 |
| 9 | 공유 링크 생성 | P2 |
| 10 | 커스텀 텍스처 업로드 | P2 |

---

## 3. 기술 아키텍처

```
[Next.js 14 Frontend]
  UploadZone        — react-dropzone, FileReader API
  PolygonEditor     — SVG 기반 폴리곤 드로잉
  canvas-engine.ts  — Canvas API, multiply+screen blend
  MaterialPanel     — 바닥재 목록 + 카테고리 필터

[FastAPI Backend]
  POST /api/segment  — SAM 세그멘테이션
  GET  /api/materials — 바닥재 목록

[AI: Segment Anything Model (Meta)]
  sam_vit_h_4b8939.pth
  힌트 포인트: 바닥 중앙 하단
  네거티브 포인트: 상단 (벽/하늘 제외)

[Storage]
  public/materials/ — 텍스처 이미지 (Next.js static)
```

---

## 4. 합성 알고리즘 상세

### Canvas Blend Mode 조합
```
원본 이미지
    ↓ clip (폴리곤 마스크)
    ↓ multiply (opacity: 0.72) — 조명/그림자 유지
    ↓ screen (opacity: 0.20)  — 어두운 영역 보정
    = 합성 결과
```

### multiply blend 원리
- 픽셀값 = (원본 × 텍스처) / 255
- 밝은 영역 → 텍스처 색 잘 나타남
- 어두운 영역 → 원본 그림자 유지
- 결과: 자연스러운 조명 보존

### 텍스처 타일링
- 캔버스 크기의 35% 단위로 seamless 타일링
- 최대 타일 너비: 320px (성능 균형)

---

## 5. 바닥재 라이브러리

```
자갈·조약돌
  믹스 파스텔 자갈   (핑크·베이지·회색 믹스)
  다크 그레이 자갈   (모던 미니멀)
  핑크 마블 자갈     (따뜻한 내추럴)
  화이트 자갈        (밝고 깔끔)

타일
  내추럴 스톤 타일   (베이지 석재)
  콘크리트 타일      (그레이 모던)

목재
  IPE 하드우드 데크  (진한 브라운)
  파인 우드 데크     (밝은 우드)

콘크리트
  노출 콘크리트      (인더스트리얼)
  폴리싱 콘크리트    (광택 모던)
```

---

## 6. 개발 Phase

### Phase 1 — MVP (3주)
- [x] 프로젝트 셋업 (Next.js + FastAPI)
- [ ] UploadZone 컴포넌트
- [ ] SVG 폴리곤 에디터
- [ ] Canvas 합성 엔진 (canvas-engine.ts)
- [ ] MaterialPanel UI
- [ ] PNG 다운로드

### Phase 2 — AI 자동화 (2주)
- [ ] SAM 모델 서버 설치
- [ ] /api/segment 엔드포인트
- [ ] 자동 감지 + 수동 수정 UI

### Phase 3 — 서비스화 (2주)
- [ ] 바닥재 이미지 에셋 추가 (사진 촬영/구매)
- [ ] Before/After 슬라이더
- [ ] 공유 링크 (Supabase Storage)
- [ ] 모바일 최적화

---

## 7. 성능 요구사항

| 항목 | 목표값 |
|------|--------|
| 바닥재 선택 → 합성 완료 | < 200ms (클라이언트) |
| SAM 세그멘테이션 | < 5초 |
| 최대 이미지 크기 | 20MB |
| SAM 처리 최대 해상도 | 1500px |

---

## 8. 성공 지표 (KPI)

- 주간 미리보기 생성 수
- 이미지 다운로드 전환율 (목표: 40% 이상)
- AI 자동 감지 성공률 (목표: 85% 이상)
- 7일 재방문율
