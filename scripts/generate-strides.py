#!/usr/bin/env python3
"""Build a 10-frame knee stride for Barty, Pip, Ondine, and a walk for Skuggi.

The coat stays with the body. Only the shins and feet rotate about the knee,
so the step reads without tearing the face, the cane, or the lantern arm.
"""
from __future__ import annotations

from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CAST = ROOT / 'public' / 'assets' / 'cast'
COUNT = 10


def dilate_density(alpha: np.ndarray) -> np.ndarray:
    dens = np.zeros(alpha.shape, np.float32)
    for dx in range(-5, 6):
        dens += np.roll(alpha, dx, 1)
    return dens


def leg_mask(alpha: np.ndarray) -> tuple[np.ndarray, int, int]:
    ys, xs = np.where(alpha)
    top, bot = int(ys.min()), int(ys.max())
    left, right = int(xs.min()), int(xs.max())
    knee = int(top + (bot - top) * 0.76)
    below = np.zeros_like(alpha)
    below[knee:] = True
    region = alpha & below
    legs = region & (dilate_density(region) >= 5)
    return legs, knee, (left + right) // 2


def warp(arr: np.ndarray, legs: np.ndarray, knee: int, mid: int, phase: float) -> np.ndarray:
    if not legs.any():
        return arr
    height, width = arr.shape[:2]
    yy, xx = np.mgrid[0:height, 0:width]
    out = arr.copy()
    out[legs] = 0
    angle = np.deg2rad(12 * np.sin(phase))
    for sign, pivot_x, side in ((1, mid - 8, xx < mid), (-1, mid + 14, xx >= mid)):
        a = angle * sign
        c, s = np.cos(a), np.sin(a)
        dx = xx - pivot_x
        dy = yy - knee
        sx = np.clip(np.rint(pivot_x + c * dx - s * dy).astype(int), 0, width - 1)
        sy = np.clip(np.rint(knee + s * dx + c * dy).astype(int), 0, height - 1)
        take = legs & side & legs[sy, sx]
        out[take] = arr[sy, sx][take]
    return out


def sway(arr: np.ndarray, pixels: int) -> np.ndarray:
    if pixels == 0 or not (arr[:, :, 3] > 0).any():
        return arr
    out = np.zeros_like(arr)
    if pixels > 0:
        out[:, pixels:] = arr[:, :-pixels]
    else:
        out[:, :pixels] = arr[:, -pixels:]
    return out


def frames_for(who: str) -> None:
    folder = CAST / who
    base = np.array(Image.open(folder / 'detective-base.png').convert('RGBA'))
    coat = np.array(Image.open(folder / 'detective-coat-tan.png').convert('RGBA'))
    scarf = np.array(Image.open(folder / 'detective-scarf-plaid.png').convert('RGBA'))
    hat = np.array(Image.open(folder / 'detective-hat-brown.png').convert('RGBA'))
    comp = base.copy()
    comp[:, :, 3] = np.maximum.reduce([base[:, :, 3], coat[:, :, 3], scarf[:, :, 3], hat[:, :, 3]])
    alpha = comp[:, :, 3] > 12
    legs, knee, mid = leg_mask(alpha)
    parts = [p.name[len('detective-') :] for p in folder.glob('detective-*.png')]
    for index in range(COUNT):
        phase = index / COUNT * np.pi * 2
        scarf_shift = int(round(np.sin(phase + 0.6) * 3))
        for part in parts:
            src = np.array(Image.open(folder / f'detective-{part}').convert('RGBA'))
            moved = warp(src, legs, knee, mid, phase)
            if part.startswith('scarf'):
                moved = sway(moved, scarf_shift)
            Image.fromarray(moved).save(folder / f'walk-{index}-{part}')
    print(who, 'strides', COUNT, 'parts', len(parts))


def dog() -> None:
    src = np.array(Image.open(CAST / 'skuggi.png').convert('RGBA'))
    alpha = src[:, :, 3] > 12
    ys, xs = np.where(alpha)
    top, bot = int(ys.min()), int(ys.max())
    left, right = int(xs.min()), int(xs.max())
    knee = int(top + (bot - top) * 0.62)
    legs, _, mid = leg_mask(alpha)
    # tail is the rear quarter, above the knee
    tail = alpha.copy()
    tail[:, mid:] = False
    tail[knee:] = False
    for index in range(8):
        phase = index / 8 * np.pi * 2
        moved = warp(src, legs, knee, mid, phase)
        wag = int(round(np.sin(phase * 2) * 4))
        if wag:
            tail_img = np.zeros_like(moved)
            tail_img[tail] = src[tail]
            tail_img = sway(tail_img, wag)
            # clear old tail then paint wagged tail
            out = moved.copy()
            out[tail] = 0
            visible = tail_img[:, :, 3] > 0
            out[visible] = tail_img[visible]
            moved = out
        Image.fromarray(moved).save(CAST / f'skuggi-walk-{index}.png')
    print('skuggi strides 8')


if __name__ == '__main__':
    for name in ('barty', 'pip', 'ondine'):
        frames_for(name)
    dog()
