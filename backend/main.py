"""TerraceView FastAPI Backend - AI 바닥재 합성"""
from dotenv import load_dotenv
load_dotenv()

import os
import io
import numpy as np
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import uvicorn

from models.schemas import CompositeRequest, CompositeResponse, SegmentResponse
from services.ai_composite import composite_with_ai
from services.segmentation import SegmentationService

seg_service = SegmentationService()

app = FastAPI(title="TerraceView API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # TODO: 프로덕션에서는 특정 도메인만 허용
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok", "version": "0.2.0", "sam_loaded": seg_service.is_loaded}


@app.post("/api/segment", response_model=SegmentResponse)
async def segment_floor(file: UploadFile = File(...)):
    """이미지 → 바닥 영역 폴리곤 반환 (SAM or 폴백)"""
    ALLOWED = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in ALLOWED:
        raise HTTPException(400, "JPG, PNG, WEBP만 지원합니다")

    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(400, "파일 크기는 20MB 이하여야 합니다")

    img = Image.open(io.BytesIO(data)).convert("RGB")

    max_side = 1500
    if max(img.size) > max_side:
        ratio = max_side / max(img.size)
        img = img.resize((int(img.width * ratio), int(img.height * ratio)), Image.LANCZOS)

    img_array = np.array(img)
    polygon, confidence = seg_service.segment_floor(img_array)

    return SegmentResponse(
        polygon=polygon,
        confidence=confidence,
        image_width=img.width,
        image_height=img.height,
    )


@app.post("/api/composite", response_model=CompositeResponse)
async def composite_floor(req: CompositeRequest):
    """AI 인페인팅으로 바닥재 합성

    - image: base64 인코딩된 원본 사진
    - polygon: 바닥 영역 폴리곤 좌표
    - material_name: 바닥재 이름 (프롬프트 생성용)
    - material_image: (선택) base64 인코딩된 텍스처 이미지
    """
    if len(req.polygon) < 3:
        raise HTTPException(400, "폴리곤은 최소 3개 점이 필요합니다")

    polygon_dicts = [{"x": p.x, "y": p.y} for p in req.polygon]

    if not req.material_image:
        raise HTTPException(400, "바닥재 텍스처 이미지를 업로드해주세요")

    api_key = os.environ.get("GOOGLE_API_KEY", "")

    result_b64, provider, elapsed = await composite_with_ai(
        image_b64=req.image,
        polygon=polygon_dicts,
        material_name=req.material_name,
        material_image_b64=req.material_image,
        tile_scale=req.tile_scale,
        api_key=api_key,
    )

    return CompositeResponse(
        result_image=result_b64,
        provider=provider,
        processing_time=round(elapsed, 2),
    )


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
