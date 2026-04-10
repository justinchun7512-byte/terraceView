"""API 요청/응답 스키마"""
from pydantic import BaseModel
from typing import List, Optional


class PointSchema(BaseModel):
    x: float
    y: float


class SegmentResponse(BaseModel):
    polygon: List[PointSchema]
    confidence: float
    image_width: int
    image_height: int


class MaterialInfo(BaseModel):
    id: str
    name: str
    category: str
    src: str
    thumbnail: str


class MaterialsResponse(BaseModel):
    materials: List[MaterialInfo]


class CompositeRequest(BaseModel):
    image: str  # base64 encoded
    polygon: List[PointSchema]
    material_name: str
    material_image: Optional[str] = None  # base64 encoded texture image
    tile_scale: float = 0.25  # 텍스처 타일 크기 (이미지 대비 비율, 0.1~1.0)
    opacity: float = 1.0  # 불투명도 (0.0~1.0, 1.0 = 완전 불투명)


class CompositeResponse(BaseModel):
    result_image: str  # base64 encoded
    provider: str  # "replicate-sdxl" | "flux-fill-pro"
    processing_time: float  # seconds
