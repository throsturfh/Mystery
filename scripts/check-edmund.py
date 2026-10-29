#!/usr/bin/env python3
"""Opacity, foot line, and shared height for the two Edmund test sheets."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import cv2
import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
META = json.loads((ROOT / "public" / "assets" / "edmund" / "meta.json").read_text())
CELL_W, CELL_H = META["cellW"], META["cellH"]
COLS = META["cols"]
PIVOT_Y = META["pivotY"]


def cell(sheet: np.ndarray, index: int) -> np.ndarray:
    x = (index % COLS) * CELL_W
    y = (index // COLS) * CELL_H
    return sheet[y : y + CELL_H, x : x + CELL_W]


def span(frame: np.ndarray) -> tuple[int, int, int]:
    alpha = frame[:, :, 3] > 0
    ys = np.where(alpha)[0]
    if len(ys) == 0:
        return 0, 0, 0
    top, bot = int(ys.min()), int(ys.max())
    return bot - top + 1, top, bot


def holes(frame: np.ndarray) -> int:
    empty = np.where(frame[:, :, 3] == 0, np.uint8(255), np.uint8(0))
    flood = empty.copy()
    cv2.floodFill(flood, np.zeros((CELL_H + 2, CELL_W + 2), np.uint8), (0, 0), 0)
    return int((flood > 0).sum())


def soft(frame: np.ndarray) -> int:
    a = frame[:, :, 3]
    return int(((a > 0) & (a < 250)).sum())


def main() -> int:
    failed = False
    for kind in ("a", "b"):
        sheet = np.array(Image.open(ROOT / "public" / "assets" / "edmund" / kind / "figure.png"))
        idle = cell(sheet, META["idle"]["start"])
        idle_h, _, idle_bot = span(idle)
        if idle_h < 100:
            print(f"FAIL {kind} idle is empty")
            failed = True
            continue
        names = []
        for clip in ("side", "front", "back", "idle", "take"):
            info = META[clip]
            for i in range(info["count"]):
                names.append((clip, i, info["start"] + i))
        for clip, i, index in names:
            frame = cell(sheet, index)
            h, _, bot = span(frame)
            if holes(frame) or soft(frame):
                print(f"FAIL {kind} {clip}-{i} is not solid ({holes(frame)} holes)")
                failed = True
            # Take and the down/up of a real stride may change the hat height.
            # Contact frames must stay with the idle height.
            if clip == "side" and i in (0, 6):
                if abs(h - idle_h) / idle_h > 0.04:
                    print(f"FAIL {kind} side-{i} height {h} vs idle {idle_h}")
                    failed = True
                if abs(bot - idle_bot) > 2:
                    print(f"FAIL {kind} side-{i} sole at {bot}, idle at {idle_bot}")
                    failed = True
            if clip != "take" and h > idle_h * 1.08:
                print(f"FAIL {kind} {clip}-{i} grew to {h}, idle {idle_h}")
                failed = True
        print(f"ok {kind} idle {idle_h}px, sole row {idle_bot}, {len(names)} frames solid")
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
