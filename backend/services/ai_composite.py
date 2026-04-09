"""고품질 바닥재 합성 서비스

빠른 미리보기: 서버사이드 타일링 + 조명 (0.1초)
AI 실사 합성: 미리보기 결과 → Gemini로 자연스럽게 리파인 (10~20초)
"""
import base64
import io
import time
import random
import numpy as np
from typing import List, Tuple, Optional

from PIL import Image, ImageDraw, ImageFilter, ImageEnhance, ImageChops

try:
    from google import genai
    from google.genai import types
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False


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


def _precomposite(
    original: Image.Image,
    texture: Image.Image,
    mask: Image.Image,
    tile_scale: float,
    for_ai: bool = False,
) -> Image.Image:
    """빠른 미리보기용 사전 합성

    for_ai=True: AI 리파인용 (조명 약하게 → 재료 색상 보존)
    for_ai=False: 최종 미리보기용 (조명 반영)
    """
    w, h = original.size
    tile_w = max(int(w * tile_scale), 32)

    variants = _create_tile_variants(texture, tile_w)
    tiled = _tile_with_overlap_blend(variants, w, h)

    if for_ai:
        # AI용: 조명 최소화하여 재료 원본 색상 최대 보존
        lit_tiled = _apply_light_luminance(original, tiled, strength=0.10)
    else:
        lit_tiled = _apply_light_luminance(original, tiled, strength=0.35)

    feathered = _inward_feather_mask(mask, radius=4)
    return Image.composite(lit_tiled, original, feathered)


async def _refine_with_ai(
    pre_composited: Image.Image,
    texture: Image.Image,
    material_name: str,
    api_key: str,
) -> Image.Image:
    """사전 합성 이미지를 AI로 자연스럽게 리파인"""
    if not GENAI_AVAILABLE:
        raise RuntimeError("google-genai 패키지가 필요합니다")

    client = genai.Client(api_key=api_key)

    img_bytes = io.BytesIO()
    pre_composited.save(img_bytes, format="JPEG", quality=92)

    tex_bytes = io.BytesIO()
    texture.resize((512, 512), Image.LANCZOS).save(tex_bytes, format="JPEG", quality=90)

    response = client.models.generate_content(
        model="gemini-2.5-flash-image",
        contents=[
            types.Part.from_text(text=
                f"[MATERIAL] This is the exact flooring material '{material_name}' - note the specific colors, shapes, and sizes:"
            ),
            types.Part.from_bytes(data=tex_bytes.getvalue(), mime_type="image/jpeg"),
            types.Part.from_text(text=
                "[COMPOSITED PHOTO] The material above has been placed on this terrace floor. "
                "Make it look photorealistic:"
            ),
            types.Part.from_bytes(data=img_bytes.getvalue(), mime_type="image/jpeg"),
            types.Part.from_text(text=
                "STRICT RULES - VIOLATING ANY RULE IS UNACCEPTABLE:"
                "\n- NEVER change the material. The floor must use the EXACT SAME material from the [MATERIAL] image - same colors (pink, white, gray, beige pebbles), same shapes, same textures."
                "\n- NEVER change the size of pieces. Every pebble/stone/tile must stay the EXACT SAME SIZE as in the composited photo."
                "\n- NEVER darken the image. Maintain the same overall brightness."
                "\n- Your ONLY job: blend the floor naturally with the surrounding scene. Add subtle 3D depth between pieces, remove any visible repeating seam lines, and make the edges where floor meets walls/bench look like a real installation."
                "\n- Keep the background scene (walls, bench, plants, sky, pergola) unchanged."
            ),
        ],
        config=types.GenerateContentConfig(
            response_modalities=["TEXT", "IMAGE"],
        ),
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data and part.inline_data.data:
            return Image.open(io.BytesIO(part.inline_data.data)).convert("RGB")

    raise RuntimeError("AI가 이미지를 생성하지 못했습니다")


async def composite_with_ai(
    image_b64: str,
    polygon: List[dict],
    material_name: str,
    material_image_b64: Optional[str] = None,
    tile_scale: float = 0.25,
    api_key: str = "",
) -> Tuple[str, str, float]:
    """사전 합성 → AI 리파인"""
    start = time.time()

    original = base64_to_image(image_b64).convert("RGB")
    w, h = original.size

    if not material_image_b64:
        raise RuntimeError("바닥재 텍스처 이미지가 필요합니다")

    texture = base64_to_image(material_image_b64).convert("RGB")
    mask = polygon_to_mask(polygon, w, h)

    print(f"[Composite] size={w}x{h}, tile_scale={tile_scale}")

    # Step 1: 사전 합성
    pre_composited = _precomposite(original, texture, mask, tile_scale, for_ai=False)

    # Step 2: AI 리파인 (API 키가 있으면)
    if api_key and GENAI_AVAILABLE:
        # AI용은 조명 약하게 (재료 색상 보존)
        pre_for_ai = _precomposite(original, texture, mask, tile_scale, for_ai=True)
        try:
            ai_result = await _refine_with_ai(pre_for_ai, texture, material_name, api_key)
            if ai_result.size != (w, h):
                ai_result = ai_result.resize((w, h), Image.LANCZOS)
            elapsed = time.time() - start
            return image_to_base64(ai_result), "gemini-refined", elapsed
        except Exception as e:
            print(f"[AI Refine Failed] {e}, falling back to server composite")

    # AI 실패 시 사전 합성 결과 반환
    elapsed = time.time() - start
    return image_to_base64(pre_composited), "server-composite", elapsed
