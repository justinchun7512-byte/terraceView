"""TerraceView FastAPI Backend"""
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import numpy as np
from PIL import Image
import io
import uvicorn
from pathlib import Path

from services.segmentation import SegmentationService
from models.schemas import SegmentResponse, MaterialsResponse

app = FastAPI(title="TerraceView API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://your-domain.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

seg_service = SegmentationService()
MATERIALS_DIR = Path("../frontend/public/materials")


@app.get("/health")
async def health():
    return {"status": "ok", "sam_loaded": seg_service.is_loaded}


@app.post("/api/segment", response_model=SegmentResponse)
async def segment_floor(file: UploadFile = File(...)):
    """이미지 → SAM 세그멘테이션 → 폴리곤 반환"""
    ALLOWED = {"image/jpeg", "image/png", "image/webp"}
    if file.content_type not in ALLOWED:
        raise HTTPException(400, "JPG, PNG, WEBP만 지원합니다")

    data = await file.read()
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(400, "파일 크기는 20MB 이하여야 합니다")

    img = Image.open(io.BytesIO(data)).convert("RGB")

    # 최대 해상도 제한 (SAM 성능)
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


@app.get("/api/materials", response_model=MaterialsResponse)
async def get_materials():
    """바닥재 목록 반환"""
    categories = {
        "gravel": "자갈·조약돌",
        "tile": "타일",
        "wood": "목재",
        "concrete": "콘크리트",
    }
    materials = []
    for cat_dir, cat_name in categories.items():
        cat_path = MATERIALS_DIR / cat_dir
        if cat_path.exists():
            for f in sorted(cat_path.glob("*.jpg")):
                materials.append({
                    "id": f"{cat_dir}/{f.stem}",
                    "name": f.stem.replace("_", " ").title(),
                    "category": cat_name,
                    "src": f"/materials/{cat_dir}/{f.name}",
                    "thumbnail": f"/materials/{cat_dir}/{f.name}",
                })
    return MaterialsResponse(materials=materials)


if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
