import numpy as np, sys, json, os, pickle
D,OUT=sys.argv[1],sys.argv[2]
V=np.load(os.path.join(D,'V.npy'));faces=pickle.load(open(os.path.join(D,'faces.pkl'),'rb'))
J={k:np.array(v) for k,v in json.load(open(os.path.join(D,'joints.json'))).items()}
def tgt(name):
    d=np.zeros_like(V)
    for l in open(os.path.join(D,'t',name+'.target')):
        if l[0]=='#' or not l.strip():continue
        p=l.split();d[int(p[0])]=[float(p[1]),float(p[2]),float(p[3])]
    return d
GROUPS=['body','helper-l-eye','helper-r-eye']
ANCH=['joint-l-shoulder','joint-r-shoulder','joint-l-elbow','joint-r-elbow']
keep=sorted({i for g in GROUPS+ANCH for f in faces[g] for i in f});remap={o:n for n,o in enumerate(keep)};nV=len(keep)
def tri(g):
    out=[]
    for f in faces[g]:
        f=[remap[i] for i in f]
        for k in range(1,len(f)-1):out+= [f[0],f[k],f[k+1]]
    return np.array(out,dtype=np.uint16)
idx={g:tri(g) for g in GROUPS}
grp=np.zeros(nV,np.uint8)
for gi,g in enumerate(GROUPS):
    for f in faces[g]:
        for i in f:grp[remap[i]]=gi
P=V[keep]  # neutral positions (region rules)
# ---- labels by nearest bone segment
segs=[]
def add(a,b,lab,side=0):segs.append((J[a],J[b],lab,side))
sp=['pelvis','spine-4','spine-3','spine-2','spine-1','neck']
for a,b in zip(sp,sp[1:]):add(a,b,'torso')
add('neck','head','neck');add('head','head-2','head')
for s,sg in (('l',1),('r',-1)):
    add('neck',f'{s}-clavicle','torso',sg);add(f'{s}-clavicle',f'{s}-shoulder','shoulder',sg)
    add(f'{s}-shoulder',f'{s}-elbow','uarm',sg);add(f'{s}-elbow',f'{s}-hand','farm',sg);add(f'{s}-hand',f'{s}-finger-3-4','hand',sg)
    add('pelvis',f'{s}-upper-leg','hip',sg);add(f'{s}-upper-leg',f'{s}-knee','thigh',sg);add(f'{s}-knee',f'{s}-ankle','shin',sg);add(f'{s}-ankle',f'{s}-foot-2','foot',sg)
best=np.full(nV,1e9);lab=np.full(nV,'none',object);tt=np.zeros(nV)
for a,b,l,s in segs:
    ab=b-a;t=np.clip(((P-a)@ab)/(ab@ab),0,1);d=np.linalg.norm(P-(a+t[:,None]*ab),axis=1)
    m=d<best;best[m]=d[m];lab[m]=l;tt[m]=t[m]
x,y,z=P[:,0],P[:,1],P[:,2];body=grp==0
BIG=0.3
class F:
    """champ scalaire : marge signée (>0 = dedans) ; & = min, | = max, ~ = opposé"""
    def __init__(s,v):s.v=np.asarray(v,dtype=float)
    def _o(s,o):return o.v if isinstance(o,F) else o
    def __sub__(s,o):return F(s.v-s._o(o))
    def __add__(s,o):return F(s.v+s._o(o))
    def __abs__(s):return F(np.abs(s.v))
    def __mul__(s,o):return F(s.v*s._o(o))
    __rmul__=__mul__
    __radd__=__add__
    def __gt__(s,o):return F(s.v-s._o(o))
    def __ge__(s,o):return F(s.v-s._o(o))
    def __lt__(s,o):return F(s._o(o)-s.v)
    def __le__(s,o):return F(s._o(o)-s.v)
    def __and__(s,o):return F(np.minimum(s.v,o.v))
    def __or__(s,o):return F(np.maximum(s.v,o.v))
    def __invert__(s):return F(-s.v)
X,Y,Z=F(x),F(y),F(z);AX=F(np.abs(x))
def L(*n):return F(np.where(np.isin(lab,n)&body,BIG,-BIG))
TF=F(tt*4.0)  # t le long de l'os, ramené en dm approx.
def interp(a,xs,ys):return F(np.interp(a.v,xs,ys))
TOR=L('torso','shoulder','hip')
R=json.load(open(sys.argv[3]))
def ev(expr):return eval(expr,{'np':np},dict(L=L,TOR=TOR,x=X,y=Y,z=Z,ax=AX,t=TF,interp=interp,abs=abs)).v
PIECES=list(R['pieces'].keys())
marg={k:np.clip(ev(R['pieces'][k]),-1.27,1.27) for k in PIECES}
mask=np.zeros(nV,np.uint32)
for bi,k in enumerate(PIECES):mask|=((marg[k]>0).astype(np.uint32)<<bi)
loose=np.clip(np.where(np.isin(lab,['thigh'])&(tt<0.5),0.6+0.8*tt,0)+np.where(np.isin(lab,['hip']),0.5,0),0,1)
# ---- morphs
def avg(*ns):return sum(tgt(n) for n in ns)/len(ns)
out={'nV':nV,'pieces':PIECES,'groups':GROUPS,'arrays':[]}
blob=bytearray()
def put(name,arr):
    global blob
    while len(blob)%4:blob+=b'\0'
    out['arrays'].append({'name':name,'type':arr.dtype.name,'offset':len(blob),'length':int(arr.size)});blob+=arr.tobytes()
for g in ('female','male'):
    base=V+avg(*[f'e-{e}-{g}' for e in ('african','asian','caucasian')])+0.8*tgt(f'p-{g}-ideal')
    put(f'{g}.pos',base[keep].astype(np.float32).ravel())
    for k,n in (('muscle+',f'u-{g}-maxmuscle-averageweight'),('muscle-',f'u-{g}-minmuscle-averageweight'),('weight+',f'u-{g}-averagemuscle-maxweight'),('weight-',f'u-{g}-averagemuscle-minweight'),('height+',f'h-{g}-maxheight'),('height-',f'h-{g}-minheight')):
        put(f'{g}.{k}',np.round(tgt(n)[keep]*2000).astype(np.int16).ravel())
for g in GROUPS:put('idx.'+g,idx[g])
W=json.load(open(os.path.join(D,'default_weights.mhw')))['weights']
armW=np.zeros(len(V));foreW=np.zeros(len(V))
for bone,lst in W.items():
    b=bone.split('.')[0]
    fa=b.startswith(('lowerarm','wrist','metacarpal','finger'))
    ua=fa or b.startswith('upperarm')
    for i,w in lst:
        if ua:armW[i]+=w
        if fa:foreW[i]+=w
        if b.startswith('shoulder01'):armW[i]+=0.35*w
for a in ANCH:put('anchor.'+a[6:],np.array(sorted({remap[i] for f in faces[a] for i in f}),dtype=np.uint16))
put('armW',(np.clip(armW[keep],0,1)*255).astype(np.uint8));put('foreW',(np.clip(foreW[keep],0,1)*255).astype(np.uint8))
put('mask',mask)
for k in PIECES:put('m.'+k,np.round(marg[k]*100).astype(np.int8));put('loose',(loose*255).astype(np.uint8));put('group',grp)
os.makedirs(OUT,exist_ok=True)
open(os.path.join(OUT,'avatar.bin'),'wb').write(blob);json.dump(out,open(os.path.join(OUT,'avatar.json'),'w'))
print('nV',nV,'bin KB',len(blob)//1024,{k:int(((mask>>i)&1).sum()) for i,k in enumerate(PIECES)})
from collections import Counter;print(Counter(lab[body]))
if os.environ.get('DBG'):
    sel=body&(ax<0.4)&(y>0.9)&(y<1.9)&(z>0.6)
    from collections import Counter
    print('navel labels',Counter(lab[sel]))
    for i in np.where(sel)[0][:12]:print(i,P[i].round(2),lab[i],round(tt[i],2))
    hd=body&np.isin(lab,['head','neck'])
    print('head y range',y[hd].min().round(2),y[hd].max().round(2),'z',z[hd].min().round(2),z[hd].max().round(2))
