#!/usr/bin/env python3
"""Guard the original authored room floor against regression to plinth-zero spawns."""
import json
import struct
from pathlib import Path

model = Path(__file__).resolve().parents[3] / "Hissrum12_V5_med_39_objekt.glb"
data = model.read_bytes()
assert data[:4] == b"glTF" and struct.unpack_from("<I", data, 4)[0] == 2
assert struct.unpack_from("<I", data, 8)[0] == len(data)
length, chunk_type = struct.unpack_from("<I4s", data, 12)
assert chunk_type == b"JSON"
gltf = json.loads(data[20:20 + length])
nodes = gltf["nodes"]
meshes = gltf["meshes"]
accessors = gltf["accessors"]

def vertical_limits(name):
    node = next(n for n in nodes if n.get("name") == name)
    positions = [accessors[p["attributes"]["POSITION"]]
                 for p in meshes[node["mesh"]]["primitives"]]
    return min(a["min"][1] for a in positions), max(a["max"][1] for a in positions)

floor_min, floor_max = vertical_limits("floor__floor")
plinth_min, _ = vertical_limits("base__trim")
assert -0.03 <= floor_min <= floor_max <= 0.03, "Original floor must remain at y=0 m"
assert plinth_min < floor_min - 0.1, "Source plinth should extend below the floor"
assert len(nodes) >= 100 and len(meshes) >= 90, "Original room and 39-object details missing"
print(f"PASS: GLB {len(data)} bytes, {len(nodes)} nodes, {len(meshes)} meshes; "
      f"floor y=({floor_min:.3f},{floor_max:.3f})m, "
      f"plinth y={plinth_min:.3f}m — NEVER normalize camera to plinth.")
