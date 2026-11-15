"""Готовит GLB для wsb-builder: меши torso / sleeveL / sleeveR, UV-развёртка в сантиметрах.
Система координат конструктора: см, низ изделия y=0, перед +z, левый рукав (с точки зрения носящего) +x.
"""
import json, sys
import numpy as np, trimesh
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import dijkstra

SRC, OUT, HCM, KIND = sys.argv[1], sys.argv[2], float(sys.argv[3]), sys.argv[4]

m = trimesh.load(SRC, force='mesh')
v = m.vertices.copy(); lo, hi = v.min(0), v.max(0)
s = HCM / (hi[1] - lo[1])
v = (v - [(lo[0] + hi[0]) / 2, lo[1], (lo[2] + hi[2]) / 2]) * s
mesh = trimesh.Trimesh(v, m.faces, process=True)
v, F = mesh.vertices, mesh.faces
VN = mesh.vertex_normals.copy()
cent = mesh.triangles_center

# ---------- сегментация: геодезически ближайшее «семя» ----------
if KIND == 'tee':
    seeds = {'torso': np.abs(cent[:, 0]) < 15,
             'sleeveL': cent[:, 0] > 33, 'sleeveR': cent[:, 0] < -33}
else:
    arm = (cent[:, 1] > 6) & (cent[:, 1] < 46)
    seeds = {'torso': np.abs(cent[:, 0]) < 12,
             'sleeveL': (cent[:, 0] > 27) & arm, 'sleeveR': (cent[:, 0] < -27) & arm}
adj = mesh.face_adjacency
w = np.linalg.norm(cent[adj[:, 0]] - cent[adj[:, 1]], axis=1)
nF = len(F)
G = coo_matrix((np.r_[w, w], (np.r_[adj[:, 0], adj[:, 1]], np.r_[adj[:, 1], adj[:, 0]])), shape=(nF, nF)).tocsr()
names = ['torso', 'sleeveL', 'sleeveR']
D = np.vstack([dijkstra(G, indices=np.where(seeds[n])[0], min_only=True) for n in names])
label = D.argmin(0)
print(KIND, 'faces', {n: int((label == i).sum()) for i, n in enumerate(names)})

meta = {}
parts = {}

def unwrap_seam(uv, faces):
    """дублирует вершины на шве развёртки (u прыгает 1→0)"""
    uv = uv.copy(); faces = faces.copy()
    extra_src = []; extra_uv = []
    nV = len(uv)
    for fi, f in enumerate(faces):
        us = uv[f, 0]
        if us.max() - us.min() > 0.5:
            for k in range(3):
                if us[k] < 0.5:
                    extra_src.append(f[k]); extra_uv.append([uv[f[k], 0] + 1.0, uv[f[k], 1]])
                    faces[fi, k] = nV + len(extra_src) - 1
    return uv, faces, np.array(extra_src, int), np.array(extra_uv).reshape(-1, 2)

for li, name in enumerate(names):
    fsel = np.where(label == li)[0]
    sub = F[fsel]
    used = np.unique(sub); remap = -np.ones(len(v), int); remap[used] = np.arange(len(used))
    P = v[used]; N = VN[used]; faces = remap[sub]
    if name == 'torso':
        # u — доля длины окружности (по сечению груди), u=0 сбоку справа (x<0), перед ~0.25, спина ~0.75
        band = (P[:, 1] > 0.35 * HCM) & (P[:, 1] < 0.62 * HCM)
        th = np.arctan2(P[:, 0], P[:, 2])
        bins = np.linspace(-np.pi, np.pi, 361)
        r = np.hypot(P[:, 0], P[:, 2])
        # внешний радиус по углу (95-й перцентиль — внешняя оболочка)
        rb = np.array([np.percentile(r[band & (th >= bins[i]) & (th < bins[i + 1])], 95) if np.any(band & (th >= bins[i]) & (th < bins[i + 1])) else np.nan for i in range(360)])
        idx = np.arange(360); good = ~np.isnan(rb); rb = np.interp(idx, idx[good], rb[good], period=360)
        k = 21; rb = np.convolve(np.r_[rb[-k:], rb, rb[:k]], np.ones(k) / k, mode='same')[k:-k]
        thc = (bins[:-1] + bins[1:]) / 2
        pts = np.c_[rb * np.sin(thc), rb * np.cos(thc)]
        seg = np.linalg.norm(np.roll(pts, -1, 0) - pts, axis=1)
        C = seg.sum()
        # кумулятивная длина от угла -pi/2
        start = np.argmin(np.abs(thc - (-np.pi / 2)))
        order = np.r_[np.arange(start, 360), np.arange(0, start)]
        cum = np.zeros(361); cum[1:] = np.cumsum(seg[order])
        ang = np.unwrap(thc[order]); ang = np.r_[ang, ang[0] + 2 * np.pi]
        def u_of(t):
            t = np.where(t < ang[0], t + 2 * np.pi, t)
            return np.interp(t, ang, cum) / C
        u = u_of(th); vv = P[:, 1] / HCM
        # внутренняя оболочка — убираем из области печати (v за пределами холста)
        radial = np.c_[np.sin(th), np.zeros_like(th), np.cos(th)]
        inner = (N * radial).sum(1) < -0.3
        vv = np.where(inner, 1.25, vv)
        uv = np.c_[u, vv]
        uc_front, uc_back = float(u_of(np.array([0.0]))[0]), float(u_of(np.array([np.pi]))[0])
        meta['torso'] = dict(cmU=round(float(C), 2), cmV=HCM, uc_front=round(uc_front, 4), uc_back=round(uc_back, 4))
        print('  torso circumference', round(C, 1), 'front u', round(uc_front, 3), 'back u', round(uc_back, 3), 'inner verts', int(inner.sum()))
    else:
        t = 1 if name == 'sleeveL' else -1
        # ось рукава: PCA внешних вершин
        c0 = P.mean(0); X = P - c0
        if KIND == 'tee':
            ax = np.abs(P[:, 0])
            far = P[ax > np.percentile(ax, 90)].mean(0); near = P[ax < np.percentile(ax, 12)].mean(0)
            d = (far - near) / np.linalg.norm(far - near)
        else:
            _, _, Vt = np.linalg.svd(X, full_matrices=False); d = Vt[0]
            if d[1] > 0: d = -d  # висящий рукав: ось вниз
        proj = X @ d
        p0 = c0 + d * proj.min(); L = proj.max() - proj.min()
        tt = (proj - proj.min())  # 0 у плеча → L у манжеты
        # опорное направление c: перпендикуляр к оси в плоскости xy, «вверх/наружу»
        cxy = np.array([-d[1], d[0], 0.0]) if t > 0 else np.array([d[1], -d[0], 0.0])
        if cxy[1] < 0 and abs(cxy[1]) > 0.3: cxy = -cxy
        if abs(cxy[1]) <= 0.3 and cxy[0] * t < 0: cxy = -cxy
        cxy -= d * (cxy @ d); cxy /= np.linalg.norm(cxy)
        mvec = np.array([0, 0, -t], float); mvec -= d * (mvec @ d) + cxy * (mvec @ cxy); mvec /= np.linalg.norm(mvec)
        Q = X - np.outer(proj, d)
        phi = np.arctan2(Q @ mvec, Q @ cxy)
        u = 0.5 + phi / (2 * np.pi); vv = 1 - tt / L
        rad = np.linalg.norm(Q, axis=1)
        radial = Q / np.maximum(rad[:, None], 1e-6)
        inner = (N * radial).sum(1) < -0.3
        vv = np.where(inner, 1.25, vv)
        uv = np.c_[u, vv]
        # свободная длина рукава (вне корпуса) и центр печати
        outer = ~inner
        fromCuff = min(10.0, L * 0.3) if KIND == 'tee' else 14.0
        near = outer & (np.abs(tt - (L - fromCuff)) < 2.5)
        R = float(np.median(rad[near])) if near.any() else float(np.median(rad[outer]))
        cmU = 2 * np.pi * R
        cpt = p0 + d * (L - fromCuff) + cxy * R
        meta[name] = dict(cmU=round(cmU, 2), cmV=round(float(L), 2), vc=round(fromCuff / L, 4), uc=0.5,
                          axis=np.round(d, 3).tolist(), center=np.round(cpt, 1).tolist(), L=round(float(L), 1), R=round(R, 1),
                          dropDeg=round(float(np.degrees(np.arctan2(-d[1], abs(d[0])))), 1), p0=np.round(p0, 1).tolist())
        print(' ', name, meta[name])
    uv2, faces2, ex_src, ex_uv = unwrap_seam(uv, faces)
    P2 = np.r_[P, P[ex_src]] if len(ex_src) else P
    N2 = np.r_[N, N[ex_src]] if len(ex_src) else N
    uv2 = np.r_[uv2[:len(P)], ex_uv] if len(ex_src) else uv2
    parts[name] = (P2, N2, uv2, faces2)

# ---------- запись GLB вручную (POSITION, NORMAL, TEXCOORD_0, индексы) ----------
import struct
bin_ = bytearray(); bufferViews = []; accessors = []; meshes = []; nodes = []
def add(arr, target, comp, typ, minmax=False):
    global bin_
    while len(bin_) % 4: bin_ += b'\0'
    data = arr.tobytes(); off = len(bin_); bin_ += data
    bufferViews.append({'buffer': 0, 'byteOffset': off, 'byteLength': len(data), **({'target': target} if target else {})})
    acc = {'bufferView': len(bufferViews) - 1, 'componentType': comp, 'count': len(arr), 'type': typ}
    if minmax: acc['min'] = arr.min(0).tolist(); acc['max'] = arr.max(0).tolist()
    accessors.append(acc); return len(accessors) - 1
for name in names:
    P, N, UV, Fc = parts[name]
    N = N / np.maximum(np.linalg.norm(N, axis=1, keepdims=True), 1e-9)
    a_p = add(P.astype(np.float32), 34962, 5126, 'VEC3', True)
    a_n = add(N.astype(np.float32), 34962, 5126, 'VEC3')
    a_t = add(np.c_[UV[:, 0], 1 - UV[:, 1]].astype(np.float32), 34962, 5126, 'VEC2')  # glTF: v вниз
    a_i = add(Fc.astype(np.uint32).reshape(-1), 34963, 5125, 'SCALAR')
    meshes.append({'name': name, 'primitives': [{'attributes': {'POSITION': a_p, 'NORMAL': a_n, 'TEXCOORD_0': a_t}, 'indices': a_i, 'material': 0}]})
    nodes.append({'name': name, 'mesh': len(meshes) - 1})
gl = {'asset': {'version': '2.0', 'generator': 'wear-your-way prep'}, 'scene': 0, 'scenes': [{'nodes': list(range(len(nodes)))}],
      'nodes': nodes, 'meshes': meshes, 'materials': [{'name': 'fabric', 'pbrMetallicRoughness': {'baseColorFactor': [1, 1, 1, 1], 'metallicFactor': 0, 'roughnessFactor': 0.94}, 'doubleSided': True}],
      'accessors': accessors, 'bufferViews': bufferViews, 'buffers': [{'byteLength': len(bin_)}]}
js = json.dumps(gl, separators=(',', ':')).encode()
while len(js) % 4: js += b' '
while len(bin_) % 4: bin_ += b'\0'
with open(OUT, 'wb') as f:
    f.write(struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bin_)))
    f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
    f.write(struct.pack('<II', len(bin_), 0x004E4942)); f.write(bin_)
json.dump(meta, open(OUT + '.json', 'w'), ensure_ascii=False, indent=1)
print('  ->', OUT, round(len(bin_) / 1e6, 2), 'MB')
