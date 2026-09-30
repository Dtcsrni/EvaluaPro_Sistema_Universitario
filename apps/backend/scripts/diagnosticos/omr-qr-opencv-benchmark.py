#!/usr/bin/env python3
"""Screen OpenCV QR decoding against evaluator reports without exposing payloads.

Optional research tool only. Requires Python, Pillow, NumPy and OpenCV installed
in the local environment; none is added to the EvaluaPro production runtime.
The focal region is an approximate portrait-page ROI, not the persisted QR map.
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from typing import Any

import cv2
import numpy as np
from PIL import Image, ImageOps


VARIANTS = (
    "full_gray",
    "crop_gray",
    "crop_clahe",
    "crop_otsu",
    "crop_adaptive",
    "crop_cubic2",
    "crop_clahe_eps02",
    "crop_clahe_eps04",
    "crop_clahe_eps06",
)


def parse_report(value: str) -> tuple[str, Path]:
    label, separator, raw_path = value.partition("=")
    if not separator or not label.strip() or not raw_path.strip():
        raise argparse.ArgumentTypeError("Use etiqueta=ruta.json")
    return label.strip(), Path(raw_path.strip()).resolve()


def candidate_images(gray: np.ndarray) -> dict[str, np.ndarray]:
    height, width = gray.shape
    side = max(80, min(round(width * 0.26), round(min(width, height) * 0.28)))
    left = max(0, min(width - side, round(width * 0.8875 - side / 2)))
    top = max(0, min(height - side, round(height * 0.107 - side / 2)))
    crop = gray[top : top + side, left : left + side]
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8)).apply(crop)
    _, otsu = cv2.threshold(clahe, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    adaptive = cv2.adaptiveThreshold(
        clahe, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 31, 5
    )
    return {
        "full_gray": gray,
        "crop_gray": crop,
        "crop_clahe": clahe,
        "crop_otsu": otsu,
        "crop_adaptive": adaptive,
        "crop_cubic2": cv2.resize(
            clahe, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC
        ),
        "crop_clahe_eps02": clahe,
        "crop_clahe_eps04": clahe,
        "crop_clahe_eps06": clahe,
    }


def decode_candidates(image: np.ndarray, variant: str) -> set[str]:
    detector = cv2.QRCodeDetector()
    if variant.endswith("eps02"):
        detector.setEpsX(0.2)
        detector.setEpsY(0.2)
    elif variant.endswith("eps04"):
        detector.setEpsX(0.4)
        detector.setEpsY(0.4)
    elif variant.endswith("eps06"):
        detector.setEpsX(0.6)
        detector.setEpsY(0.6)

    decoded: set[str] = set()
    try:
        text, _, _ = detector.detectAndDecode(image)
        if text:
            decoded.add(text)
        if hasattr(detector, "detectAndDecodeMulti"):
            ok, texts, _, _ = detector.detectAndDecodeMulti(image)
            if ok:
                decoded.update(text for text in texts if text)
    except cv2.error:
        pass
    return decoded


def evaluate_report(label: str, report_path: Path) -> dict[str, Any]:
    report = json.loads(report_path.read_text(encoding="utf-8-sig"))
    root = Path(report["dataset"]["directory"])
    rows = report.get("rows", [])
    counts = {
        variant: {"exact": 0, "decoded": 0, "wrong": 0}
        for variant in VARIANTS
    }
    exact_by_variant: dict[str, set[str]] = {variant: set() for variant in VARIANTS}
    current_exact: set[str] = set()
    missing = 0
    input_errors = 0
    evaluated = 0
    started = time.perf_counter()

    for row in rows:
        file_path = root / row.get("file", "")
        expected = row.get("qrTextoEsperado")
        if not file_path.is_file():
            missing += 1
            continue
        if not expected:
            input_errors += 1
            continue

        try:
            with Image.open(file_path) as source:
                rgb = np.asarray(ImageOps.exif_transpose(source).convert("RGB"))
            gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
        except Exception:
            input_errors += 1
            continue

        evaluated += 1
        row_key = str(row.get("file") or evaluated)
        if row.get("qrCoincideEsperado") is True:
            current_exact.add(row_key)
        for variant, image in candidate_images(gray).items():
            found = decode_candidates(image, variant)
            counts[variant]["decoded"] += int(bool(found))
            counts[variant]["exact"] += int(expected in found)
            counts[variant]["wrong"] += int(bool(found) and expected not in found)
            if expected in found:
                exact_by_variant[variant].add(row_key)

    opencv_union = set().union(*exact_by_variant.values()) if exact_by_variant else set()
    return {
        "dataset": label,
        "rows": len(rows),
        "evaluated": evaluated,
        "missingFiles": missing,
        "inputErrors": input_errors,
        "durationMs": round((time.perf_counter() - started) * 1000),
        "currentEngineExact": len(current_exact),
        "opencvUnionExact": len(opencv_union),
        "opencvAdditionalOverCurrent": len(opencv_union - current_exact),
        "opencvOverlapWithCurrent": len(opencv_union & current_exact),
        "variants": counts,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--report",
        action="append",
        type=parse_report,
        required=True,
        metavar="LABEL=PATH",
        help="Evaluator JSON report; repeat for each dataset.",
    )
    args = parser.parse_args()
    result = {
        "opencv": cv2.__version__,
        "roi": "approximate portrait header; center x=0.8875W, y=0.107H",
        "results": [evaluate_report(label, report) for label, report in args.report],
    }
    print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
