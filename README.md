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
