#!/usr/bin/env python3
"""Inspect the source GLB without external dependencies; never modify it."""
import json,struct,collections,math
from pathlib import Path
p=Path(__file__).resolve().parents[3]/'Hissrum12_V5_med_39_objekt.glb'
data=p.read_bytes()
assert data[:4]==b'glTF' and struct.unpack_from('<I',data,4)[0]==2
count,ctype=struct.unpack_from('<I4s',data,12)
g=json.loads(data[20:20+count])
print('GLB bytes',len(data),'nodes',len(g.get('nodes',[])),'meshes',len(g.get('meshes',[])),'materials',len(g.get('materials',[])),'accessors',len(g.get('accessors',[])))
print('SCENES',json.dumps(g.get('scenes',[]),ensure_ascii=False)[:3500])
for i,node in enumerate(g.get('nodes',[])):
 mesh=g['meshes'][node['mesh']] if 'mesh' in node else None
 prims=mesh.get('primitives',[]) if mesh else []
 bbox=[]
 for pr in prims:
  ac=g['accessors'][pr['attributes']['POSITION']]
  if 'min' in ac: bbox.append([ac['min'],ac['max']])
 print('NODE',i,str(node.get('name',''))[:65],'mesh',node.get('mesh'),'p',len(prims),'children',len(node.get('children',[])),
 't',node.get('translation'),'r',node.get('rotation'),'s',node.get('scale'),'matrix',node.get('matrix'),'bounds',str(bbox)[:320])
for i,mat in enumerate(g.get('materials',[])):
 print('MATERIAL',i,mat.get('name'),str(mat.get('pbrMetallicRoughness',{}))[:180],'doubleSided',mat.get('doubleSided'))
