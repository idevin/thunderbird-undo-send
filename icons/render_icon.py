#!/usr/bin/env python3
"""Draw the Undo Send icon: a clock, and the envelope waiting beside it.

Run from this directory to refresh the PNGs.
"""

import math
import struct
import zlib
from pathlib import Path

AMBER = (180, 83, 9, 255)
WHITE = (255, 255, 255, 255)
FLAP = (255, 224, 196, 255)
CLEAR = (0, 0, 0, 0)

CLOCK = (40, 42)
CLOCK_R = 26
ENV = (52, 54, 86, 80)
HALO = 4.5


def in_round_rect(x, y, left, top, right, bottom, radius):
    if x < left or y < top or x >= right or y >= bottom:
        return False
    if radius <= 0:
        return True
    if x < left + radius and y < top + radius:
        return (x - (left + radius)) ** 2 + (y - (top + radius)) ** 2 <= radius ** 2
    if x >= right - radius and y < top + radius:
        return (x - (right - radius)) ** 2 + (y - (top + radius)) ** 2 <= radius ** 2
    if x < left + radius and y >= bottom - radius:
        return (x - (left + radius)) ** 2 + (y - (bottom - radius)) ** 2 <= radius ** 2
    if x >= right - radius and y >= bottom - radius:
        return (x - (right - radius)) ** 2 + (y - (bottom - radius)) ** 2 <= radius ** 2
    return True


def in_circle(u, v, cx, cy, radius):
    return (u - cx) ** 2 + (v - cy) ** 2 <= radius ** 2


def dist_to_seg(x, y, x1, y1, x2, y2):
    dx, dy = x2 - x1, y2 - y1
    length = dx * dx + dy * dy
    if length == 0:
        return math.hypot(x - x1, y - y1)
    t = max(0, min(1, ((x - x1) * dx + (y - y1) * dy) / length))
    return math.hypot(x - (x1 + t * dx), y - (y1 + t * dy))


def envelope_part(u, v):
    left, top, right, bottom = ENV
    if not in_round_rect(u, v, left, top, right, bottom, 3.5):
        return None
    mid_x = (left + right) / 2
    mid_y = (top + bottom) / 2
    span = mid_y - top
    reach = ((right - left) / 2) * (mid_y - v) / span if span else 0
    if top <= v <= mid_y and abs(u - mid_x) <= reach:
        return FLAP
    return WHITE


def in_envelope_halo(u, v):
    left, top, right, bottom = ENV
    return in_round_rect(u, v, left - HALO, top - HALO, right + HALO, bottom + HALO, 3.5 + HALO)


def clock_mark(u, v):
    cx, cy = CLOCK
    if in_circle(u, v, cx, cy, 3.4):
        return True
    # 12 o'clock and 2 o'clock: a short wait.
    for angle, length in ((-math.pi / 2, 14), (-math.pi / 6, 10)):
        x2 = cx + length * math.cos(angle)
        y2 = cy + length * math.sin(angle)
        if dist_to_seg(u, v, cx, cy, x2, y2) <= 2.8:
            return True
    for angle in (-math.pi / 2, 0, math.pi / 2, math.pi):
        x1 = cx + (CLOCK_R - 7) * math.cos(angle)
        y1 = cy + (CLOCK_R - 7) * math.sin(angle)
        x2 = cx + (CLOCK_R - 2.6) * math.cos(angle)
        y2 = cy + (CLOCK_R - 2.6) * math.sin(angle)
        if dist_to_seg(u, v, x1, y1, x2, y2) <= 1.8:
            return True
    return False


def color_at(x, y, size):
    u = (x / size) * 96
    v = (y / size) * 96
    if not in_round_rect(u, v, 0, 0, 96, 96, 22):
        return CLEAR

    part = envelope_part(u, v)
    if part is not None:
        return part
    if in_envelope_halo(u, v):
        return AMBER
    cx, cy = CLOCK
    if in_circle(u, v, cx, cy, CLOCK_R):
        if clock_mark(u, v):
            return AMBER
        return WHITE
    return AMBER


def write_png(path, size):
    samples = 4
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(samples):
                for sx in range(samples):
                    px = x + (sx + 0.5) / samples
                    py = y + (sy + 0.5) / samples
                    color = color_at(px, py, size)
                    for i in range(4):
                        acc[i] += color[i]
            count = samples * samples
            row.extend(round(channel / count) for channel in acc)
        rows.append(bytes(row))
    raw = b"".join(rows)

    def chunk(tag, data):
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)

    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    Path(path).write_bytes(png)


def main():
    here = Path(__file__).resolve().parent
    for size, name in (
        (32, "icon-32.png"),
        (48, "icon-48.png"),
        (96, "icon-96.png"),
    ):
        write_png(here / name, size)


if __name__ == "__main__":
    main()
