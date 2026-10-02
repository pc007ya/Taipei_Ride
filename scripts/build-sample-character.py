"""Generate our fitted, continuous rider/walker from the CC0 MakeHuman hm08 mesh.
Static mesh data only is consumed; no MakeHuman/addon code is imported or run.
Run: blender -b --python scripts/build-sample-character.py
"""
import bpy, json, math, pathlib, hashlib
from mathutils import Vector, Matrix
from collections import defaultdict
ROOT=pathlib.Path(__file__).resolve().parents[1]
SOURCE=ROOT/'assets/source/makehuman/makehuman-base.obj'
vertices=[];uvs=[];groups=defaultdict(list);group=''
for line in SOURCE.read_text().splitlines():
 p=line.split()
 if not p:continue
 if p[0]=='v':vertices.append(Vector(map(float,p[1:4])))
 elif p[0]=='vt':uvs.append(tuple(map(float,p[1:3])))
 elif p[0]=='g':group=p[1]
 elif p[0]=='f':groups[group].append([(int(t.split('/')[0])-1,int(t.split('/')[1])-1)for t in p[1:]])
# Source's Y axis is height, Z points forward. Convert to the game's Y-up/X-forward.
SCALE=1.0;GROUND=-8.1676
V=[Vector((v.z-.15,(v.y-GROUND)*SCALE,-v.x*SCALE))for v in vertices]
def joint(name):
 ix=set(i for f in groups['joint-'+name]for i,_ in f)
 return sum((V[i]for i in ix),Vector())/len(ix)
def dst(x,y,z):return Vector((x,y,z))
def source_skeleton():
 j={k:joint(k) for k in ['pelvis','spine-4','spine-3','spine-2','spine-1','neck','head','head-2']}
 for s in ['l','r']:
  for k in ['clavicle','shoulder','elbow','hand','hand-2','upper-leg','knee','ankle','foot-1','foot-2']:j[s+'-'+k]=joint(s+'-'+k)
 return j
SRC=source_skeleton()
for side in ['l','r']:
 SRC[side+'-hand-2']=joint(side+'-finger-3-1')
 for finger in range(1,6):
  for segment in range(1,5):SRC[f'{side}-finger-{finger}-{segment}']=joint(f'{side}-finger-{finger}-{segment}')

def target_skeleton(seated):
 d={k:v.copy() for k,v in SRC.items()}
 # Relaxed natural upright body, then a modest forward torso lean in the seated pose.
 for k in ['pelvis','spine-4','spine-3','spine-2','spine-1','neck','head','head-2']:
  d[k].x-=.02
  if seated:d[k].x+=-2.85+max(0,d[k].y-9)*.24;d[k].y+=.1
 for side,s in [(-1,'l'),(1,'r')]:
  if seated:
   d[s+'-clavicle']=dst(-.8,13.18,side*.75);d[s+'-shoulder']=dst(-.35,13.16,side*1.73)
   d[s+'-elbow']=dst(2.37,11.22,side*2.82);d[s+'-hand']=dst(5.46,11.3,side*3.55)
   d[s+'-hand-2']=dst(5.78,11.43,side*3.62)
   d[s+'-upper-leg']=dst(-2.86,9.31,side*1.17);d[s+'-knee']=dst(.74,6.39,side*2.12)
   d[s+'-ankle']=dst(.05,3.76,side*2.3);d[s+'-foot-1']=dst(.69,3.17,side*2.3);d[s+'-foot-2']=dst(1.5,3.18,side*2.3)
  else:
   d[s+'-clavicle']=dst(-.13,13.65,side*.65);d[s+'-shoulder']=dst(-.05,13.42,side*1.7)
   d[s+'-elbow']=dst(.07,10.78,side*1.84);d[s+'-hand']=dst(.2,8.31,side*1.51);d[s+'-hand-2']=dst(.3,7.48,side*1.54)
   d[s+'-upper-leg']=dst(-.01,8.68,side*.94);d[s+'-knee']=dst(.18,4.73,side*1.0)
   d[s+'-ankle']=dst(.02,.94,side*1.06);d[s+'-foot-1']=dst(.62,.23,side*1.06);d[s+'-foot-2']=dst(1.35,.23,side*1.06)
  for finger in range(1,6):
   if seated:
    z=side*3.62+(finger-3.2)*.135
    if finger==1:points=[(5.45,11.42,side*3.28),(5.63,11.63,side*3.26),(5.87,11.52,side*3.28),(5.84,11.25,side*3.31)]
    else:points=[(5.78,11.46,z),(6.02,11.28,z),(5.99,11.02,z),(5.74,10.96,z)]
    for segment in range(1,5):d[f'{s}-finger-{finger}-{segment}']=dst(*points[segment-1])
   else:
    q=(SRC[s+'-hand-2']-SRC[s+'-hand']).rotation_difference(d[s+'-hand-2']-d[s+'-hand'])
    for segment in range(1,5):d[f'{s}-finger-{finger}-{segment}']=d[s+'-hand']+q@(SRC[f'{s}-finger-{finger}-{segment}']-SRC[s+'-hand'])
 return d

BONES=[('pelvis','pelvis','spine-4',None,1.5),('abdomen','spine-4','spine-2','pelvis',1.6),('chest','spine-2','neck','abdomen',1.8),('head','neck','head-2','chest',1.0)]
for s in ['l','r']:
 BONES += [(s+'-shoulder',s+'-clavicle',s+'-shoulder','chest',.6),(s+'-arm',s+'-shoulder',s+'-elbow',s+'-shoulder',.65),(s+'-forearm',s+'-elbow',s+'-hand',s+'-arm',.5),(s+'-hand',s+'-hand',s+'-hand-2',s+'-forearm',.45),(s+'-thigh',s+'-upper-leg',s+'-knee','pelvis',.95),(s+'-shin',s+'-knee',s+'-ankle',s+'-thigh',.65),(s+'-foot',s+'-ankle',s+'-foot-2',s+'-shin',.7)]

for side in ['l','r']:
 for finger in range(1,6):
  for segment in range(1,4):
   name=f'{side}-finger-{finger}-{segment}';BONES.append((name,name,f'{side}-finger-{finger}-{segment+1}',side+'-hand'if segment==1 else f'{side}-finger-{finger}-{segment-1}',.15))

def segment_distance(p,a,b):
 v=b-a;t=max(0,min(1,(p-a).dot(v)/v.length_squared));return (p-a-v*t).length

def weights(p):
 # A continuous envelope field has no categorical shoulder/hip boundary.
 # Four neighboring bone capsules blend across each joint and armpit.
 candidates=[]
 for i,b in enumerate(BONES):
  distance=segment_distance(p,SRC[b[1]],SRC[b[2]])
  candidates.append((max(.085,distance/b[4]),i))
 chosen=sorted(candidates)[:4];values=[(i,1/d**4)for d,i in chosen];total=sum(w for _,w in values)
 return [(i,w/total)for i,w in values]

W=[weights(p)for p in V]
def deform(p,w,target):
 out=Vector()
 for i,weight in w:
  _,a,b,_,_=BONES[i];sa,sb=SRC[a],SRC[b];ta,tb=target[a],target[b]
  sv=sb-sa;tv=tb-ta;q=sv.rotation_difference(tv);rel=p-sa
  # Preserve limb thickness while changing joint-to-joint length.
  longitudinal=sv.normalized();along=rel.dot(longitudinal);perp=rel-longitudinal*along
  out+=(ta+q@perp+tv.normalized()*along*(tv.length/sv.length))*weight
 return out

def generate(seated):
 target=target_skeleton(seated);materials={};pieces=[]
 # Both shirt and trousers use continuous helper-tights topology: shoulders,
 # armpits, crotch and hips share vertices, not capped cylinders.
 for category,source in [('skin','body'),('jacket','helper-tights'),('denim','helper-tights'),('hair','body')]:
  used={};p=[];uv=[];inds=[];weights_out=[]
  for face in groups[source]:
   center=sum((V[i]for i,_ in face),Vector())/len(face)
   if category=='skin':keep=center.y>13.9 or(abs(center.z)>3.55 and center.y>8.9)
   elif category=='jacket':keep=8.7<center.y<14.6 and abs(center.z)<4.35
   elif category=='denim':keep=1.0<center.y<9.25
   else:keep=center.y>15.92 or(center.y>14.9 and center.x<.48)or(center.y>15.38 and abs(center.z)>.61)
   if not keep:continue
   polygon=[(V[vi].copy(),Vector(uvs[ui]))for vi,ui in face]
   if category in ['jacket','denim']:
    planes=[(1,9.0,1),(1,14.34,-1),(2,-4.04,1),(2,4.04,-1)]if category=='jacket'else[(1,.95,1),(1,9.23,-1)]
    for axis,level,sign in planes:
     clipped=[]
     if not polygon:break
     for a,b in zip(polygon,polygon[1:]+polygon[:1]):
      da=(a[0][axis]-level)*sign;db=(b[0][axis]-level)*sign
      if da>=0:clipped.append(a)
      if (da>=0)!=(db>=0):
       t=da/(da-db);clipped.append((a[0].lerp(b[0],t),a[1].lerp(b[1],t)))
     polygon=clipped
   ids=[]
   for original,texcoord in polygon:
    weights_vertex=weights(original)
    key=tuple(round(x,6)for x in original)+tuple(round(x,6)for x in texcoord)
    if key not in used:
     v=original.copy()
     if category=='hair':
      v+=Vector((v.x-.1,(v.y-15.6)*1.1,v.z)).normalized()*.035
     elif category!='skin':
      # Clothes sit off the body. Shape a loose jacket and trousers rather
      # than a painted naked torso; broad folds are real surface relief.
      best=max(weights_vertex,key=lambda a:a[1])[0];_,a,b,_,_=BONES[best];axis=SRC[b]-SRC[a];t=max(0,min(1,(v-SRC[a]).dot(axis)/axis.length_squared));axis_p=SRC[a]+axis*t;radial=v-axis_p
      cloth=.09 if category=='jacket' else .1
      wave=(.045*math.sin(v.y*5+v.z*2)+.024*math.sin(v.y*11-v.x*4))
      if radial.length:v+=radial.normalized()*(cloth+wave)
      if category=='jacket' and v.y<10.5:v.x+=.10*math.sin((v.y-9)*2)
     pos=deform(v,weights_vertex,target)
     used[key]=len(p);p.append([round(x,5)for x in pos]);uv.append([round(x,5)for x in texcoord]);weights_out.append(weights_vertex)
    ids.append(used[key])
   for i in range(1,len(ids)-1):inds.extend([ids[0],ids[i],ids[i+1]])
  # Mesh is smoothed in Blender; no remesh is needed for the connected source.
  name=('riding'if seated else'walking')+'-'+category
  mesh=bpy.data.meshes.new(name);mesh.from_pydata(p,[],[inds[i:i+3]for i in range(0,len(inds),3)]);mesh.update()
  # Source UV splits have coincident vertices; normals must weld across them.
  normals=[Vector()for _ in p]
  by_position=defaultdict(list)
  for i,v in enumerate(p):by_position[tuple(v)].append(i)
  for poly in mesh.polygons:
   for i in poly.vertices:normals[i]+=poly.normal*poly.area
  for indices in by_position.values():
   avg=sum((normals[i]for i in indices),Vector());avg.normalize()
   for i in indices:normals[i]=avg
  pieces.append({'name':name,'material':category,'positions':[c for v in p for c in v],'normals':[round(c,6)for n in normals for c in n],'uv':[c for v in uv for c in v],'indices':inds,'skinIndices':[i for w in weights_out for i in ([i for i,_ in w]+[0]*4)[:4]],'skinWeights':[round(x,6)for w in weights_out for x in ([v for _,v in w]+[0]*4)[:4]]})
 bones=[]
 for name,a,b,parent,r in BONES:bones.append({'name':name,'head':list(target[a]),'tail':list(target[b]),'parent':parent})
 return {'meshes':pieces,'bones':bones,'joints':{k:list(v)for k,v in target.items()},'eyes':[list(deform(joint(s+'-eye'),[(3,1)],target))for s in ['l','r']],'height':16.6589,'license':'CC0-1.0','sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest()}

bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
for seated in [False,True]:
 out=ROOT/'public/sample'/('rider.json'if seated else'walker.json');out.write_text(json.dumps(generate(seated),separators=(',',':')));print('WROTE',out,out.stat().st_size)
