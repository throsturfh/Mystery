#!/usr/bin/env python3
"""Stage-1 Edmund: a 3D walk guide painted two ways, plus a scaled office.

Set A poses a 3D mannequin (planted feet, contact/down/passing/up) and paints
each frame with form light and a dark-brown contour.
Set B redraws every frame as flat shapes from a separate 2D chart. Nothing
here bends an existing sprite.

Both sets are partitioned into base / coat / hat / scarf so wardrobe colours
are pre-baked, never multiplied onto the whole figure.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "assets" / "edmund"
OFFICE = ROOT / "public" / "assets" / "office.jpg"

# Art canvas. Sole of the standing foot sits on PIVOT_Y. 1.92 m (hat) fills
# the figure; the game scales that opaque height to the office metre rule.
CELL_W = 420
CELL_H = 520
PIVOT_X = 210
PIVOT_Y = 500
PPM = 250  # pixels per metre in the art
SS = 2

FIGURE_M = 1.92
STEP_M = 0.64  # one step, contact to contact


def S(metres: float) -> float:
    """Metres to supersampled pixels."""
    return metres * PPM * SS

# Partition ids. Brim-shadow on the face stays in skin (base).
M_SKIN, M_HAIR, M_SHIRT, M_TROUSER, M_SHOE, M_BAG, M_LANTERN = 1, 2, 3, 4, 5, 6, 7
M_COAT, M_HAT, M_SCARF = 8, 9, 10

COAT_RAMPS = {
    "tan": [(74, 50, 32), (112, 78, 48), (156, 116, 72), (196, 156, 108), (226, 196, 154)],
    "olive": [(42, 48, 28), (62, 74, 40), (92, 108, 58), (132, 146, 86), (176, 186, 130)],
    "charcoal": [(32, 30, 28), (52, 48, 44), (78, 74, 68), (118, 112, 104), (168, 160, 150)],
    "wine": [(58, 24, 32), (96, 40, 52), (132, 62, 74), (170, 96, 108), (206, 146, 150)],
}
HAT_RAMPS = {
    "brown": [(42, 28, 18), (68, 46, 30), (102, 72, 46), (142, 104, 70), (186, 150, 110)],
    "black": [(18, 16, 14), (32, 30, 28), (52, 48, 44), (86, 80, 74), (128, 120, 112)],
    "moss": [(28, 36, 22), (46, 62, 36), (70, 92, 52), (108, 132, 78), (156, 176, 120)],
    "plum": [(36, 18, 28), (64, 32, 48), (98, 52, 72), (140, 86, 108), (186, 136, 154)],
}
SCARF_SOLID = {
    "pine": [(18, 42, 30), (28, 68, 48), (46, 102, 70), (86, 142, 104), (140, 186, 150)],
    "gold": [(92, 64, 18), (140, 100, 32), (186, 142, 54), (214, 176, 96), (236, 210, 150)],
    "ink": [(16, 28, 52), (28, 48, 82), (46, 74, 120), (86, 116, 164), (150, 176, 206)],
}
# Plaid is painted, not a ramp, so the tartan stays in the scarf layer only.
PLAIDS = ((128, 36, 40), (92, 22, 28), (186, 154, 120), (70, 16, 22))

BASE_RGB = {
    M_SKIN: [(120, 78, 58), (164, 112, 84), (206, 158, 122), (228, 190, 158), (242, 214, 190)],
    M_HAIR: [(28, 18, 14), (48, 32, 24), (72, 50, 36), (102, 74, 52), (140, 108, 80)],
    M_SHIRT: [(150, 140, 120), (186, 176, 154), (214, 206, 186), (230, 224, 208), (242, 238, 226)],
    M_TROUSER: [(36, 28, 24), (58, 44, 36), (86, 66, 52), (118, 92, 72), (156, 128, 102)],
    M_SHOE: [(24, 16, 12), (42, 28, 20), (68, 46, 32), (102, 74, 52), (148, 114, 84)],
    M_BAG: [(72, 44, 24), (112, 70, 38), (156, 102, 58), (190, 140, 88), (220, 180, 130)],
    M_LANTERN: [(90, 62, 28), (140, 100, 42), (196, 150, 64), (230, 196, 110), (250, 230, 170)],
}


def lerp(a, b, t):
    return a + (b - a) * t


def clamp(v, lo, hi):
    return lo if v < lo else hi if v > hi else v


def interp(u, keys):
    u = clamp(u, 0.0, 1.0)
    if u <= keys[0][0]:
        return keys[0][1]
    for (u0, y0), (u1, y1) in zip(keys, keys[1:]):
        if u <= u1:
            span = max(1e-6, u1 - u0)
            return lerp(y0, y1, (u - u0) / span)
    return keys[-1][1]


def smooth(u):
    u = clamp(u, 0.0, 1.0)
    return u * u * (3 - 2 * u)


# --- pose chart -------------------------------------------------------------
# u is 0..1 inside one step. Even steps: left foot supports. Odd: right.

# Bob is a fraction of a short rise/drop. The standing foot stays down.
BOB = [(0.0, 0.0), (0.18, -0.35), (0.33, -1.0), (0.5, 0.05), (0.68, 0.45), (0.84, 0.85), (1.0, 0.0)]
TOE = [(0.0, 0.0), (0.62, 0.0), (0.84, 0.02), (1.0, 0.0)]
SWING_Y = [(0.0, 0.0), (0.2, 0.01), (0.34, 0.035), (0.5, 0.055), (0.7, 0.10), (0.84, 0.15), (1.0, 0.0)]


def swing_z(u):
    e = smooth(u)
    return -STEP_M / 2 + STEP_M * e


def step_pose(frame: int, per_step: int, *, breathe: float = 0.0, reach: float | None = None, weight: float = 0.0):
    """Return joint positions in metres. +Z forward, +X character right, +Y up."""
    if per_step <= 1:
        u = 0.0
        step = 0
    else:
        step = frame // per_step
        u = (frame % per_step) / per_step
    left_supports = step % 2 == 0
    bob = interp(u, BOB) * 0.028
    sup_z = STEP_M / 2 * (1 - 2 * u)
    sup_y = interp(u, TOE)
    sw_z = swing_z(u)
    sw_y = interp(u, SWING_Y)
    if left_supports:
        lz, ly = sup_z, sup_y
        rz, ry = sw_z, sw_y
        arm_l = -math.cos(u * math.pi) * 0.62
        arm_r = math.cos(u * math.pi) * 0.62
    else:
        lz, ly = sw_z, sw_y
        rz, ry = sup_z, sup_y
        arm_l = math.cos(u * math.pi) * 0.62
        arm_r = -math.cos(u * math.pi) * 0.62

    hip_y = 0.96 + bob + breathe
    sway = math.sin(u * math.pi) * (0.012 if left_supports else -0.012)
    chest_z = 0.03 + bob * 0.15
    if reach is not None:
        # Reach with the near (left) arm. Right keeps the lantern.
        k = reach
        arm_l = lerp(arm_l, 1.15, k)
        chest_z += 0.06 * k
        hip_y -= 0.03 * k
        lz = lerp(lz, 0.06, k * 0.35)
        rz = lerp(rz, -0.04, k * 0.25)
        ly = lerp(ly, 0.0, k)
        ry = lerp(ry, 0.0, k)
    hip_y += weight

    joints = {
        "hip": np.array([sway, hip_y, chest_z * 0.2]),
        "chest": np.array([sway * 0.4, hip_y + 0.46, chest_z]),
        "neck": np.array([sway * 0.2, hip_y + 0.58, chest_z + 0.02]),
        "head": np.array([0.0, hip_y + 0.74, chest_z + 0.03]),
        "hat": np.array([0.0, hip_y + 0.90, chest_z + 0.02]),
        "u": u,
        "bob": bob,
        "reach": 0.0 if reach is None else reach,
        "left_supports": left_supports,
    }
    joints["l_hip"] = joints["hip"] + np.array([-0.09, -0.02, 0.0])
    joints["r_hip"] = joints["hip"] + np.array([0.09, -0.02, 0.0])
    # Chart values are a lift above a planted ankle, so the sole stays on the floor.
    joints["l_ankle"] = np.array([-0.09, 0.08 + ly, lz])
    joints["r_ankle"] = np.array([0.09, 0.08 + ry, rz])
    joints["l_knee"] = _knee(joints["l_hip"], joints["l_ankle"])
    joints["r_knee"] = _knee(joints["r_hip"], joints["r_ankle"])
    joints["l_foot"] = _foot(joints["l_ankle"], ly)
    joints["r_foot"] = _foot(joints["r_ankle"], ry)

    l_sh = joints["chest"] + np.array([-0.20, 0.02, 0.0])
    r_sh = joints["chest"] + np.array([0.20, 0.02, 0.0])
    joints["l_shoulder"] = l_sh
    joints["r_shoulder"] = r_sh
    joints["l_hand"] = _arm(l_sh, arm_l, bend=0.45 + (0.55 if (reach or 0) > 0.4 else 0.15), reach=reach or 0)
    joints["r_hand"] = _arm(r_sh, arm_r * 0.72, bend=0.55, reach=0)
    # Elbows stored for the sleeve.
    joints["l_elbow"] = _elbow(l_sh, joints["l_hand"], arm_l)
    joints["r_elbow"] = _elbow(r_sh, joints["r_hand"], arm_r * 0.72)
    # Coat hem lags the hips by easing u toward the previous pose.
    lag = 0.22
    joints["hem_lag"] = -math.sin((u - lag) * math.pi * 2) * 0.05
    joints["scarf_lag"] = -math.sin((u - 0.18) * math.pi * 2) * 0.06
    return joints


def _foot(ankle, lift):
    """Toe stays near the ground while the foot is planted, and trails when it swings."""
    if lift < 0.04:
        return ankle + np.array([0.0, -0.055, 0.16])
    if lift < 0.09:
        return ankle + np.array([0.0, -0.03, 0.13])
    return ankle + np.array([0.0, -0.01, 0.11])


def _knee(hip, ankle):
    l1, l2 = 0.46, 0.44
    delta = ankle - hip
    # Solve in the sagittal plane; keep the hip's X.
    dz, dy = float(delta[2]), float(delta[1])
    dist = math.hypot(dz, dy)
    dist = clamp(dist, 0.08, l1 + l2 - 0.001)
    ux, uy = dz / dist, dy / dist
    px, py = -uy, ux
    cos_a = clamp((l1 * l1 + dist * dist - l2 * l2) / (2 * l1 * dist), -1, 1)
    sin_a = math.sqrt(max(0.0, 1 - cos_a * cos_a))
    base = np.array([hip[0], hip[1] + uy * l1 * cos_a, hip[2] + ux * l1 * cos_a])
    k1 = base + np.array([0.0, py * l1 * sin_a, px * l1 * sin_a])
    k2 = base - np.array([0.0, py * l1 * sin_a, px * l1 * sin_a])
    return k1 if k1[2] >= k2[2] else k2


def _elbow(shoulder, hand, swing):
    mid = (shoulder + hand) / 2
    # Push the elbow outward and slightly back so the sleeve isn't a rod.
    outward = 1 if shoulder[0] > 0 else -1
    mid = mid + np.array([0.05 * outward, -0.02, -0.04 + swing * 0.02])
    return mid


def _arm(shoulder, swing, bend, reach):
    """swing > 0 reaches forward (+Z). Returns the hand."""
    upper = 0.30
    lower = 0.28
    # Upper arm direction from nearly-down, tilted by swing.
    dz = math.sin(swing) * upper
    dy = -math.cos(swing) * upper
    elbow = shoulder + np.array([0.04 if shoulder[0] > 0 else -0.04, dy, dz])
    # Forearm continues, bent so the hand stays a little forward of the thigh.
    fz = math.sin(swing * 0.65 + bend) * lower
    fy = -math.cos(swing * 0.55) * lower * 0.92
    hand = elbow + np.array([0.0, fy * 0.15 + fy, fz])
    if reach > 0 and shoulder[0] < 0:
        # Left hand travels to a point in front of the chest, then home.
        target = shoulder + np.array([0.02, -0.16 - 0.10 * (1 - reach), 0.22 + 0.36 * reach])
        hand = hand * (1 - reach) + target * reach
    return hand


def pose_walk(index: int, count: int):
    per = count // 2
    return step_pose(index, per)


def pose_idle(index: int, count: int = 8):
    t = index / count
    breath = math.sin(t * math.pi * 2) * 0.008
    # Quiet standing: feet almost together, a little weight shift.
    pose = step_pose(0, 2, breathe=breath, weight=math.sin(t * math.pi * 2) * 0.004)
    pose["l_ankle"] = np.array([-0.07, 0.07, 0.02])
    pose["r_ankle"] = np.array([0.07, 0.07, -0.04])
    pose["l_knee"] = _knee(pose["l_hip"], pose["l_ankle"])
    pose["r_knee"] = _knee(pose["r_hip"], pose["r_ankle"])
    pose["l_foot"] = pose["l_ankle"] + np.array([0.0, -0.05, 0.15])
    pose["r_foot"] = pose["r_ankle"] + np.array([0.0, -0.05, 0.15])
    pose["scarf_lag"] = math.sin(t * math.pi * 2) * 0.018
    pose["hem_lag"] = math.sin(t * math.pi * 2 + 0.6) * 0.012
    # Arms rest.
    pose["l_hand"] = pose["l_shoulder"] + np.array([-0.02, -0.52, 0.06])
    pose["r_hand"] = pose["r_shoulder"] + np.array([0.02, -0.50, 0.05])
    pose["l_elbow"] = _elbow(pose["l_shoulder"], pose["l_hand"], 0.1)
    pose["r_elbow"] = _elbow(pose["r_shoulder"], pose["r_hand"], 0.1)
    pose["u"] = t
    return pose


def pose_take(index: int, count: int = 10):
    # Keys: rest, anticipate, reach, grasp, return. Smooth, no squash.
    keys = [(0, 0.0), (1, -0.04), (4, 1.0), (5, 1.0), (8, 0.15), (9, 0.0)]
    k = interp(index / max(1, count - 1), keys)
    k = smooth(clamp(k, 0, 1)) if k >= 0 else k
    pose = pose_idle(0, 8)
    driven = step_pose(0, 2, reach=clamp(k, 0, 1))
    for name in ("hip", "chest", "neck", "head", "hat", "l_hip", "r_hip", "l_shoulder", "r_shoulder", "l_hand", "r_hand", "l_elbow", "r_elbow", "l_knee", "r_knee", "l_ankle", "r_ankle", "l_foot", "r_foot"):
        pose[name] = driven[name]
    pose["reach"] = clamp(k, 0, 1)
    pose["hem_lag"] = 0.02 * pose["reach"]
    pose["scarf_lag"] = 0.04 * pose["reach"]
    pose["grasp"] = index >= 5
    return pose


# --- projection -------------------------------------------------------------

def project(p, view: str):
    x, y, z = float(p[0]), float(p[1]), float(p[2])
    if view == "side":
        sx = PIVOT_X + z * PPM
        sy = PIVOT_Y - y * PPM
        depth = -x
    elif view == "front":
        sx = PIVOT_X - x * PPM
        sy = PIVOT_Y - y * PPM
        depth = z
    else:  # back
        sx = PIVOT_X + x * PPM
        sy = PIVOT_Y - y * PPM
        depth = -z
    return sx * SS, sy * SS, depth


class Buf:
    def __init__(self):
        self.w = CELL_W * SS
        self.h = CELL_H * SS
        self.rgb = np.zeros((self.h, self.w, 3), np.float32)
        self.a = np.zeros((self.h, self.w), np.float32)
        self.z = np.full((self.h, self.w), -1e9, np.float32)
        self.mat = np.zeros((self.h, self.w), np.uint8)
        self.shade = np.zeros((self.h, self.w), np.uint8)

    def stamp_disc(self, cx, cy, cz, r, mat, bias=0.0, shade_bias=0):
        r = float(r)
        rad = int(math.ceil(r)) + 2
        x0 = max(0, int(cx) - rad)
        x1 = min(self.w, int(cx) + rad + 1)
        y0 = max(0, int(cy) - rad)
        y1 = min(self.h, int(cy) + rad + 1)
        if x0 >= x1 or y0 >= y1:
            return
        ys, xs = np.mgrid[y0:y1, x0:x1]
        dx = xs - cx
        dy = ys - cy
        d2 = dx * dx + dy * dy
        rr = r * r
        mask = d2 <= rr
        if not np.any(mask):
            return
        zz = np.sqrt(np.maximum(0.0, rr - d2))
        depth = cz + bias + zz / max(r, 1) * 0.08
        sub_z = self.z[y0:y1, x0:x1]
        closer = mask & (depth >= sub_z)
        if not np.any(closer):
            return
        nx = dx / r
        ny = -dy / r
        nz = zz / r
        lx, ly, lz = -0.42, 0.82, 0.42
        inv = 1 / math.sqrt(lx * lx + ly * ly + lz * lz)
        nd = (nx * lx + ny * ly + nz * lz) * inv
        # Three broad tones, not a stack of thin stripes.
        band = np.where(nd > 0.42, 3, np.where(nd > 0.02, 2, np.where(nd > -0.38, 1, 0))).astype(np.int32)
        band = np.clip(band + shade_bias, 0, 4)
        sl = (slice(y0, y1), slice(x0, x1))
        self.z[sl][closer] = depth[closer]
        self.a[sl][closer] = 1
        self.mat[sl][closer] = mat
        self.shade[sl][closer] = band[closer]

    def stamp_capsule(self, a, b, r0, r1, mat, bias=0.0):
        ax, ay, az = a
        bx, by, bz = b
        steps = max(2, int(math.hypot(bx - ax, by - ay) / max(3.0, min(r0, r1) * 0.22)))
        for i in range(steps + 1):
            t = i / steps
            self.stamp_disc(lerp(ax, bx, t), lerp(ay, by, t), lerp(az, bz, t), lerp(r0, r1, t), mat, bias=bias)

    def stamp_poly(self, pts, mat, depth, shade):
        if len(pts) < 3:
            return
        mask = Image.new("L", (self.w, self.h), 0)
        draw = ImageDraw.Draw(mask)
        draw.polygon([(p[0], p[1]) for p in pts], fill=255)
        m = np.array(mask) > 0
        closer = m & (depth >= self.z)
        self.z[closer] = depth
        self.a[closer] = 1
        self.mat[closer] = mat
        self.shade[closer] = shade


def _p(joints, name, view):
    return project(joints[name], view)


def paint_a(joints, view: str) -> Buf:
    """Volumetric toon over the 3D pose. Each pixel is one partition."""
    buf = Buf()
    hip_l, hip_r = _p(joints, "l_hip", view), _p(joints, "r_hip", view)
    knee_l, knee_r = _p(joints, "l_knee", view), _p(joints, "r_knee", view)
    ank_l, ank_r = _p(joints, "l_ankle", view), _p(joints, "r_ankle", view)
    foot_l, foot_r = _p(joints, "l_foot", view), _p(joints, "r_foot", view)
    # Far limbs first in side view by depth bias. Left side of the body is near
    # the side camera, so the left arm sits in front of the coat.
    # Higher depth draws in front. The coat covers the shirt and thighs;
    # sleeves, scarf, hat and the near hand sit above the coat.
    if view == "side":
        l_bias, r_bias = 0.55, 0.02
        leg_l, leg_r, coat_depth = 0.18, 0.08, 0.34
    elif view == "front":
        l_bias, r_bias = 0.5, 0.5
        leg_l, leg_r, coat_depth = 0.12, 0.12, 0.32
    else:
        l_bias, r_bias = 0.22, 0.22
        leg_l, leg_r, coat_depth = 0.1, 0.1, 0.36

    def limb(a, b, r0, r1, mat, bias):
        buf.stamp_capsule(a, b, S(r0), S(r1), mat, bias=bias)

    # Legs, then shoes. Radii are metres.
    limb(hip_l, knee_l, 0.078, 0.062, M_TROUSER, leg_l)
    limb(knee_l, ank_l, 0.058, 0.042, M_TROUSER, leg_l)
    limb(hip_r, knee_r, 0.078, 0.062, M_TROUSER, leg_r)
    limb(knee_r, ank_r, 0.058, 0.042, M_TROUSER, leg_r)
    limb(ank_l, foot_l, 0.042, 0.036, M_SHOE, leg_l + 0.04)
    limb(ank_r, foot_r, 0.042, 0.036, M_SHOE, leg_r + 0.04)

    chest = _p(joints, "chest", view)
    neck = _p(joints, "neck", view)
    head = _p(joints, "head", view)
    hip = _p(joints, "hip", view)
    # Torso under the coat so the silhouette never gaps at the waist.
    limb(hip, chest, 0.10, 0.12, M_SHIRT, 0.0)
    limb(chest, neck, 0.055, 0.04, M_SKIN, 0.05)
    buf.stamp_disc(head[0], head[1], head[2], S(0.115), M_SKIN, bias=0.08)

    # Coat over the thighs, open at the hem. Depth sits between the two arms.
    coat = _coat_poly(joints, view)
    buf.stamp_poly(coat, M_COAT, depth=coat_depth, shade=2)
    lapel = _lapel_poly(joints, view)
    buf.stamp_poly(lapel, M_COAT, depth=coat_depth + 0.04, shade=3)
    # Buttons, kept on the coat partition.
    if view != "back":
        for dy in (0.02, -0.10, -0.22):
            p = project(joints["chest"] + np.array([0.0, dy, 0.1]), view)
            buf.stamp_disc(p[0], p[1], p[2], S(0.012), M_COAT, bias=coat_depth + 0.08, shade_bias=-2)

    # Sleeves in coat colour, hands in skin.
    l_sh, r_sh = _p(joints, "l_shoulder", view), _p(joints, "r_shoulder", view)
    l_el, r_el = _p(joints, "l_elbow", view), _p(joints, "r_elbow", view)
    l_h, r_h = _p(joints, "l_hand", view), _p(joints, "r_hand", view)
    limb(l_sh, l_el, 0.055, 0.042, M_COAT, l_bias)
    limb(l_el, l_h, 0.040, 0.032, M_COAT, l_bias)
    limb(r_sh, r_el, 0.055, 0.042, M_COAT, r_bias)
    limb(r_el, r_h, 0.040, 0.032, M_COAT, r_bias)
    buf.stamp_disc(l_h[0], l_h[1], l_h[2], S(0.034), M_SKIN, bias=l_bias + 0.05)
    buf.stamp_disc(r_h[0], r_h[1], r_h[2], S(0.034), M_SKIN, bias=r_bias + 0.05)

    # Bag on the left shoulder, brown, always base.
    bag_top = (l_sh[0] + S(0.02), l_sh[1] + S(0.06), l_sh[2])
    bag_bot = (bag_top[0] + joints["hem_lag"] * PPM * SS * 0.2, bag_top[1] + S(0.28), bag_top[2])
    limb(bag_top, bag_bot, 0.03, 0.07, M_BAG, 0.62)
    limb(neck, bag_top, 0.012, 0.012, M_BAG, 0.5)

    # Scarf tails. Plaid pattern is applied later from the shade and a stripe.
    _scarf(buf, joints, view, neck)

    # Hat.
    _hat(buf, joints, view, head)

    # Face features, in front of the head.
    _face(buf, joints, view, head)

    # Lantern in the right hand.
    _lantern(buf, r_h, r_bias + 0.12, view)

    if joints.get("grasp") and view == "side":
        # Brass paperweight in the left hand from the grasp onward.
        buf.stamp_disc(l_h[0] + S(0.03), l_h[1], l_h[2], S(0.022), M_LANTERN, bias=l_bias + 0.2, shade_bias=1)

    _brim_shadow(buf)
    _ink(buf)
    return buf


def _coat_poly(joints, view):
    chest = joints["chest"]
    hip = joints["hip"]
    hem_y = 0.40
    lag = joints["hem_lag"]
    if view == "side":
        pts3 = [
            chest + np.array([0, 0.08, -0.10]),
            chest + np.array([0, 0.06, 0.12]),
            hip + np.array([0, -0.02, 0.16]),
            np.array([0, hem_y, hip[2] + 0.20 + lag]),
            np.array([0, hem_y - 0.02, hip[2] - 0.16 + lag * 0.4]),
            chest + np.array([0, -0.05, -0.14]),
        ]
    elif view == "front":
        pts3 = [
            chest + np.array([-0.24, 0.06, 0.06]),
            chest + np.array([0.24, 0.06, 0.06]),
            hip + np.array([0.26, -0.08, 0.04]),
            np.array([0.22, hem_y, lag]),
            np.array([0.06, hem_y + 0.04, 0.02]),
            np.array([-0.06, hem_y + 0.04, 0.02]),
            np.array([-0.22, hem_y, -lag]),
            hip + np.array([-0.26, -0.08, 0.04]),
        ]
    else:
        pts3 = [
            chest + np.array([-0.24, 0.06, -0.08]),
            chest + np.array([0.24, 0.06, -0.08]),
            hip + np.array([0.26, -0.06, -0.06]),
            np.array([0.20, hem_y, -0.02 + lag]),
            np.array([-0.20, hem_y, -0.02 - lag]),
            hip + np.array([-0.26, -0.06, -0.06]),
        ]
    return [project(p, view)[:2] for p in pts3]


def _lapel_poly(joints, view):
    chest = joints["chest"]
    if view == "side":
        pts3 = [
            chest + np.array([0, 0.05, 0.04]),
            chest + np.array([0, -0.02, 0.13]),
            chest + np.array([0, -0.28, 0.10]),
            chest + np.array([0, -0.22, 0.02]),
        ]
    elif view == "front":
        pts3 = [
            chest + np.array([-0.06, 0.04, 0.08]),
            chest + np.array([0.06, 0.04, 0.08]),
            chest + np.array([0.04, -0.32, 0.08]),
            chest + np.array([-0.04, -0.32, 0.08]),
        ]
    else:
        return []
    return [project(p, view)[:2] for p in pts3]


def _scarf(buf: Buf, joints, view, neck):
    """One ribbon, not a chain of spheres, so the tail doesn't read as a braid."""
    lag = float(joints["scarf_lag"])
    base = np.array(joints["neck"])
    spine = [
        base + np.array([0.0, -0.02, 0.06]),
        base + np.array([0.02 + lag * 0.3, -0.18, 0.07]),
        base + np.array([0.0 + lag, -0.36, 0.04]),
    ]
    half = [0.045, 0.03, 0.018]
    left, right = [], []
    prev = None
    for p, h in zip(spine, half):
        scr = project(p, view)
        if prev is None:
            px, py = 0.0, 1.0
        else:
            dx, dy = scr[0] - prev[0], scr[1] - prev[1]
            ln = math.hypot(dx, dy) or 1.0
            px, py = -dy / ln, dx / ln
        off = h * PPM * SS
        left.append((scr[0] + px * off, scr[1] + py * off))
        right.append((scr[0] - px * off, scr[1] - py * off))
        prev = scr
    buf.stamp_poly(left + right[::-1], M_SCARF, depth=0.78, shade=2)
    buf.stamp_disc(neck[0], neck[1] + S(0.01), neck[2], S(0.045), M_SCARF, bias=0.74)


def _hat(buf: Buf, joints, view, head):
    crown = project(joints["head"] + np.array([0, 0.11, 0.0]), view)
    buf.stamp_capsule(
        (head[0], head[1] - S(0.02), head[2]),
        (crown[0], crown[1], crown[2]),
        S(0.10),
        S(0.07),
        M_HAT,
        bias=0.8,
    )
    if view == "side":
        brim_c = (head[0] + S(0.03), head[1] + S(0.015), head[2])
        buf.stamp_capsule((brim_c[0] - S(0.11), brim_c[1], brim_c[2]), (brim_c[0] + S(0.16), brim_c[1] + 2, brim_c[2]), S(0.016), S(0.012), M_HAT, bias=0.82)
    else:
        buf.stamp_capsule((head[0] - S(0.17), head[1] + S(0.02), head[2]), (head[0] + S(0.17), head[1] + S(0.02), head[2]), S(0.018), S(0.018), M_HAT, bias=0.82)
    buf.stamp_capsule((head[0] - S(0.08), head[1], head[2]), (head[0] + S(0.08), head[1], head[2]), S(0.016), S(0.016), M_HAT, bias=0.84)


def _face(buf: Buf, joints, view, head):
    hx, hy, hz = head
    if view == "back":
        # Hair covers the back of the head.
        buf.stamp_disc(hx, hy - S(0.02), hz, S(0.11), M_HAIR, bias=0.12)
        return
    if view == "side":
        # Nose breaks the silhouette. Eye and mouth sit on the near side of the head.
        buf.stamp_capsule((hx + S(0.05), hy + S(0.01), hz), (hx + S(0.125), hy + S(0.02), hz), S(0.022), S(0.016), M_SKIN, bias=0.9)
        buf.stamp_disc(hx + S(0.045), hy - S(0.03), hz, S(0.018), M_SKIN, bias=0.92, shade_bias=2)
        buf.stamp_disc(hx + S(0.05), hy - S(0.03), hz, S(0.008), M_HAIR, bias=0.94)
        buf.stamp_disc(hx - S(0.09), hy + S(0.01), hz, S(0.03), M_SKIN, bias=0.7)
        buf.stamp_disc(hx - S(0.09), hy + S(0.01), hz, S(0.012), M_HAIR, bias=0.74)
        buf.stamp_capsule((hx + S(0.02), hy - S(0.055), hz), (hx + S(0.07), hy - S(0.048), hz), S(0.008), S(0.005), M_HAIR, bias=0.93)
        buf.stamp_capsule((hx + S(0.04), hy + S(0.055), hz), (hx + S(0.09), hy + S(0.062), hz), S(0.006), S(0.004), M_HAIR, bias=0.93)
        buf.stamp_disc(hx - S(0.02), hy - S(0.07), hz, S(0.08), M_HAIR, bias=0.6)
    else:
        buf.stamp_disc(hx - S(0.04), hy - S(0.015), hz, S(0.012), M_SKIN, bias=0.9, shade_bias=1)
        buf.stamp_disc(hx + S(0.04), hy - S(0.015), hz, S(0.012), M_SKIN, bias=0.9, shade_bias=1)
        buf.stamp_disc(hx - S(0.04), hy - S(0.015), hz, S(0.005), M_HAIR, bias=0.94)
        buf.stamp_disc(hx + S(0.04), hy - S(0.015), hz, S(0.005), M_HAIR, bias=0.94)
        buf.stamp_capsule((hx, hy - S(0.01), hz), (hx, hy + S(0.045), hz), S(0.014), S(0.018), M_SKIN, bias=0.88)
        buf.stamp_capsule((hx - S(0.055), hy - S(0.05), hz), (hx - S(0.01), hy - S(0.058), hz), S(0.008), S(0.005), M_HAIR, bias=0.93)
        buf.stamp_capsule((hx + S(0.01), hy - S(0.058), hz), (hx + S(0.055), hy - S(0.05), hz), S(0.005), S(0.008), M_HAIR, bias=0.93)
        buf.stamp_capsule((hx - S(0.03), hy + S(0.055), hz), (hx + S(0.03), hy + S(0.06), hz), S(0.007), S(0.007), M_HAIR, bias=0.92)
        buf.stamp_disc(hx, hy - S(0.075), hz, S(0.085), M_HAIR, bias=0.6)
        buf.stamp_disc(hx - S(0.12), hy + S(0.01), hz, S(0.024), M_SKIN, bias=0.5)
        buf.stamp_disc(hx + S(0.12), hy + S(0.01), hz, S(0.024), M_SKIN, bias=0.5)


def _lantern(buf: Buf, hand, bias, view):
    x, y, z = hand
    y += 16
    buf.stamp_capsule((x, y, z), (x, y + S(0.09), z), S(0.028), S(0.032), M_LANTERN, bias=bias)
    buf.stamp_disc(x, y + S(0.025), z, S(0.016), M_LANTERN, bias=bias + 0.02, shade_bias=2)
    buf.stamp_capsule((x - S(0.02), y - S(0.012), z), (x + S(0.02), y - S(0.012), z), S(0.008), S(0.008), M_SHOE, bias=bias)


def _brim_shadow(buf: Buf):
    """Neutral shadow under the hat brim, kept on the skin so it is not hat-coloured."""
    hat = buf.mat == M_HAT
    skin = buf.mat == M_SKIN
    # Pixels of skin with hat within 14px above them.
    shade = buf.shade
    h, w = hat.shape
    for dy in range(2, 16):
        band = np.zeros_like(skin)
        band[dy:, :] = hat[:-dy, :]
        hit = skin & band
        shade[hit] = np.minimum(shade[hit], 1)


def _ink(buf: Buf):
    """Darken the silhouette edge without changing which partition owns the pixel."""
    a = buf.a > 0
    # Edge: opaque pixel with a transparent neighbour, or a material change.
    edge = np.zeros_like(a)
    edge[1:-1, 1:-1] = a[1:-1, 1:-1] & (
        ~a[:-2, 1:-1] | ~a[2:, 1:-1] | ~a[1:-1, :-2] | ~a[1:-1, 2:]
    )
    # A second pixel of contour, still owned by whatever partition it sits on.
    edge[2:-2, 2:-2] |= a[2:-2, 2:-2] & (
        ~a[:-4, 2:-2] | ~a[4:, 2:-2] | ~a[2:-2, :-4] | ~a[2:-2, 4:]
    )
    buf.shade[edge] = 0


def downsample(buf: Buf):
    """Average the 2× buffer down and bake solid coverage inside the silhouette."""
    h, w = CELL_H, CELL_W
    a = buf.a.reshape(h, SS, w, SS).mean(axis=(1, 3))
    shade = buf.shade.reshape(h, SS, w, SS).mean(axis=(1, 3))
    mat_f = buf.mat.astype(np.float32).reshape(h, SS, w, SS)
    # Majority material.
    mat = np.rint(mat_f.mean(axis=(1, 3))).astype(np.uint8)
    # Kill fringe: coverage below a third is outside.
    inside = a >= 0.35
    mat = np.where(inside, mat, 0).astype(np.uint8)
    alpha = np.where(inside, 255, 0).astype(np.uint8)
    shade_i = np.clip(np.rint(shade), 0, 4).astype(np.uint8)
    alpha, mat, shade_i = _fill_holes(alpha, mat, shade_i)
    return alpha, mat, shade_i


def _fill_holes(alpha, mat, shade):
    """Enclosed gaps (not the space between the legs) are filled solid."""
    import cv2

    h, w = alpha.shape
    empty = np.where(alpha == 0, np.uint8(255), np.uint8(0))
    flood = empty.copy()
    cv2.floodFill(flood, np.zeros((h + 2, w + 2), np.uint8), (0, 0), 0)
    hole = flood > 0
    if not np.any(hole):
        return alpha, mat, shade
    kernel = np.ones((3, 3), np.uint8)
    for _ in range(24):
        if not np.any(hole & (mat == 0)):
            break
        grown = cv2.dilate(mat, kernel)
        grown_s = cv2.dilate(shade, kernel)
        take = hole & (mat == 0) & (grown > 0)
        mat[take] = grown[take]
        shade[take] = grown_s[take]
    alpha = alpha.copy()
    alpha[hole] = 255
    mat[hole & (mat == 0)] = M_COAT
    return alpha, mat, shade


def stripe_phase(y, x, frame_salt: int):
    return int((y * 0.37 + x * 0.08 + frame_salt) // 3) % 4


def bake_layers(alpha, mat, shade, plaid_salt: int):
    """Return base RGB plus shade masks (0 empty, else shade+1) for the wardrobe."""
    h, w = alpha.shape
    base = np.zeros((h, w, 4), np.uint8)
    for mid, ramp in BASE_RGB.items():
        for s, rgb in enumerate(ramp):
            sel = (mat == mid) & (shade == s)
            base[sel, 0] = rgb[0]
            base[sel, 1] = rgb[1]
            base[sel, 2] = rgb[2]
            base[sel, 3] = 255
    present = alpha > 0
    coat = np.where(present & (mat == M_COAT), shade + 1, 0).astype(np.uint8)
    hat = np.where(present & (mat == M_HAT), shade + 1, 0).astype(np.uint8)
    scarf = np.where(present & (mat == M_SCARF), shade + 1, 0).astype(np.uint8)
    return base, coat, hat, scarf


def colorize(mask, ramp):
    h, w = mask.shape
    out = np.zeros((h, w, 4), np.uint8)
    for s, rgb in enumerate(ramp):
        hit = mask == (s + 1)
        out[hit, 0] = rgb[0]
        out[hit, 1] = rgb[1]
        out[hit, 2] = rgb[2]
        out[hit, 3] = 255
    return out


def colorize_plaid(mask, salt):
    h, w = mask.shape
    out = np.zeros((h, w, 4), np.uint8)
    ys, xs = np.where(mask > 0)
    if len(ys) == 0:
        return out
    s = mask[ys, xs].astype(np.int16) - 1
    stripes = np.array(PLAIDS, np.float32)
    rgb = stripes[(ys // 3 + xs // 7) % 4]
    f = (0.55 + s * 0.12)[:, None]
    out[ys, xs, :3] = np.clip(rgb * f, 0, 255).astype(np.uint8)
    out[ys, xs, 3] = 255
    return out


# --- set B: flat drawings, one construction per frame ----------------------

B_INK = (62, 40, 30, 255)
B_SKIN = [(148, 96, 72), (214, 164, 128), (236, 200, 168)]
B_HAIR = (54, 36, 28, 255)
B_TROUSER = (48, 52, 68, 255)
B_SHOE = (48, 32, 24, 255)
B_SHIRT = (226, 214, 196, 255)
B_BAG = (150, 96, 52, 255)
B_BAG_D = (96, 60, 32, 255)


def paint_b(joints, view: str) -> tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """A fresh flat drawing. Joints only say where the feet and hands are."""
    img = Image.new("RGBA", (CELL_W * SS, CELL_H * SS), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ids = np.zeros((CELL_H * SS, CELL_W * SS), np.uint8)

    def P(name):
        x, y, _z = project(joints[name], view)
        return x, y

    def poly(pts, fill, mat, outline=True, width=4):
        if len(pts) < 3:
            return
        d.polygon(pts, fill=fill)
        if outline:
            d.line(pts + [pts[0]], fill=B_INK, width=width)
        _mark_poly(ids, pts, mat)

    def disc(c, r, fill, mat, outline=True):
        x, y = c
        d.ellipse((x - r, y - r, x + r, y + r), fill=fill, outline=B_INK if outline else None, width=3)
        _mark_disc(ids, x, y, r, mat)

    def limb(a, b, r0, r1, fill, mat):
        ax, ay = a
        bx, by = b
        ang = math.atan2(by - ay, bx - ax)
        px, py = -math.sin(ang), math.cos(ang)
        pts = [
            (ax + px * r0, ay + py * r0),
            (bx + px * r1, by + py * r1),
            (bx - px * r1, by - py * r1),
            (ax - px * r0, ay - py * r0),
        ]
        poly(pts, fill, mat, width=4)
        disc(a, r0 * 0.9, fill, mat)
        disc(b, r1 * 0.9, fill, mat)

    # Draw far leg, then coat, then near leg so the stride reads as a drawing
    # and not as a shaded volume. In front/back both legs are drawn, coat last
    # over the thighs only (coat poly stops at the hem).
    order = ["r", "l"] if view == "side" else ["l", "r"]
    for side in order:
        hip, knee, ank, foot = P(f"{side}_hip"), P(f"{side}_knee"), P(f"{side}_ankle"), P(f"{side}_foot")
        limb(hip, knee, S(0.072), S(0.056), B_TROUSER, M_TROUSER)
        limb(knee, ank, S(0.052), S(0.038), B_TROUSER, M_TROUSER)
        limb(ank, foot, S(0.04), S(0.034), B_SHOE, M_SHOE)

    coat = _coat_poly(joints, view)
    # Graphic coat: one filled shape, one fold stripe, a lighter shoulder.
    coat_col = (176, 132, 84, 255)
    poly(coat, coat_col, M_COAT, width=5)
    if view == "side" and len(coat) >= 4:
        fold = [coat[1], coat[2], (coat[2][0] - 10, coat[2][1]), (coat[1][0] - 8, coat[1][1])]
        poly(fold, (124, 86, 52, 255), M_COAT, outline=False)
    elif view == "front" and len(coat) >= 6:
        mid_top = ((coat[0][0] + coat[1][0]) / 2, coat[0][1])
        mid_bot = ((coat[3][0] + coat[4][0]) / 2, coat[3][1])
        d.line([mid_top, mid_bot], fill=(124, 86, 52, 255), width=6)

    # Shirt wedge.
    chest = P("chest")
    neck = P("neck")
    if view != "back":
        poly(
            [neck, (chest[0] + 8, chest[1] + 30), (chest[0] - 8, chest[1] + 36)],
            B_SHIRT,
            M_SHIRT,
            width=2,
        )

    head = P("head")
    disc(head, S(0.125), B_SKIN[1], M_SKIN)
    disc((head[0], head[1] - S(0.05)), S(0.09), B_HAIR, M_HAIR, outline=False)
    if view == "side":
        nose = [
            (head[0] + S(0.04), head[1] - S(0.01)),
            (head[0] + S(0.16), head[1] + S(0.02)),
            (head[0] + S(0.05), head[1] + S(0.05)),
        ]
        poly(nose, B_SKIN[1], M_SKIN, width=4)
        disc((head[0] + S(0.04), head[1] - S(0.03)), S(0.012), (36, 24, 20, 255), M_HAIR, outline=False)
        d.arc(
            (head[0] + S(0.02), head[1] + S(0.03), head[0] + S(0.08), head[1] + S(0.07)),
            20, 160, fill=B_INK, width=3,
        )
        disc((head[0] - S(0.09), head[1] + S(0.01)), S(0.028), B_SKIN[0], M_SKIN)
    elif view == "front":
        disc((head[0] - 12, head[1] - 2), 4, (40, 28, 24, 255), M_HAIR, outline=False)
        disc((head[0] + 12, head[1] - 2), 4, (40, 28, 24, 255), M_HAIR, outline=False)
        poly([(head[0], head[1] - 4), (head[0] - 5, head[1] + 12), (head[0] + 5, head[1] + 12)], B_SKIN[0], M_SKIN, width=2)
        d.arc((head[0] - 8, head[1] + 12, head[0] + 8, head[1] + 22), 10, 170, fill=B_INK, width=2)

    # Hat, drawn as crown + brim shapes rather than a shaded tube.
    crown = [(head[0] - 18, head[1] - 6), (head[0] + 16, head[1] - 8), (head[0] + 12, head[1] - 36), (head[0] - 12, head[1] - 34)]
    if view != "side":
        crown = [(head[0] - 22, head[1] - 8), (head[0] + 22, head[1] - 8), (head[0] + 16, head[1] - 38), (head[0] - 16, head[1] - 38)]
    poly(crown, (92, 62, 40, 255), M_HAT, width=4)
    if view == "side":
        brim = [(head[0] - 24, head[1] - 4), (head[0] + 40, head[1] - 2), (head[0] + 40, head[1] + 6), (head[0] - 24, head[1] + 4)]
    else:
        brim = [(head[0] - 46, head[1] - 6), (head[0] + 46, head[1] - 6), (head[0] + 46, head[1] + 6), (head[0] - 46, head[1] + 6)]
    poly(brim, (72, 48, 30, 255), M_HAT, width=4)
    d.line([brim[0], brim[1]], fill=(186, 150, 96, 255), width=2)

    # Scarf ribbon with a hand-offset tail (the lag lives in the pose chart).
    lag = joints["scarf_lag"] * PPM
    c0 = (neck[0], neck[1])
    c1 = (neck[0] - 6 + lag * 0.2, neck[1] + 28)
    c2 = (neck[0] + 10 + lag, neck[1] + 58)
    c3 = (neck[0] - 4 + lag * 1.5, neck[1] + 96)
    d.line([c0, c1, c2, c3], fill=(150, 42, 46, 255), width=10 * SS // 2)
    d.line([c0, c1, c2, c3], fill=B_INK, width=2)
    # Mark a tube around the polyline for the partition.
    _mark_polyline(ids, [c0, c1, c2, c3], 8, M_SCARF)
    disc(c0, 11, (150, 42, 46, 255), M_SCARF)

    # Arms. Sleeves are coat; the hand is skin. Near arm last in side view.
    for side, last in (("r", False), ("l", True)):
        if view == "side" and side == "l":
            continue
        _b_arm(d, ids, joints, view, side)
    if view == "side":
        _b_arm(d, ids, joints, view, "l")

    # Bag.
    top = P("l_shoulder")
    bx = top[0] + (12 if view != "front" else 16)
    by = top[1] + 20
    poly(
        [(bx - 12, by), (bx + 14, by), (bx + 18, by + 70), (bx - 16, by + 74)],
        B_BAG,
        M_BAG,
        width=3,
    )
    d.line([(neck[0], neck[1]), (bx, by)], fill=B_BAG_D, width=4)

    # Lantern.
    rh = P("r_hand")
    lx, ly = rh[0], rh[1] + 18
    poly([(lx - 8, ly), (lx + 8, ly), (lx + 10, ly + 26), (lx - 10, ly + 26)], (210, 160, 70, 255), M_LANTERN, width=3)
    d.arc((lx - 8, ly - 10, lx + 8, ly + 2), 200, 340, fill=B_INK, width=2)

    if joints.get("grasp") and view == "side":
        lh = P("l_hand")
        disc((lh[0] + 8, lh[1]), 7, (212, 170, 72, 255), M_LANTERN)

    # Downsample and rebuild masks at final size.
    small = img.resize((CELL_W, CELL_H), Image.Resampling.BOX)
    arr = np.array(small)
    id_img = Image.fromarray(ids, mode="L").resize((CELL_W, CELL_H), Image.Resampling.NEAREST)
    mat = np.array(id_img)
    alpha = arr[:, :, 3]
    mat = np.where(alpha > 40, mat, 0).astype(np.uint8)
    alpha_u = np.where(alpha > 40, 255, 0).astype(np.uint8)
    # Shade from the painted value's brightness, so the ramps still have five tones.
    shade = np.zeros_like(mat)
    rgb = arr[:, :, :3].astype(np.int16)
    lum = (rgb[:, :, 0] * 3 + rgb[:, :, 1] * 6 + rgb[:, :, 2]) // 10
    shade = np.clip(lum // 48, 0, 4).astype(np.uint8)
    alpha_u, mat, shade = _fill_holes(alpha_u, mat, shade)
    return alpha_u, mat, shade, arr


def _b_arm(d, ids, joints, view, side):
    sh = project(joints[f"{side}_shoulder"], view)
    el = project(joints[f"{side}_elbow"], view)
    ha = project(joints[f"{side}_hand"], view)
    coat = (176, 132, 84, 255) if side == "l" or view != "side" else (150, 108, 66, 255)
    for a, b, r0, r1 in ((sh, el, S(0.05), S(0.038)), (el, ha, S(0.036), S(0.028))):
        ax, ay, _ = a
        bx, by, _ = b
        ang = math.atan2(by - ay, bx - ax)
        px, py = -math.sin(ang), math.cos(ang)
        pts = [
            (ax + px * r0, ay + py * r0),
            (bx + px * r1, by + py * r1),
            (bx - px * r1, by - py * r1),
            (ax - px * r0, ay - py * r0),
        ]
        d.polygon(pts, fill=coat, outline=B_INK)
        _mark_poly(ids, pts, M_COAT)
    d.ellipse((ha[0] - 7, ha[1] - 7, ha[0] + 7, ha[1] + 7), fill=B_SKIN[1], outline=B_INK)
    _mark_disc(ids, ha[0], ha[1], 7, M_SKIN)


def _mark_poly(ids, pts, mat):
    m = Image.new("L", (ids.shape[1], ids.shape[0]), 0)
    ImageDraw.Draw(m).polygon([(p[0], p[1]) for p in pts], fill=mat)
    src = np.array(m)
    hit = src > 0
    ids[hit] = src[hit]


def _mark_disc(ids, x, y, r, mat):
    m = Image.new("L", (ids.shape[1], ids.shape[0]), 0)
    ImageDraw.Draw(m).ellipse((x - r, y - r, x + r, y + r), fill=mat)
    src = np.array(m)
    hit = src > 0
    ids[hit] = src[hit]


def _mark_polyline(ids, pts, rad, mat):
    m = Image.new("L", (ids.shape[1], ids.shape[0]), 0)
    dr = ImageDraw.Draw(m)
    dr.line(pts, fill=mat, width=rad * 2)
    for p in pts:
        dr.ellipse((p[0] - rad, p[1] - rad, p[0] + rad, p[1] + rad), fill=mat)
    src = np.array(m)
    hit = src > 0
    ids[hit] = src[hit]


# --- atlas assembly ---------------------------------------------------------

CLIPS = (
    [("side", i, pose_walk(i, 12), "side") for i in range(12)]
    + [("front", i, pose_walk(i, 8), "front") for i in range(8)]
    + [("back", i, pose_walk(i, 8), "back") for i in range(8)]
    + [("idle", i, pose_idle(i, 8), "side") for i in range(8)]
    + [("take", i, pose_take(i, 10), "side") for i in range(10)]
)


def render_set(kind: str):
    cols = 8
    rows = math.ceil(len(CLIPS) / cols)
    sheet_base = np.zeros((rows * CELL_H, cols * CELL_W, 4), np.uint8)
    masks = {
        "coat": np.zeros((rows * CELL_H, cols * CELL_W), np.uint8),
        "hat": np.zeros((rows * CELL_H, cols * CELL_W), np.uint8),
        "scarf": np.zeros((rows * CELL_H, cols * CELL_W), np.uint8),
    }
    for n, (name, index, pose, view) in enumerate(CLIPS):
        if kind == "a":
            alpha, mat, shade = downsample(paint_a(pose, view))
        else:
            # B uses its own 2D construction. The walk chart still plants the
            # feet, but every shape is redrawn; coat lag is a drawn offset.
            pose = _b_secondary(pose, name, index)
            alpha, mat, shade, _rgb = paint_b(pose, view)
        base, coat, hat, scarf = bake_layers(alpha, mat, shade, n)
        r, c = divmod(n, cols)
        y, x = r * CELL_H, c * CELL_W
        sheet_base[y : y + CELL_H, x : x + CELL_W] = base
        masks["coat"][y : y + CELL_H, x : x + CELL_W] = coat
        masks["hat"][y : y + CELL_H, x : x + CELL_W] = hat
        masks["scarf"][y : y + CELL_H, x : x + CELL_W] = scarf
        print(f"  {kind} {name} {index}", flush=True)
    folder = OUT / kind
    folder.mkdir(parents=True, exist_ok=True)
    Image.fromarray(sheet_base).save(folder / "base.png", optimize=True)
    coat = colorize(masks["coat"], COAT_RAMPS["tan"])
    hat = colorize(masks["hat"], HAT_RAMPS["brown"])
    scarf = colorize_plaid(masks["scarf"], 0)
    # Other wardrobe colours stay as ramps in this file. The test ships the
    # default tan / brown / plaid bake; baking all 64 into atlases did not fit.
    for cid, ramp in COAT_RAMPS.items():
        if cid == "tan":
            continue
        Image.fromarray(colorize(masks["coat"], ramp)).save(folder / f"coat-{cid}.png", optimize=True)
    Image.fromarray(coat).save(folder / "coat-tan.png", optimize=True)
    for hid, ramp in HAT_RAMPS.items():
        if hid == "brown":
            continue
        Image.fromarray(colorize(masks["hat"], ramp)).save(folder / f"hat-{hid}.png", optimize=True)
    Image.fromarray(hat).save(folder / "hat-brown.png", optimize=True)
    Image.fromarray(scarf).save(folder / "scarf-plaid.png", optimize=True)
    for sid, ramp in SCARF_SOLID.items():
        Image.fromarray(colorize(masks["scarf"], ramp)).save(folder / f"scarf-{sid}.png", optimize=True)
    figure = sheet_base.copy()
    for layer in (coat, hat, scarf):
        m = layer[:, :, 3] > 0
        figure[m] = layer[m]
    Image.fromarray(figure).save(folder / "figure.png", optimize=True)
    return folder


def _b_secondary(pose, name, index):
    """Extra drawn follow-through so B is not A's lighting with the volume removed."""
    pose = dict(pose)
    if name == "side":
        # Coat hem and scarf trail a full extra beat, keyed by hand per step.
        u = pose["u"]
        pose["hem_lag"] = -math.sin((u - 0.38) * math.pi * 2) * 0.07
        pose["scarf_lag"] = -math.sin((u - 0.42) * math.pi * 2) * 0.085
    elif name == "idle":
        t = index / 8
        pose["scarf_lag"] = math.sin(t * math.pi * 2 + 0.4) * 0.03
        pose["hem_lag"] = math.sin(t * math.pi * 2 + 1.1) * 0.02
    return pose


def write_meta():
    meta = {
        "cellW": CELL_W,
        "cellH": CELL_H,
        "cols": 8,
        "pivotX": PIVOT_X,
        "pivotY": PIVOT_Y,
        "figureMeters": FIGURE_M,
        "stepMeters": STEP_M,
        "side": {"start": 0, "count": 12, "perStep": 6, "fps": 12},
        "front": {"start": 12, "count": 8, "perStep": 4, "fps": 10},
        "back": {"start": 20, "count": 8, "perStep": 4, "fps": 10},
        "idle": {"start": 28, "count": 8, "fps": 8},
        "take": {"start": 36, "count": 10, "fps": 12, "grasp": 5},
        "sets": ["a", "b"],
    }
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "meta.json").write_text(json.dumps(meta, indent=2))
    return meta


# --- office -----------------------------------------------------------------

def paint_office():
    """1280×720 dispatch office. Doors are 315px (2.5 m at the back line)."""
    w, h = 1280, 720
    rng = np.random.default_rng(17)
    img = np.zeros((h, w, 3), np.float32)
    # Wall.
    yy = np.linspace(0, 1, h)[:, None, None]
    wall = np.zeros((h, w, 3), np.float32)
    wall[:, :] = (92, 70, 52)
    wall *= 0.82 + 0.28 * (1 - yy)
    n = rng.normal(0, 1, (h // 2, w // 2))
    n = np.array(Image.fromarray(n.astype(np.float32), mode="F").resize((w, h), Image.Resampling.BICUBIC))
    wall += n[:, :, None] * 4
    # Wainscot.
    wall[430:468] *= 0.72
    wall[468:] *= 0.0
    img += wall
    # Floor, boards running to a vanishing point near the back line.
    floor = np.zeros((h, w, 3), np.float32)
    vp_x, vp_y = 640, 430
    ys, xs = np.mgrid[0:h, 0:w]
    for y in range(468, h):
        row_t = (y - 468) / (h - 468)
        # Board boundaries fan out from the vanishing point.
        span = lerp(180, 1280, row_t ** 0.85)
        left = vp_x - span / 2
        # Which board.
        u = (np.arange(w) - left) / max(1, span)
        board = np.floor(u * 14)
        tone = 0.78 + (board % 2) * 0.08 + ((board * 3) % 5) * 0.015
        gap = (np.abs(u * 14 - np.round(u * 14)) < 0.035).astype(np.float32)
        col = np.stack([
            86 * tone * (1 - 0.35 * gap),
            58 * tone * (1 - 0.35 * gap),
            38 * tone * (1 - 0.35 * gap),
        ], axis=-1)
        # Darken toward the front edge and the corners.
        vig = 1 - 0.25 * abs(np.linspace(-1, 1, w))
        col *= vig[:, None] * (1 - 0.15 * row_t)
        floor[y] = col
    grain = rng.normal(0, 3, (h, w, 1))
    floor += grain
    img[468:] = floor[468:]

    pil = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB")
    d = ImageDraw.Draw(pil, "RGBA")

    def door(x, swing_right=False):
        top, bot = 153, 468
        d.rectangle((x, top, x + 118, bot), fill=(78, 52, 34, 255), outline=(42, 28, 18, 255), width=4)
        # Transom.
        d.rectangle((x + 10, top + 8, x + 108, top + 52), fill=(186, 206, 196, 255), outline=(62, 42, 28, 255), width=3)
        d.rectangle((x + 14, top + 12, x + 104, top + 48), fill=(214, 224, 214, 220))
        # Panels.
        d.rectangle((x + 14, top + 64, x + 104, top + 150), outline=(48, 32, 20, 255), width=3)
        d.rectangle((x + 18, top + 68, x + 100, top + 146), fill=(96, 66, 42, 255))
        d.rectangle((x + 14, top + 162, x + 104, top + 250), outline=(48, 32, 20, 255), width=3)
        d.rectangle((x + 18, top + 166, x + 100, top + 246), fill=(88, 58, 36, 255))
        knob_x = x + (96 if not swing_right else 22)
        d.ellipse((knob_x, top + 175, knob_x + 10, top + 185), fill=(198, 160, 72, 255))

    door(48, swing_right=False)
    door(1114, swing_right=True)

    # Window and purple curtains.
    d.rectangle((250, 168, 470, 400), fill=(18, 28, 42, 255))
    # City.
    rng2 = np.random.default_rng(3)
    for i, bx in enumerate(range(260, 460, 18)):
        bh = 40 + (i * 37) % 90
        d.rectangle((bx, 400 - bh, bx + 14, 392), fill=(28, 40, 58, 255))
        for wy in range(400 - bh + 8, 380, 14):
            if rng2.random() > 0.45:
                d.rectangle((bx + 3, wy, bx + 6, wy + 4), fill=(232, 196, 120, 230))
    # Rain streaks baked, plus a live overlay in the scene.
    for i in range(28):
        rx = 258 + (i * 47) % 200
        ry = 176 + (i * 29) % 180
        d.line((rx, ry, rx - 3, ry + 16), fill=(180, 200, 210, 90), width=1)
    d.rectangle((246, 164, 474, 404), outline=(62, 44, 32, 255), width=6)
    # Curtains.
    d.polygon([(230, 150), (270, 150), (286, 430), (220, 430)], fill=(92, 48, 84, 255))
    d.polygon([(450, 150), (500, 150), (512, 430), (430, 430)], fill=(78, 40, 74, 255))
    d.rectangle((226, 146, 504, 162), fill=(112, 64, 102, 255))
    # Sill.
    d.rectangle((236, 400, 486, 418), fill=(92, 70, 52, 255))
    d.ellipse((300, 386, 336, 408), fill=(48, 72, 48, 255))  # plant

    # Case board.
    d.rectangle((500, 150, 820, 340), fill=(128, 96, 64, 255), outline=(72, 52, 36, 255), width=4)
    papers = [(530, 170, 90, 58), (640, 160, 70, 50), (730, 176, 70, 64), (560, 240, 80, 70), (670, 236, 100, 78)]
    for i, (px, py, pw, ph) in enumerate(papers):
        col = (214, 196, 160, 255) if i != 2 else (186, 196, 186, 255)
        d.rectangle((px, py, px + pw, py + ph), fill=col)
        d.line((px + 8, py + 14, px + pw - 8, py + 14), fill=(120, 90, 60, 180), width=1)
    d.line((560, 200, 760, 250), fill=(160, 42, 42, 255), width=2)
    d.line((600, 180, 720, 280), fill=(160, 42, 42, 255), width=2)
    d.ellipse((690, 210, 706, 226), outline=(90, 30, 30, 255), width=2)

    # Filing cabinet.
    d.rectangle((860, 292, 980, 468), fill=(70, 104, 96, 255), outline=(36, 58, 52, 255), width=3)
    for fy in (310, 360, 410):
        d.rectangle((872, fy, 968, fy + 40), outline=(40, 64, 58, 255), width=2)
        d.rectangle((908, fy + 16, 932, fy + 24), fill=(198, 160, 72, 255))

    # Desk, 0.78 m ≈ 100px, in front of the back wall and clear of the door.
    d.rectangle((990, 392, 1108, 500), fill=(96, 64, 40, 255))
    d.polygon([(980, 378), (1120, 378), (1108, 400), (990, 400)], fill=(120, 82, 52, 255))
    d.rectangle((1000, 400, 1030, 492), fill=(78, 52, 34, 255))
    d.rectangle((1068, 400, 1098, 492), fill=(78, 52, 34, 255))
    # Green lamp, phone, teacup. Edith herself is not painted into the wall.
    d.polygon([(1046, 300), (1078, 300), (1086, 340), (1038, 340)], fill=(58, 110, 72, 255))
    d.rectangle((1056, 338, 1068, 372), fill=(72, 56, 36, 255))
    d.ellipse((1048, 368, 1078, 380), fill=(90, 70, 44, 255))
    d.ellipse((1004, 360, 1036, 378), fill=(36, 28, 24, 255))  # phone
    d.arc((1006, 348, 1034, 370), 200, 340, fill=(48, 36, 28, 255), width=3)
    d.ellipse((1090, 358, 1110, 372), fill=(220, 216, 206, 255))  # cup
    d.ellipse((1094, 360, 1106, 368), fill=(120, 78, 48, 255))

    # Rocking chair, back about 1.0 m, kept behind the walk line.
    d.polygon([(700, 330), (790, 326), (804, 470), (688, 474)], fill=(92, 58, 78, 255))
    d.polygon([(708, 360), (782, 356), (790, 450), (700, 454)], fill=(120, 78, 102, 255))
    d.arc((680, 468, 820, 520), 200, 340, fill=(62, 42, 30, 255), width=4)

    # Coat rack.
    d.line((210, 250, 210, 468), fill=(62, 44, 30, 255), width=5)
    d.line((186, 268, 234, 268), fill=(62, 44, 30, 255), width=4)
    d.polygon([(188, 274), (214, 274), (220, 430), (184, 436)], fill=(140, 112, 74, 255))  # spare coat

    # Low bookcase in the left foreground. The walk polygon goes around it.
    # Top is about chest height for Edmund standing beside it.
    d.rectangle((150, 470, 270, 640), fill=(86, 58, 38, 255), outline=(48, 32, 22, 255), width=3)
    d.rectangle((160, 488, 260, 540), fill=(54, 36, 26, 255))
    d.rectangle((168, 500, 186, 534), fill=(120, 48, 42, 255))
    d.rectangle((192, 496, 210, 534), fill=(48, 72, 64, 255))
    d.rectangle((216, 504, 250, 534), fill=(72, 56, 90, 255))
    # The paperweight is its own sprite, not painted into the shelf.

    # Lamp light, warm pool. Applied as a soft add.
    glow = Image.new("RGB", (w, h), (0, 0, 0))
    gd = ImageDraw.Draw(glow)
    for r, col in ((220, 18), (140, 28), (70, 36)):
        gd.ellipse((1062 - r, 340 - r, 1062 + r, 340 + r), fill=(col, int(col * 0.8), int(col * 0.4)))
    glow = glow.filter(ImageFilter.GaussianBlur(18))
    base = np.array(pil).astype(np.float32)
    add = np.array(glow).astype(np.float32)
    out = np.clip(base + add, 0, 255).astype(np.uint8)
    # A cool leak from the window.
    cool = np.zeros_like(out, np.float32)
    for r, col in ((180, 10), (90, 16)):
        yy, xx = np.mgrid[0:h, 0:w]
        m = ((xx - 360) ** 2 + (yy - 280) ** 2) < r * r
        cool[m, 2] += col
        cool[m, 1] += col * 0.4
    out = np.clip(out.astype(np.float32) + cool, 0, 255).astype(np.uint8)
    Image.fromarray(out, "RGB").save(OFFICE, quality=90)
    print("office", OFFICE, flush=True)


def contact_sheet():
    """One strip of the side cycle, both sets, for a quick look."""
    tiles = []
    for kind in ("a", "b"):
        base = np.array(Image.open(OUT / kind / "base.png"))
        coat = np.array(Image.open(OUT / kind / "coat-tan.png"))
        hat = np.array(Image.open(OUT / kind / "hat-brown.png"))
        scarf = np.array(Image.open(OUT / kind / "scarf-plaid.png"))
        # First 12 cells.
        row = []
        for i in range(12):
            x = (i % 8) * CELL_W
            y = (i // 8) * CELL_H
            cell = base[y : y + CELL_H, x : x + CELL_W].copy()
            for layer in (coat, hat, scarf):
                part = layer[y : y + CELL_H, x : x + CELL_W]
                m = part[:, :, 3] > 0
                cell[m] = part[m]
            row.append(cell)
        tiles.append(np.concatenate(row, axis=1))
    sheet = np.concatenate(tiles, axis=0)
    # Scale down for viewing.
    im = Image.fromarray(sheet, "RGBA")
    rgb = Image.new("RGB", im.size, (40, 32, 28))
    rgb.paste(im, mask=im.split()[-1])
    rgb = rgb.resize((rgb.width // 2, rgb.height // 2), Image.Resampling.BOX)
    path = ROOT / "art-src" / "edmund-stage1-sheet.jpg"
    path.parent.mkdir(parents=True, exist_ok=True)
    rgb.save(path, quality=85)
    print("sheet", path, flush=True)


def paint_weight():
    im = Image.new("RGBA", (48, 32), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse((4, 8, 44, 28), fill=(186, 142, 58, 255), outline=(92, 64, 28, 255))
    d.ellipse((14, 12, 28, 20), fill=(220, 186, 110, 255))
    im.save(ROOT / "public" / "assets" / "prop-weight.png")


def main():
    print("rendering set A", flush=True)
    render_set("a")
    print("rendering set B", flush=True)
    render_set("b")
    write_meta()
    paint_office()
    paint_weight()
    contact_sheet()


if __name__ == "__main__":
    main()
