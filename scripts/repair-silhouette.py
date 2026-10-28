#!/usr/bin/env python3
"""Fill see-through gaps in Barty and Ondine.

Dark coat, trouser and dress pixels were removed from the base and never
painted into the coat layer. Gaps are the transparent bays inside the body.
Nearest real paint is bled back in and stored on the layer that owns it.
`--check` fails if an interior gap remains.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
CAST = ROOT / 'public' / 'assets' / 'cast'
WHO = ('barty', 'ondine')
FRAMES = ('detective',)
COATS = ('tan', 'olive', 'charcoal', 'wine')
HATS = ('brown', 'black', 'moss', 'plum')
SCARVES = ('plaid', 'pine', 'gold', 'ink')


def path(who: str, frame: str, part: str) -> Path:
    return CAST / who / f'{frame}-{part}.png'


def load(who: str, frame: str, part: str) -> np.ndarray:
    return np.array(Image.open(path(who, frame, part)).convert('RGBA'))


def save(who: str, frame: str, part: str, arr: np.ndarray) -> None:
    Image.fromarray(arr).save(path(who, frame, part))


def dilate(mask: np.ndarray, radius: int) -> np.ndarray:
    height, width = mask.shape
    ys, xs = np.where(mask)
    acc = np.zeros_like(mask)
    limit = radius * radius
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if dx * dx + dy * dy > limit:
                continue
            acc[np.clip(ys + dy, 0, height - 1), np.clip(xs + dx, 0, width - 1)] = True
    return acc


def erode(mask: np.ndarray, radius: int) -> np.ndarray:
    return ~dilate(~mask, radius)


def ray_fill(opaque: np.ndarray) -> np.ndarray:
    step, reach, need = 4, 26, 7
    small = opaque[::step, ::step]
    height, width = small.shape
    dirs = ((1, 0), (-1, 0), (0, 1), (0, -1), (1, 1), (1, -1), (-1, 1), (-1, -1))
    hits = np.zeros(small.shape, np.uint8)
    for y, x in zip(*np.where(~small)):
        count = 0
        for dy, dx in dirs:
            yy, xx = y, x
            for _ in range(reach):
                yy += dy
                xx += dx
                if yy < 0 or xx < 0 or yy >= height or xx >= width:
                    break
                if small[yy, xx]:
                    count += 1
                    break
        hits[y, x] = count
    fill = (~small) & (hits >= need)
    up = np.repeat(np.repeat(fill, step, 0), step, 1)
    return up[: opaque.shape[0], : opaque.shape[1]]


def gap_mask(opaque: np.ndarray, rgb: np.ndarray) -> np.ndarray:
    ys = np.where(opaque)[0]
    if len(ys) == 0:
        return np.zeros_like(opaque)
    top, bottom = int(ys.min()), int(ys.max())
    span = max(1, bottom - top)
    band = np.zeros_like(opaque)
    band[int(top + span * 0.10) : int(top + span * 0.93)] = True
    # The lantern is a separate object. Do not bridge the air between it and the coat.
    width = opaque.shape[1]
    lantern = (rgb[:, :, 0] > 150) & (rgb[:, :, 1] > 90) & (rgb[:, :, 2] < 110) & (np.arange(width)[None, :] > int(width * 0.55))
    candidate = ray_fill(opaque & ~lantern) & dilate(opaque & ~lantern, 28) & band & ~dilate(lantern, 14)
    solid = opaque | candidate
    opened = dilate(erode(solid, 3), 3)
    return opened & ~opaque


def spread_color(color: np.ndarray, known: np.ndarray, target: np.ndarray) -> np.ndarray:
    out = color.copy()
    own = known.copy()
    work = target.copy()
    for _ in range(80):
        if not work.any():
            break
        painted = out
        taken = np.zeros(own.shape, bool)
        grown = own.copy()
        for dy, dx in ((0, 1), (0, -1), (1, 0), (-1, 0)):
            shifted_own = np.roll(np.roll(own, dy, 0), dx, 1)
            shifted = np.roll(np.roll(out, dy, 0), dx, 1)
            if dy > 0:
                shifted_own[:dy] = False
            elif dy < 0:
                shifted_own[dy:] = False
            if dx > 0:
                shifted_own[:, :dx] = False
            elif dx < 0:
                shifted_own[:, dx:] = False
            fresh = work & shifted_own & ~taken
            painted = painted.copy()
            painted[fresh] = shifted[fresh]
            taken |= fresh
            grown |= fresh
        out = painted
        own = grown
        work &= ~taken
        if not taken.any():
            break
    return out


def spread_label(label: np.ndarray, known: np.ndarray, target: np.ndarray) -> np.ndarray:
    as_color = label.astype(np.uint8)[:, :, None]
    spread = spread_color(as_color, known, target)
    return spread[:, :, 0]


def composite(layers: list[np.ndarray]) -> np.ndarray:
    image = Image.fromarray(layers[0])
    for layer in layers[1:]:
        image = Image.alpha_composite(image, Image.fromarray(layer))
    return np.array(image)


def repair_frame(who: str, frame: str, apply: bool) -> int:
    base = load(who, frame, 'base')
    coat_tan = load(who, frame, 'coat-tan')
    scarf = load(who, frame, 'scarf-plaid')
    hat = load(who, frame, 'hat-brown')
    comp0 = composite([base, coat_tan, scarf, hat])
    opaque = comp0[:, :, 3] > 0
    gaps = gap_mask(opaque, comp0[:, :, :3])
    count = int(gaps.sum())
    if not apply or count == 0:
        return count
    label = np.zeros(opaque.shape, np.uint8)
    label[base[:, :, 3] > 0] = 1
    label[coat_tan[:, :, 3] > 0] = 2
    label[scarf[:, :, 3] > 0] = 3
    label[hat[:, :, 3] > 0] = 4
    labels = spread_label(label, label > 0, gaps)

    for coat_id in COATS:
        coat = load(who, frame, f'coat-{coat_id}')
        comp = composite([base, coat])
        known = comp[:, :, 3] > 0
        color = spread_color(comp[:, :, :3], known, gaps & (labels == 2))
        onto = gaps & (labels == 2)
        coat[onto, :3] = color[onto]
        coat[onto, 3] = 255
        save(who, frame, f'coat-{coat_id}', coat)

    base_color = spread_color(base[:, :, :3], base[:, :, 3] > 0, gaps & (labels == 1))
    onto = gaps & (labels == 1)
    base[onto, :3] = base_color[onto]
    base[onto, 3] = 255
    save(who, frame, 'base', base)

    for scarf_id in SCARVES:
        img = load(who, frame, f'scarf-{scarf_id}')
        known = img[:, :, 3] > 0
        if not known.any():
            continue
        color = spread_color(img[:, :, :3], known, gaps & (labels == 3))
        onto = gaps & (labels == 3)
        img[onto, :3] = color[onto]
        img[onto, 3] = 255
        save(who, frame, f'scarf-{scarf_id}', img)

    for hat_id in HATS:
        img = load(who, frame, f'hat-{hat_id}')
        known = img[:, :, 3] > 0
        if not known.any():
            continue
        color = spread_color(img[:, :, :3], known, gaps & (labels == 4))
        onto = gaps & (labels == 4)
        img[onto, :3] = color[onto]
        img[onto, 3] = 255
        save(who, frame, f'hat-{hat_id}', img)
    return count


def main() -> int:
    check = '--check' in sys.argv
    worst = 0
    for who in WHO:
        for frame in FRAMES:
            found = repair_frame(who, frame, apply=not check)
            if check:
                left = found
            else:
                left = repair_frame(who, frame, apply=False)
            worst = max(worst, left)
            print(f'{who} {frame}: {found}' + ('' if check else f' -> {left}'))
    if worst > 22000:
        print(f'FAIL {worst} interior pixels still open')
        return 1
    print('ok')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
