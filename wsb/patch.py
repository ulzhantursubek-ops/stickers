"""wsb-builder v5 → v6: 3D-модели из Meshy, точные цвета по изделиям, масштаб под размер."""
import json, sys
src = open('/home/claude/wsb/pretty.js', encoding='utf-8').read()
BASE = sys.argv[1]  # папка с GLB
RENDER = json.load(open('/home/claude/wsb/render_colors.json')) if len(sys.argv) > 2 else {}

def rep(a, b, count=1):
    global src
    n = src.count(a)
    assert n == count, (n, a[:120])
    src = src.replace(a, b)

tee = json.load(open('/home/claude/wsb/tee-wsb.glb.json'))
ls = json.load(open('/home/claude/wsb/longsleeve-wsb.glb.json'))

def sleeve_uv(mt, side, kind):
    import math
    t = 1 if side == 'sleeveL' else -1
    from_cuff = mt['vc'] * mt['cmV']
    h = round(max(8, 2 * (from_cuff - 1.2)), 1)
    w = round(max(8, min(24, math.pi * mt['R'] - 4.4)), 1)
    c = mt['center']
    # направление камеры: снаружи рукава и чуть спереди
    if kind == 'tee':
        az, el = 0.75 * t, 0.62
    else:
        az, el = 1.25 * t, 0.12
    ty = c[1] if kind == 'tee' else round((c[1] + mt['p0'][1]) / 2, 1)
    view = dict(az=az, el=el, zoom=0.95, tx=round(c[0] * 0.6, 1), ty=ty, tz=c[2])
    return dict(uc=0.5, vc=mt['vc'], cmU=mt['cmU'], cmV=mt['cmV'], w=w, h=h, view=view)

def torso_uv(mt, H):
    w = round(mt['torso']['cmU'] / 2 - 4.4, 1); h = H - 14
    return {
        'front': dict(uc=mt['torso']['uc_front'], vc=round((2.5 + h / 2) / H, 4), cmU=mt['torso']['cmU'], cmV=H, w=w, h=h),
        'back': dict(uc=mt['torso']['uc_back'], vc=round((2.5 + h / 2) / H, 4), cmU=mt['torso']['cmU'], cmV=H, w=w, h=h),
    }

def colors():
    C = [
        ('tee-black', 'Чёрный', '#353535'), ('tee-white', 'Белый', '#ECECEC'), ('tee-grey', 'Серый меланж', '#E4E1D9'), ('tee-brown', 'Коричневый', '#54372F'),
        ('ls-white', 'Белый', '#F9F8FC'), ('ls-black', 'Чёрный', '#101116'), ('ls-brown', 'Коричневый', '#3F3229'), ('ls-grey', 'Графитовый', '#3F424B'),
    ]
    return [dict(id=i, name=nm, hex=hx, render=RENDER.get(i, hx)) for i, nm, hx in C]

cfg = {
    'colors': colors(),
    'products': {
        'tee': {'modelUrl': BASE + 'tee-wsb.glb', 'colorIds': ['tee-black', 'tee-white', 'tee-grey', 'tee-brown'],
                'uv': {**torso_uv(tee, 70), 'sleeveL': sleeve_uv(tee['sleeveL'], 'sleeveL', 'tee'), 'sleeveR': sleeve_uv(tee['sleeveR'], 'sleeveR', 'tee')}},
        'longsleeve': {'modelUrl': BASE + 'longsleeve-wsb.glb', 'colorIds': ['ls-white', 'ls-black', 'ls-brown', 'ls-grey'],
                       'uv': {**torso_uv(ls, 72), 'sleeveL': sleeve_uv(ls['sleeveL'], 'sleeveL', 'ls'), 'sleeveR': sleeve_uv(ls['sleeveR'], 'sleeveR', 'ls')}},
    },
}
json.dump(cfg, open('/home/claude/wsb/wsb3d-config.json', 'w'), ensure_ascii=False, indent=1)

HEADER = """window.__WSB3D=%s;
window.__wsbPickColor=function(p,cur){var ids=p&&p.colorIds;if(!ids||ids.indexOf(cur)>=0)return cur;var fam=String(cur).split("-").pop();for(var j=0;j<ids.length;j++)if(ids[j].split("-").pop()===fam)return ids[j];return ids[0]};
window.__wsbRC=function(c){return c.render||c.hex};
""" % json.dumps(cfg, ensure_ascii=False, separators=(',', ':'))
src = HEADER + src

# 1) применяем 3D-настройки к конфигу до построения справочников
rep("""      i.products.forEach(function(e) {
        r[e.id] = e
      }), i.colors.forEach(function(e) {""", """      (function() {
        var M = window.__WSB3D;
        if (!M) return;
        i.colors = M.colors;
        i.products.forEach(function(p) {
          var c = M.products[p.id];
          if (!c) return;
          p.modelUrl = c.modelUrl, p.modelScale = 1, p.colorIds = c.colorIds;
          for (var s in c.uv) p.surfaces[s] && (p.surfaces[s].uv = c.uv[s])
        })
      })(), i.products.forEach(function(e) {
        r[e.id] = e
      }), i.colors.forEach(function(e) {""")

# 2) цвета: показываем только цвета текущей вещи; материал красим «рендер»-цветом
rep('m("colors").innerHTML = i.colors.map(function(e) {',
    '(Q().colorIds && Q().colorIds.indexOf(d.colorId) < 0 && (d.colorId = window.__wsbPickColor(Q(), d.colorId), a.ready && Fe(window.__wsbRC(n[d.colorId]), !0))), m("colors").innerHTML = i.colors.filter(function(c) {\n        var ids = Q().colorIds;\n        return !ids || ids.indexOf(c.id) >= 0\n      }).map(function(e) {')
rep("Fe(n[d.colorId].hex", "Fe(window.__wsbRC(n[d.colorId])", count=4)
rep("color: Ce(n[d.colorId].hex),", "color: Ce(window.__wsbRC(n[d.colorId])),")
rep("return d.productId = r.product, a.ready && (", "return d.productId = r.product, d.colorId = window.__wsbPickColor(Q(), d.colorId), a.ready && (")

# 3) загрузка GLB: запасной адрес, масштаб под размер, свои области печати и ракурсы, убрать швы-заглушки
rep("(new a.T.GLTFLoader).load(e.modelUrl, i, void 0, t)",
    "(new a.T.GLTFLoader).load(e.modelUrl, i, void 0, function(r) {\n            window.__wsbAlt ? (new a.T.GLTFLoader).load(window.__wsbAlt(e.modelUrl, 2), i, void 0, t) : t(r)\n          })")
rep("""    function Se(e) {
      return we(i.libs.gltf)""", """    function Se(e) {
      var szS = (e.modelScale || 1) * (d.size && e.geometry ? $(e, d.size).height / e.geometry.height : 1);
      return we(i.libs.gltf)""")
rep("""        var l = p.capabilities.isWebGL2,
          s = e.modelScale || 1;""", """        v.children.slice().forEach(function(x) {
          "seam" === x.name && (v.remove(x), x.geometry && x.geometry.dispose())
        });
        var l = p.capabilities.isWebGL2,
          s = szS;""")
rep("""            k[t] = {
              id: t,
              group: d[i],
              uc: a.uc,
              vc: a.vc,
              cmU: a.cmU,
              cmV: a.cmV
            }""", """            k[t] = {
              id: t,
              group: d[i],
              uc: a.uc,
              vc: a.vc,
              cmU: a.cmU * s,
              cmV: a.cmV * s
            }, a.w && (e.surfaces[t].w = a.w * s, e.surfaces[t].h = a.h * s), a.view && (A[t] = {
              az: a.view.az,
              el: a.view.el,
              zoom: a.view.zoom,
              tx: a.view.tx * s,
              ty: a.view.ty * s,
              tz: a.view.tz * s
            })""")

# 4) свет: мягкая подсветка сзади-снизу, чтобы спина не проваливалась в тень на любом ракурсе
rep("""      s.position.set(0, 80, -140), y.add(s), y.add(s.target),""",
    """      s.position.set(0, 80, -140), y.add(s), y.add(s.target), function() {
        var f2 = new e.DirectionalLight(16777215, .18);
        f2.position.set(60, -30, -120), y.add(f2), y.add(f2.target)
      }(),""")

open('/home/claude/wsb/wsb-builder-v6.pretty.js', 'w', encoding='utf-8').write(src)
print('ok', len(src))
