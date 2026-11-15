// wear / your way — 3D-конструктор для Tilda
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

const SCRIPT_BASE = (() => {
  try { return new URL('.', document.currentScript.src).href; } catch { return './'; }
})();

// запасной адрес: если jsDelivr не отдал файл, берём его напрямую с GitHub
function altUrl(u) {
  const m = u.match(/^https:\/\/cdn\.jsdelivr\.net\/gh\/([^/]+)\/([^@/]+)@([^/]+)\/(.*)$/);
  return m ? `https://raw.githubusercontent.com/${m[1]}/${m[2]}/${m[3]}/${m[4]}` : null;
}

/* ---------- одежда и цвета ---------- */
const MODEL_HEIGHT = 1.5;
const GARMENTS = {
  tshirt: { name: 'Футболка', file: 'tshirt.glb', realHeightCm: 64,
    colors: [
      { id: 'black', name: 'Чёрный',       photo: '#353535', base: '#2A2A2A' },
      { id: 'white', name: 'Белый',        photo: '#ECECEC', base: '#C3C3C3' },
      { id: 'grey',  name: 'Серый меланж', photo: '#E4E1D9', base: '#B2B0AA' },
      { id: 'brown', name: 'Коричневый',   photo: '#54372F', base: '#412B26' },
    ] },
  longsleeve: { name: 'Лонгслив', file: 'longsleeve.glb', realHeightCm: 73,
    colors: [
      { id: 'white', name: 'Белый',      photo: '#F9F8FC', base: '#FFFEFF' },
      { id: 'black', name: 'Чёрный',     photo: '#101116', base: '#030408' },
      { id: 'brown', name: 'Коричневый', photo: '#3F3229', base: '#342A24' },
      { id: 'grey',  name: 'Графитовый', photo: '#3F424B', base: '#35373E' },
    ] },
};

/* ---------- демо-наклейки (если каталог в настройках пуст) ---------- */
function makeSticker(draw) {
  const c = document.createElement('canvas'); c.width = c.height = 512;
  const g = c.getContext('2d'); g.lineJoin = 'round'; g.lineCap = 'round'; draw(g); return c.toDataURL('image/png');
}
function star(g, cx, cy, r1, r2, n) { g.beginPath(); for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = Math.PI / n * i - Math.PI / 2; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); }
function demoStickers() {
  return [
    { name: 'Звезда', src: makeSticker(g => { star(g, 256, 262, 220, 95, 5); g.fillStyle = '#FFD447'; g.fill(); g.lineWidth = 22; g.strokeStyle = '#3F1521'; g.stroke(); }) },
    { name: 'Сердце', src: makeSticker(g => { g.beginPath(); g.moveTo(256, 450); g.bezierCurveTo(40, 300, 40, 90, 180, 90); g.bezierCurveTo(230, 90, 256, 130, 256, 160); g.bezierCurveTo(256, 130, 282, 90, 332, 90); g.bezierCurveTo(472, 90, 472, 300, 256, 450); g.fillStyle = '#E0473C'; g.fill(); g.lineWidth = 20; g.strokeStyle = '#3F1521'; g.stroke(); }) },
    { name: 'Смайл', src: makeSticker(g => { g.beginPath(); g.arc(256, 256, 215, 0, 7); g.fillStyle = '#9DB3D3'; g.fill(); g.lineWidth = 20; g.strokeStyle = '#3F1521'; g.stroke(); g.fillStyle = '#3F1521'; g.beginPath(); g.ellipse(185, 210, 24, 38, 0, 0, 7); g.fill(); g.beginPath(); g.ellipse(327, 210, 24, 38, 0, 0, 7); g.fill(); g.lineWidth = 22; g.beginPath(); g.arc(256, 280, 110, .2 * Math.PI, .8 * Math.PI); g.stroke(); }) },
    { name: 'Молния', src: makeSticker(g => { g.beginPath(); [[300, 30], [120, 290], [240, 290], [200, 482], [392, 212], [270, 212], [330, 30]].forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.closePath(); g.fillStyle = '#FFD447'; g.fill(); g.lineWidth = 18; g.strokeStyle = '#3F1521'; g.stroke(); }) },
  ];
}

/* ---------- стили ---------- */
const CSS = `
#wyw-constructor{--blue:#9DB3D3;--blue-soft:#E8EEF7;--wine:#3F1521;--wine-70:rgba(63,21,33,.7);--wine-15:rgba(63,21,33,.15);--wine-08:rgba(63,21,33,.08);color:var(--wine);font-family:inherit;padding:0 20px;box-sizing:border-box}
#wyw-constructor *{box-sizing:border-box;font-family:inherit}
#wyw-constructor .wyw-app{max-width:1180px;margin:0 auto;background:#fff;border-radius:28px;display:grid;grid-template-columns:minmax(0,1.35fr) minmax(300px,1fr);overflow:hidden;box-shadow:0 20px 60px rgba(63,21,33,.12)}
#wyw-constructor .wyw-stage{position:relative;background:radial-gradient(120% 90% at 50% 35%,#fff 0%,var(--blue-soft) 70%);min-height:560px}
#wyw-constructor canvas{position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:none;cursor:grab}
#wyw-constructor canvas.armed{cursor:crosshair}
#wyw-constructor canvas.dragging{cursor:grabbing}
#wyw-constructor .wyw-hint{position:absolute;left:50%;bottom:16px;transform:translateX(-50%);background:rgba(255,255,255,.92);padding:9px 14px;border-radius:999px;font-size:13px;font-weight:600;box-shadow:0 4px 16px rgba(63,21,33,.1);white-space:nowrap;pointer-events:none;max-width:calc(100% - 24px);overflow:hidden;text-overflow:ellipsis}
#wyw-constructor .wyw-hint.on{background:var(--wine);color:#fff}
#wyw-constructor .wyw-views{position:absolute;top:14px;left:14px;display:flex;gap:6px}
#wyw-constructor .wyw-views button{border:0;background:rgba(255,255,255,.9);color:var(--wine);font-weight:600;font-size:12px;padding:7px 11px;border-radius:999px;cursor:pointer}
#wyw-constructor .wyw-loading{position:absolute;inset:0;display:grid;place-items:center;font-weight:600;font-size:14px}
#wyw-constructor .wyw-panel{padding:22px 22px 24px;display:flex;flex-direction:column;gap:18px;border-left:1px solid var(--wine-08);max-height:760px;overflow:auto}
#wyw-constructor h3{margin:0 0 10px;font-weight:600;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:var(--wine-70);display:flex;gap:8px;align-items:center}
#wyw-constructor h3 b{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:var(--blue);color:var(--wine);font-size:11px}
#wyw-constructor .wyw-seg{display:grid;grid-template-columns:1fr 1fr;background:var(--blue-soft);border-radius:14px;padding:4px;gap:4px}
#wyw-constructor .wyw-seg button{border:0;background:transparent;font-weight:600;font-size:14px;color:var(--wine);padding:10px;border-radius:10px;cursor:pointer}
#wyw-constructor .wyw-seg button.on{background:#fff;box-shadow:0 2px 8px rgba(63,21,33,.12)}
#wyw-constructor .wyw-swatches{display:flex;gap:10px;flex-wrap:wrap}
#wyw-constructor .wyw-sw{width:40px;height:40px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 0 1px var(--wine-15);cursor:pointer;padding:0}
#wyw-constructor .wyw-sw.on{box-shadow:0 0 0 2px var(--wine)}
#wyw-constructor .wyw-swname{font-size:13px;margin-top:8px;color:var(--wine-70)}
#wyw-constructor .wyw-cats{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
#wyw-constructor .wyw-cats button{border:0;background:var(--blue-soft);color:var(--wine);font-weight:600;font-size:12px;padding:7px 11px;border-radius:999px;cursor:pointer}
#wyw-constructor .wyw-cats button.on{background:var(--wine);color:#fff}
#wyw-constructor .wyw-stickers{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
#wyw-constructor .wyw-st{aspect-ratio:1;border-radius:14px;border:1.5px solid var(--wine-08);background:#fafbfd;cursor:pointer;padding:8px;display:grid;place-items:center;transition:transform .15s}
#wyw-constructor .wyw-st:hover{transform:translateY(-2px)}
#wyw-constructor .wyw-st.on{border-color:var(--wine);background:var(--blue-soft)}
#wyw-constructor .wyw-st img{max-width:100%;max-height:100%}
#wyw-constructor .wyw-ctrl{background:var(--blue-soft);border-radius:16px;padding:14px;display:flex;flex-direction:column;gap:12px}
#wyw-constructor .wyw-ctrl.off{opacity:.45;pointer-events:none}
#wyw-constructor .wyw-row{display:flex;justify-content:space-between;font-size:13px;font-weight:600}
#wyw-constructor input[type=range]{width:100%;accent-color:var(--wine)}
#wyw-constructor .wyw-btns{display:flex;gap:8px;flex-wrap:wrap}
#wyw-constructor .wyw-btn{border:0;border-radius:12px;padding:11px 14px;font-weight:600;font-size:14px;cursor:pointer;text-decoration:none;display:inline-block}
#wyw-constructor .wyw-btn.ghost{background:#fff;color:var(--wine);box-shadow:inset 0 0 0 1.5px var(--wine-15)}
#wyw-constructor .wyw-btn.main{background:var(--wine);color:#fff;width:100%;padding:15px;font-size:15px}
#wyw-constructor .wyw-list{font-size:13px;color:var(--wine-70);line-height:1.5;margin-top:10px}
#wyw-constructor .wyw-modal{position:fixed;inset:0;background:rgba(63,21,33,.45);display:none;place-items:center;padding:20px;z-index:999999}
#wyw-constructor .wyw-modal.open{display:grid}
#wyw-constructor .wyw-card{background:#fff;border-radius:24px;max-width:720px;width:100%;padding:22px;max-height:92vh;overflow:auto}
#wyw-constructor .wyw-card h2{font-size:20px;margin:0 0 4px;font-weight:700}
#wyw-constructor .wyw-snaps{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:14px 0}
#wyw-constructor .wyw-snaps figure{margin:0;background:var(--blue-soft);border-radius:16px;overflow:hidden}
#wyw-constructor .wyw-snaps img{width:100%;display:block}
#wyw-constructor .wyw-snaps figcaption{font-size:12px;font-weight:600;padding:8px 12px}
#wyw-constructor pre{white-space:pre-wrap;background:#fafbfd;border:1px solid var(--wine-08);border-radius:12px;padding:12px;font-size:13px;line-height:1.5;margin:0 0 12px}
#wyw-constructor .wyw-note{font-size:13px;color:var(--wine-70);margin-top:6px;line-height:1.45}
@media (max-width:860px){
  #wyw-constructor{padding:0 12px}
  #wyw-constructor .wyw-app{grid-template-columns:1fr}
  #wyw-constructor .wyw-stage{min-height:420px}
  #wyw-constructor .wyw-panel{border-left:0;border-top:1px solid var(--wine-08);max-height:none}
}`;

const HTML = `
<div class="wyw-app">
  <div class="wyw-stage">
    <canvas></canvas>
    <div class="wyw-views">
      <button data-view="front">Перед</button><button data-view="back">Спина</button><button data-view="side">Бок</button>
    </div>
    <div class="wyw-loading">Загружаю модель…</div>
    <div class="wyw-hint">Крути вещь мышкой или пальцем</div>
  </div>
  <div class="wyw-panel">
    <div><h3><b>1</b>Вещь</h3>
      <div class="wyw-seg" data-r="garments"><button data-g="tshirt" class="on">Футболка</button><button data-g="longsleeve">Лонгслив</button></div></div>
    <div><h3><b>2</b>Цвет</h3><div class="wyw-swatches" data-r="swatches"></div><div class="wyw-swname" data-r="swname"></div></div>
    <div><h3><b>3</b>Размер</h3><div class="wyw-cats" data-r="sizes" style="margin:0"></div></div>
    <div><h3><b>4</b>Наклейки</h3><div class="wyw-cats" data-r="cats"></div><div class="wyw-stickers" data-r="stickers"></div></div>
    <div><h3><b>5</b>Выбранная наклейка</h3>
      <div class="wyw-ctrl off" data-r="ctrl">
        <div data-r="sizeBox"><div class="wyw-row"><span>Размер</span><span data-r="sizeVal">12 см</span></div>
          <input type="range" data-r="size" min="4" max="30" step="0.5" value="12"></div>
        <div><div class="wyw-row"><span>Поворот</span><span data-r="rotVal">0°</span></div>
          <input type="range" data-r="rot" min="-180" max="180" step="1" value="0"></div>
        <div class="wyw-btns"><button class="wyw-btn ghost" data-r="del">Удалить</button><button class="wyw-btn ghost" data-r="desel">Готово</button></div>
      </div>
      <div class="wyw-list" data-r="list"></div></div>
    <button class="wyw-btn main" data-r="done">Отправить на сборку</button>
  </div>
</div>
<div class="wyw-modal" data-r="modal">
  <div class="wyw-card">
    <h2>Твой дизайн готов</h2>
    <div class="wyw-note">1. Скачай обе картинки. 2. Скопируй текст заказа. 3. Отправь всё нам в Telegram — мы покажем превью и пришлём ссылку на оплату.</div>
    <div class="wyw-snaps" data-r="snaps"></div>
    <pre data-r="orderText"></pre>
    <div class="wyw-btns">
      <a class="wyw-btn ghost" data-r="dlFront" download="design-front.png">Скачать перед</a>
      <a class="wyw-btn ghost" data-r="dlBack" download="design-back.png">Скачать спину</a>
      <button class="wyw-btn ghost" data-r="copy">Скопировать текст</button>
      <a class="wyw-btn ghost" data-r="tg" target="_blank" rel="noopener" style="background:var(--wine);color:#fff;box-shadow:none">Открыть Telegram</a>
      <button class="wyw-btn ghost" data-r="close">Закрыть</button>
    </div>
  </div>
</div>`;

/* ---------- запуск ---------- */
function init(root) {
  const cfg = window.WYW_CONFIG || {};
  const base = cfg.base || SCRIPT_BASE;
  const style = document.createElement('style'); style.textContent = CSS; document.head.appendChild(style);
  root.innerHTML = HTML;
  const $ = r => root.querySelector(`[data-r="${r}"]`);
  const canvas = root.querySelector('canvas');

  const STICKERS = (cfg.stickers && cfg.stickers.length)
    ? cfg.stickers.map(s => ({ name: s.name, src: /^(https?:|data:)/.test(s.file) ? s.file : base + s.file, widthCm: s.widthCm, cat: s.size || '' }))
    : demoStickers();
  const cats = [...new Set(STICKERS.map(s => s.cat).filter(Boolean))];
  let catFilter = cats[0] || '';

  /* сцена */
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  const key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(2, 3, 4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 0.5); rim.position.set(-3, 1, -4); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 0.05, 4.3);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.enablePan = false; controls.enableZoom = true;
  controls.minDistance = 2.4; controls.maxDistance = 6.5;
  controls.minPolarAngle = 0.35; controls.maxPolarAngle = Math.PI - 0.35;

  function resize() {
    const r = canvas.parentElement.getBoundingClientRect();
    if (!r.width || !r.height) return;
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(canvas.parentElement);

  /* состояние */
  const loader = new GLTFLoader();
  const garmentMat = new THREE.MeshStandardMaterial({ color: '#2A2A2A', roughness: 0.92, metalness: 0, side: THREE.DoubleSide });
  const models = {};
  let current = 'tshirt', colorId = 'black', garment = null, selected = null, armed = null, sizeId = '';
  const SIZES = Object.assign({ tshirt: ['S', 'M', 'L', 'XL'], longsleeve: ['S', 'M', 'L', 'XL'] }, cfg.sizes || {});
  const decals = [];
  const textures = new Map();
  const colorsOf = () => GARMENTS[current].colors;
  const curColor = () => colorsOf().find(c => c.id === colorId) || colorsOf()[0];

  async function loadGarment(id) {
    if (models[id]) return models[id];
    const url = base + GARMENTS[id].file;
    let gltf;
    try { gltf = await loader.loadAsync(url); }
    catch (e) { const alt = altUrl(url); if (!alt) throw e; gltf = await loader.loadAsync(alt); }
    let mesh = null; gltf.scene.updateMatrixWorld(true);
    gltf.scene.traverse(o => { if (o.isMesh && !mesh) mesh = o; });
    const geo = mesh.geometry.clone(); geo.applyMatrix4(mesh.matrixWorld);
    geo.computeBoundingBox();
    const size = new THREE.Vector3(), ctr = new THREE.Vector3();
    geo.boundingBox.getSize(size); geo.boundingBox.getCenter(ctr);
    const s = MODEL_HEIGHT / size.y;
    geo.translate(-ctr.x, -ctr.y, -ctr.z); geo.scale(s, s, s);
    geo.computeVertexNormals(); geo.computeBoundingBox();
    const m = new THREE.Mesh(geo, garmentMat);
    m.userData.cmPerUnit = GARMENTS[id].realHeightCm / MODEL_HEIGHT;
    m.userData.halfWidth = (geo.boundingBox.max.x - geo.boundingBox.min.x) / 2;
    models[id] = m; return m;
  }

  function getTexture(st) {
    if (textures.has(st.src)) return Promise.resolve(textures.get(st.src));
    return new Promise((res, rej) => {
      const tl = new THREE.TextureLoader(); tl.setCrossOrigin('anonymous');
      const ok = t => {
        t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        const out = { tex: t, aspect: t.image.height / t.image.width }; textures.set(st.src, out); res(out);
      };
      tl.load(st.src, ok, undefined, e => { const alt = altUrl(st.src); alt ? tl.load(alt, ok, undefined, rej) : rej(e); });
    });
  }

  const helper = new THREE.Object3D();
  function decalGeometry(d) {
    helper.position.copy(d.pos);
    helper.lookAt(d.pos.clone().add(d.normal));
    helper.rotateZ(THREE.MathUtils.degToRad(d.rotDeg));
    const w = d.sizeCm / garment.userData.cmPerUnit;
    return new DecalGeometry(garment, d.pos, helper.rotation.clone(), new THREE.Vector3(w, w * d.aspect, Math.max(0.12, w * 0.6)));
  }
  function buildDecal(d) {
    if (d.mesh) { d.mesh.geometry.dispose(); d.mesh.geometry = decalGeometry(d); return; }
    const mat = new THREE.MeshStandardMaterial({ map: d.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, roughness: 0.75, metalness: 0 });
    d.mesh = new THREE.Mesh(decalGeometry(d), mat);
    d.mesh.renderOrder = decals.indexOf(d) + 1; d.mesh.userData.decal = d;
    scene.add(d.mesh);
  }
  function placeLabel(d) {
    const p = d.pos;
    if (Math.abs(p.x) > garment.userData.halfWidth * 0.62) return p.x < 0 ? 'правый рукав' : 'левый рукав';
    return p.z >= 0 ? 'перед' : 'спина';
  }

  /* ввод */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function hit(e, targets) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(targets, false)[0];
  }
  const worldNormal = h => h.face.normal.clone().transformDirection(h.object.matrixWorld).normalize();

  let down = null, drag = null, pending = false, lastMove = null;
  canvas.addEventListener('pointerdown', e => {
    down = { x: e.clientX, y: e.clientY };
    const dh = decals.length && hit(e, decals.map(d => d.mesh));
    if (dh && !armed) {
      select(dh.object.userData.decal);
      drag = selected; controls.enabled = false; canvas.classList.add('dragging');
      canvas.setPointerCapture(e.pointerId);
    }
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    lastMove = e; if (pending) return; pending = true;
    requestAnimationFrame(() => {
      pending = false;
      const h = hit(lastMove, [garment]); if (!h) return;
      drag.pos.copy(h.point); drag.normal.copy(worldNormal(h)); buildDecal(drag); renderList();
    });
  });
  canvas.addEventListener('pointerup', async e => {
    const moved = down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6;
    if (drag) { drag = null; controls.enabled = true; canvas.classList.remove('dragging'); down = null; return; }
    if (!moved && down) {
      const h = garment && hit(e, [garment]);
      if (h && armed) {
        const st = armed;
        try {
          const { tex, aspect } = await getTexture(st);
          const d = { sticker: st, pos: h.point.clone(), normal: worldNormal(h), sizeCm: st.widthCm || 12, rotDeg: 0, tex, aspect };
          decals.push(d); buildDecal(d); disarm(); select(d);
        } catch (err) { hint('Не удалось загрузить картинку наклейки', true); console.error(err); }
      } else if (!h) select(null);
    }
    down = null;
  });

  /* панель */
  const hintEl = root.querySelector('.wyw-hint');
  function hint(t, on) { hintEl.textContent = t; hintEl.classList.toggle('on', !!on); }
  function defaultHint() { hint(decals.length ? 'Тяни наклейку, чтобы сдвинуть' : 'Выбери наклейку и нажми на вещь'); }

  function renderCats() {
    const box = $('cats'); box.innerHTML = '';
    box.style.display = cats.length > 1 ? 'flex' : 'none';
    cats.forEach(c => {
      const b = document.createElement('button'); b.textContent = c; b.className = c === catFilter ? 'on' : '';
      b.onclick = () => { catFilter = c; renderCats(); renderStickers(); }; box.appendChild(b);
    });
  }
  function renderStickers() {
    const box = $('stickers'); box.innerHTML = '';
    STICKERS.filter(s => !catFilter || s.cat === catFilter).forEach(st => {
      const b = document.createElement('button'); b.className = 'wyw-st' + (armed === st ? ' on' : '');
      b.title = st.name + (st.widthCm ? ` · ${st.widthCm} см` : '');
      const img = document.createElement('img'); img.alt = st.name; img.src = st.src; img.loading = 'lazy'; b.appendChild(img);
      b.onclick = () => { armed === st ? disarm() : arm(st); };
      box.appendChild(b);
    });
  }
  function arm(st) { armed = st; select(null); canvas.classList.add('armed'); renderStickers(); hint(`Нажми на вещь, куда поставить «${st.name}»`, true); }
  function disarm() { armed = null; canvas.classList.remove('armed'); renderStickers(); defaultHint(); }

  function syncVals() { $('sizeVal').textContent = `${(+$('size').value).toFixed(1).replace('.0', '')} см`; $('rotVal').textContent = `${$('rot').value}°`; }
  function select(d) {
    if (selected && selected.mesh) selected.mesh.material.emissive.setHex(0);
    selected = d;
    $('ctrl').classList.toggle('off', !d);
    if (d) {
      d.mesh.material.emissive.setHex(0x222222);
      $('size').value = d.sizeCm; $('rot').value = d.rotDeg; syncVals();
      $('sizeBox').style.display = d.sticker.widthCm ? 'none' : '';
    }
    renderList();
  }
  $('size').oninput = () => { if (!selected) return; selected.sizeCm = +$('size').value; syncVals(); buildDecal(selected); renderList(); };
  $('rot').oninput = () => { if (!selected) return; selected.rotDeg = +$('rot').value; syncVals(); buildDecal(selected); };
  $('del').onclick = () => {
    if (!selected) return;
    scene.remove(selected.mesh); selected.mesh.geometry.dispose(); selected.mesh.material.dispose();
    decals.splice(decals.indexOf(selected), 1); selected = null; select(null); defaultHint();
  };
  $('desel').onclick = () => select(null);
  function renderList() {
    const l = $('list');
    if (!decals.length) { l.textContent = 'Пока нет наклеек.'; return; }
    l.innerHTML = decals.map((d, i) => `${i + 1}. ${d.sticker.name} — ${d.sizeCm} см, ${placeLabel(d)}${d === selected ? ' ←' : ''}`).join('<br>');
  }

  function renderSizes() {
    const box = $('sizes'); box.innerHTML = '';
    if (!SIZES[current].includes(sizeId)) sizeId = '';
    SIZES[current].forEach(z => {
      const b = document.createElement('button'); b.textContent = z; b.className = z === sizeId ? 'on' : '';
      b.onclick = () => { sizeId = z; renderSizes(); }; box.appendChild(b);
    });
  }
  function applyColor() { garmentMat.color.set(curColor().base); }
  function renderSwatches() {
    const box = $('swatches'); box.innerHTML = '';
    colorsOf().forEach(c => {
      const b = document.createElement('button'); b.className = 'wyw-sw' + (c.id === colorId ? ' on' : '');
      b.style.background = c.photo; b.title = c.name;
      b.onclick = () => { colorId = c.id; applyColor(); renderSwatches(); };
      box.appendChild(b);
    });
    $('swname').textContent = curColor().name;
  }

  root.querySelectorAll('[data-r="garments"] button').forEach(b => b.onclick = () => switchGarment(b.dataset.g));
  async function switchGarment(id) {
    if (id === current && garment) return;
    root.querySelectorAll('[data-r="garments"] button').forEach(x => x.classList.toggle('on', x.dataset.g === id));
    root.querySelector('.wyw-loading').style.display = 'grid';
    const m = await loadGarment(id);
    root.querySelector('.wyw-loading').style.display = 'none';
    if (garment) scene.remove(garment);
    garment = m; current = id; scene.add(m);
    if (!colorsOf().some(c => c.id === colorId)) colorId = colorsOf()[0].id;
    applyColor(); renderSwatches(); renderSizes();
    const keep = [];
    for (const d of decals) {
      ray.set(d.pos.clone().addScaledVector(d.normal, 1.5), d.normal.clone().negate());
      const h = ray.intersectObject(garment, false)[0];
      if (h) { d.pos.copy(h.point); d.normal.copy(worldNormal(h)); buildDecal(d); keep.push(d); }
      else scene.remove(d.mesh);
    }
    decals.length = 0; decals.push(...keep);
    select(null); defaultHint();
  }

  /* камера */
  const VIEWS = { front: new THREE.Vector3(0, 0.05, 4.3), back: new THREE.Vector3(0, 0.05, -4.3), side: new THREE.Vector3(4.3, 0.05, 0) };
  let tween = null;
  function goView(v, instant) {
    const to = VIEWS[v].clone();
    if (instant) { camera.position.copy(to); controls.update(); return; }
    tween = { from: camera.position.clone(), to, t: 0 };
  }
  root.querySelectorAll('.wyw-views button').forEach(b => b.onclick = () => goView(b.dataset.view));

  /* заявка */
  function snap(view) {
    const prev = camera.position.clone(), sel = selected;
    if (sel) sel.mesh.material.emissive.setHex(0);
    goView(view, true); renderer.render(scene, camera);
    const url = canvas.toDataURL('image/png');
    camera.position.copy(prev); controls.update();
    if (sel) sel.mesh.material.emissive.setHex(0x222222);
    return url;
  }
  $('done').onclick = () => {
    if (!decals.length) { hint('Сначала добавь хотя бы одну наклейку', true); return; }
    if (!sizeId) { hint('Выбери размер вещи', true); $('sizes').scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    const f = snap('front'), b = snap('back');
    $('snaps').innerHTML = `<figure><img src="${f}" alt="Перед"><figcaption>Перед</figcaption></figure><figure><img src="${b}" alt="Спина"><figcaption>Спина</figcaption></figure>`;
    $('dlFront').href = f; $('dlBack').href = b;
    const lines = decals.map((d, i) => `${i + 1}. ${d.sticker.name} — ${d.sizeCm} см, ${placeLabel(d)}`);
    $('orderText').textContent = `Заказ wear / your way\nВещь: ${GARMENTS[current].name}, ${curColor().name.toLowerCase()}\nРазмер: ${sizeId}\nНаклейки (${decals.length}):\n${lines.join('\n')}`;
    const tg = (cfg.telegram || '').replace(/^@/, '');
    $('tg').href = tg ? `https://t.me/${tg}` : '#'; $('tg').style.display = tg ? '' : 'none';
    $('modal').classList.add('open');
  };
  $('close').onclick = () => $('modal').classList.remove('open');
  $('modal').onclick = e => { if (e.target === $('modal')) $('modal').classList.remove('open'); };
  $('copy').onclick = async () => {
    const txt = $('orderText').textContent;
    try { await navigator.clipboard.writeText(txt); $('copy').textContent = 'Скопировано'; }
    catch { const r = document.createRange(); r.selectNodeContents($('orderText')); const s = getSelection(); s.removeAllRanges(); s.addRange(r); $('copy').textContent = 'Выделено — нажми «Копировать»'; }
    setTimeout(() => $('copy').textContent = 'Скопировать текст', 2000);
  };

  /* цикл: рисуем только когда блок виден */
  let visible = true;
  new IntersectionObserver(es => { visible = es[0].isIntersecting; }).observe(canvas);
  function loop() {
    requestAnimationFrame(loop);
    if (!visible) return;
    if (tween) {
      tween.t = Math.min(1, tween.t + 0.06);
      const k = 1 - Math.pow(1 - tween.t, 3);
      const a = new THREE.Spherical().setFromVector3(tween.from), b = new THREE.Spherical().setFromVector3(tween.to);
      let dth = b.theta - a.theta; if (dth > Math.PI) dth -= 2 * Math.PI; if (dth < -Math.PI) dth += 2 * Math.PI;
      camera.position.setFromSpherical(new THREE.Spherical(a.radius + (b.radius - a.radius) * k, a.phi + (b.phi - a.phi) * k, a.theta + dth * k));
      if (tween.t >= 1) tween = null;
    }
    controls.update(); renderer.render(scene, camera);
  }

  renderCats(); renderStickers(); renderSwatches(); renderList(); resize();
  switchGarment('tshirt').then(() => { defaultHint(); root.dataset.ready = '1'; })
    .catch(err => { root.querySelector('.wyw-loading').textContent = 'Не удалось загрузить модель — проверь адрес в настройках'; console.error(err); });
  loop();
}

function boot() {
  const root = document.getElementById('wyw-constructor');
  if (root && !root.dataset.inited) { root.dataset.inited = '1'; init(root); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
