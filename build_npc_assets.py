#!/usr/bin/env python3
"""Convert four CC0 Kenney Mini Characters to the small offline V5 skin format.

Usage: python3 source/build_npc_assets.py /path/to/kenney_mini-characters.zip
No external packages. Original source files are identified by hash in provenance.
"""
import argparse
import base64
import hashlib
import json
import math
import pathlib
import struct
import zipfile
import zlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SELECTED = [
    ("colleague-a", "Kollega · lång frisyr", "character-female-f.glb", 1.68),
    ("colleague-b", "Kollega · vardagskläder", "character-male-a.glb", 1.78),
    ("colleague-c", "Kollega · labbrock", "character-female-e.glb", 1.60),
    ("material-handler", "Material Handler · arbetskläder", "character-male-e.glb", 1.75),
]
CLIPS = ["idle", "walk", "emote-yes", "emote-no", "interact-right", "holding-both", "pick-up"]


def png_palette(data):
    """Decode the source's indexed PNG, including all five lossless row filters."""
    pos, compressed, palette = 8, b"", []
    while pos < len(data):
        size = struct.unpack_from(">I", data, pos)[0]
        tag, value = data[pos + 4:pos + 8], data[pos + 8:pos + 8 + size]
        if tag == b"IHDR":
            width, height, depth, colour, _, _, interlace = struct.unpack(">IIBBBBB", value)
            assert depth == 8 and colour == 3 and interlace == 0
        elif tag == b"PLTE":
            palette = [list(value[i:i + 3]) for i in range(0, len(value), 3)]
        elif tag == b"IDAT":
            compressed += value
        pos += size + 12
    raw, pixels, previous = zlib.decompress(compressed), [], bytearray(width)
    for y in range(height):
        filt = raw[y * (width + 1)]
        row = bytearray(raw[y * (width + 1) + 1:(y + 1) * (width + 1)])
        for x in range(width):
            a, b, c = row[x - 1] if x else 0, previous[x], previous[x - 1] if x else 0
            if filt == 1:
                row[x] = (row[x] + a) & 255
            elif filt == 2:
                row[x] = (row[x] + b) & 255
            elif filt == 3:
                row[x] = (row[x] + (a + b) // 2) & 255
            elif filt == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                row[x] = (row[x] + (a if pa <= pb and pa <= pc else b if pb <= pc else c)) & 255
        pixels.extend(row)
        previous = row

    def sample(u, v):
        x, y = min(width - 1, max(0, int(u * width))), min(height - 1, max(0, int(v * height)))
        return palette[pixels[y * width + x]]
    return sample


def encode(values, form):
    return base64.b64encode(struct.pack("<" + form * len(values), *values)).decode()


def mesh_pack(vertices, indices):
    return {
        "vertices": len(vertices), "triangles": len(indices) // 3,
        "positions": encode([v for p, n, c, b in vertices for v in p], "f"),
        "normals": encode([round(max(-1, min(1, v)) * 127) for p, n, c, b in vertices for v in n], "b"),
        "colors": encode([v for p, n, c, b in vertices for v in c], "B"),
        "joints": encode([b for p, n, c, b in vertices], "B"),
        "indices": encode(indices, "H"),
    }


def cluster_lod(vertices, indices, cell=.080):
    # Merge only spatially close vertices with the same colour and rigid bone.
    # This preserves skin attachment and palette boundaries; LOD is real geometry.
    keys, groups, remap = {}, [], []
    for p, n, c, b in vertices:
        # Faces, hair and glasses define identity. Preserve head positions so a
        # collapsed skin surface cannot cover the tiny eye/mouth triangles.
        facial_detail = b == 6
        spatial = tuple(round(v, 6) for v in p) if facial_detail else tuple(round(v / cell) for v in p)
        key = (facial_detail,) + spatial + tuple(c) + (b,)
        if key not in keys:
            keys[key] = len(groups)
            groups.append([])
        i = keys[key]
        groups[i].append((p, n, c, b))
        remap.append(i)
    reduced = []
    for group in groups:
        p = [sum(v[0][a] for v in group) / len(group) for a in range(3)]
        n = [sum(v[1][a] for v in group) for a in range(3)]
        length = math.sqrt(sum(v * v for v in n)) or 1
        reduced.append((p, [v / length for v in n], group[0][2], group[0][3]))
    out, seen = [], set()
    for i in range(0, len(indices), 3):
        tri = tuple(remap[j] for j in indices[i:i + 3])
        if len(set(tri)) == 3 and tri not in seen:
            seen.add(tri)
            out.extend(tri)
    return reduced, out


def convert(data, sample):
    size = struct.unpack_from("<I", data, 12)[0]
    gltf, binary = json.loads(data[20:20 + size]), data[28 + size:]

    def accessor(index):
        a = gltf["accessors"][index]
        view = gltf["bufferViews"][a["bufferView"]]
        nc = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}[a["type"]]
        form = {5126: "f", 5123: "H", 5121: "B", 5125: "I"}[a["componentType"]]
        return list(struct.unpack_from("<" + form * a["count"] * nc, binary, view.get("byteOffset", 0) + a.get("byteOffset", 0)))

    skin = gltf["skins"][0]
    assert all(s["joints"] == skin["joints"] and accessor(s["inverseBindMatrices"]) == accessor(skin["inverseBindMatrices"]) for s in gltf["skins"])
    vertices, indices, lookup = [], [], {}
    for mesh in gltf["meshes"]:
        for primitive in mesh["primitives"]:
            attrs = primitive["attributes"]
            positions, normals, uvs, bones, weights = [accessor(attrs[k]) for k in ["POSITION", "NORMAL", "TEXCOORD_0", "JOINTS_0", "WEIGHTS_0"]]
            remap = []
            for i in range(len(positions) // 3):
                # Kenney's supplied 7-bone skin is rigid: every vertex has one
                # weight of 1. This exact representation needs a single joint.
                assert weights[i * 4:i * 4 + 4] == [1, 0, 0, 0]
                p, n, c, b = positions[i * 3:i * 3 + 3], normals[i * 3:i * 3 + 3], sample(*uvs[i * 2:i * 2 + 2]), bones[i * 4]
                key = tuple(round(v, 6) for v in p + n) + tuple(c) + (b,)
                if key not in lookup:
                    lookup[key] = len(vertices)
                    vertices.append((p, n, c, b))
                remap.append(lookup[key])
            indices.extend(remap[i] for i in accessor(primitive["indices"]))
    nodes = []
    parents = {child: i for i, n in enumerate(gltf["nodes"]) for child in n.get("children", [])}
    for node_index in skin["joints"]:
        n = gltf["nodes"][node_index]
        parent_index = parents.get(node_index)
        nodes.append({
            "name": n["name"], "parent": skin["joints"].index(parent_index) if parent_index in skin["joints"] else -1,
            "t": n.get("translation", [0, 0, 0]), "q": n.get("rotation", [0, 0, 0, 1]),
            "s": n.get("scale", [1, 1, 1]),
        })
    clips = {}
    for clip in gltf["animations"]:
        if clip["name"] not in CLIPS:
            continue
        channels, duration = [], 0
        for channel in clip["channels"]:
            target = channel["target"]
            if target["node"] not in skin["joints"]:
                continue
            sampler = clip["samplers"][channel["sampler"]]
            assert sampler.get("interpolation", "LINEAR") == "LINEAR"
            times, values = accessor(sampler["input"]), accessor(sampler["output"])
            duration = max(duration, max(times))
            channels.append({"node": skin["joints"].index(target["node"]), "path": target["path"], "times": [round(t, 6) for t in times], "values": [round(t, 7) for t in values]})
        clips[clip["name"]] = {"duration": duration, "channels": channels}
    bounds = [[min(v[0][axis] for v in vertices), max(v[0][axis] for v in vertices)] for axis in range(3)]
    return {"nodes": nodes, "inverseBind": accessor(skin["inverseBindMatrices"]), "bounds": bounds, "clips": clips, "lods": [mesh_pack(vertices, indices), mesh_pack(*cluster_lod(vertices, indices))]}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source_zip", type=pathlib.Path)
    args = parser.parse_args()
    archive = zipfile.ZipFile(args.source_zip)
    palette = archive.read("Models/GLB format/Textures/colormap.png")
    sample = png_palette(palette)
    assets = {"version": 1, "source": "Kenney Mini Characters 1.0", "license": "CC0-1.0", "variants": []}
    provenance = {
        "source": "Kenney Mini Characters", "version": "1.0", "sourceCreationDate": "2024-07-17",
        "retrieved": "2026-10-20", "page": "https://kenney.nl/assets/mini-characters",
        "archiveUrl": "https://kenney.nl/media/pages/assets/mini-characters/bfc7e272b4-1774770718/kenney_mini-characters.zip",
        "archiveSha256": hashlib.sha256(args.source_zip.read_bytes()).hexdigest(),
        "license": "CC0-1.0", "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
        "sourceLicenseFile": "License.txt", "licenseSha256": hashlib.sha256(archive.read("License.txt")).hexdigest(),
        "paletteSha256": hashlib.sha256(palette).hexdigest(),
        "retainedClips": CLIPS, "files": [],
        "processing": [
            "Only four original characters retained; all unused models and clips excluded.",
            "Original indexed PNG palette baked to per-vertex sRGB colour; no runtime textures.",
            "Duplicate vertices welded exactly by position, normal, colour and joint.",
            "Original rigid 7-joint weights represented exactly as one joint index per vertex.",
            "Secondary mesh generated by spatial vertex clustering, preserving colour and bone boundaries.",
            "Original LINEAR animation keyframes preserved; quaternion rotations interpolated by shortest-path slerp.",
            "Runtime height is configurable; horizontal scale is 0.62 of proportional height scale to suit the planning room.",
        ],
        "proceduralMotion": ["turn: root yaw steering with source idle", "look/phone: source emote-no with optional head/arm pose", "dance: source emote-yes with procedural arm, torso and root rhythm"],
    }
    out = ROOT / "assets" / "people"
    out.mkdir(parents=True, exist_ok=True)
    for ident, label, name, height in SELECTED:
        data = archive.read("Models/GLB format/" + name)
        model = convert(data, sample)
        model.update({"id": ident, "label": label, "height": height, "sourceFile": name})
        assets["variants"].append(model)
        provenance["files"].append({"sourceFile": "Models/GLB format/" + name, "sha256": hashlib.sha256(data).hexdigest(), "id": ident, "triangles": [m["triangles"] for m in model["lods"]], "vertices": [m["vertices"] for m in model["lods"]]})
    text = json.dumps(assets, ensure_ascii=False, separators=(",", ":"))
    (out / "characters.compact.json").write_text(text + "\n", encoding="utf-8")
    (ROOT / "source" / "npc-assets.js").write_text("/* Generated by build_npc_assets.py. Kenney Mini Characters 1.0 — CC0-1.0. */\nconst NpcAssets=" + text + ";\nif(typeof module==='object')module.exports=NpcAssets;\n", encoding="utf-8")
    (out / "LICENSE-KENNEY.txt").write_bytes(archive.read("License.txt"))
    (out / "provenance.json").write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"bytes": len(text.encode()), "variants": provenance["files"]}, indent=2))


if __name__ == "__main__":
    main()
