#!/usr/bin/env python3
"""把 AI 生成的 GLB 吉祥物贴图降采样压缩，便于网页加载。

原始模型（混元 3D 生成）约 25 MB，其中 23.7 MB 是三张 4K PNG 贴图：
  · texture_pbr_*            基础色
  · texture_pbr_*_normal     法线
  · texture_pbr_*_metallic-...  金属度/粗糙度

做法：保持网格数据（bufferViews）不动，只把图片重新编码为较小的 JPEG，
然后按原顺序重建 GLB 的二进制块，并重算所有 bufferView 偏移。

用法：
    PYTHONPATH=<Pillow 目录> python optimize-glb.py \
        --src assets/mascot.glb --dst assets/mascot.glb
"""
import argparse
import io
import json
import os
import struct
import sys

from PIL import Image

GLB_MAGIC = 0x46546C67
CHUNK_JSON = 0x4E4F534A
CHUNK_BIN = 0x004E4942

# 名称关键字 -> (最长边, JPEG 质量)
RULES = [
    ("normal", (1024, 92)),
    ("metallic", (512, 85)),
    ("", (1024, 86)),          # 兜底 = 基础色
]


def read_glb(path):
    with open(path, "rb") as f:
        data = f.read()
    magic, version, length = struct.unpack("<III", data[:12])
    if magic != GLB_MAGIC:
        raise SystemExit("不是合法的 GLB 文件: %s" % path)
    chunks, off = [], 12
    while off < length:
        clen, ctype = struct.unpack("<II", data[off:off + 8])
        chunks.append((ctype, data[off + 8: off + 8 + clen]))
        off += 8 + clen
    js = next(c for c in chunks if c[0] == CHUNK_JSON)
    bn = next((c for c in chunks if c[0] == CHUNK_BIN), (None, b""))[1]
    return json.loads(js[1].decode("utf-8")), bn


def rule_for(name):
    low = (name or "").lower()
    for key, cfg in RULES:
        if key in low:
            return cfg
    return RULES[-1][1]


def shrink_image(raw, name):
    longest, quality = rule_for(name)
    im = Image.open(io.BytesIO(raw))
    im.load()
    has_alpha = im.mode in ("RGBA", "LA") or (im.mode == "P" and "transparency" in im.info)
    if max(im.size) > longest:
        ratio = longest / float(max(im.size))
        im = im.resize((max(1, round(im.width * ratio)), max(1, round(im.height * ratio))), Image.LANCZOS)
    out = io.BytesIO()
    if has_alpha:
        im.convert("RGBA").save(out, format="PNG", optimize=True)
        mime = "image/png"
    else:
        im.convert("RGB").save(out, format="JPEG", quality=quality, optimize=True, progressive=True)
        mime = "image/jpeg"
    return out.getvalue(), mime, im.size


def rebuild(gltf, bin_data):
    buffer_views = gltf.get("bufferViews", [])
    images = gltf.get("images", [])
    img_by_bv = {}
    for img in images:
        if "bufferView" in img:
            img_by_bv[img["bufferView"]] = img

    new_bin = bytearray()
    report = []
    for index, bv in enumerate(buffer_views):
        if index in img_by_bv and bin_data:
            start = bv.get("byteOffset", 0)
            raw = bin_data[start: start + bv["byteLength"]]
            img = img_by_bv[index]
            payload, mime, size = shrink_image(raw, img.get("name", ""))
            img["mimeType"] = mime
            report.append((img.get("name", "?"), bv["byteLength"], len(payload), size))
        else:
            start = bv.get("byteOffset", 0)
            payload = bin_data[start: start + bv["byteLength"]]
        while len(new_bin) % 4:
            new_bin.append(0)
        bv["byteOffset"] = len(new_bin)
        bv["byteLength"] = len(payload)
        new_bin += payload

    if gltf.get("buffers"):
        gltf["buffers"][0]["byteLength"] = len(new_bin)
        gltf["buffers"][0].pop("uri", None)
    return bytes(new_bin), report


def write_glb(path, gltf, bin_data):
    js = json.dumps(gltf, separators=(",", ":")).encode("utf-8")
    while len(js) % 4:
        js += b" "
    bn = bin_data
    while len(bn) % 4:
        bn += b"\x00"
    total = 12 + 8 + len(js) + (8 + len(bn) if bn else 0)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", GLB_MAGIC, 2, total))
        f.write(struct.pack("<II", len(js), CHUNK_JSON))
        f.write(js)
        if bn:
            f.write(struct.pack("<II", len(bn), CHUNK_BIN))
            f.write(bn)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--dst", required=True)
    ap.add_argument("--poster", default="")
    args = ap.parse_args()

    gltf, bin_data = read_glb(args.src)
    new_bin, report = rebuild(gltf, bin_data)
    tmp = args.dst + ".tmp"
    write_glb(tmp, gltf, new_bin)
    before = os.path.getsize(args.src)
    after = os.path.getsize(tmp)
    os.replace(tmp, args.dst)

    for name, old, new, size in report:
        print("  贴图 %-58s %6.2fMB -> %5.3fMB  (%dx%d)"
              % (name[:58], old / 1048576.0, new / 1048576.0, size[0], size[1]))
    print("GLB  %.2fMB -> %.2fMB  (%.0f%% 缩减)" % (before / 1048576.0, after / 1048576.0,
                                                    100 * (1 - after / float(before))))
    if args.poster and os.path.exists(args.poster):
        im = Image.open(args.poster).convert("RGB")
        im.thumbnail((640, 640), Image.LANCZOS)
        im.save(args.poster, format="JPEG", quality=88, optimize=True)
        print("海报  %s -> %dx%d %.0fKB" % (args.poster, im.width, im.height,
                                            os.path.getsize(args.poster) / 1024.0))


if __name__ == "__main__":
    sys.exit(main())
