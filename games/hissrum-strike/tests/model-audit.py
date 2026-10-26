#!/usr/bin/env python3
"""GLB scene audit: inspect real object placement/materials without moving geometry."""
import json,struct,math,collections
from pathlib import Path
p=Path('Hissrum12_V5_med_39_objekt.glb')
b=p.read_bytes(); assert b[:4]==b'glTF' and struct.unpack_from('<I',b,4)[0]==2
length,kind=struct.unpack_from('<I4s',b,12)
doc=json.loads(b[20:20+length])
nodes=doc.get('nodes',[]); meshes=doc.get('meshes',[]); acc=doc.get('accessors',[])
mat=doc.get('materials',[])
def identity():
 return [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1]
def mul(a,b):
 return [sum(a[k*4+r]*b[c*4+k] for k in range(4)) for c in range(4) for r in range(4)]
def transform(node):
 if 'matrix' in node: return node['matrix']
 tx,ty,tz=node.get('translation',[0,0,0]); x,y,z,w=node.get('rotation',[0,0,0,1]); sx,sy,sz=node.get('scale',[1,1,1])
 return [(1-2*(y*y+z*z))*sx,2*(x*y+z*w)*sx,2*(x*z-y*w)*sx,0,
         2*(x*y-z*w)*sy,(1-2*(x*x+z*z))*sy,2*(y*z+x*w)*sy,0,
         2*(x*z+y*w)*sz,2*(y*z-x*w)*sz,(1-2*(x*x+y*y))*sz,0,
         tx,ty,tz,1]
def tp(m,x,y,z):
 return [m[0]*x+m[4]*y+m[8]*z+m[12],
         m[1]*x+m[5]*y+m[9]*z+m[13],
         m[2]*x+m[6]*y+m[10]*z+m[14]]
def box(p):
 return [[min(pt[i] for pt in p) for i in range(3)],[max(pt[i] for pt in p) for i in range(3)]]
def bbox(mesh, matrix):
 pts=[]; tris=0; primNames=[]
 for prim in meshes[mesh].get('primitives',[]):
  attr=prim.get('attributes',{}); idx=attr.get('POSITION')
  if idx is None: continue
  a=acc[idx]; mi=a.get('min'); ma=a.get('max')
  if mi is None or ma is None: continue
  corners=[tp(matrix,x,y,z) for x in (mi[0],ma[0]) for y in (mi[1],ma[1]) for z in (mi[2],ma[2])]
  pts.extend(corners); count=acc[prim.get('indices')]['count'] if 'indices' in prim else a['count']
  tris+=count//3
  k=prim.get('material')
  primNames.append(mat[k].get('name',str(k)) if k is not None else 'default')
 return (*box(pts),tris,primNames) if pts else (None,None,0,[])
records=[]
def walk(idx,m,anc):
 n=nodes[idx]; mm=mul(m,transform(n)); name=n.get('name',f'node{idx}')
 if 'mesh' in n:
  mi,ma,tris,mats=bbox(n['mesh'],mm)
  if mi is not None:
   records.append(dict(node=idx,name=name,path=anc+'/'+name,minimum=mi,maximum=ma,
                      triangles=tris,mats=mats))
 for child in n.get('children',[]): walk(child,mm,anc+'/'+name)
scene=doc.get('scenes',[{}])[doc.get('scene',0)]
for root in scene.get('nodes',[]):walk(root,identity(),'')
if records:
 globalBounds=[[min(item['minimum'][i] for item in records) for i in range(3)],
               [max(item['maximum'][i] for item in records) for i in range(3)]]
else: globalBounds=[]
def rounded(x): return [round(a,3) for a in x]
print('=== GLB SCENE ===')
print(json.dumps({'asset':doc.get('asset'),'nodeCount':len(nodes),'meshCount':len(meshes),'materialCount':len(mat),
                  'sceneNodeCount':len(records),'globalBounds':globalBounds,'extent':rounded([globalBounds[1][i]-globalBounds[0][i] for i in range(3)]),
                  'totalTriangles':sum(r['triangles'] for r in records)},ensure_ascii=False))
print('=== SCENE OBJECTS ===')
for r in sorted(records,key=lambda r:-r['triangles'])[:90]:
 print(json.dumps({'name':r['name'],'min':rounded(r['minimum']),'max':rounded(r['maximum']),
                   'tris':r['triangles'],'materials':r['mats'][:4]},ensure_ascii=False))
print('=== MATERIALS ===')
for i,m in enumerate(mat[:100]):
 pbr=m.get('pbrMetallicRoughness',{})
 print(json.dumps({'id':i,'name':m.get('name'),'baseColorFactor':pbr.get('baseColorFactor'),
                   'hasTexture':'baseColorTexture' in pbr,'alphaMode':m.get('alphaMode'),'doubleSided':m.get('doubleSided')},ensure_ascii=False))
