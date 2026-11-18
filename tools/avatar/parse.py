import numpy as np, sys, json, os
D=sys.argv[1]
V=[];faces={};cur=None;groups=[]
for line in open(os.path.join(D,'base.obj')):
    if line.startswith('v '):V.append([float(x) for x in line.split()[1:4]])
    elif line.startswith('g '):cur=line.split(None,1)[1].strip()
    elif line.startswith('f '):faces.setdefault(cur,[]).append([int(p.split('/')[0])-1 for p in line.split()[1:]])
V=np.array(V)
def tgt(name):
    d=np.zeros_like(V)
    for l in open(os.path.join(D,'t',name+'.target')):
        if l[0]=='#' or not l.strip():continue
        p=l.split();d[int(p[0])]=[float(p[1]),float(p[2]),float(p[3])]
    return d
joints={g[6:]:V[sorted({i for f in fs for i in f})].mean(0) for g,fs in faces.items() if g.startswith('joint-')}
np.save(os.path.join(D,'V.npy'),V)
json.dump({k:v.tolist() for k,v in joints.items()},open(os.path.join(D,'joints.json'),'w'))
import pickle;pickle.dump(faces,open(os.path.join(D,'faces.pkl'),'wb'))
body=faces['body'];bv=sorted({i for f in body for i in f})
print('body faces',len(body),'verts',len(bv),'sizes',{len(f) for f in body})
B=V[bv];print('bounds min',B.min(0).round(2),'max',B.max(0).round(2))
for k in ['ground','pelvis','spine-4','spine-3','spine-2','spine-1','neck','head','head-2','l-clavicle','l-shoulder','l-elbow','l-hand','l-upper-leg','l-knee','l-ankle','l-foot-1','l-foot-2','l-eye','mouth','jaw']:
    print(k,joints[k].round(2))
for g in ['helper-hair','helper-l-eye','helper-r-eye']:
    print(g,len(faces[g]),'faces')
