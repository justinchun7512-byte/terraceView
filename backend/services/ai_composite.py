"""고품질 바닥재 합성 서비스 - 서버사이드 이미지 프로세싱 v2

1. 텍스처 변형본 여러개 생성 (회전/플립/색조)
2. 랜덤 배치 + 오버랩 알파 블렌딩으로 이음새 제거
3. 원본 조명 가볍게 적용
4. 안쪽 페더링으로 깔끔한 경계
"""
import base64
import io
import time
import random
import numpy as np
from typing import List, Tuple, Optional

from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops


def polygon_to_mask(polygon: List[dict], width: int, height: int) -> Image.Image:
    mask = Image.new("L", (width, height), 0)
    draw = ImageDraw.Draw(mask)
    pts = [(int(p["x"]), int(p["y"])) for p in polygon]
    if len(pts) >= 3:
        draw.polygon(pts, fill=255)
    return mask


def image_to_base64(img: Image.Image, fmt: str = "PNG") -> str:
    buf = io.BytesIO()
    img.save(buf, format=fmt)
    return base64.b64encode(buf.getvalue()).decode()


def base64_to_image(b64: str) -> Image.Image:
    if "," in b64:
        b64 = b64.split(",", 1)[1]
    return Image.open(io.BytesIO(base64.b64decode(b64)))


def _create_tile_variants(texture: Image.Image, tile_w: int) -> list:
    """텍스처로부터 8개의 변형본 생성 (회전/플립/밝기)"""
    tile_h = int(tile_w * texture.height / texture.width)
    base = texture.resize((tile_w, tile_h), Image.LANCZOS)

    variants = []
    for flip_h in [False, True]:
        for flip_v in [False, True]:
            t = base.copy()
            if flip_h:
                t = t.transpose(Image.FLIP_LEFT_RIGHT)
            if flip_v:
                t = t.transpose(Image.FLIP_TOP_BOTTOM)
            variants.append(t)

            # 밝기 변형본 추가
            enhancer = ImageEnhance.Brightness(t)
            variants.append(enhancer.enhance(0.95))

    return variants


def _tile_with_overlap_blend(variants: list, canvas_w: int, canvas_h: int) -> Image.Image:
    """랜덤 변형본 배치 + 오버랩 영역 알파 블렌딩으로 이음새 제거"""
    tile_w, tile_h = variants[0].size
    overlap = max(tile_w // 5, 8)  # 오버랩: 타일 너비의 20%

    step_x = tile_w - overlap
    step_y = tile_h - overlap

    canvas = Image.new("RGB", (canvas_w, canvas_h))
    canvas_arr = np.array(canvas, dtype=np.float32)
    weight_arr = np.zeros((canvas_h, canvas_w), dtype=np.float32)

    random.seed(12345)

    for gx, tx in enumerate(range(0, canvas_w + tile_w, step_x)):
        for gy, ty in enumerate(range(0, canvas_h + tile_h, step_y)):
            # 랜덤 변형본 선택
            variant = random.choice(variants)
            v_arr = np.array(variant, dtype=np.float32)
            vw, vh = variant.size

            # 가장자리 페이드 마스크 (오버랩 영역에서 부드러운 전환)
            fade = np.ones((vh, vw), dtype=np.float32)
            for i in range(overlap):
                alpha = i / overlap
                fade[:, i] = np.minimum(fade[:, i], alpha)         # 왼쪽
                fade[:, vw - 1 - i] = np.minimum(fade[:, vw - 1 - i], alpha)  # 오른쪽
                fade[i, :] = np.minimum(fade[i, :], alpha)         # 위
                fade[vh - 1 - i, :] = np.minimum(fade[vh - 1 - i, :], alpha)  # 아래

            # 캔버스에 블렌딩
            y1 = max(ty, 0)
            y2 = min(ty + vh, canvas_h)
            x1 = max(tx, 0)
            x2 = min(tx + vw, canvas_w)

            sy1 = y1 - ty
            sy2 = sy1 + (y2 - y1)
            sx1 = x1 - tx
            sx2 = sx1 + (x2 - x1)

            if sy2 <= sy1 or sx2 <= sx1:
                continue

            tile_region = v_arr[sy1:sy2, sx1:sx2]
            fade_region = fade[sy1:sy2, sx1:sx2]

            for c in range(3):
                canvas_arr[y1:y2, x1:x2, c] += tile_region[:, :, c] * fade_region
            weight_arr[y1:y2, x1:x2] += fade_region

    # 가중 평균
    weight_arr = np.maximum(weight_arr, 0.001)
    for c in range(3):
        canvas_arr[:, :, c] /= weight_arr

    return Image.fromarray(canvas_arr.clip(0, 255).astype(np.uint8))


def _apply_light_luminance(original: Image.Image, tiled: Image.Image, strength: float = 0.35) -> Image.Image:
    """원본의 그림자/음영을 텍스처에 적용.

    밝은 영역은 거의 건드리지 않고, 어두운 영역(그림자)만 선택적으로 어둡게.
    → 전체가 어두워지지 않으면서 그림자/음영은 자연스럽게 표현.
    """
    orig_arr = np.array(original, dtype=np.float32)
    tex_arr = np.array(tiled, dtype=np.float32)

    # 원본 luminance (0~255)
    orig_lum = 0.299 * orig_arr[:, :, 0] + 0.587 * orig_arr[:, :, 1] + 0.114 * orig_arr[:, :, 2]
    mean_lum = max(np.mean(orig_lum), 1.0)

    # 상대 밝기: 1.0 = 평균, <1 = 그림자, >1 = 밝은 곳
    ratio = orig_lum / mean_lum

    # 그림자만 적용: ratio < 1인 부분만 strength 적용, 밝은 부분은 거의 그대로
    # 그림자는 강하게, 밝은 곳은 약하게
    shadow_factor = np.where(
        ratio < 0.85,
        1.0 + (ratio - 1.0) * strength * 1.8,  # 진한 그림자: 강하게
        np.where(
            ratio < 1.0,
            1.0 + (ratio - 1.0) * strength,  # 약한 그림자: 보통
            1.0 + (ratio - 1.0) * strength * 0.1,  # 밝은곳: 거의 안 건드림
        ),
    )
    shadow_factor = np.clip(shadow_factor, 0.3, 1.1)

    result = tex_arr.copy()
    for c in range(3):
        result[:, :, c] = tex_arr[:, :, c] * shadow_factor

    return Image.fromarray(result.clip(0, 255).astype(np.uint8))


def _inward_feather_mask(mask: Image.Image, radius: int = 4) -> Image.Image:
    """안쪽으로만 페더링 (바깥 누출 0%)"""
    eroded = mask.filter(ImageFilter.MinFilter(size=radius * 2 + 1))
    blurred = eroded.filter(ImageFilter.GaussianBlur(radius=radius))
    mask_arr = np.array(mask, dtype=np.float32)
    blur_arr = np.array(blurred, dtype=np.float32)
    return Image.fromarray(np.minimum(mask_arr, blur_arr).astype(np.uint8))


async def composite_with_ai(
    image_b64: str,
    polygon: List[dict],
    material_name: str,
    material_image_b64: Optional[str] = None,
    tile_scale: float = 0.25,
    api_key: str = "",
) -> Tuple[str, str, float]:
    """고품질 서버사이드 합성"""
    start = time.time()

    original = base64_to_image(image_b64).convert("RGB")
    w, h = original.size

    if not material_image_b64:
        raise RuntimeError("바닥재 텍스처 이미지가 필요합니다")

    texture = base64_to_image(material_image_b64).convert("RGB")
    mask = polygon_to_mask(polygon, w, h)

    tile_w = max(int(w * tile_scale), 32)
    print(f"[Composite] size={w}x{h}, tile_scale={tile_scale}, tile_px={tile_w}")

    # Step 1: 타일 변형본 생성
    variants = _create_tile_variants(texture, tile_w)

    # Step 2: 랜덤 배치 + 오버랩 블렌딩
    tiled = _tile_with_overlap_blend(variants, w, h)

    # Step 3: 그림자/음영 적용 (35% - 그림자만 선택적 적용)
    lit_tiled = _apply_light_luminance(original, tiled, strength=0.35)

    # Step 4: 안쪽 페더링
    feathered = _inward_feather_mask(mask, radius=4)

    # Step 5: 합성
    result = Image.composite(lit_tiled, original, feathered)

    elapsed = time.time() - start
    return image_to_base64(result), "server-composite", elapsed
