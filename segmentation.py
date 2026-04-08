"""SAM 기반 바닥 세그멘테이션 서비스"""
import numpy as np
import cv2
from pathlib import Path
from typing import List, Tuple

try:
    from segment_anything import sam_model_registry, SamPredictor
    SAM_AVAILABLE = True
except ImportError:
    SAM_AVAILABLE = False


class SegmentationService:
    def __init__(self):
        self.predictor = None
        self.is_loaded = False

        # SAM 모델 로드 시도
        model_path = Path("models/sam_vit_h_4b8939.pth")
        if SAM_AVAILABLE and model_path.exists():
            try:
                import torch
                device = "cuda" if torch.cuda.is_available() else "cpu"
                sam = sam_model_registry["vit_h"](checkpoint=str(model_path))
                sam.to(device=device)
                self.predictor = SamPredictor(sam)
                self.is_loaded = True
                print(f"SAM loaded on {device}")
            except Exception as e:
                print(f"SAM load failed: {e}")
        else:
            print("SAM not available — using fallback segmentation")

    def segment_floor(self, image: np.ndarray) -> Tuple[List[dict], float]:
        h, w = image.shape[:2]
        if self.predictor is not None:
            return self._sam_segment(image, h, w)
        return self._fallback_segment(h, w)

    def _sam_segment(self, image, h, w):
        self.predictor.set_image(image)

        # 바닥 영역 힌트 포인트 (하단 중앙 + 좌우)
        input_points = np.array([
            [w // 2, int(h * 0.85)],
            [w // 4, int(h * 0.88)],
            [w * 3 // 4, int(h * 0.88)],
            [w // 2, int(h * 0.70)],
        ])
        input_labels = np.array([1, 1, 1, 1])

        # 배제할 영역 힌트 (상단 = 벽, 하늘)
        neg_points = np.array([[w // 2, int(h * 0.15)]])
        neg_labels = np.array([0])

        all_points = np.vstack([input_points, neg_points])
        all_labels = np.concatenate([input_labels, neg_labels])

        masks, scores, _ = self.predictor.predict(
            point_coords=all_points,
            point_labels=all_labels,
            multimask_output=True,
        )

        # 신뢰도 + 크기 점수 조합
        area_scores = [m.sum() for m in masks]
        combined = [0.7 * s + 0.3 * (a / (h * w)) for s, a in zip(scores, area_scores)]
        best_mask = masks[np.argmax(combined)]

        polygon = self._mask_to_polygon(best_mask)
        return polygon, float(np.max(scores))

    def _mask_to_polygon(self, mask: np.ndarray) -> List[dict]:
        # 모폴로지 연산으로 노이즈 제거
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
        clean = cv2.morphologyEx(mask.astype(np.uint8), cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return []

        largest = max(contours, key=cv2.contourArea)
        epsilon = 0.008 * cv2.arcLength(largest, True)
        approx = cv2.approxPolyDP(largest, epsilon, True)

        return [{"x": int(pt[0][0]), "y": int(pt[0][1])} for pt in approx]

    def _fallback_segment(self, h: int, w: int):
        """SAM 없을 때 — 하단 60% 영역 반환"""
        polygon = [
            {"x": 0,        "y": int(h * 0.52)},
            {"x": int(w * 0.3), "y": int(h * 0.45)},
            {"x": int(w * 0.7), "y": int(h * 0.45)},
            {"x": w,        "y": int(h * 0.52)},
            {"x": w,        "y": h},
            {"x": 0,        "y": h},
        ]
        return polygon, 0.5
