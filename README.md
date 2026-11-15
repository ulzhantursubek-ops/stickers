# wear / your way — 3D-конструктор

Ветка только с файлами 3D-конструктора (каталог наклеек — в ветке `main`).

- `3d/wyw-constructor.js` — собранный скрипт (three.js внутри)
- `3d/tshirt.glb`, `3d/longsleeve.glb` — модели вещей
- `3d/src/main.js` — исходник; сборка: `esbuild 3d/src/main.js --bundle --minify --format=iife --outfile=3d/wyw-constructor.js`

Подключение в Tilda (блок T123):
```html
<div id="wyw-constructor"></div>
<script>window.WYW_CONFIG = { telegram: "ник", base: "https://cdn.jsdelivr.net/gh/ulzhantursubek-ops/stickers@constructor-3d/3d/", stickers: [] };</script>
<script src="https://cdn.jsdelivr.net/gh/ulzhantursubek-ops/stickers@constructor-3d/3d/wyw-constructor.js" defer></script>
```

## wsb/ — твой конструктор (wsb-builder) с 3D-моделями
- `wsb/wsb-builder-v6.js` — wsb-builder-v5 + модели Meshy, цвета по изделиям, масштаб под размер
- `wsb/tee-wsb.glb`, `wsb/longsleeve-wsb.glb` — модели с мешами torso / sleeveL / sleeveR и развёрткой в см
- `wsb/prep_glb.py`, `wsb/patch.py` — как это собрано
