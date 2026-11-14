// =============================================================================
// Карта: .env (MAP_IMAGE_PATH, MAP_WIDTH/HEIGHT, старт START_*).
// Маршрут: старт → сразу развилка 1а/1б → ветки ROUTE_BRANCH_* (пиксели map4.png).
// =============================================================================

/** @typedef {{ x: number, y: number, id: string, task: boolean }} RouteWaypoint */

/** Только старт; дальше — выбор ветки 1а или 1б */
function buildCommonRoute(env) {
  return [{ x: env.startX, y: env.startY, id: 'start', task: false }];
}

const ROUTE_FORK = {
  a: { x: 981, y: 566, id: '1a' },
  b: { x: 934, y: 1038, id: '1b' },
};

/** Ветка A: верхняя дорожка → общий финиш */
const ROUTE_BRANCH_A = [
  { x: 981, y: 566, id: '1a', task: true },
  { x: 1237, y: 678, id: '2a', task: true },
  { x: 1571, y: 755, id: '3a', task: true },
  { x: 1936, y: 812, id: '4a', task: true },
  { x: 2081, y: 811, id: 'finish', task: false },
];

/** Ветка B: нижняя дорожка → финиш */
const ROUTE_BRANCH_B = [
  { x: 934, y: 1038, id: '1b', task: true },
  { x: 1004, y: 1239, id: '2b', task: true },
  { x: 1602, y: 1398, id: '3b', task: true },
  { x: 1904, y: 1393, id: '4b', task: true },
  { x: 2134, y: 1298, id: '5b', task: true },
  { x: 2224, y: 1139, id: '6b', task: true },
  { x: 2081, y: 811, id: 'finish', task: false },
];

/** Промежуточные точки движения по карте (пиксели map4), когда нельзя идти по прямой */
const ROUTE_WALK_VIA = {
  'start|1b': [
    { x: 665, y: 752 },
    { x: 638, y: 835 },
    { x: 648, y: 920 },
    { x: 688, y: 998 },
    { x: 745, y: 1040 },
  ],
  /** Обход зубра между 2б и 3б — умеренная дуга (между прямой и широкой петлёй) */
  '2b|3b': [
    { x: 1120, y: 1240 },
    { x: 1240, y: 1255 },
    { x: 1360, y: 1275 },
    { x: 1480, y: 1305 },
    { x: 1565, y: 1355 },
  ],
};

/** Визуал маркера «следующий шаг» */
const NEXT_MARKER = {
  radiusMult: 1.58,
  hitRadiusMult: 3.4,
  pulseScaleMult: 1.14,
  pulseMs: 620,
};

const TOUCH_MARKER_HIT_MIN_PX = 44;

function prefersCoarsePointer() {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(hover: none)').matches;
}

const ORIENTATION_LOCK_EL_ID = 'lampik-orientation-lock';
let orientationGateBound = false;
let landscapeLockAttempted = false;

/** Смартфон (не планшет с мышью): короткая сторона экрана типична для телефона. */
function isPhoneLikeDevice() {
  if (!prefersCoarsePointer()) {
    return false;
  }
  const short = Math.min(window.innerWidth, window.innerHeight);
  const long = Math.max(window.innerWidth, window.innerHeight);
  return short <= 520 && long >= short * 1.12;
}

function isPortraitOrientation() {
  if (window.matchMedia) {
    if (window.matchMedia('(orientation: portrait)').matches) {
      return true;
    }
    if (window.matchMedia('(orientation: landscape)').matches) {
      return false;
    }
  }
  return window.innerHeight > window.innerWidth;
}

function shouldBlockPortraitPlay() {
  return isPhoneLikeDevice() && isPortraitOrientation();
}

async function tryLockScreenLandscape() {
  if (landscapeLockAttempted || !isPhoneLikeDevice()) {
    return;
  }
  landscapeLockAttempted = true;
  const orientation = screen.orientation;
  if (!orientation || typeof orientation.lock !== 'function') {
    return;
  }
  try {
    await orientation.lock('landscape');
  } catch {
    /* Safari / обычная вкладка — остаётся подсказка «поверни телефон» */
  }
}

function syncPortraitOrientationGate() {
  const block = shouldBlockPortraitPlay();
  document.body.classList.toggle('lampik-portrait-block', block);
  const overlay = document.getElementById(ORIENTATION_LOCK_EL_ID);
  if (overlay) {
    overlay.hidden = !block;
    overlay.setAttribute('aria-hidden', block ? 'false' : 'true');
  }
  if (game) {
    const scene = game.scene.getScene('MainScene');
    if (scene?.scene) {
      if (block && scene.scene.isActive() && !scene.scene.isPaused()) {
        scene.scene.pause();
      } else if (!block && scene.scene.isPaused()) {
        scene.scene.resume();
        if (game.scale) {
          game.scale.resize(window.innerWidth, window.innerHeight);
        }
      }
    }
  }
}

function bindPortraitOrientationGate() {
  if (orientationGateBound) {
    return;
  }
  orientationGateBound = true;
  syncPortraitOrientationGate();
  window.addEventListener('resize', syncPortraitOrientationGate);
  window.addEventListener('orientationchange', syncPortraitOrientationGate);
  screen.orientation?.addEventListener?.('change', syncPortraitOrientationGate);
  document.addEventListener(
    'pointerdown',
    () => {
      void tryLockScreenLandscape();
    },
    { capture: true, passive: true }
  );
}

function markerTouchHitRadius(visualRadius) {
  const scaled = Math.max(28, visualRadius * NEXT_MARKER.hitRadiusMult);
  return prefersCoarsePointer() ? Math.max(TOUCH_MARKER_HIT_MIN_PX, scaled) : scaled;
}

/** pointerdown + pointerup — на iOS иногда срабатывает только up */
function bindMarkerTap(marker, onTap) {
  if (!marker) {
    return;
  }
  let downFired = false;
  const run = () => {
    downFired = true;
    onTap();
  };
  marker.removeAllListeners('pointerdown');
  marker.removeAllListeners('pointerup');
  marker.on('pointerdown', run);
  marker.on('pointerup', () => {
    if (downFired) {
      downFired = false;
      return;
    }
    onTap();
  });
}

/**
 * @param {object} env
 * @param {'a' | 'b' | null} branch
 * @returns {RouteWaypoint[]}
 */
function buildFullRoute(env, branch) {
  const common = buildCommonRoute(env);
  if (!branch) {
    return common;
  }
  const tail = branch === 'a' ? ROUTE_BRANCH_A : ROUTE_BRANCH_B;
  return [...common, ...tail];
}

/** Индекс старта: на нём сразу показываем развилку 1а / 1б */
const ROUTE_FORK_FROM_INDEX = 0;

/**
 * Минимальная дистанция одного шага на экране (px).
 * Чем меньше — тем больше шагов между остановками (см. WALK_STEP_PX в .env).
 */
const WALK_DEFAULTS = {
  stepPx: 22,
  maxSteps: 36,
  minLegDuration: 0.18,
};

/**
 * Имитация шагов на одном PNG (ноги/руки — спрайт-лист в .env).
 * Движение по дорожке идёт порциями, синхронно с подъёмом/постановкой ноги.
 */
const WALK_PROCEDURAL = {
  bobY: 8,
  leanDeg: 4,
  squatScaleY: 0.96,
  strideScaleY: 1.03,
};

/** Прыжок по умолчанию (перекрывается JUMP_* в .env) */
/** Меняйте JUMP_* в .env; в консоли при старте будет jump tuning v5 */
const JUMP_TUNING_REV = 5;

const JUMP_DEFAULTS = {
  heightPx: 48,
  forwardPx: 28,
  leanDeg: 12,
  prepSquashY: 0.68,
  stretchY: 1.2,
  landSquashY: 0.78,
  reboundPx: 16,
  rebound2Px: 9,
  rebound3Px: 4,
  prep: 0.08,
  launch: 0.13,
  hang: 0.05,
  land: 0.11,
  rebound: 0.11,
  settle: 0.22,
  camShakeMs: 140,
  elasticEase: 'elastic.out(1.15, 0.42)',
  launchEase: 'back.out(2)',
};

function jumpConfig(env) {
  const num = (key, fallback) => {
    const v = Number(env?.[key]);
    return Number.isNaN(v) ? fallback : v;
  };
  return {
    heightPx: num('jumpHeightPx', JUMP_DEFAULTS.heightPx),
    forwardPx: num('jumpForwardPx', JUMP_DEFAULTS.forwardPx),
    leanDeg: num('jumpLeanDeg', JUMP_DEFAULTS.leanDeg),
    prepSquashY: num('jumpPrepSquashY', JUMP_DEFAULTS.prepSquashY),
    stretchY: num('jumpStretchY', JUMP_DEFAULTS.stretchY),
    landSquashY: num('jumpLandSquashY', JUMP_DEFAULTS.landSquashY),
    reboundPx: num('jumpReboundPx', JUMP_DEFAULTS.reboundPx),
    rebound2Px: num('jumpRebound2Px', JUMP_DEFAULTS.rebound2Px),
    rebound3Px: num('jumpRebound3Px', JUMP_DEFAULTS.rebound3Px),
    prep: num('jumpPrepDuration', JUMP_DEFAULTS.prep),
    launch: num('jumpLaunchDuration', JUMP_DEFAULTS.launch),
    hang: num('jumpHangDuration', JUMP_DEFAULTS.hang),
    land: num('jumpLandDuration', JUMP_DEFAULTS.land),
    rebound: num('jumpReboundDuration', JUMP_DEFAULTS.rebound),
    settle: num('jumpSettleDuration', JUMP_DEFAULTS.settle),
    camShakeMs: num('jumpCamShakeMs', JUMP_DEFAULTS.camShakeMs),
    elasticEase: env?.jumpElasticEase || JUMP_DEFAULTS.elasticEase,
    launchEase: env?.jumpLaunchEase || JUMP_DEFAULTS.launchEase,
  };
}

/** Маленькие отскоки на месте (без elastic по x/y — иначе «улетает»). */
function appendSpringBounces(tl, lampik, j, sx, sy) {
  const landScaleY = sy * j.landSquashY;
  const bounces = [
    { lift: j.reboundPx, squash: landScaleY * 0.99 },
    { lift: j.rebound2Px, squash: landScaleY * 0.995 },
    { lift: j.rebound3Px, squash: landScaleY * 1 },
  ];

  for (const b of bounces) {
    if (b.lift <= 0) {
      continue;
    }
    const half = j.rebound * 0.5;
    tl.to(lampik, {
      y: `-=${b.lift}`,
      scaleY: sy * 1.04,
      ease: 'sine.out',
      duration: half,
    }).to(lampik, {
      y: 0,
      scaleY: b.squash,
      scaleX: sx,
      ease: 'sine.in',
      duration: half,
    });
  }

  tl.to(lampik, {
    y: 0,
    x: 0,
    rotation: 0,
    scaleX: sx,
    scaleY: sy,
    ease: 'sine.inOut',
    duration: j.settle,
  });
}

/** PNG Лампика нарисован лицом влево; по дорожке чаще идём вправо/вниз */
function artFacesLeft(env) {
  return env?.lampikArtFacesLeft !== false;
}

function resolveFaceRight(dx, dy, env) {
  const threshold = 8;
  if (Math.abs(dx) >= threshold) {
    return dx > 0;
  }
  if (Math.abs(dy) >= threshold) {
    return env?.lampikDefaultFaceRight !== false;
  }
  return env?.lampikDefaultFaceRight !== false;
}

function scaleXForFaceRight(faceRight, magnitude, env) {
  const mag = Math.abs(magnitude) || 1;
  if (artFacesLeft(env)) {
    return faceRight ? -mag : mag;
  }
  return faceRight ? mag : -mag;
}

function forwardSignFromScaleX(scaleX, env) {
  if (artFacesLeft(env)) {
    return scaleX < 0 ? 1 : -1;
  }
  return scaleX > 0 ? 1 : -1;
}

/**
 * Включить спрайт-лист шагов (задаётся USE_WALK_SPRITESHEET=true в .env).
 * Когда появится атлас — prepareWalkVisuals / stopWalkVisuals.
 */
const WALK_SPRITE = {
  key: 'lampik_walk',
  animKey: 'lampik_walk_cycle',
};

// -----------------------------------------------------------------------------

const MAX_DPR = 2;

function getDevicePixelRatio() {
  return Math.min(window.devicePixelRatio || 1, MAX_DPR);
}

function setTextureSmoothFilter(scene, textureKey) {
  if (!scene.textures.exists(textureKey)) {
    return;
  }
  scene.textures.get(textureKey).setFilter(Phaser.Textures.FilterMode.LINEAR);
}

function setDisplayHeightPreserveAspect(sprite, targetHeight) {
  const w = sprite.width;
  const h = sprite.height;
  if (!w || !h) {
    return;
  }
  const targetWidth = Math.round(targetHeight * (w / h));
  sprite.setDisplaySize(targetWidth, targetHeight);
}

/**
 * Карта целиком в окне (contain): одинаковый scale по X/Y, поля по краям — без обрезки.
 * @returns {{ scale: number, offsetX: number, offsetY: number, displayW: number, displayH: number }}
 */
function computeMapLayout(mapSize, screenSize) {
  const scale = Math.min(screenSize.width / mapSize.width, screenSize.height / mapSize.height);
  if (!Number.isFinite(scale) || scale <= 0) {
    return {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
      displayW: screenSize.width,
      displayH: screenSize.height,
    };
  }
  const displayW = mapSize.width * scale;
  const displayH = mapSize.height * scale;
  return {
    scale,
    offsetX: (screenSize.width - displayW) * 0.5,
    offsetY: (screenSize.height - displayH) * 0.5,
    displayW,
    displayH,
  };
}

/** Размеры UI (маркеры, Лампик) в пикселях экрана при текущем scale карты. */
function mapLayoutUiPx(layout, designPx, minPx = 0) {
  const scaled = Math.round(designPx * layout.scale);
  return minPx > 0 ? Math.max(minPx, scaled) : scaled;
}

/** Узкий экран или сильно ужатая карта — маркеры и анимации следуют scale карты. */
const COMPACT_VIEWPORT_MAX_WIDTH = 768;
const COMPACT_MAP_SCALE_THRESHOLD = 0.58;
/** На телефоне карта по ширине ~0.15–0.2 — привязка роста Лампика к scale делала фигурку невидимой. */
const COMPACT_LAMPIK_MIN_HEIGHT = 34;

function isCompactMapViewport(layout, screenW) {
  return screenW < COMPACT_VIEWPORT_MAX_WIDTH || layout.scale < COMPACT_MAP_SCALE_THRESHOLD;
}

function resolveLampikDisplayHeight(layout, screenW, screenH, env) {
  const design = env.lampikDisplayHeight;
  const viewportCap = Math.round(screenH * 0.18);
  if (!isCompactMapViewport(layout, screenW)) {
    return Math.min(design, viewportCap);
  }
  const narrowEdge = Math.min(screenW, screenH);
  const phoneFloor = Math.min(
    design,
    Math.max(COMPACT_LAMPIK_MIN_HEIGHT, Math.round(narrowEdge * 0.086))
  );
  return Math.min(phoneFloor, viewportCap);
}

/** Масштаб анимаций (прыжок, покачивание): на десктопе — 1, на телефоне — как карта. */
function mapMotionUiScale(layout, screenW) {
  return isCompactMapViewport(layout, screenW) ? layout.scale : 1;
}

function mapPointToScreen(mapX, mapY, mapSize, screenSize) {
  const layout = computeMapLayout(mapSize, screenSize);
  return {
    x: layout.offsetX + mapX * layout.scale,
    y: layout.offsetY + mapY * layout.scale,
  };
}

/** Остановки маршрута в координатах экрана. */
function routeToScreen(route, env, screenW, screenH) {
  const mapSize = { width: env.mapWidth, height: env.mapHeight };
  const screenSize = { width: screenW, height: screenH };
  return route.map(({ x, y, id, task }) => ({
    x: mapPointToScreen(x, y, mapSize, screenSize).x,
    y: mapPointToScreen(x, y, mapSize, screenSize).y,
    id,
    task,
  }));
}

/**
 * @param {number} fromX
 * @param {number} fromY
 * @param {string | undefined} fromId
 * @param {string | undefined} toId
 * @param {number} toX
 * @param {number} toY
 * @param {object} env
 * @param {number} screenW
 * @param {number} screenH
 */
function buildWalkScreenPath(fromX, fromY, fromId, toId, toX, toY, env, screenW, screenH) {
  const key = fromId && toId ? `${fromId}|${toId}` : '';
  const vias = key ? ROUTE_WALK_VIA[key] : null;
  if (!vias?.length) {
    return [
      { x: fromX, y: fromY },
      { x: toX, y: toY },
    ];
  }
  const mapSize = { width: env.mapWidth, height: env.mapHeight };
  const screenSize = { width: screenW, height: screenH };
  const points = [{ x: fromX, y: fromY }];
  for (const p of vias) {
    const pt = mapPointToScreen(p.x, p.y, mapSize, screenSize);
    points.push({ x: pt.x, y: pt.y });
  }
  points.push({ x: toX, y: toY });
  return points;
}

function mapForkToScreen(env, screenW, screenH) {
  const mapSize = { width: env.mapWidth, height: env.mapHeight };
  const screenSize = { width: screenW, height: screenH };
  return {
    a: {
      ...mapPointToScreen(ROUTE_FORK.a.x, ROUTE_FORK.a.y, mapSize, screenSize),
      id: ROUTE_FORK.a.id,
    },
    b: {
      ...mapPointToScreen(ROUTE_FORK.b.x, ROUTE_FORK.b.y, mapSize, screenSize),
      id: ROUTE_FORK.b.id,
    },
  };
}

const LAMPIK_TEXTURE_KEY = 'lampik';
const LAMPIK_TRIM_FRAME = '__trim';

/** Пробелы и скобки в имени файла — для load.image / img.src */
function encodeAssetPath(path) {
  return path
    .split('/')
    .map((segment, index) => (index === 0 ? segment : encodeURIComponent(segment)))
    .join('/');
}

function isFileProtocol() {
  return typeof location !== 'undefined' && location.protocol === 'file:';
}

/**
 * file:// — Phaser Loader через XHR не грузит локальные PNG; заранее через Image().
 * @param {string} url
 * @returns {Promise<HTMLImageElement>}
 */
function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Не удалось загрузить: ${url}`));
    img.src = encodeAssetPath(url);
  });
}

/**
 * @param {object} env
 * @returns {Promise<void>}
 */
async function preloadFileProtocolTextures(env) {
  const mapPath = env.mapImagePath || 'assets/map4.png';
  const lampikPath =
    env.lampikImagePath || 'assets/_lampik-remove-background.com (1).png';
  const [mapImg, lampikImg] = await Promise.all([
    loadImageElement(mapPath),
    loadImageElement(lampikPath),
  ]);
  window.__LAMPIK_FILE_TEXTURES__ = {
    map: mapImg,
    [LAMPIK_TEXTURE_KEY]: lampikImg,
  };
}

function injectFileProtocolTextures(scene) {
  const pre = window.__LAMPIK_FILE_TEXTURES__;
  if (!pre) {
    return false;
  }
  if (pre.map && !scene.textures.exists('map')) {
    scene.textures.addImage('map', pre.map);
  }
  if (pre[LAMPIK_TEXTURE_KEY] && !scene.textures.exists(LAMPIK_TEXTURE_KEY)) {
    scene.textures.addImage(LAMPIK_TEXTURE_KEY, pre[LAMPIK_TEXTURE_KEY]);
  }
  return scene.textures.exists('map');
}

/** Обрезка пустых/чёрных полей (lampik2.png — персонаж в центре большого холста). */
function detectLampikContentBounds(scene, textureKey, assetRev = '') {
  const regKey = `${textureKey}_${assetRev}_trimBounds_v2`;
  if (scene.registry.has(regKey)) {
    return scene.registry.get(regKey);
  }

  const fullFrame = { x: 0, y: 0, width: 0, height: 0 };

  try {
    const frame = scene.textures.getFrame(textureKey);
    const img = frame.source?.image;
    if (!img || !img.width || !img.height) {
      return null;
    }

    const cutX = frame.cutX || 0;
    const cutY = frame.cutY || 0;
    const w = frame.cutWidth || frame.width;
    const h = frame.cutHeight || frame.height;
    fullFrame.width = w;
    fullFrame.height = h;

    const maxSide = 720;
    const downscale = Math.min(1, maxSide / Math.max(w, h));
    const sw = Math.max(1, Math.round(w * downscale));
    const sh = Math.max(1, Math.round(h * downscale));

    const canvas = document.createElement('canvas');
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, cutX, cutY, w, h, 0, 0, sw, sh);

    const { data } = ctx.getImageData(0, 0, sw, sh);
    let minX = sw;
    let minY = sh;
    let maxX = 0;
    let maxY = 0;

    for (let y = 0; y < sh; y += 1) {
      for (let x = 0; x < sw; x += 1) {
        const i = (y * sw + x) * 4;
        const a = data[i + 3];
        const lum = data[i] + data[i + 1] + data[i + 2];
        if (a > 16 && lum > 40) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (minX > maxX) {
      scene.registry.set(regKey, null);
      return null;
    }

    const pad = Math.max(2, Math.round(4 / downscale));
    const x = Math.max(0, Math.floor(minX / downscale) - pad);
    const y = Math.max(0, Math.floor(minY / downscale) - pad);
    const width = Math.max(8, Math.min(w - x, Math.ceil((maxX - minX + 1) / downscale) + pad * 2));
    const height = Math.max(8, Math.min(h - y, Math.ceil((maxY - minY + 1) / downscale) + pad * 2));

    const bounds = { x, y, width, height };
    scene.registry.set(regKey, bounds);
    return bounds;
  } catch (error) {
    console.warn('[lampik] trim bounds failed, using full texture', error);
    scene.registry.set(regKey, null);
    return null;
  }
}

function ensureLampikTrimFrame(scene, textureKey, crop) {
  const tex = scene.textures.get(textureKey);
  if (!tex.has(LAMPIK_TRIM_FRAME)) {
    tex.add(LAMPIK_TRIM_FRAME, 0, crop.x, crop.y, crop.width, crop.height);
  }
  return LAMPIK_TRIM_FRAME;
}

/** Один раз ужимаем исходный PNG до bake (логич. высота × DPR × superSample). При 1 — резче на экране */
function bakeCharacterTexture(scene, sourceKey, logicalHeight, superSample = 1, assetRev = '', crop = null) {
  const dpr = getDevicePixelRatio();
  setTextureSmoothFilter(scene, sourceKey);
  const frame = scene.textures.getFrame(sourceKey);
  const contentW = crop?.width ?? frame.width;
  const contentH = crop?.height ?? frame.height;
  const aspect = contentW / contentH;
  const targetBakeH = Math.round(logicalHeight * dpr * superSample);
  const bakeH = Math.min(contentH, Math.max(1, targetBakeH));
  const bakeW = Math.max(1, Math.round(bakeH * aspect));
  const rev = assetRev ? `${assetRev}_` : '';
  const cropTag = crop ? `c${crop.x}_${crop.y}_${contentW}x${contentH}` : 'full';
  const bakedKey = `${sourceKey}_${rev}${cropTag}_b3_ss${superSample}_${bakeW}x${bakeH}`;

  if (!scene.textures.exists(bakedKey)) {
    if (!scene.textures.exists(sourceKey)) {
      console.error(`[lampik] текстура "${sourceKey}" не загружена`);
      return {
        key: sourceKey,
        displayWidth: Math.max(1, Math.round(logicalHeight * aspect)),
        displayHeight: logicalHeight,
      };
    }

    const rt = scene.add.renderTexture(0, 0, bakeW, bakeH).setVisible(false);
    const stamp =
      crop && crop.width >= 8 && crop.height >= 8
        ? scene.add.image(
            bakeW * 0.5,
            bakeH * 0.5,
            sourceKey,
            ensureLampikTrimFrame(scene, sourceKey, crop)
          )
        : scene.add.image(bakeW * 0.5, bakeH * 0.5, sourceKey);
    stamp.setDisplaySize(bakeW, bakeH);
    rt.clear();
    rt.draw(stamp, bakeW * 0.5, bakeH * 0.5);
    stamp.destroy();
    rt.saveTexture(bakedKey);
    rt.destroy();
    setTextureSmoothFilter(scene, bakedKey);
  }

  return {
    key: bakedKey,
    displayWidth: Math.max(1, Math.round(logicalHeight * aspect)),
    displayHeight: logicalHeight,
  };
}

function assetPathRev(path) {
  return (path || 'default').replace(/[^\w.-]+/g, '_');
}

function resolveLampikDisplay(scene, logicalHeight, env) {
  const superSample = env?.lampikBakeSuperSample ?? 1;
  const assetRev = assetPathRev(env?.lampikImagePath);
  const trim = env?.lampikTrimContent !== false;
  const crop = trim ? detectLampikContentBounds(scene, LAMPIK_TEXTURE_KEY, assetRev) : null;
  const baked = bakeCharacterTexture(
    scene,
    LAMPIK_TEXTURE_KEY,
    logicalHeight,
    superSample,
    assetRev,
    crop
  );
  const cropKey = crop ? `${crop.width}x${crop.height}` : 'full';
  return {
    cacheKey: `lampik_${assetRev}_${cropKey}_h${logicalHeight}_ss${superSample}`,
    ...baked,
  };
}

function bindGsapToPhaser(game) {
  if (typeof gsap === 'undefined' || game.gsapBound) {
    return;
  }
  game.gsapBound = true;
  if (typeof Draggable !== 'undefined') {
    gsap.registerPlugin(Draggable);
  }
  gsap.ticker.remove(gsap.updateRoot);
  game.events.on('step', (time) => {
    gsap.updateRoot(time / 1000);
  });
}

if (typeof gsap !== 'undefined' && typeof Draggable !== 'undefined') {
  gsap.registerPlugin(Draggable);
}

/** @returns {MainScene | undefined} */
function getMainScene() {
  return game?.scene?.getScene('MainScene');
}

// -----------------------------------------------------------------------------
// Видео-заставки (старт / финал)
// -----------------------------------------------------------------------------

const VIDEO_SPLASH_SOURCES = {
  start: {
    mov: 'video/StartLampik.mov',
    mp4: 'video/StartLampik.mp4',
  },
  finish: {
    mov: 'video/FinishLampik.mov',
    mp4: 'video/FinishLampik.mp4',
  },
};

const VIDEO_SPLASH_TAGLINE = {
  start: 'Лампик отправляется в путь к бабушке и дедушке',
  finish: 'Скоро Лампик увидит бабушку и дедушку!',
};

/** @type {'start' | 'finish' | null} */
let videoSplashMode = null;
let videoSplashBound = false;
let videoSplashPlaying = false;
let videoSplashLoadFailed = false;
let finaleSequenceStarted = false;
/** @type {(() => void) | null} */
let videoSplashStartComplete = null;
/** @type {number | null} */
let videoSplashLoadTimeout = null;
/** @type {Map<string, boolean>} */
const videoSplashHeadCache = new Map();
/** @type {string[]} */
let videoSplashUrlQueue = [];
/** @type {number} */
let videoSplashUrlQueueIndex = 0;

function readVideoSplashEls() {
  return {
    root: document.getElementById('lampik-video-splash'),
    video: document.getElementById('lampik-video-splash-player'),
    loading: document.getElementById('lampik-video-splash-loading'),
    action: document.getElementById('lampik-video-splash-action'),
    skip: document.getElementById('lampik-video-splash-skip'),
    finale: document.getElementById('lampik-video-splash-finale'),
    finaleSparks: document.getElementById('lampik-video-splash-sparks'),
    rewards: document.getElementById('lampik-video-splash-rewards'),
    tagline: document.getElementById('lampik-video-splash-tagline'),
  };
}

/**
 * @param {'start' | 'finish'} kind
 * @param {{ playing?: boolean }} [opts]
 */
function syncVideoSplashTagline(kind, opts = {}) {
  const { tagline } = readVideoSplashEls();
  if (!tagline) {
    return;
  }
  const text = VIDEO_SPLASH_TAGLINE[kind] || VIDEO_SPLASH_TAGLINE.start;
  tagline.textContent = text;
  tagline.removeAttribute('hidden');
  tagline.classList.toggle('video-splash__tagline--hide', opts.playing === true);
}

/**
 * @param {string} url
 * @returns {Promise<boolean>}
 */
async function isVideoAssetAvailable(url) {
  if (videoSplashHeadCache.has(url)) {
    return videoSplashHeadCache.get(url) === true;
  }
  if (typeof location !== 'undefined' && location.protocol === 'file:') {
    videoSplashHeadCache.set(url, /\.mp4$/i.test(url) === false);
    return videoSplashHeadCache.get(url) === true;
  }
  try {
    const res = await fetch(url, { method: 'HEAD' });
    const ok = res.ok;
    videoSplashHeadCache.set(url, ok);
    return ok;
  } catch {
    videoSplashHeadCache.set(url, false);
    return false;
  }
}

/**
 * URL-ы заставки в порядке приоритета для браузера (Chrome — mp4, Safari — mov).
 * @param {'start' | 'finish'} kind
 * @returns {Promise<string[]>}
 */
async function resolveSplashVideoUrlCandidates(kind) {
  const paths = VIDEO_SPLASH_SOURCES[kind];
  if (!paths) {
    return [];
  }
  const mp4Ok = await isVideoAssetAvailable(paths.mp4);
  const preferMp4 = window.GAME_ENV?.videoSplashUseMp4 === true;

  const ordered = [];
  const pushUnique = (url) => {
    if (url && !ordered.includes(url)) {
      ordered.push(url);
    }
  };

  // .mov есть в проекте; .mp4 — только если реально лежит на сервере (иначе лишний error).
  pushUnique(paths.mov);
  if (mp4Ok && preferMp4) {
    ordered.unshift(paths.mp4);
  } else if (mp4Ok) {
    pushUnique(paths.mp4);
  }

  return ordered;
}

function clearVideoSplashLoadTimeout() {
  if (videoSplashLoadTimeout !== null) {
    window.clearTimeout(videoSplashLoadTimeout);
    videoSplashLoadTimeout = null;
  }
}

/** Если декодирование зависло — всё равно даём «В путь!» / «Пропустить». */
function showVideoSplashStalledUi() {
  const { loading, skip, action, video } = readVideoSplashEls();
  if (videoSplashPlaying) {
    return;
  }
  if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
    onVideoSplashReady();
    return;
  }
  loading?.setAttribute('hidden', '');
  skip?.removeAttribute('hidden');
  if (videoSplashMode === 'finish') {
    tryAutoPlayFinishVideoSplash();
    return;
  }
  action?.removeAttribute('hidden');
}

function armVideoSplashLoadTimeout(ms = 5000) {
  clearVideoSplashLoadTimeout();
  videoSplashLoadTimeout = window.setTimeout(() => {
    showVideoSplashStalledUi();
  }, ms);
}

function setVideoSplashBodyLock(active) {
  document.body.classList.toggle('video-splash-active', active);
}

function hideVideoSplashActionUi() {
  const { action, skip, loading, tagline } = readVideoSplashEls();
  action?.setAttribute('hidden', '');
  skip?.setAttribute('hidden', '');
  loading?.setAttribute('hidden', '');
  tagline?.classList.add('video-splash__tagline--hide');
}

function showVideoSplashFallbackUi() {
  const { loading, skip, action } = readVideoSplashEls();
  videoSplashLoadFailed = true;
  if (loading) {
    loading.textContent = 'Не удалось загрузить видео';
    loading.removeAttribute('hidden');
  }
  skip?.removeAttribute('hidden');
  if (action && !videoSplashPlaying) {
    if (videoSplashMode === 'finish') {
      action.textContent = 'Посмотреть финал';
    }
    action.removeAttribute('hidden');
  }
}

/**
 * @param {'start' | 'finish'} kind
 */
function resetVideoSplashPlayerVisuals() {
  const { video } = readVideoSplashEls();
  if (!video) {
    return;
  }
  video.pause();
  while (video.firstChild) {
    video.removeChild(video.firstChild);
  }
  video.removeAttribute('src');
  video.classList.remove('video-splash__video--ready');
  video.classList.remove('video-splash__video--playing');
  video.currentTime = 0;
}

async function mountVideoSplashSources(kind, startIndex = 0) {
  const { video } = readVideoSplashEls();
  if (!video) {
    return false;
  }
  clearVideoSplashLoadTimeout();
  videoSplashLoadFailed = false;

  if (startIndex === 0) {
    videoSplashUrlQueue = await resolveSplashVideoUrlCandidates(kind);
    videoSplashUrlQueueIndex = 0;
  }

  resetVideoSplashPlayerVisuals();

  const url = videoSplashUrlQueue[startIndex];
  if (!url) {
    showVideoSplashFallbackUi();
    return false;
  }

  videoSplashUrlQueueIndex = startIndex;
  video.src = url;
  video.load();
  armVideoSplashLoadTimeout();
  return true;
}

function tryNextSplashVideoSource() {
  const next = videoSplashUrlQueueIndex + 1;
  if (next < videoSplashUrlQueue.length) {
    videoSplashLoadFailed = false;
    return mountVideoSplashSources(videoSplashMode || 'start', next);
  }
  return Promise.resolve(false);
}

function onVideoSplashReady() {
  const { video, loading, action } = readVideoSplashEls();
  if (!video || videoSplashPlaying) {
    return;
  }
  clearVideoSplashLoadTimeout();
  videoSplashLoadFailed = false;
  video.classList.add('video-splash__video--ready');
  loading?.setAttribute('hidden', '');
  if (videoSplashMode) {
    syncVideoSplashTagline(videoSplashMode, { playing: false });
  }
  if (videoSplashMode === 'finish') {
    tryAutoPlayFinishVideoSplash();
    return;
  }
  action?.removeAttribute('hidden');
  skip?.removeAttribute('hidden');
}

function fadeOutAndHideVideoSplash(onDone) {
  const { root } = readVideoSplashEls();
  if (!root) {
    setVideoSplashBodyLock(false);
    onDone?.();
    return;
  }

  const finish = () => {
    clearVideoSplashLoadTimeout();
    root.setAttribute('hidden', '');
    root.setAttribute('aria-hidden', 'true');
    root.classList.remove('video-splash--fading');
    const { video, finale } = readVideoSplashEls();
    video?.pause();
    if (video) {
      video.removeAttribute('src');
      video.classList.remove('video-splash__video--ready');
    }
    finale?.setAttribute('hidden', '');
    finale?.setAttribute('aria-hidden', 'true');
    finale?.classList.remove('video-splash__finale--visible');
    setVideoSplashBodyLock(false);
    videoSplashMode = null;
    videoSplashPlaying = false;
    onDone?.();
  };

  root.classList.add('video-splash--fading');
  window.setTimeout(finish, 560);
}

function completeStartVideoSplash() {
  const done = videoSplashStartComplete;
  videoSplashStartComplete = null;
  fadeOutAndHideVideoSplash(() => {
    setModalGamePause(false);
    startLampikBackgroundMusic();
    done?.();
  });
}

function showFinishCelebrationPanel() {
  const { finale, finaleSparks, action, tagline } = readVideoSplashEls();
  action?.setAttribute('hidden', '');
  tagline?.setAttribute('hidden', '');
  if (finaleSparks) {
    finaleSparks.textContent = String(sparksBalance());
  }
  if (finale) {
    finale.removeAttribute('hidden');
    finale.setAttribute('aria-hidden', 'false');
    requestAnimationFrame(() => {
      finale.classList.add('video-splash__finale--visible');
    });
  }
}

function onVideoSplashEnded() {
  const { video } = readVideoSplashEls();
  video?.pause();
  videoSplashPlaying = false;
  syncLampikBgmForVideo();

  if (videoSplashMode === 'start') {
    completeStartVideoSplash();
    return;
  }
  if (videoSplashMode === 'finish') {
    showFinishCelebrationPanel();
  }
}

function skipVideoSplash() {
  hideVideoSplashActionUi();
  if (videoSplashMode === 'start') {
    completeStartVideoSplash();
    return;
  }
  if (videoSplashMode === 'finish') {
    showFinishCelebrationPanel();
  }
}

function startVideoSplashPlayback() {
  const { video, action } = readVideoSplashEls();
  if (!video || videoSplashPlaying) {
    return;
  }
  action?.setAttribute('hidden', '');
  videoSplashPlaying = true;
  if (videoSplashMode) {
    syncVideoSplashTagline(videoSplashMode, { playing: true });
  }
  syncLampikBgmForVideo();

  const playResult = video.play();
  if (playResult && typeof playResult.catch === 'function') {
    playResult.catch((err) => {
      console.warn('[video-splash] play() failed:', err);
      videoSplashPlaying = false;
      syncLampikBgmForVideo();
      if (videoSplashMode === 'finish') {
        const { action: act } = readVideoSplashEls();
        if (act) {
          act.textContent = 'Посмотреть финал';
          act.removeAttribute('hidden');
        }
        syncVideoSplashTagline('finish', { playing: false });
      } else {
        showVideoSplashFallbackUi();
      }
    });
  }
}

function tryAutoPlayFinishVideoSplash() {
  if (videoSplashMode !== 'finish' || videoSplashPlaying || videoSplashLoadFailed) {
    return;
  }
  startVideoSplashPlayback();
}

function playVideoSplashFromUserGesture() {
  startVideoSplashPlayback();
}

/**
 * @param {'start' | 'finish'} kind
 * @param {{ onStartComplete?: () => void }} [opts]
 */
async function openVideoSplash(kind, opts = {}) {
  const { root, loading, action, skip, finale } = readVideoSplashEls();
  if (!root || !action) {
    if (kind === 'start') {
      opts.onStartComplete?.();
    } else {
      openSparkExchange({ finale: true });
    }
    return;
  }

  videoSplashMode = kind;
  videoSplashPlaying = false;
  videoSplashLoadFailed = false;
  if (kind === 'start') {
    videoSplashStartComplete = opts.onStartComplete ?? null;
  }

  root.classList.remove('video-splash--fading');
  root.removeAttribute('hidden');
  root.setAttribute('aria-hidden', 'false');
  root.classList.toggle('video-splash--start', kind === 'start');
  root.classList.toggle('video-splash--finish', kind === 'finish');

  finale?.setAttribute('hidden', '');
  finale?.setAttribute('aria-hidden', 'true');
  finale?.classList.remove('video-splash__finale--visible');

  action.textContent = kind === 'start' ? 'В путь!' : 'Посмотреть финал';
  action.setAttribute('hidden', '');
  skip?.setAttribute('hidden', '');
  if (loading) {
    loading.textContent = 'Загрузка…';
    loading.removeAttribute('hidden');
  }

  setVideoSplashBodyLock(true);
  setModalGamePause(true);
  syncVideoSplashTagline(kind, { playing: false });

  await mountVideoSplashSources(kind);
}

function bindVideoSplashUi() {
  if (videoSplashBound) {
    return;
  }
  const { video, action, skip, rewards } = readVideoSplashEls();
  if (!video || !action) {
    return;
  }
  videoSplashBound = true;

  action.addEventListener('click', () => {
    if (videoSplashLoadFailed) {
      skipVideoSplash();
      return;
    }
    playVideoSplashFromUserGesture();
    window.setTimeout(() => {
      ensureMiniGameAudioContext();
    }, 0);
  });

  skip?.addEventListener('click', () => {
    skipVideoSplash();
    window.setTimeout(() => {
      ensureMiniGameAudioContext();
    }, 0);
  });

  rewards?.addEventListener('click', () => {
    fadeOutAndHideVideoSplash(() => {
      openSparkExchange({ finale: true });
    });
  });

  const onProgress = () => onVideoSplashReady();
  video.addEventListener('loadedmetadata', onProgress);
  video.addEventListener('loadeddata', onProgress);
  video.addEventListener('canplay', onProgress);
  video.addEventListener('ended', onVideoSplashEnded);
  video.addEventListener('playing', () => {
    video.classList.add('video-splash__video--playing');
    syncLampikBgmForVideo();
  });
  video.addEventListener('play', () => syncLampikBgmForVideo());
  video.addEventListener('pause', () => {
    video.classList.remove('video-splash__video--playing');
    syncLampikBgmForVideo();
  });
  video.addEventListener('error', () => {
    clearVideoSplashLoadTimeout();
    if (videoSplashPlaying) {
      return;
    }
    void tryNextSplashVideoSource().then((ok) => {
      if (!ok) {
        showVideoSplashFallbackUi();
      }
    });
  });
}

function showStartVideoSplash(onComplete) {
  bindVideoSplashUi();
  openVideoSplash('start', { onStartComplete: onComplete });
}

function beginFinaleSequence() {
  if (finaleSequenceStarted) {
    return;
  }
  finaleSequenceStarted = true;
  resetCompletedMinigamesInRun();
  unlockSparkExchange('финиш у бабушки');
  bindVideoSplashUi();
  openVideoSplash('finish');
}

// -----------------------------------------------------------------------------
// Модальное окно задания (DOM + GSAP)
// -----------------------------------------------------------------------------

const taskModalState = {
  stopIndex: 0,
  /** @type {string | null} */
  minigameId: null,
  open: false,
  closing: false,
  nextEnabled: false,
};

const SPARKS_STORAGE_KEY = 'lampik_sparks_v1';
/** Старый ключ — больше не используем (задания только в рамках одного прохода / сессии) */
const COMPLETED_MINIGAMES_STORAGE_KEY = 'lampik_completed_minigames_v1';
const STORY_REPLAY_SPARK_COST = 1;

/** Идентификаторы мини-игр (не привязаны к остановкам на карте) */
const MINIGAME = {
  KETTLE: 'kettle',
  TAP: 'tap',
  TRASH: 'trash',
  LIGHT: 'light',
  PHONE: 'phone',
  FRIDGE: 'fridge',
  TV: 'tv',
};

const ALL_MINIGAME_IDS = [
  MINIGAME.KETTLE,
  MINIGAME.TAP,
  MINIGAME.TRASH,
  MINIGAME.LIGHT,
  MINIGAME.PHONE,
  MINIGAME.FRIDGE,
  MINIGAME.TV,
];

const completedMinigamesState = {
  ids: /** @type {string[]} */ ([]),
};

/** Подарки в магазине наград (финальный экран) */
const SPARK_REWARDS = [
  {
    id: 'sticker',
    cost: 4,
    shopLabel: 'Стикеры',
    title: 'Стикер-пак',
    imagePath: 'assets/gifts/stickerPack.png',
  },
  {
    id: 'coloring',
    cost: 5,
    shopLabel: 'Раскраска',
    title: 'Раскраска',
    imagePath: 'assets/gifts/draw.png',
  },
  {
    id: 'diploma',
    cost: 6,
    shopLabel: 'Диплом',
    title: 'Диплом',
    imagePath: 'assets/gifts/dimploma.png',
  },
];

const sparksState = {
  earned: 0,
  spent: 0,
  purchases: /** @type {string[]} */ ([]),
  exchangeUnlocked: false,
};

/** @param {unknown} id */
function isValidSparkRewardId(id) {
  return typeof id === 'string' && SPARK_REWARDS.some((r) => r.id === id);
}

function loadSparksFromStorage() {
  try {
    const raw = localStorage.getItem(SPARKS_STORAGE_KEY);
    if (!raw) {
      return;
    }
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') {
      return;
    }
    const earned = Number(data.earned);
    const spent = Number(data.spent);
    sparksState.earned = Number.isFinite(earned) ? Math.max(0, Math.floor(earned)) : 0;
    sparksState.spent = Number.isFinite(spent) ? Math.max(0, Math.floor(spent)) : 0;
    if (sparksState.spent > sparksState.earned) {
      sparksState.spent = sparksState.earned;
    }
    sparksState.purchases = Array.isArray(data.purchases)
      ? [...new Set(data.purchases.filter(isValidSparkRewardId))]
      : [];
    sparksState.exchangeUnlocked = data.exchangeUnlocked === true;
  } catch {
    /* ignore corrupt storage */
  }
}

/** Сброс списка заданий текущего прохода (новая игра, reload, финиш, «Играть снова») */
function resetCompletedMinigamesInRun() {
  completedMinigamesState.ids = [];
  try {
    localStorage.removeItem(COMPLETED_MINIGAMES_STORAGE_KEY);
    localStorage.removeItem('lampik_story_replay_cycle_v1');
  } catch {
    /* ignore */
  }
}

function loadProgressFromStorage() {
  loadSparksFromStorage();
  resetCompletedMinigamesInRun();
}

function saveSparksToStorage() {
  try {
    localStorage.setItem(
      SPARKS_STORAGE_KEY,
      JSON.stringify({
        earned: sparksState.earned,
        spent: sparksState.spent,
        purchases: sparksState.purchases,
        exchangeUnlocked: sparksState.exchangeUnlocked,
      })
    );
  } catch {
    /* ignore quota / private mode */
  }
}

function isMinigameCompleted(minigameId) {
  return completedMinigamesState.ids.includes(minigameId);
}

function getUncompletedMinigameIds() {
  return ALL_MINIGAME_IDS.filter((id) => !isMinigameCompleted(id));
}

/**
 * Случайное задание среди тех, что ещё не были в этом проходе.
 * @returns {string | null} null — на остановке не осталось новых мини-игр (крайний случай)
 */
function pickMinigameIdForTaskStop() {
  const pending = getUncompletedMinigameIds();
  if (pending.length === 0) {
    return null;
  }
  return pending[Math.floor(Math.random() * pending.length)];
}

/** @param {string | null | undefined} minigameId */
function markMinigameCompleted(minigameId) {
  if (!minigameId || !ALL_MINIGAME_IDS.includes(minigameId) || isMinigameCompleted(minigameId)) {
    return;
  }
  completedMinigamesState.ids.push(minigameId);
  console.info(`[task-modal] задание выполнено в этом проходе: ${minigameId}`);
}

/** @param {string | null | undefined} minigameId */
function isActiveStoryMinigameId(minigameId) {
  return typeof minigameId === 'string' && ALL_MINIGAME_IDS.includes(minigameId);
}

function sparksBalance() {
  return Math.max(0, sparksState.earned - sparksState.spent);
}

let sparkExchangeOpen = false;
let sparkExchangeFinale = false;
let rewardGiftModalOpen = false;
/** @type {{ id: string, title: string, imagePath: string, cost: number, justPurchased?: boolean, previewOnly?: boolean } | null} */
let rewardGiftModalPayload = null;

const MODAL_LAMPIK_MOTION = {
  jumpHeightPx: 16,
  /** Пауза между прыжками (сек) */
  restSec: 5.5,
  prep: 0.1,
  up: 0.24,
  down: 0.22,
  settle: 0.18,
  prepSquashY: 0.91,
  stretchY: 1.07,
  landSquashY: 0.94,
};

let modalLampikMotion = null;

function readSparksHudEl() {
  return {
    hud: document.getElementById('sparks-hud'),
    count: document.getElementById('sparks-count'),
    root: document.getElementById('task-modal'),
    backdrop: document.querySelector('.task-modal__backdrop'),
    panel: document.querySelector('.task-modal__panel'),
    nextBtn: document.getElementById('task-modal-next'),
    dismissBtn: document.getElementById('task-modal-dismiss'),
  };
}

function isTaskModalDismissAllowed() {
  return window.GAME_ENV?.taskModalAllowDismiss !== false;
}

function syncTaskModalDismissUi() {
  const { root } = readSparksHudEl();
  const allow = isTaskModalDismissAllowed();
  if (root) {
    root.classList.toggle('task-modal--dismissable', allow);
  }
}

function setModalGamePause(paused) {
  const container = document.getElementById('game-container');
  if (container) {
    container.classList.toggle('game-container--modal-pause', paused);
  }
  const scene = getMainScene();
  if (scene?.input) {
    scene.input.enabled = !paused;
  }
}

function setNextButtonEnabled(enabled) {
  const { nextBtn } = readSparksHudEl();
  if (!nextBtn) {
    return;
  }
  taskModalState.nextEnabled = enabled;
  nextBtn.disabled = !enabled;
  nextBtn.setAttribute('aria-disabled', enabled ? 'false' : 'true');
  nextBtn.setAttribute(
    'aria-label',
    enabled
      ? 'Готово — идём дальше'
      : 'Пока нельзя — сначала сделай задание'
  );
}

function stopModalLampikMotion() {
  const img = document.getElementById('task-modal-lampik');
  if (img && typeof gsap !== 'undefined') {
    gsap.killTweensOf(img);
    gsap.set(img, { clearProps: 'transform' });
  }
  if (modalLampikMotion) {
    modalLampikMotion.kill();
    modalLampikMotion = null;
  }
}

function clearStoryTaskModalLayout() {
  const modal = document.getElementById('task-modal');
  modal?.classList.remove(
    'task-modal--kettle-story',
    'task-modal--tap-story',
    'task-modal--trash-story',
    'task-modal--light-story',
    'task-modal--phone-story',
    'task-modal--fridge-story',
    'task-modal--tv-story'
  );
  document.getElementById('trash-mascot-bubble')?.remove();
  setModalLampikMood('neutral');
}

function applyKettleTaskModalLayout() {
  document.getElementById('task-modal')?.classList.add('task-modal--kettle-story');
  setModalLampikMood('sad');
}

function applyTapTaskModalLayout() {
  document.getElementById('task-modal')?.classList.add('task-modal--tap-story');
  setModalLampikMood('sad');
}

function applyLightTaskModalLayout() {
  document.getElementById('task-modal')?.classList.add('task-modal--light-story');
  setModalLampikMood('sad');
}

function applyPhoneTaskModalLayout() {
  document.getElementById('task-modal')?.classList.add('task-modal--phone-story');
  setModalLampikMood('sad');
}

function applyFridgeTaskModalLayout() {
  document.getElementById('task-modal')?.classList.add('task-modal--fridge-story');
  setModalLampikMood('sad');
}

function applyTvTaskModalLayout() {
  document.getElementById('task-modal')?.classList.add('task-modal--tv-story');
  setModalLampikMood('sad');
}

const TRASH_CROSSED_BOTTLE_SVG = `
  <svg viewBox="0 0 36 36" width="32" height="32" aria-hidden="true">
    <rect x="12" y="8" width="12" height="20" rx="4" fill="#5ec8f5" />
    <rect x="14" y="6" width="8" height="4" rx="2" fill="#3aa8e0" />
    <path stroke="#e94f5f" stroke-width="3" stroke-linecap="round" d="M8 8l20 20M28 8L8 28"/>
  </svg>
`;

function applyTrashTaskModalLayout() {
  document.getElementById('task-modal')?.classList.add('task-modal--trash-story');
  setModalLampikMood('sad');
  const mascotStage = document.querySelector('.task-modal__mascot-stage');
  if (!mascotStage || mascotStage.querySelector('#trash-mascot-bubble')) {
    return;
  }
  const bubble = document.createElement('div');
  bubble.id = 'trash-mascot-bubble';
  bubble.className = 'trash-task__mascot-bubble';
  bubble.setAttribute('role', 'note');
  bubble.innerHTML = TRASH_CROSSED_BOTTLE_SVG;
  mascotStage.appendChild(bubble);
  if (typeof gsap !== 'undefined') {
    gsap.fromTo(
      bubble,
      { scale: 0.65, opacity: 0, y: 8 },
      { scale: 1, opacity: 1, y: 0, duration: 0.45, ease: 'back.out(2.2)' }
    );
  }
}

let miniGameAudioCtx = null;
let gameAudioUnlockBound = false;

function ensureMiniGameAudioContext() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      return null;
    }
    if (!miniGameAudioCtx) {
      miniGameAudioCtx = new Ctx();
    }
    if (miniGameAudioCtx.state === 'suspended') {
      void miniGameAudioCtx.resume();
    }
    return miniGameAudioCtx;
  } catch {
    return null;
  }
}

async function resumeMiniGameAudioContext() {
  const ctx = ensureMiniGameAudioContext();
  if (!ctx) {
    return false;
  }
  if (ctx.state === 'suspended') {
    try {
      await ctx.resume();
    } catch {
      return false;
    }
  }
  return ctx.state === 'running';
}

function onGameAudioUnlocked() {
  void resumeMiniGameAudioContext().then((ok) => {
    if (!ok) {
      return;
    }
    if (lampikBgmState.wantsPlay) {
      syncLampikBgmForVideo();
      if (lampikBgmState.phraseTimer == null) {
        runLampikBgmPhrase();
      }
    }
  });
}

function bindGameAudioUnlock() {
  if (gameAudioUnlockBound) {
    return;
  }
  gameAudioUnlockBound = true;
  const handler = () => {
    onGameAudioUnlocked();
  };
  document.addEventListener('pointerdown', handler, true);
  document.addEventListener('keydown', handler, true);
  document.addEventListener('touchstart', handler, { capture: true, passive: true });
}

/** Короткое «кап» для открытого крана */
function playTapDripSound() {
  try {
    const ctx = ensureMiniGameAudioContext();
    if (!ctx) {
      return;
    }
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(920 + Math.random() * 160, t0);
    osc.frequency.exponentialRampToValueAtTime(280, t0 + 0.07);
    gain.gain.setValueAtTime(0.07, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.11);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.13);
  } catch {
    /* необязательно */
  }
}

let lampikFootstepSide = 0;
let gameSfxBus = null;

function ensureGameSfxBus() {
  const ctx = ensureMiniGameAudioContext();
  if (!ctx) {
    return null;
  }
  if (!gameSfxBus) {
    const g = ctx.createGain();
    g.gain.value = 1;
    g.connect(ctx.destination);
    gameSfxBus = g;
  }
  return gameSfxBus;
}

/** Тихий шаг Лампика по дорожке (синтез, без файлов) */
function playLampikFootstepSound() {
  try {
    if (isSplashVideoPlaying()) {
      return;
    }
    const ctx = ensureMiniGameAudioContext();
    if (!ctx) {
      return;
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
    const bus = ensureGameSfxBus();
    if (!bus || ctx.state !== 'running') {
      return;
    }
    lampikFootstepSide = 1 - lampikFootstepSide;
    const t0 = ctx.currentTime + 0.001;
    const duration = 0.07;
    const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      const fade = 1 - i / bufferSize;
      data[i] = (Math.random() * 2 - 1) * fade * fade;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    const sideBias = lampikFootstepSide === 0 ? 80 : -80;
    noiseFilter.frequency.setValueAtTime(520 + sideBias + Math.random() * 140, t0);
    noiseFilter.Q.setValueAtTime(1.1, t0);
    const noiseGain = ctx.createGain();
    const peak = 0.14 + Math.random() * 0.06;
    noiseGain.gain.setValueAtTime(peak, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(bus);
    noise.start(t0);
    noise.stop(t0 + duration + 0.02);

    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'triangle';
    thump.frequency.setValueAtTime(105 + Math.random() * 30, t0);
    thump.frequency.exponentialRampToValueAtTime(58, t0 + 0.055);
    thumpGain.gain.setValueAtTime(0.1, t0);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.065);
    thump.connect(thumpGain);
    thumpGain.connect(bus);
    thump.start(t0);
    thump.stop(t0 + 0.07);

    const click = ctx.createOscillator();
    const clickGain = ctx.createGain();
    click.type = 'square';
    click.frequency.setValueAtTime(720 + Math.random() * 200, t0);
    clickGain.gain.setValueAtTime(0.018, t0);
    clickGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.018);
    const clickFilter = ctx.createBiquadFilter();
    clickFilter.type = 'highpass';
    clickFilter.frequency.setValueAtTime(400, t0);
    click.connect(clickFilter);
    clickFilter.connect(clickGain);
    clickGain.connect(bus);
    click.start(t0);
    click.stop(t0 + 0.022);
  } catch {
    /* необязательно */
  }
}

const walkFootstepRhythm = {
  timer: null,
  cycleMs: 0,
};

function startWalkFootstepRhythm(cycleDurationSec) {
  stopWalkFootstepRhythm();
  onGameAudioUnlocked();
  const stepMs = Math.max(90, Math.round(cycleDurationSec * 500));
  walkFootstepRhythm.cycleMs = stepMs;
  playLampikFootstepSound();
  walkFootstepRhythm.timer = window.setInterval(() => {
    playLampikFootstepSound();
  }, stepMs);
}

function stopWalkFootstepRhythm() {
  if (walkFootstepRhythm.timer != null) {
    window.clearInterval(walkFootstepRhythm.timer);
    walkFootstepRhythm.timer = null;
  }
}

const LAMPIK_BGM_MASTER_GAIN = 0.2;

const LAMPIK_BGM_MOODS = [
  {
    root: 62,
    scale: [0, 2, 4, 7, 9],
    chords: [
      [0, 4, 7],
      [5, 9, 12],
      [7, 11, 14],
      [0, 4, 7],
    ],
  },
  {
    root: 57,
    scale: [0, 2, 3, 7, 9],
    chords: [
      [0, 3, 7],
      [8, 12, 15],
      [5, 8, 12],
      [3, 7, 10],
    ],
  },
  {
    root: 64,
    scale: [0, 2, 4, 7, 9, 11],
    chords: [
      [0, 4, 7],
      [9, 12, 16],
      [5, 9, 12],
      [7, 11, 14],
    ],
  },
  {
    root: 59,
    scale: [0, 3, 5, 7, 10],
    chords: [
      [0, 3, 7],
      [5, 8, 12],
      [10, 14, 17],
      [0, 3, 7],
    ],
  },
];

let lampikBgmState = {
  wantsPlay: false,
  phraseTimer: null,
  masterGainNode: null,
};

function isSplashVideoPlaying() {
  const { root, video } = readVideoSplashEls();
  if (root?.hasAttribute('hidden')) {
    return false;
  }
  if (videoSplashPlaying) {
    return true;
  }
  if (video && !video.paused && !video.ended && video.currentTime > 0) {
    return true;
  }
  return false;
}

function ensureLampikBgmBus() {
  const ctx = ensureMiniGameAudioContext();
  if (!ctx) {
    return null;
  }
  if (!lampikBgmState.masterGainNode) {
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.connect(ctx.destination);
    lampikBgmState.masterGainNode = g;
  }
  return lampikBgmState.masterGainNode;
}

function syncLampikBgmForVideo() {
  const bus = lampikBgmState.masterGainNode;
  const ctx = miniGameAudioCtx;
  if (!bus || !ctx) {
    return;
  }
  const t = ctx.currentTime;
  const audible =
    lampikBgmState.wantsPlay && !isSplashVideoPlaying() ? LAMPIK_BGM_MASTER_GAIN : 0.0001;
  bus.gain.cancelScheduledValues(t);
  bus.gain.setValueAtTime(Math.max(0.0001, bus.gain.value), t);
  bus.gain.linearRampToValueAtTime(audible, t + 0.4);
}

function scheduleLampikBgmPadNote(ctx, bus, startTime, midi, duration, peak) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(2200, startTime);
  filter.Q.setValueAtTime(0.35, startTime);
  osc.type = Math.random() > 0.25 ? 'triangle' : 'sawtooth';
  osc.frequency.setValueAtTime(successMidiToFreq(midi), startTime);
  const attack = 0.08 + Math.random() * 0.12;
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + attack);
  gain.gain.setValueAtTime(peak * 0.88, startTime + Math.max(attack + 0.15, duration - 0.35));
  gain.gain.linearRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(bus);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.08);
}

function scheduleLampikBgmBeat(ctx, bus, startTime, strong = false) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  const base = strong ? 200 : 165;
  osc.frequency.setValueAtTime(base, startTime);
  osc.frequency.exponentialRampToValueAtTime(72, startTime + 0.1);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(strong ? 0.09 : 0.055, startTime + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.13);
  osc.connect(gain);
  gain.connect(bus);
  osc.start(startTime);
  osc.stop(startTime + 0.15);
}

function scheduleLampikBgmMelodyBlip(ctx, bus, startTime, midi) {
  const duration = 0.12 + Math.random() * 0.14;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = Math.random() > 0.4 ? 'square' : 'triangle';
  osc.frequency.setValueAtTime(successMidiToFreq(midi), startTime);
  osc.detune.setValueAtTime((Math.random() - 0.5) * 10, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(0.065 + Math.random() * 0.03, startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(3400, startTime);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(bus);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.04);
}

function clearLampikBgmPhraseTimer() {
  if (lampikBgmState.phraseTimer != null) {
    window.clearTimeout(lampikBgmState.phraseTimer);
    lampikBgmState.phraseTimer = null;
  }
}

function runLampikBgmPhrase() {
  clearLampikBgmPhraseTimer();
  if (!lampikBgmState.wantsPlay) {
    return;
  }
  const ctx = ensureMiniGameAudioContext();
  const bus = ensureLampikBgmBus();
  if (!ctx || !bus) {
    lampikBgmState.phraseTimer = window.setTimeout(runLampikBgmPhrase, 1800);
    return;
  }

  if (isSplashVideoPlaying()) {
    lampikBgmState.phraseTimer = window.setTimeout(runLampikBgmPhrase, 900);
    return;
  }

  if (ctx.state !== 'running') {
    lampikBgmState.phraseTimer = window.setTimeout(runLampikBgmPhrase, 600);
    return;
  }

  const mood = LAMPIK_BGM_MOODS[Math.floor(Math.random() * LAMPIK_BGM_MOODS.length)];
  const t0 = ctx.currentTime + 0.04;
  const beatSec = 0.42 + Math.random() * 0.08;
  const bars = 4 + Math.floor(Math.random() * 3);
  const beatsTotal = bars * 4;
  const order = [...mood.chords].sort(() => Math.random() * 0.5 - 0.25);

  for (let beat = 0; beat < beatsTotal; beat += 1) {
    const t = t0 + beat * beatSec;
    scheduleLampikBgmBeat(ctx, bus, t, beat % 4 === 0);

    if (beat % 2 === 0) {
      const chord = order[Math.floor(beat / 2) % order.length];
      const padDur = beatSec * 2.05;
      chord.forEach((semi) => {
        scheduleLampikBgmPadNote(
          ctx,
          bus,
          t,
          mood.root + semi,
          padDur,
          0.038 + Math.random() * 0.022
        );
      });
      const arpStep = beatSec * 0.48;
      chord.forEach((semi, i) => {
        scheduleLampikBgmMelodyBlip(ctx, bus, t + arpStep * i + 0.04, mood.root + semi + 12);
      });
    }

    if (Math.random() > 0.35) {
      const semi = mood.scale[Math.floor(Math.random() * mood.scale.length)];
      scheduleLampikBgmMelodyBlip(
        ctx,
        bus,
        t + beatSec * 0.55,
        mood.root + semi + (Math.random() > 0.6 ? 12 : 0)
      );
    }
  }

  const restMs = (0.35 + Math.random() * 0.85) * 1000;
  const phraseMs = beatsTotal * beatSec * 1000;
  lampikBgmState.phraseTimer = window.setTimeout(runLampikBgmPhrase, phraseMs + restMs);
}

function startLampikBackgroundMusic() {
  lampikBgmState.wantsPlay = true;
  void resumeMiniGameAudioContext().then((ok) => {
    ensureLampikBgmBus();
    syncLampikBgmForVideo();
    if (!ok) {
      return;
    }
    if (lampikBgmState.phraseTimer == null) {
      runLampikBgmPhrase();
    }
  });
}

function pauseLampikBackgroundMusic() {
  lampikBgmState.wantsPlay = false;
  clearLampikBgmPhraseTimer();
  syncLampikBgmForVideo();
}

/** Щелчок вентиля */
function playTapValveClickSound() {
  try {
    const ctx = ensureMiniGameAudioContext();
    if (!ctx) {
      return;
    }
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, t0);
    osc.frequency.exponentialRampToValueAtTime(120, t0 + 0.04);
    gain.gain.setValueAtTime(0.09, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.07);
  } catch {
    /* необязательно */
  }
}

/** Мажорная пентатоника — без «фальши», удобно рандомить ноты */
const SUCCESS_PENTATONE_SEMITONES = [0, 2, 4, 7, 9];

function successMidiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function playSuccessChimeNote(ctx, startTime, freq, options = {}) {
  const {
    duration = 0.32,
    peak = 0.11,
    type = 'sine',
    detune = 0,
    pitchSlideTo = null,
  } = options;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.setValueAtTime(0.7, startTime);
  filter.frequency.setValueAtTime(Math.min(7200, freq * 3.2), startTime);
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  if (pitchSlideTo != null && pitchSlideTo > 0) {
    osc.frequency.exponentialRampToValueAtTime(pitchSlideTo, startTime + duration * 0.55);
  }
  osc.detune.setValueAtTime(detune, startTime);
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.linearRampToValueAtTime(peak, startTime + 0.014);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.04);
}

/** Успех в мини-играх: лёгкий «дзинь», каждый раз другой рисунок и высота */
function playMiniGameSuccessPlop() {
  try {
    const ctx = ensureMiniGameAudioContext();
    if (!ctx) {
      return;
    }
    const t0 = ctx.currentTime;
    const rootMidi = 66 + Math.floor(Math.random() * 10);
    const style = Math.floor(Math.random() * 4);
    const detuneJit = () => (Math.random() - 0.5) * 18;
    const noteAt = (semi, octave = 0) => successMidiToFreq(rootMidi + semi + octave * 12);
    const pickSemi = () =>
      SUCCESS_PENTATONE_SEMITONES[Math.floor(Math.random() * SUCCESS_PENTATONE_SEMITONES.length)];

    if (style === 0) {
      const count = 3 + Math.floor(Math.random() * 3);
      const step = 0.065 + Math.random() * 0.045;
      const startIdx = Math.floor(Math.random() * SUCCESS_PENTATONE_SEMITONES.length);
      for (let i = 0; i < count; i += 1) {
        const scaleIdx = startIdx + i;
        const semi = SUCCESS_PENTATONE_SEMITONES[scaleIdx % SUCCESS_PENTATONE_SEMITONES.length];
        const octave = Math.floor(scaleIdx / SUCCESS_PENTATONE_SEMITONES.length);
        playSuccessChimeNote(ctx, t0 + i * step, noteAt(semi, octave), {
          duration: 0.26 + Math.random() * 0.14,
          peak: Math.max(0.06, 0.13 - i * 0.018),
          type: Math.random() > 0.4 ? 'sine' : 'triangle',
          detune: detuneJit(),
        });
      }
    } else if (style === 1) {
      const motifs = [
        [0, 4, 7, 12],
        [0, 7, 9, 12],
        [0, 2, 7, 9, 12],
      ];
      const motif = motifs[Math.floor(Math.random() * motifs.length)];
      const step = 0.055 + Math.random() * 0.035;
      motif.forEach((semi, i) => {
        playSuccessChimeNote(ctx, t0 + i * step, noteAt(semi), {
          duration: 0.24 + Math.random() * 0.1,
          peak: 0.12 - i * 0.012,
          detune: detuneJit(),
        });
      });
    } else if (style === 2) {
      const third = Math.random() > 0.5 ? 4 : 3;
      playSuccessChimeNote(ctx, t0, noteAt(0), { duration: 0.42, peak: 0.09 });
      playSuccessChimeNote(ctx, t0 + 0.05, noteAt(third), { duration: 0.38, peak: 0.075 });
      const shimmerSemi = pickSemi() + 12;
      playSuccessChimeNote(ctx, t0 + 0.13 + Math.random() * 0.06, noteAt(shimmerSemi % 12, 1), {
        duration: 0.22,
        peak: 0.065,
        type: 'triangle',
        detune: detuneJit(),
      });
    } else {
      const startSemi = pickSemi() + 7 + Math.floor(Math.random() * 6);
      const endSemi = pickSemi();
      const startFreq = noteAt(startSemi % 12, Math.floor(startSemi / 12) + 1);
      const endFreq = Math.max(90, noteAt(endSemi));
      playSuccessChimeNote(ctx, t0, startFreq, {
        duration: 0.16 + Math.random() * 0.12,
        peak: 0.16 + Math.random() * 0.05,
        pitchSlideTo: endFreq,
        detune: detuneJit(),
      });
      if (Math.random() > 0.35) {
        playSuccessChimeNote(ctx, t0 + 0.09, noteAt(pickSemi() + 12), {
          duration: 0.18,
          peak: 0.055,
          type: 'triangle',
        });
      }
    }
  } catch {
    /* звук необязателен */
  }
}

/** Звук «дзынь» — телефон заряжен на 100% */
function playPhoneChargeFullSound() {
  try {
    const ctx = ensureMiniGameAudioContext();
    if (!ctx) {
      return;
    }
    const t0 = ctx.currentTime;
    const freqs = [620, 880, 1180];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      const start = t0 + i * 0.055;
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.28);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.3);
    });
  } catch {
    /* необязательно */
  }
}

/** Щелчок при выключении чайника */
function playKettleUnplugClickSound() {
  try {
    const ctx = ensureMiniGameAudioContext();
    if (!ctx) {
      return;
    }
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(180, t0);
    osc.frequency.exponentialRampToValueAtTime(90, t0 + 0.05);
    gain.gain.setValueAtTime(0.06, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.09);
  } catch {
    /* необязательно */
  }
}

/** Щелчок кнопки пульта / выключателя телевизора */
function playTvRemoteClickSound() {
  try {
    const ctx = ensureMiniGameAudioContext();
    if (!ctx) {
      return;
    }
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(920, t0);
    filter.Q.setValueAtTime(2.2, t0);
    osc.type = 'square';
    osc.frequency.setValueAtTime(210, t0);
    osc.frequency.exponentialRampToValueAtTime(95, t0 + 0.04);
    gain.gain.setValueAtTime(0.075, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(t0);
    osc.stop(t0 + 0.08);
  } catch {
    /* необязательно */
  }
}

/** Тихий «бубнеж» идущего телевизора */
function playTvMumbleBlip() {
  try {
    const ctx = ensureMiniGameAudioContext();
    if (!ctx) {
      return;
    }
    const t0 = ctx.currentTime;
    const bufferSize = Math.floor(ctx.sampleRate * 0.06);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    }
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(380 + Math.random() * 120, t0);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.018, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.06);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + 0.065);
  } catch {
    /* необязательно */
  }
}

/**
 * @param {HTMLElement} layer
 * @param {number} x
 * @param {number} y
 */
function spawnTrashSortStar(layer, x, y) {
  if (!layer || typeof gsap === 'undefined') {
    return;
  }
  const star = document.createElement('span');
  star.className = 'trash-task__sort-star';
  star.setAttribute('aria-hidden', 'true');
  star.textContent = '★';
  star.style.left = `${x}px`;
  star.style.top = `${y}px`;
  layer.appendChild(star);
  gsap.fromTo(
    star,
    { scale: 0.2, opacity: 1, rotation: 0 },
    {
      scale: 1.35,
      opacity: 0,
      rotation: 140,
      y: -22,
      duration: 0.65,
      ease: 'power2.out',
      onComplete: () => star.remove(),
    }
  );
}

/** @param {'neutral' | 'sad'} mood */
function setModalLampikMood(mood) {
  const stage = document.querySelector('.task-modal__mascot-stage');
  const img = document.getElementById('task-modal-lampik');
  stage?.classList.toggle('task-modal__mascot-stage--sad', mood === 'sad');
  if (img && typeof gsap !== 'undefined') {
    if (mood === 'sad') {
      gsap.set(img, { rotation: -5, y: 6, scaleY: 0.96, scaleX: gsap.getProperty(img, 'scaleX') });
    } else if (mood === 'neutral') {
      gsap.set(img, { rotation: 0, y: 0, scaleY: 1 });
    }
  }
}

/** После успешного задания — радостный отскок и цикл прыжков в модалке */
function celebrateModalLampikTaskComplete() {
  const img = document.getElementById('task-modal-lampik');
  if (!img || typeof gsap === 'undefined') {
    return;
  }
  stopModalLampikMotion();
  const env = window.GAME_ENV;
  const sx = scaleXForFaceRight(true, 1, env);
  setModalLampikMood('neutral');
  gsap.set(img, { x: 0, y: 0, rotation: 0, scaleX: sx, scaleY: 1 });
  gsap
    .timeline()
    .to(img, {
      y: -26,
      scaleY: 1.1,
      duration: 0.32,
      ease: 'power2.out',
    })
    .to(img, {
      y: 0,
      scaleY: 1,
      duration: 0.42,
      ease: 'bounce.out',
    })
    .add(() => startModalLampikMotion());
}

/** В модалке — редкий лёгкий прыжок на месте (длинная пауза между ними) */
function startModalLampikMotion() {
  stopModalLampikMotion();
  const img = document.getElementById('task-modal-lampik');
  if (!img || typeof gsap === 'undefined') {
    return;
  }

  const env = window.GAME_ENV;
  const m = MODAL_LAMPIK_MOTION;
  const sx = scaleXForFaceRight(true, 1, env);

  gsap.set(img, { x: 0, y: 0, rotation: 0, scaleX: sx, scaleY: 1 });

  modalLampikMotion = gsap.timeline({ repeat: -1, repeatDelay: m.restSec });

  modalLampikMotion
    .to(img, {
      scaleY: m.prepSquashY,
      y: 3,
      duration: m.prep,
      ease: 'power2.in',
    })
    .to(img, {
      y: -m.jumpHeightPx,
      scaleY: m.stretchY,
      duration: m.up,
      ease: 'power2.out',
    })
    .to(img, {
      y: 0,
      scaleY: m.landSquashY,
      duration: m.down,
      ease: 'power2.in',
    })
    .to(img, {
      scaleY: 1,
      y: 0,
      rotation: 0,
      duration: m.settle,
      ease: 'back.out(1.5)',
    });
}

function syncSparksHud() {
  const { hud, count } = readSparksHudEl();
  const balance = sparksBalance();
  const earned = sparksState.earned;
  if (count) {
    count.textContent = String(balance);
  }
  if (hud) {
    const canShop = balance > 0 && sparksState.exchangeUnlocked;
    hud.disabled = !canShop;
    hud.classList.toggle('sparks-hud--locked', !canShop);
  }
}

function awardSpark() {
  sparksState.earned += 1;
  saveSparksToStorage();
  syncSparksHud();
  const { hud, count } = readSparksHudEl();
  if (hud && typeof gsap !== 'undefined') {
    gsap.fromTo(
      hud,
      { scale: 1 },
      {
        scale: 1.12,
        duration: 0.22,
        ease: 'back.out(2)',
        yoyo: true,
        repeat: 1,
      }
    );
    gsap.fromTo(
      count,
      { color: '#ff9f3a' },
      { color: '#4a3d6b', duration: 0.6, ease: 'power2.out' }
    );
  }
}

function unlockSparkExchange(reason) {
  if (sparksState.exchangeUnlocked) {
    return;
  }
  sparksState.exchangeUnlocked = true;
  saveSparksToStorage();
  syncSparksHud();
  console.info(`[sparks] обмен открыт: ${reason || 'конец пути'}`);
}

function renderSparkExchangeRewards() {
  const list = document.getElementById('spark-exchange-rewards');
  if (!list) {
    return;
  }
  list.innerHTML = '';
  const balance = sparksBalance();

  for (const reward of SPARK_REWARDS) {
    const owned = sparksState.purchases.includes(reward.id);
    const canAfford = balance >= reward.cost;
    const wrap = document.createElement('div');
    wrap.className = 'spark-exchange__reward';
    wrap.setAttribute('role', 'listitem');

    const thumb = document.createElement('div');
    thumb.className =
      'spark-exchange__reward-thumb' + (owned ? ' spark-exchange__reward-thumb--owned' : '');

    const img = document.createElement('img');
    img.src = encodeAssetPath(reward.imagePath);
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    thumb.appendChild(img);

    const viewBtn = document.createElement('button');
    viewBtn.type = 'button';
    viewBtn.className = 'spark-exchange__view-btn';
    viewBtn.textContent = 'Посмотреть';
    viewBtn.setAttribute('aria-label', `Посмотреть: ${reward.shopLabel}`);
    viewBtn.disabled = !owned && !canAfford;
    viewBtn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (owned) {
        openRewardGiftModal(reward);
        return;
      }
      if (canAfford) {
        openRewardGiftModal(reward, { previewOnly: true });
      }
    });

    const label = document.createElement('span');
    label.className = 'spark-exchange__reward-label';
    label.textContent = `${reward.shopLabel} (${reward.cost})`;

    wrap.append(thumb, label, viewBtn);

    if (owned) {
      const ownedHint = document.createElement('p');
      ownedHint.className = 'spark-exchange__reward-owned';
      ownedHint.textContent = 'Куплено';
      wrap.appendChild(ownedHint);
    } else if (!canAfford) {
      const need = reward.cost - balance;
      const hint = document.createElement('p');
      hint.className = 'spark-exchange__reward-hint';
      hint.textContent = `Нужно ещё ${need} ${sparkCountWord(need)}`;
      wrap.appendChild(hint);
    }

    list.appendChild(wrap);
  }

  const balanceEl = document.getElementById('spark-exchange-balance');
  if (balanceEl) {
    balanceEl.textContent = String(balance);
  }
}

/** @param {number} n */
function sparkCountWord(n) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) {
    return 'искра';
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'искры';
  }
  return 'искр';
}

function openRewardGiftUrl(imagePath) {
  const url = encodeAssetPath(imagePath);
  const fileName = imagePath.split('/').pop() || 'lampik-gift.png';
  const opened = window.open(url, '_blank', 'noopener,noreferrer');
  if (opened) {
    return;
  }
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

function isRewardOwned(rewardId) {
  return sparksState.purchases.includes(rewardId);
}

function ensureSparkExchangeVisible() {
  if (!sparkExchangeOpen) {
    return;
  }
  const root = document.getElementById('spark-exchange');
  const backdrop = root?.querySelector('.spark-exchange__backdrop');
  const panel = root?.querySelector('.spark-exchange__panel');
  if (!root || root.hidden) {
    return;
  }
  if (typeof gsap !== 'undefined') {
    gsap.killTweensOf([backdrop, panel]);
  }
  if (backdrop) {
    backdrop.style.opacity = '1';
  }
  if (panel) {
    panel.style.opacity = '1';
    panel.style.transform = 'scale(1)';
  }
}

function resetRewardGiftModalLayerStyles() {
  const root = document.getElementById('reward-gift-modal');
  const backdrop = root?.querySelector('.reward-gift-modal__backdrop');
  const panel = root?.querySelector('.reward-gift-modal__panel');
  if (backdrop) {
    backdrop.style.opacity = '';
  }
  if (panel) {
    panel.style.opacity = '';
    panel.style.transform = '';
  }
}

function syncRewardGiftModalChrome() {
  const downloadBtn = document.getElementById('reward-gift-download');
  const buyBtn = document.getElementById('reward-gift-buy');
  const hintEl = document.getElementById('reward-gift-hint');
  const payload = rewardGiftModalPayload;
  if (!downloadBtn || !buyBtn || !payload) {
    return;
  }

  const owned = isRewardOwned(payload.id);
  const preview = !owned && payload.previewOnly === true;

  downloadBtn.hidden = !owned;
  downloadBtn.textContent = 'Скачать';
  downloadBtn.disabled = false;

  buyBtn.hidden = owned || !preview;
  if (!buyBtn.hidden) {
    const affordable = sparksBalance() >= payload.cost;
    buyBtn.disabled = !affordable;
    buyBtn.textContent = `Купить за ${payload.cost} ${sparkCountWord(payload.cost)}`;
  }

  if (hintEl) {
    if (payload.justPurchased === true) {
      hintEl.textContent = 'Искры уже списаны. Можно скачать подарок или закрыть окно.';
      hintEl.hidden = false;
    } else if (preview) {
      hintEl.textContent =
        'Это только просмотр. Искры спишутся после нажатия «Купить». Можно закрыть окно и ничего не изменится.';
      hintEl.hidden = false;
    } else if (owned) {
      hintEl.textContent = 'Подарок уже твой — можно скачать.';
      hintEl.hidden = false;
    } else {
      hintEl.hidden = true;
    }
  }
}

/**
 * @param {typeof SPARK_REWARDS[number]} reward
 * @param {{ justPurchased?: boolean, previewOnly?: boolean }} [options]
 */
function openRewardGiftModal(reward, options = {}) {
  const root = document.getElementById('reward-gift-modal');
  if (root && root.parentElement !== document.body) {
    document.body.appendChild(root);
  }
  const backdrop = root?.querySelector('.reward-gift-modal__backdrop');
  const panel = root?.querySelector('.reward-gift-modal__panel');
  const titleEl = document.getElementById('reward-gift-title');
  const imgEl = document.getElementById('reward-gift-image');
  if (!root || !backdrop || !panel || !titleEl || !imgEl) {
    return;
  }

  const imageUrl = encodeAssetPath(reward.imagePath);
  const owned = isRewardOwned(reward.id);
  rewardGiftModalPayload = {
    id: reward.id,
    title: reward.title,
    imagePath: reward.imagePath,
    cost: reward.cost,
    justPurchased: options.justPurchased === true,
    previewOnly: !owned && options.previewOnly === true,
  };
  syncRewardGiftModalChrome();
  titleEl.textContent = reward.title;
  imgEl.src = imageUrl;
  imgEl.alt = reward.title;

  rewardGiftModalOpen = true;
  root.hidden = false;
  root.classList.add('reward-gift-modal--open');
  root.setAttribute('aria-hidden', 'false');

  backdrop.style.opacity = '1';
  panel.style.opacity = '1';
  panel.style.transform = 'scale(1)';

  if (typeof gsap !== 'undefined') {
    gsap.killTweensOf([backdrop, panel]);
    gsap.fromTo(backdrop, { opacity: 0.4 }, { opacity: 1, duration: 0.22, ease: 'power2.out' });
    gsap.fromTo(
      panel,
      { opacity: 0.85, scale: 0.94 },
      { opacity: 1, scale: 1, duration: 0.35, ease: 'back.out(1.4)' }
    );
  }

  window.setTimeout(() => {
    if (!rewardGiftModalOpen) {
      return;
    }
    const panelOpacity = window.getComputedStyle(panel).opacity;
    if (panelOpacity === '0' || Number(panelOpacity) < 0.05) {
      backdrop.style.opacity = '1';
      panel.style.opacity = '1';
      panel.style.transform = 'scale(1)';
    }
  }, 450);
}

function closeRewardGiftModal() {
  const root = document.getElementById('reward-gift-modal');
  const backdrop = root?.querySelector('.reward-gift-modal__backdrop');
  const panel = root?.querySelector('.reward-gift-modal__panel');
  if (!root || !rewardGiftModalOpen) {
    return;
  }

  const finish = () => {
    root.hidden = true;
    root.classList.remove('reward-gift-modal--open');
    root.setAttribute('aria-hidden', 'true');
    rewardGiftModalOpen = false;
    rewardGiftModalPayload = null;
    resetRewardGiftModalLayerStyles();
    ensureSparkExchangeVisible();
  };

  if (typeof gsap !== 'undefined' && backdrop && panel) {
    gsap.killTweensOf([backdrop, panel]);
    gsap
      .timeline({ onComplete: finish })
      .to(panel, { opacity: 0, scale: 0.92, duration: 0.2, ease: 'power2.in' })
      .to(backdrop, { opacity: 0, duration: 0.16, ease: 'power2.in' }, '-=0.08');
  } else {
    finish();
  }
}

function commitRewardPurchase(rewardId) {
  const reward = SPARK_REWARDS.find((r) => r.id === rewardId);
  if (!reward) {
    return false;
  }
  if (sparksState.purchases.includes(rewardId)) {
    return true;
  }
  const balance = sparksBalance();
  if (balance < reward.cost) {
    return false;
  }
  sparksState.spent += reward.cost;
  sparksState.purchases.push(rewardId);
  saveSparksToStorage();
  syncSparksHud();
  renderSparkExchangeRewards();
  return true;
}

function confirmRewardGiftDownload() {
  const payload = rewardGiftModalPayload;
  if (!payload?.imagePath) {
    return;
  }
  if (!isRewardOwned(payload.id)) {
    return;
  }
  openRewardGiftUrl(payload.imagePath);
}

function confirmRewardGiftPurchase() {
  const payload = rewardGiftModalPayload;
  if (!payload || isRewardOwned(payload.id)) {
    syncRewardGiftModalChrome();
    return;
  }
  if (!commitRewardPurchase(payload.id)) {
    syncRewardGiftModalChrome();
    return;
  }
  rewardGiftModalPayload = {
    ...payload,
    previewOnly: false,
    justPurchased: true,
  };
  syncRewardGiftModalChrome();
}

/**
 * @param {{ finale?: boolean }} [opts]
 */
function openSparkExchange(opts = {}) {
  sparkExchangeFinale = opts.finale === true;
  if (sparkExchangeOpen) {
    renderSparkExchangeRewards();
    syncSparkExchangeChrome();
    return;
  }
  const root = document.getElementById('spark-exchange');
  const backdrop = root?.querySelector('.spark-exchange__backdrop');
  const panel = root?.querySelector('.spark-exchange__panel');
  if (!root || !backdrop || !panel) {
    return;
  }

  sparkExchangeOpen = true;
  root.hidden = false;
  root.classList.add('spark-exchange--open');
  root.classList.toggle('spark-exchange--finale', sparkExchangeFinale);
  root.setAttribute('aria-hidden', 'false');
  syncSparkExchangeChrome();
  renderSparkExchangeRewards();

  if (typeof gsap !== 'undefined') {
    gsap.killTweensOf([backdrop, panel]);
    gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.28, ease: 'power2.out' });
    gsap.fromTo(
      panel,
      { opacity: 0, scale: 0.9 },
      { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(1.6)' }
    );
  } else {
    backdrop.style.opacity = '1';
    panel.style.opacity = '1';
    panel.style.transform = 'scale(1)';
  }

  setModalGamePause(true);
}

function syncSparkExchangeChrome() {
  const replay = document.getElementById('spark-exchange-replay');
  const backdrop = document.querySelector('#spark-exchange .spark-exchange__backdrop');
  if (replay) {
    replay.hidden = !sparkExchangeFinale;
  }
  if (backdrop) {
    if (sparkExchangeFinale) {
      backdrop.removeAttribute('data-spark-exchange-dismiss');
    } else {
      backdrop.setAttribute('data-spark-exchange-dismiss', '');
    }
  }
}

function closeSparkExchange() {
  if (sparkExchangeFinale) {
    return;
  }
  const root = document.getElementById('spark-exchange');
  const backdrop = root?.querySelector('.spark-exchange__backdrop');
  const panel = root?.querySelector('.spark-exchange__panel');
  if (!root || !sparkExchangeOpen) {
    return;
  }

  const finish = () => {
    root.hidden = true;
    root.classList.remove('spark-exchange--open');
    root.classList.remove('spark-exchange--finale');
    root.setAttribute('aria-hidden', 'true');
    sparkExchangeOpen = false;
    sparkExchangeFinale = false;
    if (!taskModalState.open) {
      setModalGamePause(false);
    }
  };

  if (typeof gsap !== 'undefined' && backdrop && panel) {
    gsap.killTweensOf([backdrop, panel]);
    gsap
      .timeline({ onComplete: finish })
      .to(panel, { opacity: 0, scale: 0.92, duration: 0.22, ease: 'power2.in' })
      .to(backdrop, { opacity: 0, duration: 0.18, ease: 'power2.in' }, '-=0.1');
  } else {
    finish();
  }
}

function bindSparkExchangeUi() {
  const hud = document.getElementById('sparks-hud');
  hud?.addEventListener('click', () => {
    if (hud.disabled) {
      return;
    }
    openSparkExchange({ finale: false });
  });

  document.querySelectorAll('[data-spark-exchange-dismiss]').forEach((el) => {
    el.addEventListener('click', () => closeSparkExchange());
  });

  document.getElementById('spark-exchange-replay')?.addEventListener('click', () => {
    const balance = sparksBalance();
    if (balance < STORY_REPLAY_SPARK_COST) {
      console.warn(
        `[sparks] для «Играть снова» нужно ${STORY_REPLAY_SPARK_COST} ${sparkCountWord(STORY_REPLAY_SPARK_COST)}, сейчас ${balance}`
      );
      return;
    }
    sparksState.spent += STORY_REPLAY_SPARK_COST;
    saveSparksToStorage();
    resetCompletedMinigamesInRun();
    window.location.reload();
  });

  document.getElementById('reward-gift-download')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    confirmRewardGiftDownload();
  });

  document.getElementById('reward-gift-buy')?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    confirmRewardGiftPurchase();
  });

  document
    .querySelector('.reward-gift-modal__panel')
    ?.addEventListener('click', (event) => event.stopPropagation());

  document.querySelectorAll('[data-reward-gift-dismiss]').forEach((el) => {
    el.addEventListener('click', () => closeRewardGiftModal());
  });
}

function onTaskModalClosed() {
  stopModalLampikMotion();
  setModalGamePause(false);
  const scene = getMainScene();
  if (scene) {
    scene.isTaskModalOpen = false;
    scene.refreshStopMarkersInteractivity();
    scene.startIdleAnimation();
  }
  taskModalState.open = false;
  taskModalState.closing = false;
}

function finalizeTaskModalClosed(awardSparkOnClose) {
  teardownTaskModalMiniGame();
  const { root, backdrop, panel } = readSparksHudEl();
  if (typeof gsap !== 'undefined') {
    gsap.killTweensOf([backdrop, panel]);
    if (backdrop) {
      gsap.set(backdrop, { opacity: 0 });
    }
    if (panel) {
      gsap.set(panel, { opacity: 0, scale: 0.92 });
    }
  }
  if (root) {
    root.hidden = true;
    root.classList.remove('task-modal--open');
    root.setAttribute('aria-hidden', 'true');
  }
  setNextButtonEnabled(false);
  stopModalLampikMotion();
  if (awardSparkOnClose && isActiveStoryMinigameId(taskModalState.minigameId)) {
    markMinigameCompleted(taskModalState.minigameId);
    awardSpark();
    const scene = getMainScene();
    const lastStop = scene && scene.isOnFinishStop?.();
    if (lastStop) {
      window.setTimeout(() => beginFinaleSequence(), 450);
    }
  }
  taskModalState.minigameId = null;
  onTaskModalClosed();
}

/**
 * @param {{ awardSpark?: boolean, requireNext?: boolean, instant?: boolean }} [opts]
 */
function closeTaskModalWithOptions(opts = {}) {
  const awardSparkOnClose = opts.awardSpark === true;
  const requireNext = opts.requireNext === true;
  const instant = opts.instant === true;

  if (!taskModalState.open || taskModalState.closing) {
    return;
  }
  if (requireNext && !taskModalState.nextEnabled) {
    return;
  }

  taskModalState.closing = true;
  stopModalLampikMotion();

  const { backdrop, panel } = readSparksHudEl();
  if (typeof gsap !== 'undefined') {
    gsap.killTweensOf([backdrop, panel]);
  }

  const scene = getMainScene();
  if (scene) {
    scene.pauseIdleAnimation();
  }

  if (instant || !backdrop || !panel || typeof gsap === 'undefined') {
    finalizeTaskModalClosed(awardSparkOnClose);
    return;
  }

  const tl = gsap.timeline({
    onComplete: () => finalizeTaskModalClosed(awardSparkOnClose),
  });

  tl.to(panel, {
    scale: 0.88,
    opacity: 0,
    duration: 0.28,
    ease: 'power2.in',
  }).to(
    backdrop,
    {
      opacity: 0,
      duration: 0.22,
      ease: 'power2.in',
    },
    '-=0.12'
  );
}

/** Успешное завершение задания — искра начисляется */
function closeTaskModal() {
  closeTaskModalWithOptions({ awardSpark: true, requireNext: true });
}

/** Временно: закрыть без искры (когда мини-игр ещё нет) */
function dismissTaskModal() {
  if (!isTaskModalDismissAllowed()) {
    console.warn('[task-modal] сброс выключен (TASK_MODAL_ALLOW_DISMISS=false в .env)');
    return;
  }
  if (!taskModalState.open || taskModalState.closing) {
    return;
  }
  closeTaskModalWithOptions({ awardSpark: false, instant: true });
}

/**
 * @param {number} stopIndex
 * @param {string | null | undefined} [minigameId] — если не передан, выбирается случайно из невыполненных
 */
function showTaskModal(stopIndex, minigameId) {
  if (typeof gsap === 'undefined') {
    console.warn('[task-modal] GSAP не загружен');
    return;
  }

  const { root, backdrop, panel } = readSparksHudEl();
  if (!root || !backdrop || !panel) {
    return;
  }

  if (taskModalState.open) {
    return;
  }

  let activeMinigameId = minigameId;
  if (activeMinigameId === undefined && stopIndex > 0) {
    activeMinigameId = pickMinigameIdForTaskStop();
  }

  taskModalState.stopIndex = stopIndex;
  taskModalState.minigameId = activeMinigameId ?? null;
  taskModalState.open = true;
  taskModalState.closing = false;
  setNextButtonEnabled(false);

  root.hidden = false;
  root.classList.add('task-modal--open');
  root.setAttribute('aria-hidden', 'false');

  gsap.killTweensOf([backdrop, panel]);
  gsap.set(backdrop, { opacity: 0 });
  gsap.set(panel, { opacity: 0, scale: 0.72 });

  const scene = getMainScene();
  if (scene) {
    scene.isTaskModalOpen = true;
    scene.pauseIdleAnimation();
    scene.refreshStopMarkersInteractivity();
  }
  setModalGamePause(true);

  gsap.to(backdrop, { opacity: 1, duration: 0.32, ease: 'power2.out' });
  gsap.to(panel, {
    opacity: 1,
    scale: 1,
    duration: 0.55,
    ease: 'back.out(1.7)',
    onComplete: () => {
      if (!isActiveStoryMinigameId(taskModalState.minigameId)) {
        startModalLampikMotion();
      } else {
        stopModalLampikMotion();
        setModalLampikMood('sad');
      }
    },
  });

  syncTaskModalDismissUi();
  mountTaskModalMiniGameById(taskModalState.minigameId);

  const picked = taskModalState.minigameId ? `, задание «${taskModalState.minigameId}»` : ', все задания уже сделаны';
  console.info(`[task-modal] открыто, остановка ${stopIndex}${picked}`);
}

/** Вызов из мини-игр, когда задание выполнено */
function enableNextButton() {
  if (!taskModalState.open || taskModalState.closing) {
    return;
  }
  setNextButtonEnabled(true);
  const { nextBtn } = readSparksHudEl();
  if (nextBtn && typeof gsap !== 'undefined') {
    gsap.fromTo(
      nextBtn,
      { scale: 1 },
      { scale: 1.04, duration: 0.2, ease: 'back.out(2)', yoyo: true, repeat: 1 }
    );
  }
}

function handleDismissControlEvent(event) {
  if (!event.target.closest?.('#task-modal-dismiss, [data-task-dismiss-control]')) {
    return;
  }
  if (!isTaskModalDismissAllowed() || !taskModalState.open || taskModalState.closing) {
    return;
  }
  event.preventDefault();
  event.stopPropagation();
  dismissTaskModal();
}

function bindTaskModalUi() {
  const root = document.getElementById('task-modal');
  if (!root || root.dataset.bound === '1') {
    return;
  }
  root.dataset.bound = '1';

  const { nextBtn, backdrop, dismissBtn } = readSparksHudEl();

  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (taskModalState.nextEnabled) {
        closeTaskModal();
      }
    });
  }

  if (dismissBtn) {
    dismissBtn.addEventListener('click', handleDismissControlEvent);
  }

  document.addEventListener('click', handleDismissControlEvent, true);

  if (backdrop) {
    backdrop.addEventListener('click', (event) => {
      if (event.target !== backdrop) {
        return;
      }
      if (!isTaskModalDismissAllowed() || !taskModalState.open || taskModalState.closing) {
        return;
      }
      dismissTaskModal();
    });
  }

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') {
      return;
    }
    if (!taskModalState.open || taskModalState.closing) {
      return;
    }
    if (!isTaskModalDismissAllowed()) {
      return;
    }
    event.preventDefault();
    dismissTaskModal();
  });

  syncTaskModalDismissUi();
}

/** @param {number} stopIndex */
function onStopReached(stopIndex) {
  const scene = getMainScene();
  const waypoint = scene?.getWaypoint?.(stopIndex);
  const label = waypoint?.id ?? stopIndex;
  console.log(`Прибыл на остановку ${label} (${stopIndex})`);

  if (waypoint?.id === 'finish') {
    beginFinaleSequence();
    return;
  }

  if (!waypoint?.task) {
    return;
  }

  const minigameId = pickMinigameIdForTaskStop();
  showTaskModal(stopIndex, minigameId);
}

window.showTaskModal = showTaskModal;
window.enableNextButton = enableNextButton;
window.closeTaskModal = closeTaskModal;
window.dismissTaskModal = dismissTaskModal;
/** @deprecated используй dismissTaskModal / closeTaskModal */
window.hideTaskModal = closeTaskModalWithOptions;

// -----------------------------------------------------------------------------
// Мини-игры в модалке (случайный выбор на остановках)
// -----------------------------------------------------------------------------

/**
 * @param {HTMLElement | null} particles
 * @param {HTMLElement} stage
 * @param {number} originXFactor
 * @param {number} originYFactor
 */
function burstMinigameSparkParticles(particles, stage, originXFactor = 0.38, originYFactor = 0.42) {
  if (!particles || typeof gsap === 'undefined') {
    return;
  }
  const originX = stage.offsetWidth * originXFactor;
  const originY = stage.offsetHeight * originYFactor;
  for (let i = 0; i < 14; i += 1) {
    const spark = document.createElement('span');
    spark.className = 'minigame-burst-spark';
    spark.style.left = `${originX}px`;
    spark.style.top = `${originY}px`;
    particles.appendChild(spark);
    const angle = (Math.PI * 2 * i) / 14 + Math.random() * 0.4;
    const dist = 40 + Math.random() * 70;
    gsap.fromTo(
      spark,
      { x: 0, y: 0, opacity: 1, scale: 0.4, rotation: 45 },
      {
        x: Math.cos(angle) * dist,
        y: Math.sin(angle) * dist - 20,
        opacity: 0,
        scale: 1.1 + Math.random() * 0.35,
        rotation: 45 + Math.random() * 180 - 90,
        duration: 0.65 + Math.random() * 0.45,
        ease: 'power2.out',
        onComplete: () => spark.remove(),
      }
    );
  }
}

let activeMiniGameTeardown = null;

function teardownTaskModalMiniGame() {
  if (typeof activeMiniGameTeardown === 'function') {
    activeMiniGameTeardown();
    activeMiniGameTeardown = null;
  }
  clearStoryTaskModalLayout();
  const content = document.getElementById('task-modal-content');
  if (content) {
    content.innerHTML = '';
    content.className = 'task-modal__content';
  }
  const titleEl = document.getElementById('task-modal-title');
  if (titleEl) {
    titleEl.textContent = 'Задание';
  }
}

/**
 * @param {HTMLElement} container
 * @returns {() => void}
 */
function mountKettleUnplugTask(container) {
  container.innerHTML = `
    <div class="kettle-task" id="kettle-task-root">
      <div class="kettle-task__stage" id="kettle-stage">
        <p class="kettle-task__bubble" id="kettle-thought-bubble" role="note">
          <span class="kettle-task__bubble-who">Лампик говорит:</span>
          <span class="kettle-task__bubble-text">Чайник включён! Потяни вилку влево ↤</span>
        </p>
        <svg class="kettle-task__wire" aria-hidden="true">
          <path id="kettle-wire-path" d="M0 0 L0 0"></path>
        </svg>
        <div class="kettle-task__kettle" id="kettle-unit" aria-hidden="true">
          <svg class="kettle-task__kettle-svg" viewBox="0 0 132 108" aria-hidden="true">
            <defs>
              <linearGradient id="kettleBodyHot" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ff9a8a" />
                <stop offset="45%" stop-color="#f04a3f" />
                <stop offset="100%" stop-color="#b82e28" />
              </linearGradient>
              <linearGradient id="kettleBodyOff" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#d2d7df" />
                <stop offset="100%" stop-color="#7a8491" />
              </linearGradient>
              <linearGradient id="kettleMetal" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#f4f5f8" />
                <stop offset="100%" stop-color="#a8adb8" />
              </linearGradient>
              <linearGradient id="kettleWindow" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stop-color="#9ed8ff" />
                <stop offset="100%" stop-color="#5eb8f0" />
              </linearGradient>
              <radialGradient id="kettleGlow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stop-color="#ffe08a" stop-opacity="0.55" />
                <stop offset="100%" stop-color="#ffe08a" stop-opacity="0" />
              </radialGradient>
            </defs>
            <ellipse class="kettle-task__heat-glow" cx="68" cy="58" rx="52" ry="40" fill="url(#kettleGlow)" />
            <ellipse cx="66" cy="96" rx="44" ry="7" fill="rgba(40, 30, 50, 0.12)" />
            <path class="kettle-task__body-fill" d="M38 38 Q38 28 50 26 L78 26 Q92 26 94 38 L98 72 Q98 84 84 88 L48 88 Q34 84 34 72 Z" fill="url(#kettleBodyHot)" />
            <path d="M38 38 Q38 28 50 26 L78 26 Q92 26 94 38 L98 72 Q98 84 84 88 L48 88 Q34 84 34 72 Z" fill="none" stroke="rgba(255,255,255,0.35)" stroke-width="1.5" />
            <rect x="54" y="46" width="22" height="26" rx="5" fill="url(#kettleWindow)" opacity="0.9" />
            <rect x="56" y="48" width="18" height="22" rx="4" fill="rgba(255,255,255,0.35)" />
            <path class="kettle-task__spout-fill" d="M37 50.5 Q27 49.2 20 45 Q13 40.5 12 36 Q11.5 32.5 15.5 33.5 L31.5 43.5 Q35.5 46.5 37 50.5 Z" fill="url(#kettleBodyHot)" />
            <path d="M37 50.5 Q27 49.2 20 45 Q13 40.5 12 36 Q11.5 32.5 15.5 33.5 L31.5 43.5 Q35.5 46.5 37 50.5 Z" stroke="rgba(0,0,0,0.08)" fill="none" stroke-width="0.8" />
            <path class="kettle-task__handle-stroke" d="M98 44 Q118 44 120 58 Q122 72 102 74" fill="none" stroke="#c43830" stroke-width="7" stroke-linecap="round" />
            <path d="M98 44 Q118 44 120 58 Q122 72 102 74" fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="2" stroke-linecap="round" />
            <ellipse cx="66" cy="28" rx="26" ry="7" fill="url(#kettleMetal)" />
            <rect x="48" y="22" width="36" height="9" rx="4" fill="url(#kettleMetal)" />
            <circle cx="66" cy="18" r="5.5" fill="#e8eaef" stroke="#a8adb8" stroke-width="1.5" />
            <rect x="44" y="82" width="44" height="9" rx="3" fill="url(#kettleMetal)" />
            <circle class="kettle-task__power-led" cx="88" cy="86" r="3.2" fill="#7dffb0" />
            <text class="kettle-task__scale" x="65" y="66" text-anchor="middle" font-size="7" font-family="Nunito,sans-serif" font-weight="800" fill="rgba(255,255,255,0.85)">ON</text>
          </svg>
          <div class="kettle-task__steam" id="kettle-steam" aria-hidden="true"></div>
          <div class="kettle-task__exhale" id="kettle-exhale" aria-hidden="true"></div>
        </div>
        <div class="kettle-task__success-zone" id="kettle-success-zone" aria-hidden="true"></div>
        <div class="kettle-task__socket" aria-hidden="true">
          <svg class="kettle-task__socket-svg" viewBox="0 0 80 88" aria-hidden="true">
            <defs>
              <linearGradient id="socketPlate" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ffffff" />
                <stop offset="55%" stop-color="#eceef4" />
                <stop offset="100%" stop-color="#c9cdd8" />
              </linearGradient>
              <linearGradient id="socketRecess" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#8e95a3" />
                <stop offset="100%" stop-color="#5c6370" />
              </linearGradient>
            </defs>
            <rect x="4" y="6" width="72" height="76" rx="14" fill="url(#socketPlate)" stroke="#b4b9c6" stroke-width="2.5" />
            <rect x="4" y="6" width="72" height="76" rx="14" fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="2" />
            <circle cx="18" cy="18" r="3.5" fill="#d8dbe3" stroke="#a8adb8" stroke-width="1" />
            <circle cx="62" cy="18" r="3.5" fill="#d8dbe3" stroke="#a8adb8" stroke-width="1" />
            <path d="M17 18 L19 18 M61 18 L63 18" stroke="#9aa0ac" stroke-width="1.2" stroke-linecap="round" />
            <rect x="16" y="28" width="48" height="46" rx="10" fill="url(#socketRecess)" />
            <rect x="20" y="32" width="40" height="38" rx="8" fill="#3a404c" />
            <rect x="28" y="38" width="10" height="22" rx="3" fill="#1a1d24" />
            <rect x="42" y="38" width="10" height="22" rx="3" fill="#1a1d24" />
            <circle cx="33" cy="66" r="4" fill="#2a2f38" stroke="#505868" stroke-width="1" />
            <circle cx="47" cy="66" r="4" fill="#2a2f38" stroke="#505868" stroke-width="1" />
            <ellipse cx="40" cy="74" rx="22" ry="4" fill="rgba(0,0,0,0.15)" />
          </svg>
        </div>
        <div class="kettle-task__plug" id="kettle-plug" role="slider" aria-label="Вилка — потяни влево, чтобы выключить чайник" tabindex="0">
          <div class="kettle-task__plug-pins" aria-hidden="true">
            <span class="kettle-task__plug-pin kettle-task__plug-pin--left"></span>
            <span class="kettle-task__plug-pin kettle-task__plug-pin--right"></span>
            <span class="kettle-task__plug-pin kettle-task__plug-pin--earth"></span>
          </div>
          <div class="kettle-task__plug-body">
            <span class="kettle-task__plug-grip" aria-hidden="true"></span>
          </div>
          <div class="kettle-task__plug-cord-nub" aria-hidden="true"></div>
        </div>
        <div class="kettle-task__particles" id="kettle-particles" aria-hidden="true"></div>
      </div>
    </div>
  `;

  const root = container.querySelector('#kettle-task-root');
  const stage = container.querySelector('#kettle-stage');
  const plug = container.querySelector('#kettle-plug');
  const steamBox = container.querySelector('#kettle-steam');
  const wirePath = container.querySelector('#kettle-wire-path');
  const kettleUnit = container.querySelector('#kettle-unit');
  const successZone = container.querySelector('#kettle-success-zone');
  const particles = container.querySelector('#kettle-particles');
  const wireSvg = container.querySelector('.kettle-task__wire');
  const thoughtBubble = container.querySelector('#kettle-thought-bubble');
  const exhaleEl = container.querySelector('#kettle-exhale');

  if (!root || !stage || !plug || !steamBox || !wirePath || typeof gsap === 'undefined') {
    return () => {};
  }

  let kettleShakeTween = null;
  let thoughtPulseTween = null;

  if (thoughtBubble) {
    gsap.set(thoughtBubble, { scale: 0.85, opacity: 0 });
    gsap.to(thoughtBubble, {
      scale: 1,
      opacity: 1,
      duration: 0.45,
      ease: 'back.out(2.5)',
      delay: 0.15,
      onComplete: () => {
        thoughtPulseTween = gsap.to(thoughtBubble, {
          scale: 1.02,
          duration: 1.1,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
          transformOrigin: '50% 50%',
        });
      },
    });
  }

  function startKettleShake() {
    if (!kettleUnit) {
      return;
    }
    gsap.set(kettleUnit, { transformOrigin: '42% 92%' });
    kettleShakeTween = gsap.to(kettleUnit, {
      x: 1.2,
      rotation: 0.65,
      duration: 0.045,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  function stopKettleShake() {
    if (kettleShakeTween) {
      kettleShakeTween.kill();
      kettleShakeTween = null;
    }
    if (kettleUnit) {
      gsap.to(kettleUnit, { x: 0, rotation: 0, duration: 0.2, ease: 'power2.out' });
    }
  }

  function playKettleExhale() {
    if (!exhaleEl) {
      return;
    }
    gsap.killTweensOf(exhaleEl);
    gsap.set(exhaleEl, { opacity: 0, scale: 0.35, x: 0, y: 0 });
    gsap
      .timeline()
      .to(exhaleEl, {
        opacity: 0.62,
        scale: 1.15,
        y: -14,
        duration: 0.4,
        ease: 'power2.out',
      })
      .to(exhaleEl, {
        opacity: 0,
        scale: 1.45,
        y: -30,
        duration: 0.55,
        ease: 'power1.in',
      });
  }

  function dismissThoughtBubble() {
    if (thoughtPulseTween) {
      thoughtPulseTween.kill();
      thoughtPulseTween = null;
    }
    if (thoughtBubble) {
      thoughtBubble.textContent = 'Молодец! Чайник отдыхает.';
      thoughtBubble.classList.add('kettle-task__bubble--done');
      gsap.to(thoughtBubble, { scale: 1, opacity: 1, duration: 0.35, ease: 'power2.out' });
    }
  }

  startKettleShake();

  const steamCount = 6;
  for (let i = 0; i < steamCount; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'kettle-task__steam-dot';
    dot.style.left = `${22 + (i - (steamCount - 1) / 2) * 16}%`;
    steamBox.appendChild(dot);
  }

  const steamDots = [...steamBox.querySelectorAll('.kettle-task__steam-dot')];

  function startSteam() {
    steamDots.forEach((dot, i) => {
      gsap.set(dot, { y: 0, opacity: 0, scale: 0.55 });
      gsap.timeline({ repeat: -1, delay: i * 0.18 }).to(dot, {
        y: -54,
        x: (i - 2.5) * 3,
        opacity: 0.82,
        scale: 1.12,
        duration: 1.25,
        ease: 'sine.out',
      }).to(dot, {
        opacity: 0,
        duration: 0.2,
        ease: 'none',
      }).set(dot, { y: 0, opacity: 0, scale: 0.55 });
    });
  }

  function stopSteam() {
    gsap.killTweensOf(steamDots);
    gsap.to(steamDots, { opacity: 0, duration: 0.35, ease: 'power1.out' });
  }

  startSteam();

  const homeX = 0;
  let taskComplete = false;
  let plugDraggable = null;

  function syncWire() {
    if (!wireSvg || !kettleUnit || !plug) {
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const kettleRect = kettleUnit.getBoundingClientRect();
    const plugRect = plug.getBoundingClientRect();

    const x1 = kettleRect.right - stageRect.left - 6;
    const y1 = kettleRect.bottom - stageRect.top - 14;
    const x2 = plugRect.left - stageRect.left + 4;
    const y2 = plugRect.top - stageRect.top + plugRect.height * 0.55;
    const sag = Math.min(18, Math.abs(x2 - x1) * 0.08);

    wireSvg.setAttribute('viewBox', `0 0 ${Math.round(stageRect.width)} ${Math.round(stageRect.height)}`);
    wirePath.setAttribute(
      'd',
      `M ${x1} ${y1} Q ${(x1 + x2) * 0.5} ${y1 + sag} ${x2} ${y2}`
    );
  }

  function burstSparkParticles() {
    burstMinigameSparkParticles(particles, stage, 0.38, 0.42);
  }

  function plugInSuccessZone() {
    if (!successZone || !plug) {
      return false;
    }
    const zone = successZone.getBoundingClientRect();
    const pr = plug.getBoundingClientRect();
    const plugCenterX = pr.left + pr.width * 0.45;
    return plugCenterX >= zone.left && plugCenterX <= zone.right;
  }

  function onTaskSuccess() {
    if (taskComplete) {
      return;
    }
    taskComplete = true;
    stopSteam();
    stopKettleShake();
    root.classList.add('kettle-task--off');
    if (plugDraggable) {
      plugDraggable.disable();
    }
    playKettleUnplugClickSound();
    playMiniGameSuccessPlop();
    playKettleExhale();
    dismissThoughtBubble();
    celebrateModalLampikTaskComplete();
    burstSparkParticles();
    enableNextButton();
  }

  function snapPlugHome() {
    gsap.to(plug, {
      x: homeX,
      duration: 0.85,
      ease: 'elastic.out(1, 0.55)',
      onUpdate: syncWire,
    });
  }

  gsap.set(plug, { x: homeX });

  const layoutWire = () => {
    syncWire();
  };

  requestAnimationFrame(layoutWire);
  window.addEventListener('resize', layoutWire);

  if (typeof Draggable !== 'undefined') {
    plugDraggable = Draggable.create(plug, {
      type: 'x',
      bounds: { minX: -96, maxX: homeX },
      inertia: false,
      cursor: 'grab',
      activeCursor: 'grabbing',
      allowEventDefault: true,
      onDragStart: function onKettleDragStart() {
        if (taskComplete) {
          this.endDrag();
          return;
        }
        ensureMiniGameAudioContext();
      },
      onDrag: syncWire,
      onDragEnd: () => {
        if (taskComplete) {
          return;
        }
        if (plugInSuccessZone()) {
          onTaskSuccess();
          return;
        }
        snapPlugHome();
      },
    })[0];
  } else {
    console.warn('[kettle-task] GSAP Draggable не загружен');
  }

  return () => {
    window.removeEventListener('resize', layoutWire);
    stopKettleShake();
    if (thoughtPulseTween) {
      thoughtPulseTween.kill();
      thoughtPulseTween = null;
    }
    if (plugDraggable) {
      plugDraggable.kill();
      plugDraggable = null;
    }
    const killTargets = [plug, ...steamDots];
    if (kettleUnit) {
      killTargets.push(kettleUnit);
    }
    if (thoughtBubble) {
      killTargets.push(thoughtBubble);
    }
    if (exhaleEl) {
      killTargets.push(exhaleEl);
    }
    gsap.killTweensOf(killTargets);
    if (particles) {
      particles.querySelectorAll('.minigame-burst-spark').forEach((el) => el.remove());
    }
  };
}

/**
 * @param {HTMLElement} container
 * @returns {() => void}
 */
function mountTapCloseTask(container) {
  container.innerHTML = `
    <div class="tap-task" id="tap-task-root">
      <div class="tap-task__stage" id="tap-stage">
        <div class="tap-task__bubble" id="tap-thought-bubble" role="note">
          <span class="tap-task__bubble-icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
              <path fill="#4fb8f0" d="M16 4c-5.2 0-9.5 4-9.5 9.2 0 3.8 2.2 7.1 5.4 8.7l-.3 6.3a1.2 1.2 0 0 0 1.8 1l5.6-3.2c5.8-.4 10.3-4.9 10.3-10.8C29.3 8 23.3 4 16 4z"/>
              <path stroke="#e85d5d" stroke-width="2.8" stroke-linecap="round" d="M9 9l14 14M23 9L9 23"/>
            </svg>
          </span>
          <span class="tap-task__bubble-copy">
            <span class="tap-task__bubble-who">Лампик думает:</span>
            <span class="tap-task__bubble-text">Вода течёт зря! Покрути красный вентиль по стрелке ↻</span>
          </span>
        </div>
        <div class="tap-task__playfield" id="tap-playfield">
        <div class="tap-task__sink-unit" id="tap-sink-unit" aria-hidden="true">
          <div class="tap-task__shake-layer" id="tap-shake-layer">
          <svg class="tap-task__sink-svg" viewBox="0 0 280 196" aria-hidden="true">
            <defs>
              <filter id="tapBlurShadow" x="-8%" y="-80%" width="116%" height="260%">
                <feGaussianBlur stdDeviation="3.5" />
              </filter>
            </defs>
            <rect
              class="tap-task__sink-shadow"
              x="42"
              y="182"
              width="196"
              height="10"
              rx="5"
              fill="#000000"
              opacity="0.26"
              filter="url(#tapBlurShadow)"
            />
            <rect class="tap-task__counter" x="28" y="74" width="224" height="18" rx="4" fill="#d2dae3" />
            <rect x="34" y="77" width="52" height="5" rx="2" fill="#ffffff" opacity="0.42" />
            <rect class="tap-task__sink-bowl" x="46" y="92" width="188" height="92" rx="46" ry="46" fill="#ffffff" />
            <rect x="54" y="98" width="36" height="7" rx="2" fill="#ffffff" opacity="0.55" />
            <rect x="58" y="100" width="164" height="8" rx="4" fill="#eef2f7" opacity="0.9" />
            <ellipse class="tap-task__puddle" cx="140" cy="156" rx="38" ry="8" fill="#8ed4f8" opacity="0.45" />
            <g class="tap-task__drain">
              <circle cx="140" cy="152" r="10" fill="#b8c5d4" />
              <circle cx="140" cy="152" r="5" fill="#95a6b8" />
              <circle cx="140" cy="152" r="2" fill="#7a8c9e" />
            </g>
            <g class="tap-task__faucet">
              <rect
                class="tap-task__faucet-shadow"
                x="118"
                y="90"
                width="50"
                height="7"
                rx="3.5"
                fill="#000000"
                opacity="0.24"
                filter="url(#tapBlurShadow)"
              />
              <rect x="130" y="28" width="20" height="50" rx="3" fill="#b8c2d0" />
              <rect x="134" y="34" width="6" height="38" rx="2" fill="#d8dee8" opacity="0.85" />
              <rect x="132" y="32" width="4" height="18" rx="1.5" fill="#ffffff" opacity="0.48" />
              <rect x="82" y="52" width="50" height="12" rx="3" fill="#b8c2d0" />
              <rect x="84" y="54" width="18" height="4" rx="1.5" fill="#ffffff" opacity="0.4" />
              <rect x="130" y="52" width="38" height="10" rx="2" fill="#b8c2d0" />
              <rect x="162" y="52" width="10" height="28" rx="2" fill="#aeb9c8" />
              <rect x="164" y="54" width="4" height="10" rx="1.5" fill="#ffffff" opacity="0.42" />
              <rect x="164" y="78" width="6" height="4" rx="1" fill="#9eabb9" />
            </g>
            <rect
              class="tap-task__stream"
              x="163"
              y="80"
              width="8"
              height="22"
              rx="3"
              fill="#5bc8f5"
              opacity="0.92"
            />
          </svg>
          <div class="tap-task__drops" id="tap-drops" aria-hidden="true"></div>
          <div class="tap-task__valve" id="tap-valve">
            <span class="visually-hidden" id="tap-valve-hint">Покрути красный вентиль по дуге со стрелкой, чтобы закрыть кран</span>
            <svg class="tap-task__valve-hint-arc" viewBox="0 0 88 88" aria-hidden="true">
              <path
                class="tap-task__valve-hint-path"
                d="M 62 26 A 22 22 0 0 1 62 62"
                fill="none"
                stroke="#3d9ae8"
                stroke-width="3.5"
                stroke-linecap="round"
              />
              <path
                class="tap-task__valve-hint-head"
                d="M 58 58 L 66 62 L 62 70"
                fill="none"
                stroke="#3d9ae8"
                stroke-width="3.5"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <div
              class="tap-task__valve-knob"
              id="tap-valve-knob"
              role="slider"
              aria-valuemin="0"
              aria-valuemax="90"
              aria-valuenow="0"
              aria-label="Красный вентиль крана"
              aria-describedby="tap-valve-hint"
              tabindex="0"
            >
              <span class="tap-task__valve-knob-bar tap-task__valve-knob-bar--h" aria-hidden="true"></span>
              <span class="tap-task__valve-knob-bar tap-task__valve-knob-bar--v" aria-hidden="true"></span>
            </div>
          </div>
          </div>
        </div>
        <div class="tap-task__particles" id="tap-particles" aria-hidden="true"></div>
        </div>
      </div>
    </div>
  `;

  const root = container.querySelector('#tap-task-root');
  const stage = container.querySelector('#tap-stage');
  const sinkUnit = container.querySelector('#tap-sink-unit');
  const shakeLayer = container.querySelector('#tap-shake-layer');
  const dropsBox = container.querySelector('#tap-drops');
  const valve = container.querySelector('#tap-valve');
  const valveKnob = container.querySelector('#tap-valve-knob');
  const thoughtBubble = container.querySelector('#tap-thought-bubble');
  const particles = container.querySelector('#tap-particles');

  if (!root || !stage || !sinkUnit || !dropsBox || !valveKnob || typeof gsap === 'undefined') {
    return () => {};
  }

  let faucetShakeTween = null;
  let thoughtPulseTween = null;
  let taskComplete = false;
  const homeAngle = 0;
  const closeAngle = 90;
  const dropTweens = [];
  let tapDripTimer = null;
  let valveFlashTween = null;
  let lastValveClickAngle = homeAngle;

  if (thoughtBubble) {
    gsap.set(thoughtBubble, { scale: 0.85, opacity: 0 });
    gsap.to(thoughtBubble, {
      scale: 1,
      opacity: 1,
      duration: 0.45,
      ease: 'back.out(2.5)',
      delay: 0.12,
      onComplete: () => {
        thoughtPulseTween = gsap.to(thoughtBubble, {
          scale: 1.02,
          duration: 1.1,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
          transformOrigin: '50% 50%',
        });
      },
    });
  }

  function startFaucetShake() {
    if (!shakeLayer) {
      return;
    }
    gsap.set(shakeLayer, { transformOrigin: '50% 38%' });
    faucetShakeTween = gsap.to(shakeLayer, {
      x: 0.7,
      rotation: 0.3,
      duration: 0.05,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  function stopFaucetShake() {
    if (faucetShakeTween) {
      faucetShakeTween.kill();
      faucetShakeTween = null;
    }
    if (shakeLayer) {
      gsap.to(shakeLayer, { x: 0, rotation: 0, duration: 0.22, ease: 'power2.out' });
    }
  }

  const dropCount = 7;
  const dropEls = [];
  for (let i = 0; i < dropCount; i += 1) {
    const drop = document.createElement('span');
    drop.className = 'tap-task__drop';
    drop.style.left = `${46 + (i % 3) * 7}%`;
    dropsBox.appendChild(drop);
    dropEls.push(drop);
  }

  function spawnDropLoop(dot, delay) {
    gsap.set(dot, { y: 0, opacity: 0, scale: 0.5 });
    const tween = gsap
      .timeline({ repeat: -1, delay })
      .to(dot, {
        opacity: 0.95,
        scale: 1,
        duration: 0.08,
        ease: 'power1.out',
      })
      .to(dot, {
        y: 50,
        opacity: 0,
        scale: 0.48,
        duration: 0.4 + Math.random() * 0.14,
        ease: 'power3.in',
      })
      .set(dot, { y: 0, opacity: 0, scale: 0.5 });
    dropTweens.push(tween);
  }

  function stopTapDripSounds() {
    if (tapDripTimer) {
      clearTimeout(tapDripTimer);
      tapDripTimer = null;
    }
  }

  function scheduleTapDripSound() {
    stopTapDripSounds();
    if (taskComplete) {
      return;
    }
    playTapDripSound();
    tapDripTimer = window.setTimeout(scheduleTapDripSound, 360 + Math.random() * 300);
  }

  function startTapDripSounds() {
    ensureMiniGameAudioContext();
    scheduleTapDripSound();
  }

  dropEls.forEach((dot, i) => spawnDropLoop(dot, i * 0.14));
  startFaucetShake();
  startTapDripSounds();

  function stopDrops() {
    stopTapDripSounds();
    dropTweens.forEach((t) => t.kill());
    dropTweens.length = 0;
    gsap.to(dropEls, { opacity: 0, duration: 0.3, ease: 'power1.out' });
  }

  function flashValveKnob() {
    if (!valveKnob || typeof gsap === 'undefined') {
      return;
    }
    if (valveFlashTween) {
      valveFlashTween.kill();
    }
    valveFlashTween = gsap.fromTo(
      valveKnob,
      { filter: 'brightness(1.42)' },
      { filter: 'brightness(1)', duration: 0.55, ease: 'power2.out' }
    );
  }

  function maybeValveClickFeedback(angle) {
    if (Math.abs(angle - lastValveClickAngle) < 11) {
      return;
    }
    lastValveClickAngle = angle;
    flashValveKnob();
    playTapValveClickSound();
  }

  function valveProgress(angle) {
    return gsap.utils.clamp(0, 1, angle / closeAngle);
  }

  function readValveAngle() {
    const raw = gsap.getProperty(valveKnob, 'rotation');
    return gsap.utils.clamp(homeAngle, closeAngle, typeof raw === 'number' ? raw : homeAngle);
  }

  function syncValveVisual(angle) {
    const clamped = gsap.utils.clamp(homeAngle, closeAngle, angle);
    gsap.set(valveKnob, { rotation: clamped, transformOrigin: '50% 50%' });
    const t = valveProgress(clamped);
    valve?.classList.toggle('tap-task__valve--turning', t > 0.08);
    if (t > 0.06) {
      valve?.classList.remove('tap-task__valve--hint');
    }
    valveKnob?.setAttribute('aria-valuenow', String(Math.round(clamped)));
  }

  function valveIsClosed(angle) {
    return angle >= closeAngle - 6;
  }

  function dismissThoughtBubble() {
    if (thoughtPulseTween) {
      thoughtPulseTween.kill();
      thoughtPulseTween = null;
    }
  }

  function showSuccessBubble() {
    if (!thoughtBubble) {
      return;
    }
    const copy = thoughtBubble.querySelector('.tap-task__bubble-copy');
    const icon = thoughtBubble.querySelector('.tap-task__bubble-icon');
    if (icon) {
      icon.innerHTML = `
        <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill="#dff9ec" stroke="#6ee7a8" stroke-width="2"/>
          <path fill="none" stroke="#2fb86f" stroke-width="2.5" stroke-linecap="round" d="M10 16l4 4 8-9"/>
        </svg>`;
    }
    if (copy) {
      copy.innerHTML =
        '<span class="tap-task__bubble-who">Лампик радуется:</span><span class="tap-task__bubble-text">Молодец! Вода не течёт зря.</span>';
    }
    thoughtBubble.classList.add('tap-task__bubble--done');
    gsap.to(thoughtBubble, { scale: 1, opacity: 1, duration: 0.35, ease: 'power2.out' });
  }

  function onTaskSuccess() {
    if (taskComplete) {
      return;
    }
    taskComplete = true;
    stopDrops();
    stopFaucetShake();
    root.classList.add('tap-task--closed');
    if (valveDraggable) {
      valveDraggable.disable();
    }
    valveKnob?.setAttribute('aria-disabled', 'true');
    playMiniGameSuccessPlop();
    dismissThoughtBubble();
    showSuccessBubble();
    celebrateModalLampikTaskComplete();
    burstMinigameSparkParticles(particles, stage, 0.55, 0.38);
    enableNextButton();
  }

  function snapValveHome() {
    gsap.to(valveKnob, {
      rotation: homeAngle,
      duration: 0.9,
      ease: 'elastic.out(1, 0.55)',
      onUpdate: () => syncValveVisual(readValveAngle()),
    });
  }

  gsap.set(valveKnob, { rotation: homeAngle, transformOrigin: '50% 50%' });
  syncValveVisual(homeAngle);
  valve?.classList.add('tap-task__valve--hint');

  let valveDraggable = null;
  if (typeof Draggable !== 'undefined') {
    valveDraggable = Draggable.create(valveKnob, {
      type: 'rotation',
      inertia: false,
      dragClickables: true,
      cursor: 'grab',
      activeCursor: 'grabbing',
      allowEventDefault: true,
      zIndexBoost: true,
      liveSnap: function liveSnapValveRotation(endValue) {
        return gsap.utils.clamp(homeAngle, closeAngle, endValue);
      },
      onDragStart: function onValveDragStart() {
        if (taskComplete) {
          this.endDrag();
          return;
        }
        ensureMiniGameAudioContext();
        valve?.classList.remove('tap-task__valve--hint');
        lastValveClickAngle = readValveAngle();
      },
      onDrag: function onValveDrag() {
        const angle = readValveAngle();
        syncValveVisual(angle);
        maybeValveClickFeedback(angle);
      },
      onDragEnd: function onValveDragEnd() {
        if (taskComplete) {
          return;
        }
        const draggedAngle = readValveAngle();
        if (valveIsClosed(draggedAngle)) {
          gsap.set(valveKnob, { rotation: closeAngle });
          syncValveVisual(closeAngle);
          onTaskSuccess();
          return;
        }
        snapValveHome();
      },
    })[0];
  } else {
    console.warn('[tap-task] GSAP Draggable не загружен');
  }

  return () => {
    stopFaucetShake();
    stopDrops();
    if (valveFlashTween) {
      valveFlashTween.kill();
      valveFlashTween = null;
    }
    if (thoughtPulseTween) {
      thoughtPulseTween.kill();
      thoughtPulseTween = null;
    }
    if (valveDraggable) {
      valveDraggable.kill();
      valveDraggable = null;
    }
    const killTargets = [shakeLayer, valveKnob, thoughtBubble, ...dropEls];
    gsap.killTweensOf(killTargets);
    if (valveKnob) {
      gsap.set(valveKnob, { clearProps: 'filter' });
    }
    particles?.querySelectorAll('.minigame-burst-spark').forEach((el) => el.remove());
  };
}

/**
 * @param {HTMLElement} container
 * @returns {() => void}
 */
function mountLightSwitchTask(container) {
  container.innerHTML = `
    <div class="light-task" id="light-task-root">
      <div class="light-task__stage" id="light-stage">
        <div class="light-task__bubble" id="light-thought-bubble" role="note">
          <span class="light-task__bubble-icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
              <circle cx="16" cy="14" r="9" fill="#ffe082" stroke="#f5b942" stroke-width="1.5"/>
              <path fill="#5c4a2a" d="M14 22h4v2h-4z"/>
              <path stroke="#e85d5d" stroke-width="2.6" stroke-linecap="round" d="M9 8l14 14M23 8L9 22"/>
            </svg>
          </span>
          <span class="light-task__bubble-copy">
            <span class="light-task__bubble-who">Лампик думает:</span>
            <span class="light-task__bubble-text">Свет горит зря! Опусти кнопку выключателя по стрелке ↓</span>
          </span>
        </div>
        <div class="light-task__playfield" id="light-playfield">
          <svg class="light-task__room-svg" viewBox="0 0 280 196" aria-hidden="true">
            <defs>
              <linearGradient id="lightWindowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#c8e8ff" />
                <stop offset="55%" stop-color="#a8d4f8" />
                <stop offset="100%" stop-color="#8fc4ea" />
              </linearGradient>
              <linearGradient id="lightFloorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#e0d0b8" />
                <stop offset="100%" stop-color="#c4b092" />
              </linearGradient>
              <filter id="lightSoftShadow" x="-10%" y="-20%" width="120%" height="140%">
                <feGaussianBlur stdDeviation="2.8" />
              </filter>
            </defs>
            <rect class="light-task__room-sky" x="0" y="0" width="280" height="196" fill="#d8e8f4" />
            <path class="light-task__wall-left" d="M0 0 L22 20 L22 168 L0 196 Z" fill="#e5dcc8" />
            <path class="light-task__floor" d="M22 168 L258 168 L280 196 L0 196 Z" fill="url(#lightFloorGrad)" />
            <line class="light-task__floor-board" x1="40" y1="172" x2="268" y2="190" stroke="#b8a48a" stroke-width="1" opacity="0.35" />
            <line class="light-task__floor-board" x1="28" y1="178" x2="250" y2="194" stroke="#b8a48a" stroke-width="1" opacity="0.28" />
            <rect class="light-task__wall" x="22" y="20" width="236" height="148" fill="#efe6d4" />
            <rect class="light-task__ceiling" x="22" y="20" width="236" height="10" rx="2" fill="#f8f2e8" />
            <rect x="28" y="22" width="56" height="5" rx="2" fill="#ffffff" opacity="0.42" />
            <line x1="22" y1="20" x2="22" y2="168" stroke="#d8cfc0" stroke-width="2" />
            <rect class="light-task__baseboard" x="22" y="158" width="236" height="10" rx="2" fill="#f5f0e8" stroke="#e0d6c4" stroke-width="1" />
            <g class="light-task__window-unit">
              <rect class="light-task__window-frame" x="96" y="48" width="88" height="68" rx="5" fill="#faf6ef" stroke="#d0c4b0" stroke-width="2.5" />
              <rect class="light-task__window-glass" x="102" y="54" width="76" height="56" rx="3" fill="url(#lightWindowGrad)" />
              <line x1="140" y1="54" x2="140" y2="110" stroke="#e8e0d0" stroke-width="2" />
              <line x1="102" y1="82" x2="178" y2="82" stroke="#e8e0d0" stroke-width="2" />
              <rect x="132" y="62" width="16" height="10" rx="2" fill="#ffffff" opacity="0.35" />
            </g>
            <g class="light-task__picture">
              <rect x="46" y="66" width="32" height="26" rx="4" fill="#ffffff" stroke="#d0c4b0" stroke-width="1.8" />
              <circle cx="62" cy="76" r="6" fill="#8ec8f0" />
              <rect x="56" y="82" width="14" height="3" rx="1" fill="#e8c858" />
            </g>
            <ellipse class="light-task__rug" cx="132" cy="176" rx="54" ry="12" fill="#d9a066" opacity="0.9" />
            <ellipse cx="132" cy="176" rx="38" ry="7" fill="#e8b878" opacity="0.55" />
            <g class="light-task__ceiling-lamp">
              <line class="light-task__cord" x1="106" y1="30" x2="106" y2="54" stroke="#b8b0a4" stroke-width="2.5" stroke-linecap="round" />
              <rect class="light-task__socket" x="98" y="52" width="16" height="10" rx="3" fill="#c9c2b8" stroke="#a8a095" stroke-width="1" />
              <ellipse
                class="light-task__bulb-shadow"
                cx="106"
                cy="78"
                rx="18"
                ry="5"
                fill="#000000"
                opacity="0.16"
                filter="url(#lightSoftShadow)"
              />
              <circle class="light-task__bulb" cx="106" cy="72" r="15" fill="#ffd95a" stroke="#e8b82e" stroke-width="2" />
              <ellipse class="light-task__bulb-shine" cx="100" cy="66" rx="5" ry="7" fill="#ffffff" opacity="0.55" />
            </g>
          </svg>
          <div class="light-task__bulb-glow" id="light-bulb-glow" aria-hidden="true"></div>
          <div class="light-task__dim" id="light-dim" aria-hidden="true"></div>
          <div class="light-task__switch-wrap" id="light-switch-wrap">
            <svg class="light-task__switch-hint" viewBox="0 0 32 40" width="22" height="28" aria-hidden="true">
              <path
                class="light-task__switch-hint-arrow"
                d="M16 6v22M10 22l6 8 6-8"
                fill="none"
                stroke="#3d9ae8"
                stroke-width="3.2"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>
            <div class="light-task__switch-plate" id="light-switch-plate" aria-hidden="true">
              <div
                class="light-task__switch-rocker"
                id="light-switch-rocker"
                role="slider"
                aria-valuemin="0"
                aria-valuemax="14"
                aria-valuenow="0"
                aria-label="Кнопка выключателя"
                tabindex="0"
              ></div>
            </div>
          </div>
        </div>
        <div class="light-task__particles" id="light-particles" aria-hidden="true"></div>
      </div>
    </div>
  `;

  const root = container.querySelector('#light-task-root');
  const stage = container.querySelector('#light-stage');
  const playfield = container.querySelector('#light-playfield');
  const switchWrap = container.querySelector('#light-switch-wrap');
  const switchRocker = container.querySelector('#light-switch-rocker');
  const bulbGlow = container.querySelector('#light-bulb-glow');
  const dimLayer = container.querySelector('#light-dim');
  const thoughtBubble = container.querySelector('#light-thought-bubble');
  const particles = container.querySelector('#light-particles');

  if (!root || !stage || !playfield || !switchRocker || !bulbGlow || typeof gsap === 'undefined') {
    return () => {};
  }

  let glowPulseTween = null;
  let thoughtPulseTween = null;
  let switchDraggable = null;
  let taskComplete = false;
  const homeY = 0;
  const pressY = 14;
  const pressThreshold = pressY - 3;

  if (thoughtBubble) {
    gsap.set(thoughtBubble, { scale: 0.85, opacity: 0 });
    gsap.to(thoughtBubble, {
      scale: 1,
      opacity: 1,
      duration: 0.45,
      ease: 'back.out(2.5)',
      delay: 0.1,
      onComplete: () => {
        thoughtPulseTween = gsap.to(thoughtBubble, {
          scale: 1.02,
          duration: 1.15,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
          transformOrigin: '50% 50%',
        });
      },
    });
  }

  gsap.set(switchRocker, { y: homeY, transformOrigin: '50% 50%' });
  gsap.set(bulbGlow, { scale: 1, opacity: 0.72, transformOrigin: '50% 50%' });
  glowPulseTween = gsap.to(bulbGlow, {
    scale: 1.14,
    opacity: 0.92,
    duration: 1.05,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut',
    transformOrigin: '50% 50%',
  });
  switchWrap?.classList.add('light-task__switch-wrap--hint');

  function readSwitchY() {
    const raw = gsap.getProperty(switchRocker, 'y');
    return gsap.utils.clamp(homeY, pressY, typeof raw === 'number' ? raw : homeY);
  }

  function syncSwitchVisual(y) {
    const clamped = gsap.utils.clamp(homeY, pressY, y);
    gsap.set(switchRocker, { y: clamped });
    switchRocker?.setAttribute('aria-valuenow', String(Math.round(clamped)));
    switchWrap?.classList.toggle('light-task__switch-wrap--pressing', clamped > 2);
    if (clamped > 1) {
      switchWrap?.classList.remove('light-task__switch-wrap--hint');
    }
  }

  function switchIsOff(y) {
    return y >= pressThreshold;
  }

  function dismissThoughtBubble() {
    if (thoughtPulseTween) {
      thoughtPulseTween.kill();
      thoughtPulseTween = null;
    }
  }

  function showSuccessBubble() {
    if (!thoughtBubble) {
      return;
    }
    const copy = thoughtBubble.querySelector('.light-task__bubble-copy');
    const icon = thoughtBubble.querySelector('.light-task__bubble-icon');
    if (icon) {
      icon.innerHTML = `
        <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill="#dff9ec" stroke="#6ee7a8" stroke-width="2"/>
          <path fill="none" stroke="#2fb86f" stroke-width="2.5" stroke-linecap="round" d="M10 16l4 4 8-9"/>
        </svg>`;
    }
    if (copy) {
      copy.innerHTML =
        '<span class="light-task__bubble-who">Лампик радуется:</span><span class="light-task__bubble-text">Ура! Свет погас — электричество не тратится зря.</span>';
    }
    thoughtBubble.classList.add('light-task__bubble--done');
    gsap.to(thoughtBubble, { scale: 1, opacity: 1, duration: 0.35, ease: 'power2.out' });
  }

  function onTaskSuccess() {
    if (taskComplete) {
      return;
    }
    taskComplete = true;
    if (glowPulseTween) {
      glowPulseTween.kill();
      glowPulseTween = null;
    }
    gsap.to(bulbGlow, { opacity: 0, scale: 0.7, duration: 0.35, ease: 'power2.out' });
    gsap.to(dimLayer, { opacity: 1, duration: 0.55, ease: 'power2.out' });
    root.classList.add('light-task--off');
    if (switchDraggable) {
      switchDraggable.disable();
    }
    switchRocker?.setAttribute('aria-disabled', 'true');
    gsap.set(switchRocker, { y: pressY });
    syncSwitchVisual(pressY);
    playMiniGameSuccessPlop();
    dismissThoughtBubble();
    showSuccessBubble();
    celebrateModalLampikTaskComplete();
    burstMinigameSparkParticles(particles, stage, 0.5, 0.42);
    enableNextButton();
  }

  function snapSwitchHome() {
    gsap.to(switchRocker, {
      y: homeY,
      duration: 0.85,
      ease: 'elastic.out(1, 0.58)',
      onUpdate: () => syncSwitchVisual(readSwitchY()),
    });
  }

  if (typeof Draggable !== 'undefined') {
    switchDraggable = Draggable.create(switchRocker, {
      type: 'y',
      inertia: false,
      dragClickables: true,
      cursor: 'grab',
      activeCursor: 'grabbing',
      allowEventDefault: true,
      zIndexBoost: true,
      liveSnap: function liveSnapSwitchY(endValue) {
        return gsap.utils.clamp(homeY, pressY, endValue);
      },
      onDragStart: function onSwitchDragStart() {
        if (taskComplete) {
          this.endDrag();
          return;
        }
        ensureMiniGameAudioContext();
        switchWrap?.classList.remove('light-task__switch-wrap--hint');
      },
      onDrag: function onSwitchDrag() {
        syncSwitchVisual(readSwitchY());
      },
      onDragEnd: function onSwitchDragEnd() {
        if (taskComplete) {
          return;
        }
        const y = readSwitchY();
        if (switchIsOff(y)) {
          gsap.set(switchRocker, { y: pressY });
          syncSwitchVisual(pressY);
          playTapValveClickSound();
          onTaskSuccess();
          return;
        }
        snapSwitchHome();
      },
    })[0];
  } else {
    console.warn('[light-task] GSAP Draggable не загружен');
  }

  return () => {
    if (glowPulseTween) {
      glowPulseTween.kill();
      glowPulseTween = null;
    }
    if (thoughtPulseTween) {
      thoughtPulseTween.kill();
      thoughtPulseTween = null;
    }
    if (switchDraggable) {
      switchDraggable.kill();
      switchDraggable = null;
    }
    const killTargets = [switchRocker, bulbGlow, dimLayer, thoughtBubble];
    gsap.killTweensOf(killTargets);
    particles?.querySelectorAll('.minigame-burst-spark').forEach((el) => el.remove());
  };
}

/**
 * @param {HTMLElement} container
 * @returns {() => void}
 */
function mountFridgeCloseTask(container) {
  container.innerHTML = `
    <div class="fridge-task" id="fridge-task-root">
      <div class="fridge-task__stage" id="fridge-stage">
        <div class="fridge-task__bubble" id="fridge-thought-bubble" role="note">
          <span class="fridge-task__bubble-icon" aria-hidden="true">
            <svg viewBox="0 0 32 36" width="26" height="30" aria-hidden="true">
              <rect x="7" y="4" width="18" height="28" rx="4" fill="#f6fbff" stroke="#c8d8e8" stroke-width="1.4"/>
              <rect x="9" y="6" width="14" height="24" rx="3" fill="#b8e8ff" opacity="0.85"/>
              <rect x="19" y="10" width="5" height="16" rx="2" fill="#ffffff" stroke="#d8e4ee" stroke-width="1"/>
              <circle cx="22" cy="18" r="1.2" fill="#9ab8cc"/>
            </svg>
          </span>
          <span class="fridge-task__bubble-copy">
            <span class="fridge-task__bubble-who">Лампик думает:</span>
            <span class="fridge-task__bubble-text">Холод выходит! Закрой дверцу по стрелке ←</span>
          </span>
        </div>
        <div class="fridge-task__playfield" id="fridge-playfield">
          <div class="fridge-task__unit" id="fridge-unit">
            <span class="fridge-task__cast-shadow" aria-hidden="true"></span>
            <div class="fridge-task__body">
              <span class="fridge-task__top-cap" aria-hidden="true"></span>
              <span class="fridge-task__side-depth" aria-hidden="true"></span>
              <div class="fridge-task__shell" aria-hidden="true">
                <span class="fridge-task__shell-gasket" aria-hidden="true"></span>
              </div>
              <div class="fridge-task__cavity" id="fridge-cavity" aria-hidden="true">
                <span class="fridge-task__shelf fridge-task__shelf--top" aria-hidden="true"></span>
                <span class="fridge-task__shelf fridge-task__shelf--mid" aria-hidden="true"></span>
                <span class="fridge-task__shelf fridge-task__shelf--low" aria-hidden="true"></span>
                <span class="fridge-task__cavity-back" aria-hidden="true"></span>
                <div class="fridge-task__cold-light" id="fridge-cold-light"></div>
              </div>
              <span class="fridge-task__feet" aria-hidden="true"></span>
              <span class="fridge-task__feet fridge-task__feet--r" aria-hidden="true"></span>
              <div class="fridge-task__vapor" id="fridge-vapor" aria-hidden="true"></div>
              <svg class="fridge-task__door-hint" id="fridge-door-hint" viewBox="0 0 48 32" aria-hidden="true">
                <path
                  class="fridge-task__door-hint-arrow"
                  d="M36 16H10M10 16l8-7M10 16l8 7"
                  fill="none"
                  stroke="#3d9ae8"
                  stroke-width="3.4"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>
              <div
                class="fridge-task__door-pivot"
                id="fridge-door"
                role="slider"
                aria-valuemin="-18"
                aria-valuemax="0"
                aria-valuenow="-16"
                aria-label="Дверца холодильника — притяни влево, чтобы закрыть"
                tabindex="0"
              >
                <div class="fridge-task__door-panel" aria-hidden="true">
                  <span class="fridge-task__door-freezer-badge" aria-hidden="true">❄</span>
                  <span class="fridge-task__door-divider" aria-hidden="true"></span>
                  <span class="fridge-task__door-shine" aria-hidden="true"></span>
                  <span class="fridge-task__handle" aria-hidden="true"></span>
                  <span class="fridge-task__door-thickness" aria-hidden="true"></span>
                  <span class="fridge-task__door-inner-edge" aria-hidden="true"></span>
                </div>
              </div>
              <div class="fridge-task__exhale" id="fridge-exhale" aria-hidden="true"></div>
            </div>
          </div>
        </div>
        <div class="fridge-task__particles" id="fridge-particles" aria-hidden="true"></div>
      </div>
    </div>
  `;

  const root = container.querySelector('#fridge-task-root');
  const stage = container.querySelector('#fridge-stage');
  const fridgeUnit = container.querySelector('#fridge-unit');
  const coldLight = container.querySelector('#fridge-cold-light');
  const vaporBox = container.querySelector('#fridge-vapor');
  const door = container.querySelector('#fridge-door');
  const doorHint = container.querySelector('#fridge-door-hint');
  const thoughtBubble = container.querySelector('#fridge-thought-bubble');
  const exhaleEl = container.querySelector('#fridge-exhale');
  const particles = container.querySelector('#fridge-particles');
  const playfield = container.querySelector('#fridge-playfield');

  if (!root || !stage || !fridgeUnit || !door || !coldLight || typeof gsap === 'undefined') {
    return () => {};
  }

  /** Шарнир слева: приоткрытие = поворот против часовой (вправо), не по часовой */
  const openAngle = -16;
  const closeAngle = 0;
  const closeThreshold = -5;
  let coldPulseTween = null;
  let hintPulseTween = null;
  let thoughtPulseTween = null;
  let fridgeHumTween = null;
  let doorDraggable = null;
  let taskComplete = false;

  if (thoughtBubble) {
    gsap.set(thoughtBubble, { scale: 0.86, opacity: 0 });
    gsap.to(thoughtBubble, {
      scale: 1,
      opacity: 1,
      duration: 0.45,
      ease: 'back.out(2.5)',
      delay: 0.08,
      onComplete: () => {
        thoughtPulseTween = gsap.to(thoughtBubble, {
          scale: 1.02,
          duration: 1.15,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
          transformOrigin: '50% 50%',
        });
      },
    });
  }

  gsap.set(door, { rotation: openAngle, transformOrigin: '0% 50%' });
  door?.setAttribute('aria-valuenow', String(openAngle));
  playfield?.classList.add('fridge-task__playfield--hint');

  gsap.set(coldLight, { opacity: 0.92, transformOrigin: '50% 50%' });
  coldPulseTween = gsap.to(coldLight, {
    opacity: 1,
    scale: 1.04,
    duration: 0.95,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut',
    transformOrigin: '50% 50%',
  });

  if (doorHint) {
    gsap.set(doorHint, { opacity: 0.92, x: 0 });
    hintPulseTween = gsap.to(doorHint, {
      x: -7,
      opacity: 1,
      duration: 0.65,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  const vaporDots = [];
  for (let i = 0; i < 7; i += 1) {
    const dot = document.createElement('span');
    dot.className = 'fridge-task__vapor-dot';
    vaporBox?.appendChild(dot);
    vaporDots.push(dot);
    gsap.set(dot, { x: 0, y: 0, opacity: 0, scale: 0.55 });
    gsap
      .timeline({ repeat: -1, delay: i * 0.16 })
      .to(dot, {
        x: 18 + i * 2,
        y: -22 - (i % 3) * 6,
        opacity: 0.75,
        scale: 1,
        duration: 1.35,
        ease: 'sine.out',
      })
      .to(dot, { opacity: 0, duration: 0.55, ease: 'sine.in' });
  }

  function readDoorAngle() {
    const raw = gsap.getProperty(door, 'rotation');
    return gsap.utils.clamp(openAngle, closeAngle, typeof raw === 'number' ? raw : openAngle);
  }

  function syncDoorAria(angle) {
    door?.setAttribute('aria-valuenow', String(Math.round(angle)));
  }

  function stopVapor() {
    gsap.killTweensOf(vaporDots);
    gsap.to(vaporDots, { opacity: 0, duration: 0.35, ease: 'power1.out' });
  }

  function stopColdLight() {
    if (coldPulseTween) {
      coldPulseTween.kill();
      coldPulseTween = null;
    }
    gsap.to(coldLight, { opacity: 0, scale: 0.92, duration: 0.4, ease: 'power2.out' });
  }

  function startFridgeHum() {
    gsap.set(fridgeUnit, { transformOrigin: '50% 88%' });
    fridgeHumTween = gsap.to(fridgeUnit, {
      rotation: 0.55,
      x: 1.5,
      duration: 0.14,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  function stopFridgeHum() {
    if (fridgeHumTween) {
      fridgeHumTween.kill();
      fridgeHumTween = null;
    }
    gsap.to(fridgeUnit, { x: 0, rotation: 0, duration: 0.2, ease: 'power2.out' });
  }

  function playFridgeSigh() {
    if (!exhaleEl) {
      return;
    }
    gsap.killTweensOf(exhaleEl);
    gsap.set(exhaleEl, { opacity: 0, scale: 0.4, x: 0, y: 0 });
    gsap
      .timeline()
      .to(exhaleEl, {
        opacity: 0.55,
        scale: 1.1,
        y: -10,
        duration: 0.38,
        ease: 'power2.out',
      })
      .to(exhaleEl, {
        opacity: 0,
        scale: 1.35,
        y: -24,
        duration: 0.5,
        ease: 'power1.in',
      });
    gsap.fromTo(
      fridgeUnit,
      { rotation: 0, y: 0 },
      {
        rotation: -1.2,
        y: 2,
        duration: 0.16,
        yoyo: true,
        repeat: 3,
        ease: 'sine.inOut',
        transformOrigin: '50% 92%',
      }
    );
  }

  function dismissThoughtBubble() {
    if (thoughtPulseTween) {
      thoughtPulseTween.kill();
      thoughtPulseTween = null;
    }
  }

  function showSuccessBubble() {
    if (!thoughtBubble) {
      return;
    }
    const copy = thoughtBubble.querySelector('.fridge-task__bubble-copy');
    const icon = thoughtBubble.querySelector('.fridge-task__bubble-icon');
    if (icon) {
      icon.innerHTML = `
        <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill="#dff9ec" stroke="#6ee7a8" stroke-width="2"/>
          <path fill="none" stroke="#2fb86f" stroke-width="2.5" stroke-linecap="round" d="M10 16l4 4 8-9"/>
        </svg>`;
    }
    if (copy) {
      copy.innerHTML =
        '<span class="fridge-task__bubble-who">Лампик радуется:</span><span class="fridge-task__bubble-text">Ура! Дверца закрыта — холод снова внутри.</span>';
    }
    thoughtBubble.classList.add('fridge-task__bubble--done');
    gsap.to(thoughtBubble, { scale: 1, opacity: 1, duration: 0.35, ease: 'power2.out' });
  }

  function onTaskSuccess() {
    if (taskComplete) {
      return;
    }
    taskComplete = true;
    if (hintPulseTween) {
      hintPulseTween.kill();
      hintPulseTween = null;
    }
    doorHint?.classList.add('fridge-task__door-hint--hide');
    stopFridgeHum();
    stopVapor();
    stopColdLight();
    root.classList.add('fridge-task--closed');
    if (doorDraggable) {
      doorDraggable.disable();
    }
    door?.setAttribute('aria-disabled', 'true');
    gsap.set(door, { rotation: closeAngle });
    syncDoorAria(closeAngle);
    playTapValveClickSound();
    playMiniGameSuccessPlop();
    playFridgeSigh();
    dismissThoughtBubble();
    showSuccessBubble();
    celebrateModalLampikTaskComplete();
    burstMinigameSparkParticles(particles, stage, 0.48, 0.44);
    enableNextButton();
  }

  function snapDoorOpen() {
    gsap.to(door, {
      rotation: openAngle,
      duration: 0.9,
      ease: 'elastic.out(1, 0.58)',
      onUpdate: () => syncDoorAria(readDoorAngle()),
      onComplete: () => {
        playfield?.classList.add('fridge-task__playfield--hint');
      },
    });
  }

  startFridgeHum();

  if (typeof Draggable !== 'undefined') {
    doorDraggable = Draggable.create(door, {
      type: 'rotation',
      inertia: false,
      dragClickables: true,
      cursor: 'grab',
      activeCursor: 'grabbing',
      allowEventDefault: true,
      zIndexBoost: true,
      liveSnap: function liveSnapFridgeDoor(endValue) {
        return gsap.utils.clamp(openAngle, closeAngle, endValue);
      },
      onDragStart: function onFridgeDoorDragStart() {
        if (taskComplete) {
          this.endDrag();
          return;
        }
        ensureMiniGameAudioContext();
        playfield?.classList.remove('fridge-task__playfield--hint');
        if (hintPulseTween) {
          hintPulseTween.pause();
        }
      },
      onDrag: function onFridgeDoorDrag() {
        syncDoorAria(readDoorAngle());
      },
      onDragEnd: function onFridgeDoorDragEnd() {
        if (taskComplete) {
          return;
        }
        const angle = readDoorAngle();
        if (angle >= closeThreshold) {
          gsap.set(door, { rotation: closeAngle });
          syncDoorAria(closeAngle);
          onTaskSuccess();
          return;
        }
        if (hintPulseTween) {
          hintPulseTween.resume();
        }
        snapDoorOpen();
      },
    })[0];
  } else {
    console.warn('[fridge-task] GSAP Draggable не загружен');
  }

  return () => {
    stopFridgeHum();
    if (coldPulseTween) {
      coldPulseTween.kill();
      coldPulseTween = null;
    }
    if (hintPulseTween) {
      hintPulseTween.kill();
      hintPulseTween = null;
    }
    if (thoughtPulseTween) {
      thoughtPulseTween.kill();
      thoughtPulseTween = null;
    }
    if (doorDraggable) {
      doorDraggable.kill();
      doorDraggable = null;
    }
    const killTargets = [door, coldLight, fridgeUnit, thoughtBubble, doorHint, exhaleEl, ...vaporDots];
    gsap.killTweensOf(killTargets);
    particles?.querySelectorAll('.minigame-burst-spark').forEach((el) => el.remove());
  };
}

/**
 * @param {HTMLElement} container
 * @returns {() => void}
 */
function mountTvPowerOffTask(container) {
  container.innerHTML = `
    <div class="tv-task" id="tv-task-root">
      <div class="tv-task__stage" id="tv-stage">
        <div class="tv-task__bubble" id="tv-thought-bubble" role="note">
          <span class="tv-task__bubble-icon" aria-hidden="true">
            <svg viewBox="0 0 40 32" width="34" height="28" aria-hidden="true">
              <rect x="3" y="5" width="34" height="22" rx="3" fill="#2f3f58" stroke="#1a2233" stroke-width="1.5"/>
              <rect x="6" y="8" width="28" height="16" rx="2" fill="#5ed4ff"/>
              <rect x="5" y="25" width="6" height="3" rx="1" fill="#3a4558"/>
              <rect x="29" y="25" width="6" height="3" rx="1" fill="#3a4558"/>
              <path stroke="#e94f5f" stroke-width="3.2" stroke-linecap="round" d="M8 7l24 20M32 7L8 27"/>
            </svg>
          </span>
          <span class="tv-task__bubble-copy">
            <span class="tv-task__bubble-who">Лампик удивляется:</span>
            <span class="tv-task__bubble-text">ТВ работает, а в комнате никого! Нажми красную кнопку ↘</span>
          </span>
        </div>
        <div class="tv-task__playfield" id="tv-playfield">
          <svg class="tv-task__room-svg" viewBox="0 0 280 208" aria-hidden="true">
            <defs>
              <linearGradient id="tvWallGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#f2ebe0" />
                <stop offset="100%" stop-color="#e6dccf" />
              </linearGradient>
              <linearGradient id="tvFloorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#ddc9ab" />
                <stop offset="100%" stop-color="#bfa888" />
              </linearGradient>
              <linearGradient id="tvWindowGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#caeaff" />
                <stop offset="100%" stop-color="#9ed0f5" />
              </linearGradient>
              <filter id="tvSoftShade" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="2.2" />
              </filter>
            </defs>
            <rect class="tv-task__sky" x="0" y="0" width="280" height="208" fill="#dfeaf4" />
            <path class="tv-task__wall-left" d="M0 0 L24 18 L24 156 L0 188 Z" fill="#e2d9ca" />
            <path class="tv-task__floor" d="M24 156 L256 156 L280 188 L0 188 Z" fill="url(#tvFloorGrad)" />
            <line x1="42" y1="160" x2="258" y2="182" stroke="#b8a48a" stroke-width="1" opacity="0.32" />
            <line x1="34" y1="166" x2="240" y2="186" stroke="#b8a48a" stroke-width="1" opacity="0.24" />
            <rect class="tv-task__wall-back" x="24" y="18" width="232" height="138" fill="url(#tvWallGrad)" />
            <rect class="tv-task__ceiling" x="24" y="18" width="232" height="8" rx="2" fill="#faf6f0" />
            <rect class="tv-task__baseboard" x="24" y="146" width="232" height="10" rx="2" fill="#f3ede4" stroke="#e0d6c8" stroke-width="1" />
            <line x1="24" y1="18" x2="24" y2="156" stroke="#d8cfc0" stroke-width="2" />
            <g class="tv-task__window">
              <rect x="36" y="42" width="56" height="48" rx="4" fill="#faf6ef" stroke="#d0c4b0" stroke-width="2" />
              <rect x="41" y="47" width="46" height="38" rx="2" fill="url(#tvWindowGrad)" />
              <line x1="64" y1="47" x2="64" y2="85" stroke="#e8e0d0" stroke-width="1.5" />
              <line x1="41" y1="66" x2="87" y2="66" stroke="#e8e0d0" stroke-width="1.5" />
            </g>
            <g class="tv-task__picture">
              <rect x="198" y="52" width="36" height="28" rx="3" fill="#fff" stroke="#d0c4b0" stroke-width="1.5" />
              <circle cx="216" cy="62" r="6" fill="#9ed4f5" />
              <rect x="210" y="70" width="14" height="3" rx="1" fill="#e8c858" />
            </g>
            <g class="tv-task__sofa" aria-hidden="true">
              <path d="M186 108 Q218 96 248 108 L252 132 Q218 126 186 132 Z" fill="#9a88c8" stroke="#7a6aaa" stroke-width="1.2" />
              <path d="M192 108 L192 94 Q204 88 216 94 L216 108 Z" fill="#b0a0d8" />
              <path d="M218 108 L218 92 Q234 86 248 92 L248 108 Z" fill="#b0a0d8" />
              <rect x="190" y="128" width="58" height="8" rx="3" fill="#7a6aaa" opacity="0.85" />
            </g>
            <ellipse class="tv-task__rug" cx="140" cy="172" rx="58" ry="11" fill="#d9a066" opacity="0.88" />
            <ellipse cx="140" cy="172" rx="42" ry="7" fill="#e8b878" opacity="0.5" />
            <ellipse
              class="tv-task__floor-shadow"
              cx="140"
              cy="158"
              rx="62"
              ry="9"
              fill="#3a3028"
              opacity="0.14"
              filter="url(#tvSoftShade)"
            />
            <rect class="tv-task__wall-niche" x="98" y="98" width="84" height="4" rx="2" fill="#ddd4c8" opacity="0.65" />
          </svg>
          <div class="tv-task__room-wash" id="tv-room-wash" aria-hidden="true"></div>
          <div class="tv-task__console" id="tv-unit">
            <div class="tv-task__tv">
              <div class="tv-task__screen-glow" id="tv-screen-glow" aria-hidden="true"></div>
              <div class="tv-task__bezel" aria-hidden="true">
                <div class="tv-task__screen" id="tv-screen" aria-hidden="true">
                  <div class="tv-task__scanlines" aria-hidden="true"></div>
                  <span class="tv-task__toon tv-task__toon--a" aria-hidden="true"></span>
                  <span class="tv-task__toon tv-task__toon--b" aria-hidden="true"></span>
                  <span class="tv-task__toon tv-task__toon--c" aria-hidden="true"></span>
                </div>
                <button
                  type="button"
                  class="tv-task__power-btn"
                  id="tv-power-btn"
                  aria-label="Выключить телевизор — красная кнопка питания"
                >⏻</button>
              </div>
              <span class="tv-task__stand" aria-hidden="true"></span>
            </div>
            <div class="tv-task__cabinet" aria-hidden="true"></div>
          </div>
          <div class="tv-task__off-badge" id="tv-off-badge" aria-hidden="true">OFF</div>
        </div>
        <div class="tv-task__particles" id="tv-particles" aria-hidden="true"></div>
      </div>
    </div>
  `;

  const root = container.querySelector('#tv-task-root');
  const stage = container.querySelector('#tv-stage');
  const playfield = container.querySelector('#tv-playfield');
  const screen = container.querySelector('#tv-screen');
  const screenGlow = container.querySelector('#tv-screen-glow');
  const powerBtn = container.querySelector('#tv-power-btn');
  const thoughtBubble = container.querySelector('#tv-thought-bubble');
  const particles = container.querySelector('#tv-particles');
  const offBadge = container.querySelector('#tv-off-badge');
  const roomWash = container.querySelector('#tv-room-wash');

  if (!root || !stage || !playfield || !screen || !powerBtn || typeof gsap === 'undefined') {
    return () => {};
  }

  let thoughtPulseTween = null;
  let glowPulseTween = null;
  let powerHintTween = null;
  let hintDelayCall = null;
  let tvAudioInterval = null;
  let taskComplete = false;

  function startTvAudio() {
    stopTvAudio();
    playTvMumbleBlip();
    tvAudioInterval = window.setInterval(() => {
      if (!taskComplete) {
        playTvMumbleBlip();
      }
    }, 1650);
  }

  function stopTvAudio() {
    if (tvAudioInterval != null) {
      window.clearInterval(tvAudioInterval);
      tvAudioInterval = null;
    }
  }

  if (thoughtBubble) {
    gsap.set(thoughtBubble, { scale: 0.85, opacity: 0 });
    gsap.to(thoughtBubble, {
      scale: 1,
      opacity: 1,
      duration: 0.45,
      ease: 'back.out(2.5)',
      delay: 0.08,
      onComplete: () => {
        thoughtPulseTween = gsap.to(thoughtBubble, {
          scale: 1.02,
          duration: 1.2,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
          transformOrigin: '50% 50%',
        });
      },
    });
  }

  if (screenGlow) {
    gsap.set(screenGlow, { opacity: 0.65, scale: 1 });
    glowPulseTween = gsap.to(screenGlow, {
      opacity: 0.9,
      scale: 1.08,
      duration: 0.85,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
    });
  }

  startTvAudio();

  hintDelayCall = gsap.delayedCall(10, () => {
    if (taskComplete) {
      return;
    }
    powerBtn.classList.add('tv-task__power-btn--hint');
    powerHintTween = gsap.to(powerBtn, {
      scale: 1.14,
      duration: 0.38,
      yoyo: true,
      repeat: -1,
      ease: 'sine.inOut',
      transformOrigin: '50% 50%',
    });
  });

  function dismissThoughtBubble() {
    if (thoughtPulseTween) {
      thoughtPulseTween.kill();
      thoughtPulseTween = null;
    }
  }

  function showSuccessBubble() {
    if (!thoughtBubble) {
      return;
    }
    const copy = thoughtBubble.querySelector('.tv-task__bubble-copy');
    const icon = thoughtBubble.querySelector('.tv-task__bubble-icon');
    if (icon) {
      icon.innerHTML = `
        <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill="#dff9ec" stroke="#6ee7a8" stroke-width="2"/>
          <path fill="none" stroke="#2fb86f" stroke-width="2.5" stroke-linecap="round" d="M10 16l4 4 8-9"/>
        </svg>`;
    }
    if (copy) {
      copy.innerHTML =
        '<span class="tv-task__bubble-who">Лампик радуется:</span><span class="tv-task__bubble-text">Тише! Экран погас — энергия не уходит в никуда.</span>';
    }
    thoughtBubble.classList.add('tv-task__bubble--done');
    gsap.to(thoughtBubble, { scale: 1, opacity: 1, duration: 0.35, ease: 'power2.out' });
  }

  function onTaskSuccess() {
    if (taskComplete) {
      return;
    }
    taskComplete = true;
    stopTvAudio();
    if (glowPulseTween) {
      glowPulseTween.kill();
      glowPulseTween = null;
    }
    if (powerHintTween) {
      powerHintTween.kill();
      powerHintTween = null;
    }
    if (hintDelayCall) {
      hintDelayCall.kill();
      hintDelayCall = null;
    }
    powerBtn.classList.remove('tv-task__power-btn--hint');
    powerBtn.disabled = true;
    powerBtn.setAttribute('aria-disabled', 'true');
    gsap.to(screenGlow, { opacity: 0, scale: 0.75, duration: 0.35, ease: 'power2.out' });
    if (roomWash) {
      gsap.to(roomWash, { opacity: 0, duration: 0.5, ease: 'power2.out' });
    }
    gsap.fromTo(
      powerBtn,
      { scale: 0.92 },
      { scale: 1, duration: 0.22, ease: 'back.out(2.5)' }
    );
    root.classList.add('tv-task--off');
    offBadge?.classList.add('tv-task__off-badge--show');
    playTvRemoteClickSound();
    playMiniGameSuccessPlop();
    dismissThoughtBubble();
    showSuccessBubble();
    celebrateModalLampikTaskComplete();
    burstMinigameSparkParticles(particles, stage, 0.5, 0.44);
    enableNextButton();
  }

  function onPowerActivate() {
    if (taskComplete) {
      return;
    }
    ensureMiniGameAudioContext();
    powerBtn.classList.remove('tv-task__power-btn--hint');
    if (powerHintTween) {
      powerHintTween.kill();
      powerHintTween = null;
    }
    if (hintDelayCall) {
      hintDelayCall.kill();
      hintDelayCall = null;
    }
    onTaskSuccess();
  }

  powerBtn.addEventListener('click', onPowerActivate);
  powerBtn.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onPowerActivate();
    }
  });

  return () => {
    stopTvAudio();
    powerBtn.removeEventListener('click', onPowerActivate);
    if (glowPulseTween) {
      glowPulseTween.kill();
      glowPulseTween = null;
    }
    if (powerHintTween) {
      powerHintTween.kill();
      powerHintTween = null;
    }
    if (hintDelayCall) {
      hintDelayCall.kill();
      hintDelayCall = null;
    }
    if (thoughtPulseTween) {
      thoughtPulseTween.kill();
      thoughtPulseTween = null;
    }
    gsap.killTweensOf([screenGlow, roomWash, powerBtn, thoughtBubble, screen]);
    particles?.querySelectorAll('.minigame-burst-spark').forEach((el) => el.remove());
  };
}

/**
 * @param {HTMLElement} container
 * @returns {() => void}
 */
function mountPhoneChargeTask(container) {
  container.innerHTML = `
    <div class="phone-task" id="phone-task-root">
      <div class="phone-task__stage" id="phone-stage">
        <div class="phone-task__bubble" id="phone-thought-bubble" role="note">
          <span class="phone-task__bubble-icon" aria-hidden="true">
            <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
              <rect x="9" y="4" width="14" height="24" rx="3" fill="#2a2f3c" stroke="#1a1e28" stroke-width="1"/>
              <rect x="11" y="6" width="10" height="18" rx="2" fill="#ff6b6b"/>
              <rect x="14" y="22" width="4" height="2" rx="1" fill="#e74c4c"/>
            </svg>
          </span>
          <span class="phone-task__bubble-copy">
            <span class="phone-task__bubble-who">Лампик говорит:</span>
            <span class="phone-task__bubble-text" id="phone-bubble-text">Телефон садится! Потяни вилку в розетку →</span>
          </span>
        </div>
        <svg class="phone-task__wire" aria-hidden="true">
          <path class="phone-task__wire-path" id="phone-wire-path" />
        </svg>
        <div class="phone-task__desk" aria-hidden="true"></div>
        <div class="phone-task__phone" id="phone-unit" aria-hidden="true">
          <div class="phone-task__phone-body">
            <div class="phone-task__screen">
              <span class="phone-task__time" aria-hidden="true">12:00</span>
              <div class="phone-task__battery-widget" id="phone-battery-widget">
                <svg class="phone-task__battery-outline" viewBox="0 0 48 24" width="54" height="26" aria-hidden="true">
                  <rect x="2" y="4" width="40" height="16" rx="4" fill="none" stroke="currentColor" stroke-width="2"/>
                  <rect x="42" y="9" width="4" height="6" rx="1" fill="currentColor"/>
                </svg>
                <div class="phone-task__battery-track" aria-hidden="true">
                  <div class="phone-task__battery-fill" id="phone-battery-fill" style="width:12%"></div>
                </div>
                <span class="phone-task__battery-pct" id="phone-battery-pct" aria-live="polite">8%</span>
              </div>
              <span class="phone-task__bolt" id="phone-bolt" aria-hidden="true">⚡</span>
            </div>
          </div>
          <span class="phone-task__port" id="phone-port" aria-hidden="true"></span>
        </div>
        <div class="phone-task__success-zone" id="phone-success-zone" aria-hidden="true"></div>
        <div class="phone-task__socket" aria-hidden="true">
          <svg class="phone-task__socket-svg" viewBox="0 0 80 88" aria-hidden="true">
            <rect x="6" y="8" width="68" height="72" rx="10" fill="#ebe6dc" stroke="#c4bbb0" stroke-width="2"/>
            <rect x="14" y="14" width="52" height="56" rx="7" fill="#f5f0e8" stroke="#d8d0c4" stroke-width="1.5"/>
            <ellipse cx="28" cy="38" rx="5" ry="7" fill="#3a3a42"/>
            <ellipse cx="52" cy="38" rx="5" ry="7" fill="#3a3a42"/>
            <circle cx="40" cy="56" r="5" fill="#3a3a42"/>
          </svg>
        </div>
        <div class="phone-task__plug" id="phone-plug" role="slider" aria-label="Вилка зарядки — потяни в розетку" tabindex="0">
          <div class="phone-task__plug-pins" aria-hidden="true">
            <span class="phone-task__plug-pin phone-task__plug-pin--left"></span>
            <span class="phone-task__plug-pin phone-task__plug-pin--right"></span>
            <span class="phone-task__plug-pin phone-task__plug-pin--earth"></span>
          </div>
          <div class="phone-task__plug-body">
            <span class="phone-task__plug-grip" aria-hidden="true"></span>
          </div>
          <div class="phone-task__plug-cord-nub" aria-hidden="true"></div>
        </div>
        <div class="phone-task__particles" id="phone-particles" aria-hidden="true"></div>
      </div>
    </div>
  `;

  const root = container.querySelector('#phone-task-root');
  const stage = container.querySelector('#phone-stage');
  const phoneUnit = container.querySelector('#phone-unit');
  const wirePath = container.querySelector('#phone-wire-path');
  const wireSvg = container.querySelector('.phone-task__wire');
  const plug = container.querySelector('#phone-plug');
  const socketEl = container.querySelector('.phone-task__socket');
  const successZone = container.querySelector('#phone-success-zone');
  const batteryFill = container.querySelector('#phone-battery-fill');
  const batteryPct = container.querySelector('#phone-battery-pct');
  const batteryWidget = container.querySelector('#phone-battery-widget');
  const bolt = container.querySelector('#phone-bolt');
  const thoughtBubble = container.querySelector('#phone-thought-bubble');
  const bubbleText = container.querySelector('#phone-bubble-text');
  const particles = container.querySelector('#phone-particles');

  if (
    !root ||
    !stage ||
    !phoneUnit ||
    !wirePath ||
    !plug ||
    !batteryFill ||
    typeof gsap === 'undefined'
  ) {
    return () => {};
  }

  const homeX = 0;
  /** @type {number} — смещение вилки по x, когда она в розетке (считаем по DOM) */
  let plugSnapX = 100;
  let phase = 'unplugged';
  let taskComplete = false;
  let plugDraggable = null;
  let chargeTween = null;
  let thoughtPulseTween = null;
  let lowBatteryTween = null;
  const chargeState = { pct: 8 };

  if (thoughtBubble) {
    gsap.set(thoughtBubble, { scale: 0.85, opacity: 0 });
    gsap.to(thoughtBubble, {
      scale: 1,
      opacity: 1,
      duration: 0.45,
      ease: 'back.out(2.5)',
      delay: 0.1,
      onComplete: () => {
        thoughtPulseTween = gsap.to(thoughtBubble, {
          scale: 1.02,
          duration: 1.1,
          yoyo: true,
          repeat: -1,
          ease: 'sine.inOut',
          transformOrigin: '50% 50%',
        });
      },
    });
  }

  lowBatteryTween = gsap.to(batteryWidget, {
    opacity: 0.7,
    duration: 0.85,
    yoyo: true,
    repeat: -1,
    ease: 'sine.inOut',
  });

  function batteryColor(pct) {
    const t = Math.min(1, Math.max(0, (pct - 8) / 92));
    const r = Math.round(232 + (76 - 232) * t);
    const g = Math.round(76 + (209 - 76) * t);
    const b = Math.round(76 + (146 - 76) * t);
    return `rgb(${r},${g},${b})`;
  }

  function updateBatteryDisplay(pct) {
    const clamped = gsap.utils.clamp(0, 100, pct);
    batteryFill.style.width = `${clamped}%`;
    batteryFill.style.background = batteryColor(clamped);
    batteryWidget.style.color = clamped >= 96 ? '#2fb86f' : '#e85050';
    if (batteryPct) {
      batteryPct.textContent = `${Math.round(clamped)}%`;
    }
    root.classList.toggle('phone-task--low', clamped < 25);
    root.classList.toggle('phone-task--charging', phase === 'charging' || phase === 'full');
  }

  updateBatteryDisplay(chargeState.pct);
  if (bolt) {
    gsap.set(bolt, { opacity: 0, scale: 0.3 });
  }

  function syncWire() {
    if (!wireSvg || !phoneUnit || !plug) {
      return;
    }
    const stageRect = stage.getBoundingClientRect();
    const phoneRect = phoneUnit.getBoundingClientRect();
    const plugRect = plug.getBoundingClientRect();

    const x1 = phoneRect.right - stageRect.left - 4;
    const y1 = phoneRect.bottom - stageRect.top - 28;
    const x2 = plugRect.left - stageRect.left + 6;
    const y2 = plugRect.top - stageRect.top + plugRect.height * 0.52;
    const sag = Math.min(22, Math.abs(x2 - x1) * 0.1 + 8);

    wireSvg.setAttribute('viewBox', `0 0 ${Math.round(stageRect.width)} ${Math.round(stageRect.height)}`);
    wirePath.setAttribute(
      'd',
      `M ${x1} ${y1} Q ${(x1 + x2) * 0.5} ${y1 + sag} ${x2} ${y2}`
    );
  }

  function readPlugX() {
    const raw = gsap.getProperty(plug, 'x');
    return typeof raw === 'number' ? raw : homeX;
  }

  function calcPlugSnapFromLayout() {
    if (!socketEl || !plug) {
      return plugSnapX;
    }
    const prevX = readPlugX();
    gsap.set(plug, { x: homeX });
    const socketRect = socketEl.getBoundingClientRect();
    const plugRect = plug.getBoundingClientRect();
    const socketCenterX = socketRect.left + socketRect.width * 0.52;
    const plugPinX = plugRect.left + plugRect.width * 0.5;
    const delta = socketCenterX - plugPinX;
    plugSnapX = Math.max(52, Math.round(delta));
    gsap.set(plug, { x: prevX });
    if (plugDraggable) {
      plugDraggable.applyBounds({ minX: homeX, maxX: plugSnapX + 18 });
    }
    return plugSnapX;
  }

  function plugInSuccessZone() {
    if (!plug) {
      return false;
    }
    const hitTarget = socketEl || successZone;
    if (!hitTarget) {
      return false;
    }
    const zone = hitTarget.getBoundingClientRect();
    const pr = plug.getBoundingClientRect();
    const padX = 14;
    const padY = 10;
    const overlapX = Math.min(pr.right, zone.right + padX) - Math.max(pr.left, zone.left - padX);
    const overlapY = Math.min(pr.bottom, zone.bottom + padY) - Math.max(pr.top, zone.top - padY);
    return overlapX >= 22 && overlapY >= 16;
  }

  function snapPlugHome() {
    gsap.to(plug, {
      x: homeX,
      duration: 0.85,
      ease: 'elastic.out(1, 0.55)',
      onUpdate: syncWire,
    });
  }

  function snapPlugInSocket() {
    calcPlugSnapFromLayout();
    gsap.to(plug, {
      x: plugSnapX,
      duration: 0.32,
      ease: 'power2.out',
      onUpdate: syncWire,
    });
  }

  function showUnplugHint() {
    if (bubbleText) {
      bubbleText.textContent = 'Полный заряд! Потяни вилку из розетки ←';
    }
    if (thoughtPulseTween) {
      thoughtPulseTween.restart();
    }
    if (bolt) {
      gsap.set(bolt, { scale: 0.2, opacity: 0 });
      gsap.to(bolt, { scale: 1.15, opacity: 1, duration: 0.5, ease: 'back.out(3)' });
      gsap.to(bolt, {
        scale: 1.05,
        duration: 0.55,
        yoyo: true,
        repeat: -1,
        ease: 'sine.inOut',
        delay: 0.5,
      });
    }
  }

  function dismissThoughtBubble() {
    if (thoughtPulseTween) {
      thoughtPulseTween.kill();
      thoughtPulseTween = null;
    }
  }

  function showSuccessBubble() {
    if (!thoughtBubble) {
      return;
    }
    const copy = thoughtBubble.querySelector('.phone-task__bubble-copy');
    const icon = thoughtBubble.querySelector('.phone-task__bubble-icon');
    if (icon) {
      icon.innerHTML = `
        <svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true">
          <circle cx="16" cy="16" r="14" fill="#dff9ec" stroke="#6ee7a8" stroke-width="2"/>
          <path fill="none" stroke="#2fb86f" stroke-width="2.5" stroke-linecap="round" d="M10 16l4 4 8-9"/>
        </svg>`;
    }
    if (copy) {
      copy.innerHTML =
        '<span class="phone-task__bubble-who">Лампик радуется:</span><span class="phone-task__bubble-text">Супер! Телефон заряжен — провод убрали, энергия не тратится зря.</span>';
    }
    thoughtBubble.classList.add('phone-task__bubble--done');
    gsap.to(thoughtBubble, { scale: 1, opacity: 1, duration: 0.35, ease: 'power2.out' });
  }

  function onBatteryFull() {
    phase = 'full';
    root.classList.add('phone-task--full');
    updateBatteryDisplay(100);
    playPhoneChargeFullSound();
    showUnplugHint();
    if (plugDraggable) {
      plugDraggable.enable();
    }
  }

  function startCharging() {
    phase = 'charging';
    root.classList.add('phone-task--charging');
    playKettleUnplugClickSound();
    snapPlugInSocket();
    if (plugDraggable) {
      plugDraggable.disable();
    }
    if (lowBatteryTween) {
      lowBatteryTween.kill();
      lowBatteryTween = null;
    }
    gsap.set(batteryWidget, { opacity: 1 });

    chargeTween = gsap.to(chargeState, {
      pct: 100,
      duration: 4.5,
      ease: 'power1.inOut',
      onUpdate: () => updateBatteryDisplay(chargeState.pct),
      onComplete: onBatteryFull,
    });
  }

  function onTaskSuccess() {
    if (taskComplete) {
      return;
    }
    taskComplete = true;
    phase = 'done';
    if (chargeTween) {
      chargeTween.kill();
      chargeTween = null;
    }
    if (plugDraggable) {
      plugDraggable.disable();
    }
    root.classList.add('phone-task--done');
    playKettleUnplugClickSound();
    playMiniGameSuccessPlop();
    dismissThoughtBubble();
    showSuccessBubble();
    celebrateModalLampikTaskComplete();
    burstMinigameSparkParticles(particles, stage, 0.42, 0.48);
    enableNextButton();
  }

  gsap.set(plug, { x: homeX });

  const layoutWire = () => {
    syncWire();
    if (phase === 'unplugged') {
      calcPlugSnapFromLayout();
    }
  };
  requestAnimationFrame(() => {
    calcPlugSnapFromLayout();
    syncWire();
  });
  window.addEventListener('resize', layoutWire);

  if (typeof Draggable !== 'undefined') {
    plugDraggable = Draggable.create(plug, {
      type: 'x',
      bounds: { minX: homeX, maxX: plugSnapX + 16 },
      inertia: false,
      cursor: 'grab',
      activeCursor: 'grabbing',
      allowEventDefault: true,
      onDragStart() {
        if (taskComplete) {
          this.endDrag();
          return;
        }
        if (phase === 'charging') {
          this.endDrag();
          return;
        }
        ensureMiniGameAudioContext();
      },
      onDrag: syncWire,
      onDragEnd() {
        if (taskComplete) {
          return;
        }
        if (phase === 'unplugged') {
          const nearSocket = readPlugX() >= plugSnapX - 22;
          if (plugInSuccessZone() || nearSocket) {
            startCharging();
            return;
          }
          snapPlugHome();
          return;
        }
        if (phase === 'full') {
          if (!plugInSuccessZone() || readPlugX() < plugSnapX - 28) {
            snapPlugHome();
            onTaskSuccess();
            return;
          }
          gsap.to(plug, { x: plugSnapX, duration: 0.2, onUpdate: syncWire });
        }
      },
    })[0];
  } else {
    console.warn('[phone-task] GSAP Draggable не загружен');
  }

  return () => {
    window.removeEventListener('resize', layoutWire);
    if (chargeTween) {
      chargeTween.kill();
      chargeTween = null;
    }
    if (thoughtPulseTween) {
      thoughtPulseTween.kill();
      thoughtPulseTween = null;
    }
    if (lowBatteryTween) {
      lowBatteryTween.kill();
      lowBatteryTween = null;
    }
    if (plugDraggable) {
      plugDraggable.kill();
      plugDraggable = null;
    }
    const killTargets = [plug, phoneUnit, thoughtBubble, batteryWidget, bolt];
    gsap.killTweensOf(killTargets);
    particles?.querySelectorAll('.minigame-burst-spark').forEach((el) => el.remove());
  };
}

const TRASH_HINT_ICONS = {
  plastic: `<svg viewBox="0 0 32 40" width="28" height="34" aria-hidden="true"><rect x="12" y="2" width="8" height="4" rx="2" fill="#2d8ec4"/><rect x="10" y="6" width="12" height="32" rx="5" fill="#5ec8f5" stroke="#2d8ec4" stroke-width="1.2"/><rect x="12" y="14" width="8" height="10" rx="2" fill="#fff" opacity="0.55"/></svg>`,
  paper: `<svg viewBox="0 0 32 32" width="28" height="28" aria-hidden="true"><path d="M4 10 Q6 6 10 8 L22 8 Q26 6 28 10 L28 22 Q26 26 22 24 L10 24 Q6 26 4 22 Z" fill="#fff5d6" stroke="#e8c868" stroke-width="1.2"/><path d="M11 13h10M11 17h8" stroke="#d4b85a" stroke-width="1.3" stroke-linecap="round"/></svg>`,
  battery: `<svg viewBox="0 0 36 24" width="30" height="20" aria-hidden="true"><rect x="2" y="5" width="30" height="14" rx="4" fill="#b8c0c8" stroke="#8a929c" stroke-width="1"/><rect x="32" y="9" width="3" height="6" rx="1" fill="#8a929c"/><text x="11" y="16" font-size="9" font-weight="900" fill="#e85a5a">+</text><text x="25" y="16" font-size="10" font-weight="900" fill="#4a5560">−</text></svg>`,
};

const TRASH_BIN_LABELS = {
  plastic: 'синий — пластик',
  paper: 'жёлтый — бумага',
  battery: 'красный — батарейки',
};

/**
 * @param {HTMLElement} container
 * @returns {() => void}
 */
function mountTrashSortTask(container) {
  container.innerHTML = `
    <div class="trash-task" id="trash-task-root">
      <div class="trash-task__bubble" id="trash-thought-bubble" role="note">
        <span class="trash-task__bubble-icon" id="trash-bubble-icon" aria-hidden="true">
          ${TRASH_CROSSED_BOTTLE_SVG}
        </span>
        <span class="trash-task__bubble-copy">
          <span class="trash-task__bubble-who">Лампик говорит:</span>
          <span class="trash-task__bubble-text" id="trash-bubble-text">На полянке мусор! Перетащи вещи в цветные баки.</span>
        </span>
      </div>
      <div class="trash-task__stage" id="trash-stage">
        <div class="trash-task__meadow" aria-hidden="true">
          <span class="trash-task__grass tuft tuft--1"></span>
          <span class="trash-task__grass tuft tuft--2"></span>
          <span class="trash-task__grass tuft tuft--3"></span>
        </div>
        <div class="trash-task__items" id="trash-items">
          <div class="trash-task__item trash-task__item--plastic" id="trash-item-plastic" data-kind="plastic" role="button" tabindex="0" aria-label="Пластиковая бутылка — перетащи в синий бак">
            <svg class="trash-task__item-fig" viewBox="0 0 56 72" aria-hidden="true">
              <defs>
                <linearGradient id="trashBottleGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="#9ee8ff" />
                  <stop offset="55%" stop-color="#4db8ea" />
                  <stop offset="100%" stop-color="#2488c8" />
                </linearGradient>
                <linearGradient id="trashBottleShine" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stop-color="#fff" stop-opacity="0.55" />
                  <stop offset="100%" stop-color="#fff" stop-opacity="0" />
                </linearGradient>
              </defs>
              <ellipse cx="28" cy="68" rx="16" ry="4" fill="rgba(0,0,0,0.12)" />
              <rect x="22" y="4" width="12" height="7" rx="2.5" fill="#1a7ab5" />
              <path d="M20 8h16v3c0 2-1.5 3-3 3h-10c-2 0-3-1-3-3V8z" fill="#2d96d4" />
              <rect x="17" y="14" width="22" height="50" rx="9" fill="url(#trashBottleGrad)" stroke="#1e6fa8" stroke-width="1.5" />
              <rect x="21" y="28" width="14" height="18" rx="3" fill="url(#trashBottleShine)" />
              <rect x="20" y="32" width="16" height="12" rx="2" fill="#fff" opacity="0.45" />
              <text x="28" y="41" text-anchor="middle" font-size="7" font-weight="800" fill="#1e6fa8" font-family="Nunito,sans-serif">H₂O</text>
            </svg>
            <span class="trash-task__item-tag">Бутылка</span>
          </div>
          <div class="trash-task__item trash-task__item--paper" id="trash-item-paper" data-kind="paper" role="button" tabindex="0" aria-label="Бумажный фантик — перетащи в жёлтый бак">
            <svg class="trash-task__item-fig" viewBox="0 0 60 56" aria-hidden="true">
              <ellipse cx="30" cy="52" rx="18" ry="4" fill="rgba(0,0,0,0.1)" />
              <path d="M6 14 Q8 8 14 10 L46 10 Q52 8 54 14 L54 42 Q52 48 46 46 L14 46 Q8 48 6 42 Z" fill="#fff8e6" stroke="#e5c45a" stroke-width="2" />
              <path d="M6 14 Q14 18 6 22 M54 14 Q46 18 54 22" fill="none" stroke="#f0d878" stroke-width="2" stroke-linecap="round" />
              <path d="M6 42 Q14 38 6 34 M54 42 Q46 38 54 34" fill="none" stroke="#f0d878" stroke-width="2" stroke-linecap="round" />
              <rect x="16" y="20" width="28" height="16" rx="3" fill="#ffeeb8" stroke="#e8c868" stroke-width="1" />
              <circle cx="30" cy="28" r="5" fill="#ffc93d" opacity="0.85" />
              <path d="M20 26h6M34 26h6M22 32h16" stroke="#d4a84a" stroke-width="1.5" stroke-linecap="round" />
            </svg>
            <span class="trash-task__item-tag">Фантик</span>
          </div>
          <div class="trash-task__item trash-task__item--battery" id="trash-item-battery" data-kind="battery" role="button" tabindex="0" aria-label="Батарейка — перетащи в красный бак">
            <svg class="trash-task__item-fig" viewBox="0 0 68 44" aria-hidden="true">
              <ellipse cx="34" cy="40" rx="22" ry="3.5" fill="rgba(0,0,0,0.12)" />
              <rect x="6" y="12" width="52" height="24" rx="7" fill="#c4ccd4" stroke="#8a949e" stroke-width="1.5" />
              <rect x="58" y="18" width="6" height="12" rx="2" fill="#8a949e" />
              <rect x="8" y="14" width="22" height="20" rx="5" fill="#e8ecf0" />
              <rect x="38" y="14" width="18" height="20" rx="5" fill="#a8b2bc" />
              <text x="19" y="29" text-anchor="middle" font-size="14" font-weight="900" fill="#e03e3e" font-family="Nunito,sans-serif">+</text>
              <text x="47" y="29" text-anchor="middle" font-size="16" font-weight="900" fill="#3d4854" font-family="Nunito,sans-serif">−</text>
              <path d="M34 14v20" stroke="#9aa3ad" stroke-width="1" />
            </svg>
            <span class="trash-task__item-tag">Батарейка</span>
          </div>
        </div>
        <div class="trash-task__bins" aria-hidden="true">
          <div class="trash-task__bin trash-task__bin--plastic" data-kind="plastic" id="trash-bin-plastic">
            <div class="trash-task__bin-lid"></div>
            <div class="trash-task__bin-body"></div>
            <span class="trash-task__bin-icon">${TRASH_HINT_ICONS.plastic}</span>
          </div>
          <div class="trash-task__bin trash-task__bin--paper" data-kind="paper" id="trash-bin-paper">
            <div class="trash-task__bin-lid"></div>
            <div class="trash-task__bin-body"></div>
            <span class="trash-task__bin-icon">${TRASH_HINT_ICONS.paper}</span>
          </div>
          <div class="trash-task__bin trash-task__bin--battery" data-kind="battery" id="trash-bin-battery">
            <div class="trash-task__bin-lid"></div>
            <div class="trash-task__bin-body"></div>
            <span class="trash-task__bin-icon">${TRASH_HINT_ICONS.battery}</span>
          </div>
        </div>
        <div class="trash-task__particles" id="trash-particles" aria-hidden="true"></div>
      </div>
    </div>
  `;

  const root = container.querySelector('#trash-task-root');
  const stage = container.querySelector('#trash-stage');
  const thoughtBubble = container.querySelector('#trash-thought-bubble');
  const bubbleIcon = container.querySelector('#trash-bubble-icon');
  const bubbleText = container.querySelector('#trash-bubble-text');
  const particles = container.querySelector('#trash-particles');
  const itemEls = /** @type {HTMLElement[]} */ ([
    ...container.querySelectorAll('.trash-task__item'),
  ]);
  const binEls = /** @type {HTMLElement[]} */ ([...container.querySelectorAll('.trash-task__bin')]);

  if (!root || !stage || typeof gsap === 'undefined') {
    return () => {};
  }

  let thoughtPulseTween = null;
  let taskComplete = false;
  let sortedCount = 0;
  /** @type {import('gsap').Draggable[]} */
  const draggables = [];
  /** @type {Map<HTMLElement, { homeX: number, homeY: number, kind: string, done: boolean }>} */
  const itemState = new Map();

  const burstSparkParticles = () => {
    burstMinigameSparkParticles(particles, stage, 0.32, 0.38);
  };

  function pulseThoughtBubble() {
    if (!thoughtBubble) {
      return;
    }
    gsap.set(thoughtBubble, { scale: 0.88, opacity: 0 });
    gsap.to(thoughtBubble, {
      scale: 1,
      opacity: 1,
      duration: 0.4,
      ease: 'back.out(2)',
      onComplete: () => {
        thoughtPulseTween = gsap.to(thoughtBubble, {
          scale: 1.04,
          duration: 0.9,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
        });
      },
    });
  }

  function showSortHint(kind) {
    if (!bubbleIcon || !bubbleText || taskComplete) {
      return;
    }
    const icon = TRASH_HINT_ICONS[kind] || TRASH_HINT_ICONS.plastic;
    bubbleIcon.innerHTML = icon;
    bubbleText.textContent = `Не тот бак! Эту вещь — в ${TRASH_BIN_LABELS[kind] || 'нужный бак'}.`;
    gsap.fromTo(
      thoughtBubble,
      { scale: 1 },
      { scale: 1.06, duration: 0.2, yoyo: true, repeat: 1, ease: 'power2.out' }
    );
  }

  function onAllSorted() {
    if (taskComplete) {
      return;
    }
    taskComplete = true;
    root.classList.add('trash-task--done');
    if (thoughtPulseTween) {
      thoughtPulseTween.kill();
      thoughtPulseTween = null;
    }
    if (bubbleIcon) {
      bubbleIcon.innerHTML =
        '<svg viewBox="0 0 28 28" width="26" height="26" aria-hidden="true"><path fill="#3cb878" d="M11.5 20.2 6.2 14.8l2.4-2.4 3 3 8.4-8.4 2.4 2.4z"/></svg>';
    }
    if (bubbleText) {
      bubbleText.textContent = 'Ура! Полянка чистая — молодец!';
    }
    thoughtBubble?.classList.add('trash-task__bubble--done');
    celebrateModalLampikTaskComplete();
    burstSparkParticles();
    enableNextButton();
    const mascotBubble = document.getElementById('trash-mascot-bubble');
    if (mascotBubble) {
      gsap.to(mascotBubble, { opacity: 0, scale: 0.6, duration: 0.35, onComplete: () => mascotBubble.remove() });
    }
  }

  /**
   * @param {HTMLElement} itemEl
   * @returns {string | null}
   */
  function binUnderItem(itemEl) {
    const ir = itemEl.getBoundingClientRect();
    const cx = ir.left + ir.width * 0.5;
    const cy = ir.top + ir.height * 0.55;
    for (const bin of binEls) {
      const br = bin.getBoundingClientRect();
      const pad = 6;
      if (cx >= br.left - pad && cx <= br.right + pad && cy >= br.top - pad && cy <= br.bottom + pad) {
        return bin.dataset.kind || null;
      }
    }
    return null;
  }

  /**
   * @param {HTMLElement} itemEl
   * @param {HTMLElement} binEl
   */
  function absorbIntoBin(itemEl, binEl) {
    const br = binEl.getBoundingClientRect();
    const sr = stage.getBoundingClientRect();
    const ir = itemEl.getBoundingClientRect();
    const curX = Number(gsap.getProperty(itemEl, 'x')) || 0;
    const curY = Number(gsap.getProperty(itemEl, 'y')) || 0;
    const targetClientX = br.left + br.width * 0.5 - ir.width * 0.5;
    const targetClientY = br.top + br.height * 0.38 - ir.height * 0.5;
    gsap.to(itemEl, {
      x: curX + (targetClientX - ir.left),
      y: curY + (targetClientY - ir.top),
      scale: 0.35,
      opacity: 0,
      duration: 0.35,
      ease: 'power2.in',
      onComplete: () => {
        itemEl.style.visibility = 'hidden';
        itemEl.style.pointerEvents = 'none';
      },
    });
    playMiniGameSuccessPlop();
    const starX = br.left + br.width * 0.5 - sr.left;
    const starY = br.top + br.height * 0.22 - sr.top;
    spawnTrashSortStar(stage, starX, starY);
    binEl.classList.add('trash-task__bin--pop');
    gsap.fromTo(
      binEl,
      { scale: 1 },
      { scale: 1.06, duration: 0.18, yoyo: true, repeat: 1, ease: 'power2.out' }
    );
  }

  function snapItemHome(itemEl) {
    const st = itemState.get(itemEl);
    if (!st) {
      return;
    }
    gsap.to(itemEl, {
      x: st.homeX,
      y: st.homeY,
      duration: 0.95,
      ease: 'elastic.out(1, 0.55)',
    });
  }

  function captureHomes() {
    for (const el of itemEls) {
      const kind = el.dataset.kind || '';
      const x = Number(gsap.getProperty(el, 'x')) || 0;
      const y = Number(gsap.getProperty(el, 'y')) || 0;
      itemState.set(el, { homeX: x, homeY: y, kind, done: false });
    }
  }

  requestAnimationFrame(() => {
    captureHomes();
  });

  pulseThoughtBubble();

  if (typeof Draggable !== 'undefined') {
    for (const itemEl of itemEls) {
      const d = Draggable.create(itemEl, {
        type: 'x,y',
        bounds: stage,
        inertia: false,
        cursor: 'grab',
        activeCursor: 'grabbing',
        zIndexBoost: true,
        onPress() {
          if (taskComplete || itemState.get(itemEl)?.done) {
            this.endDrag();
          }
        },
        onDragStart() {
          ensureMiniGameAudioContext();
          gsap.to(itemEl, { scale: 1.08, duration: 0.15, ease: 'power2.out' });
        },
        onDragEnd() {
          if (taskComplete || itemState.get(itemEl)?.done) {
            return;
          }
          gsap.to(itemEl, { scale: 1, duration: 0.2, ease: 'power2.out' });
          const kind = itemEl.dataset.kind || '';
          const hitKind = binUnderItem(itemEl);
          if (!hitKind) {
            snapItemHome(itemEl);
            return;
          }
          if (hitKind !== kind) {
            showSortHint(kind);
            snapItemHome(itemEl);
            return;
          }
          const binEl = binEls.find((b) => b.dataset.kind === hitKind);
          if (!binEl) {
            snapItemHome(itemEl);
            return;
          }
          const st = itemState.get(itemEl);
          if (st) {
            st.done = true;
          }
          this.disable();
          absorbIntoBin(itemEl, binEl);
          sortedCount += 1;
          if (sortedCount >= itemEls.length) {
            gsap.delayedCall(0.45, onAllSorted);
          }
        },
      })[0];
      draggables.push(d);
    }
  } else {
    console.warn('[trash-task] GSAP Draggable не загружен');
  }

  return () => {
    if (thoughtPulseTween) {
      thoughtPulseTween.kill();
      thoughtPulseTween = null;
    }
    for (const d of draggables) {
      d.kill();
    }
    draggables.length = 0;
    const killTargets = [...itemEls, ...binEls, thoughtBubble];
    gsap.killTweensOf(killTargets);
    particles?.querySelectorAll('.minigame-burst-spark, .trash-task__sort-star').forEach((el) => el.remove());
  };
}

/** @param {string | null | undefined} minigameId */
function mountTaskModalMiniGameById(minigameId) {
  teardownTaskModalMiniGame();
  const content = document.getElementById('task-modal-content');
  if (!content) {
    return;
  }

  const titleEl = document.getElementById('task-modal-title');

  if (minigameId === MINIGAME.KETTLE) {
    if (titleEl) {
      titleEl.textContent = 'Выключи чайник';
    }
    applyKettleTaskModalLayout();
    activeMiniGameTeardown = mountKettleUnplugTask(content);
    return;
  }

  if (minigameId === MINIGAME.TAP) {
    if (titleEl) {
      titleEl.textContent = 'Закрой кран';
    }
    applyTapTaskModalLayout();
    activeMiniGameTeardown = mountTapCloseTask(content);
    return;
  }

  if (minigameId === MINIGAME.LIGHT) {
    if (titleEl) {
      titleEl.textContent = 'Выключи свет';
    }
    applyLightTaskModalLayout();
    activeMiniGameTeardown = mountLightSwitchTask(content);
    return;
  }

  if (minigameId === MINIGAME.TRASH) {
    if (titleEl) {
      titleEl.textContent = 'Сортируй мусор';
    }
    applyTrashTaskModalLayout();
    activeMiniGameTeardown = mountTrashSortTask(content);
    return;
  }

  if (minigameId === MINIGAME.PHONE) {
    if (titleEl) {
      titleEl.textContent = 'Заряди телефон';
    }
    applyPhoneTaskModalLayout();
    activeMiniGameTeardown = mountPhoneChargeTask(content);
    return;
  }

  if (minigameId === MINIGAME.FRIDGE) {
    if (titleEl) {
      titleEl.textContent = 'Закрой холодильник';
    }
    applyFridgeTaskModalLayout();
    activeMiniGameTeardown = mountFridgeCloseTask(content);
    return;
  }

  if (minigameId === MINIGAME.TV) {
    if (titleEl) {
      titleEl.textContent = 'Выключи телевизор';
    }
    applyTvTaskModalLayout();
    activeMiniGameTeardown = mountTvPowerOffTask(content);
    return;
  }

  if (titleEl) {
    titleEl.textContent = 'Все задания сделаны!';
  }
  content.innerHTML =
    '<p class="task-modal__placeholder">Ты уже выполнил все мини-задания на этом пути. Лампик гордится! Можно идти дальше.</p>';
  requestAnimationFrame(() => {
    if (taskModalState.open && !taskModalState.closing) {
      enableNextButton();
    }
  });
}

function planWalkSteps(fromX, fromY, toX, toY, env) {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.hypot(dx, dy);
  const stepPx = env.walkStepPx ?? WALK_DEFAULTS.stepPx;
  const maxSteps = env.walkMaxSteps ?? WALK_DEFAULTS.maxSteps;
  let stepCount = Math.max(1, Math.round(dist / stepPx));
  stepCount = Math.min(stepCount, maxSteps);
  const legDuration = Math.max(WALK_DEFAULTS.minLegDuration, env.walkLegDuration ?? 0.22);
  const cycleDuration = legDuration * 2;
  return {
    stepCount,
    cycleDuration,
    legDuration,
    dx,
    dy,
    dist,
    totalDuration: stepCount * cycleDuration,
  };
}

class MainScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainScene' });
    this.lampikRoot = null;
    this.lampik = null;
    this.mapImage = null;
    this.idleTween = null;
    this.moveTween = null;
    this.lampikBaseY = 0;
    this.lampikBaseX = 0;
    this.lampikBaseScaleX = 1;
    this.lampikBaseScaleY = 1;
    this.lampikBaseRotation = 0;
    this.currentStopIndex = 0;
    /** @type {'a' | 'b' | null} */
    this.routeBranch = null;
    this.isMoving = false;
    this.isTaskModalOpen = false;
    this.stopsScreen = [];
    this.stopMarkers = [];
    /** @type {Phaser.GameObjects.Arc[]} */
    this.forkMarkers = [];
    this.bakedCharacter = null;
    this.displayHeight = 110;
  }

  preload() {
    if (isFileProtocol() && injectFileProtocolTextures(this)) {
      return;
    }

    const mapPath = window.GAME_ENV?.mapImagePath || 'assets/map4.png';
    this.load.image('map', encodeAssetPath(mapPath));
    const lampikPath =
      window.GAME_ENV?.lampikImagePath || 'assets/_lampik-remove-background.com (1).png';
    const lampikUrl = encodeAssetPath(lampikPath);
    this.load.image(LAMPIK_TEXTURE_KEY, lampikUrl);
    this.load.on(`loaderror`, (file) => {
      if (file.key === 'map' || file.key === LAMPIK_TEXTURE_KEY) {
        console.error('[lampik] Ошибка загрузки:', file.key, file.url);
      }
    });

    const env = window.GAME_ENV;
    if (env?.useWalkSpritesheet && env.walkSheetPath) {
      this.load.spritesheet(WALK_SPRITE.key, encodeAssetPath(env.walkSheetPath), {
        frameWidth: env.walkFrameWidth,
        frameHeight: env.walkFrameHeight,
      });
    }
  }

  ensureWalkAnimation() {
    const env = window.GAME_ENV;
    if (!env?.useWalkSpritesheet || !this.textures.exists(WALK_SPRITE.key)) {
      return false;
    }
    if (this.anims.exists(WALK_SPRITE.animKey)) {
      return true;
    }

    const endFrame = Math.max(0, (env.walkFrameCount || 1) - 1);
    this.anims.create({
      key: WALK_SPRITE.animKey,
      frames: this.anims.generateFrameNumbers(WALK_SPRITE.key, { start: 0, end: endFrame }),
      frameRate: env.walkFrameRate || 10,
      repeat: -1,
    });
    return true;
  }

  bindLampikPointer() {
    if (!this.lampikRoot) {
      return;
    }
    const w = this.bakedCharacter?.displayWidth ?? 80;
    const h = this.bakedCharacter?.displayHeight ?? 110;
    this.lampikRoot.setInteractive(
      new Phaser.Geom.Rectangle(-w * 0.5, -h, w, h),
      Phaser.Geom.Rectangle.Contains
    );
    this.lampikRoot.input.cursor = 'pointer';
    this.lampikRoot.removeAllListeners('pointerdown');
    this.lampikRoot.on('pointerdown', () => {
      onGameAudioUnlocked();
      if (!this.isMoving && !this.isTaskModalOpen) {
        this.playJumpAnimation();
      }
    });
  }

  create() {
    if (!this.textures.exists('map')) {
      console.error(
        '[lampik] Карта не загружена. При file:// нужны папка assets/ и env.local.js; лучше dist-usb/'
      );
    } else {
      setTextureSmoothFilter(this, 'map');
    }
    if (!this.textures.exists(LAMPIK_TEXTURE_KEY)) {
      console.error('[lampik] PNG не загрузился — проверьте LAMPIK_IMAGE_PATH и пути к assets/');
    } else {
      setTextureSmoothFilter(this, LAMPIK_TEXTURE_KEY);
    }
    this.cameras.main.setRoundPixels(true);

    const env = window.GAME_ENV;
    this.displayHeight = env.lampikDisplayHeight;
    this.mapLayout = null;

    this.input.setTopOnly(true);

    this.buildWorld();
    this.refreshStopMarkersInteractivity();

    this.scale.on('resize', this.onGameResize, this);
    this.input.keyboard?.on('keydown-SPACE', () => this.playJumpAnimation());

    this.ensureWalkAnimation();
    this.bindLampikPointer();

    console.info(`[Лампик] jump tuning v${JUMP_TUNING_REV}`, jumpConfig(env));
  }

  getMarkerRadius(env) {
    const layout = this.mapLayout;
    if (!layout || !isCompactMapViewport(layout, this.scale.width)) {
      return env.stopMarkerRadius;
    }
    return mapLayoutUiPx(layout, env.stopMarkerRadius, 7);
  }

  getMarkerHitRadius(visualRadius) {
    return markerTouchHitRadius(visualRadius);
  }

  buildWorld() {
    const { width, height } = this.scale;
    const env = window.GAME_ENV;
    const mapSize = { width: env.mapWidth, height: env.mapHeight };
    const screenSize = { width, height };

    this.mapLayout = computeMapLayout(mapSize, screenSize);
    this.displayHeight = resolveLampikDisplayHeight(this.mapLayout, width, height, env);

    if (this.mapImage) {
      this.mapImage.destroy();
    }
    this.mapImage = this.add.image(width * 0.5, height * 0.5, 'map');
    this.mapImage.setDisplaySize(this.mapLayout.displayW, this.mapLayout.displayH);
    this.mapImage.setDepth(0);

    this.stopsScreen = routeToScreen(buildFullRoute(env, this.routeBranch), env, width, height);

    const profile = resolveLampikDisplay(this, this.displayHeight, env);
    if (!this.bakedCharacter || this.bakedCharacter.cacheKey !== profile.cacheKey) {
      this.bakedCharacter = profile;
    }

    const start = this.stopsScreen[this.currentStopIndex];
    const lampikX = Math.round(start.x);
    const lampikY = Math.round(start.y);

    if (!this.lampikRoot) {
      this.lampikRoot = this.add.container(lampikX, lampikY);
      this.lampikRoot.setDepth(10);
      this.lampik = this.add.sprite(0, 0, this.bakedCharacter.key);
      this.lampik.setOrigin(0.5, 1);
      this.lampik.setDisplaySize(this.bakedCharacter.displayWidth, this.bakedCharacter.displayHeight);
      this.lampikRoot.add(this.lampik);
    } else {
      this.lampikRoot.setPosition(lampikX, lampikY);
      this.lampik.setTexture(this.bakedCharacter.key);
      this.lampik.setDisplaySize(this.bakedCharacter.displayWidth, this.bakedCharacter.displayHeight);
    }

    this.syncLampikBases();
    this.bindLampikPointer();

    if (!this.isMoving) {
      this.applyDefaultFacing();
    }

    this.destroyStopMarkers();
    this.destroyForkMarkers();
    this.createStopMarkers(env);
    if (this.isAtRouteFork()) {
      this.createForkMarkers(env);
    }

    if (!this.isMoving) {
      this.startIdleAnimation();
    }
  }

  getRouteStopCount() {
    return this.stopsScreen.length;
  }

  /** @param {number} index */
  getWaypoint(index) {
    return this.stopsScreen[index] ?? null;
  }

  isAtRouteFork() {
    return (
      this.routeBranch === null &&
      this.currentStopIndex === ROUTE_FORK_FROM_INDEX &&
      !this.isMoving &&
      !this.isTaskModalOpen
    );
  }

  isOnFinishStop() {
    const wp = this.getWaypoint(this.currentStopIndex);
    return wp?.id === 'finish';
  }

  getForwardSign() {
    return forwardSignFromScaleX(this.lampik.scaleX, window.GAME_ENV);
  }

  applyDefaultFacing() {
    if (!this.lampik || !this.stopsScreen.length) {
      return;
    }
    const env = window.GAME_ENV;
    const here = this.getWaypoint(this.currentStopIndex);
    if (here?.id === 'start') {
      // У таблички старта — лицом к родителям / городу (не в сторону дороги)
      this.lampik.scaleX = scaleXForFaceRight(false, this.lampikBaseScaleX, env);
      return;
    }
    if (here?.id === 'finish') {
      // У бабушки с дедушкой — зеркало относительно последнего участка дорожки (лицом к дому)
      const prev = this.stopsScreen[this.currentStopIndex - 1];
      let faceRight = true;
      if (prev) {
        const dx = here.x - prev.x;
        const dy = here.y - prev.y;
        faceRight = !resolveFaceRight(dx, dy, env);
      }
      this.lampik.scaleX = scaleXForFaceRight(faceRight, this.lampikBaseScaleX, env);
      return;
    }
    const next = this.stopsScreen[this.currentStopIndex + 1];
    if (next) {
      this.setFacingToward(next.x, next.y);
      return;
    }
    const faceRight = env?.lampikDefaultFaceRight !== false;
    this.lampik.scaleX = scaleXForFaceRight(faceRight, this.lampikBaseScaleX, env);
  }

  setFacingToward(targetX, targetY) {
    if (!this.lampikRoot || !this.lampik) {
      return;
    }
    const dx = targetX - this.lampikRoot.x;
    const dy = targetY - this.lampikRoot.y;
    const env = window.GAME_ENV;
    const faceRight = resolveFaceRight(dx, dy, env);
    this.lampik.scaleX = scaleXForFaceRight(faceRight, this.lampikBaseScaleX, env);
  }

  syncLampikBases() {
    if (!this.lampikRoot || !this.lampik) {
      return;
    }
    this.lampikBaseX = this.lampikRoot.x;
    this.lampikBaseY = this.lampikRoot.y;
    const absScaleX = Math.abs(this.lampik.scaleX);
    this.lampikBaseScaleX = absScaleX > 0 ? absScaleX : 1;
    this.lampikBaseScaleY = this.lampik.scaleY || 1;
    this.lampikBaseRotation = this.lampik.rotation;
  }

  killMarkerPulse(marker) {
    if (!marker) {
      return;
    }
    const tw = marker.getData('pulseTween');
    if (tw) {
      tw.stop();
      tw.remove();
    }
    marker.setData('pulseTween', null);
    const base = marker.getData('pulseBaseScale');
    if (typeof base === 'number') {
      marker.setScale(base);
    }
  }

  startMarkerPulse(marker, baseScale) {
    this.killMarkerPulse(marker);
    marker.setData('pulseBaseScale', baseScale);
    marker.setScale(baseScale);
    const peak = baseScale * NEXT_MARKER.pulseScaleMult;
    const tween = this.tweens.add({
      targets: marker,
      scale: peak,
      duration: NEXT_MARKER.pulseMs,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    marker.setData('pulseTween', tween);
  }

  destroyStopMarkers() {
    for (const marker of this.stopMarkers) {
      this.killMarkerPulse(marker);
      marker.destroy();
    }
    this.stopMarkers = [];
  }

  destroyForkMarkers() {
    for (const marker of this.forkMarkers) {
      this.killMarkerPulse(marker);
      marker.destroy();
    }
    this.forkMarkers = [];
  }

  createForkMarkers(env) {
    const envRef = window.GAME_ENV;
    const { width, height } = this.scale;
    const forks = mapForkToScreen(envRef, width, height);
    const radius = this.getMarkerRadius(env);
    const hitR = this.getMarkerHitRadius(radius);
    const entries = [
      { branch: 'a', ...forks.a },
      { branch: 'b', ...forks.b },
    ];

    for (const fork of entries) {
      const marker = this.add.circle(Math.round(fork.x), Math.round(fork.y), radius, 0xffffff, env.stopMarkerNextAlpha);
      marker.setStrokeStyle(4, 0xfff3a0, 0.95);
      marker.setDepth(16);
      marker.setData('forkBranch', fork.branch);
      marker.setInteractive(new Phaser.Geom.Circle(0, 0, hitR), Phaser.Geom.Circle.Contains);
      marker.input.cursor = 'pointer';
      bindMarkerTap(marker, () => this.onForkMarkerClicked(fork.branch));
      this.forkMarkers.push(marker);
      this.startMarkerPulse(marker, NEXT_MARKER.radiusMult);
    }
  }

  /** @param {'a' | 'b'} branch */
  onForkMarkerClicked(branch) {
    if (!this.isAtRouteFork() || this.isMoving || this.isTaskModalOpen) {
      return;
    }
    this.routeBranch = branch;
    const env = window.GAME_ENV;
    const { width, height } = this.scale;
    this.stopsScreen = routeToScreen(buildFullRoute(env, branch), env, width, height);
    this.destroyForkMarkers();
    this.destroyStopMarkers();
    this.createStopMarkers(env);
    this.moveToNextStop();
  }

  setMarkerInteractive(marker, env, isNext) {
    const radius = this.getMarkerRadius(env);
    const hitRadius = isNext ? this.getMarkerHitRadius(radius) : Math.max(22, radius * 1.1);

    if (isNext) {
      marker.setInteractive(
        new Phaser.Geom.Circle(0, 0, hitRadius),
        Phaser.Geom.Circle.Contains
      );
      marker.input.cursor = 'pointer';
    } else {
      marker.disableInteractive();
    }
  }

  syncNextMarkerVisual(marker, env, isNext) {
    marker.setStrokeStyle(isNext ? 4 : 1, isNext ? 0xfff3a0 : 0xffffff, isNext ? 0.9 : env.stopMarkerAlpha + 0.15);
    const baseScale = isNext ? NEXT_MARKER.radiusMult : 1;
    if (isNext) {
      this.startMarkerPulse(marker, baseScale);
    } else {
      this.killMarkerPulse(marker);
      marker.setScale(1);
    }
  }

  /** Маркер только на следующей остановке (старт и пройденные — без кругов). */
  createStopMarkers(env) {
    this.destroyStopMarkers();
    if (this.isAtRouteFork() || this.isMoving || this.isTaskModalOpen) {
      return;
    }
    const nextIndex = this.currentStopIndex + 1;
    if (nextIndex >= this.getRouteStopCount()) {
      return;
    }
    const stop = this.stopsScreen[nextIndex];
    if (!stop) {
      return;
    }

    const radius = this.getMarkerRadius(env);
    const alpha = env.stopMarkerNextAlpha;
    const marker = this.add.circle(Math.round(stop.x), Math.round(stop.y), radius, 0xffffff, alpha);
    marker.setStrokeStyle(4, 0xfff3a0, 0.9);
    marker.setDepth(15);
    marker.setData('stopIndex', nextIndex);

    this.setMarkerInteractive(marker, env, true);
    bindMarkerTap(marker, () => this.onStopMarkerClicked(nextIndex));
    this.startMarkerPulse(marker, NEXT_MARKER.radiusMult);
    this.stopMarkers.push(marker);
  }

  refreshStopMarkersInteractivity() {
    const env = window.GAME_ENV;
    const atFork = this.isAtRouteFork();

    if (atFork && this.forkMarkers.length === 0) {
      this.createForkMarkers(env);
    } else if (!atFork) {
      this.destroyForkMarkers();
    }

    this.createStopMarkers(env);

    for (const marker of this.forkMarkers) {
      marker.setAlpha(atFork ? env.stopMarkerNextAlpha : 0);
      if (atFork) {
        const r = this.getMarkerRadius(env);
        marker.setInteractive(
          new Phaser.Geom.Circle(0, 0, this.getMarkerHitRadius(r)),
          Phaser.Geom.Circle.Contains
        );
        if (!marker.getData('pulseTween')) {
          this.startMarkerPulse(marker, 1);
        }
      } else {
        this.killMarkerPulse(marker);
        marker.disableInteractive();
      }
    }
  }

  onStopMarkerClicked(stopIndex) {
    onGameAudioUnlocked();
    if (this.isMoving || this.isTaskModalOpen) {
      return;
    }
    const expected = this.currentStopIndex + 1;
    if (stopIndex !== expected) {
      return;
    }
    this.moveToNextStop();
  }

  moveToNextStop() {
    const nextIndex = this.currentStopIndex + 1;
    if (this.isAtRouteFork()) {
      return;
    }
    if (this.isMoving || nextIndex >= this.getRouteStopCount() || !this.lampikRoot) {
      return;
    }

    const fromWp = this.stopsScreen[this.currentStopIndex];
    const target = this.stopsScreen[nextIndex];
    const targetX = Math.round(target.x);
    const targetY = Math.round(target.y);

    const fromX = this.lampikRoot.x;
    const fromY = this.lampikRoot.y;
    const env = window.GAME_ENV;
    const { width, height } = this.scale;
    const path = buildWalkScreenPath(
      fromX,
      fromY,
      fromWp?.id,
      target?.id,
      targetX,
      targetY,
      env,
      width,
      height
    );

    this.isMoving = true;
    this.refreshStopMarkersInteractivity();
    this.pauseIdleAnimation();
    onGameAudioUnlocked();
    this.prepareWalkVisuals(targetX, targetY);

    if (this.moveTween) {
      this.moveTween.kill();
    }
    this.stopWalkFootsteps();

    gsap.killTweensOf([this.lampikRoot, this.lampik]);

    const walkPlan = planWalkSteps(fromX, fromY, targetX, targetY, env);
    this.startWalkFootsteps(walkPlan.cycleDuration);

    const finishMove = () => {
      this.stopWalkFootsteps();
      this.stopWalkVisuals();
      this.currentStopIndex = nextIndex;
      this.lampikRoot.setPosition(targetX, targetY);
      this.lampik.setPosition(0, 0);
      this.syncLampikBases();
      this.isMoving = false;
      this.moveTween = null;
      if (this.getWaypoint(nextIndex)?.id === 'finish') {
        this.applyDefaultFacing();
      }
      onStopReached(nextIndex);
      this.refreshStopMarkersInteractivity();
      this.startIdleAnimation();
    };

    this.moveTween = this.buildPathWalkTimeline(path, finishMove);
  }

  startWalkFootsteps(cycleDurationSec) {
    startWalkFootstepRhythm(cycleDurationSec);
  }

  stopWalkFootsteps() {
    stopWalkFootstepRhythm();
  }

  /**
   * @param {{ x: number, y: number }[]} path
   * @param {() => void} onComplete
   */
  buildPathWalkTimeline(path, onComplete) {
    const env = window.GAME_ENV;
    const segments = [];
    for (let i = 0; i < path.length - 1; i += 1) {
      const a = path[i];
      const b = path[i + 1];
      const plan = planWalkSteps(a.x, a.y, b.x, b.y, env);
      segments.push({ a, b, plan });
    }

    if (segments.length === 0) {
      onComplete();
      return null;
    }

    const master = gsap.timeline({
      onComplete,
    });

    let tOffset = 0;
    segments.forEach((seg, index) => {
      const { a, b, plan } = seg;
      if (index > 0) {
        master.add(() => {
          this.setFacingToward(b.x, b.y);
        }, tOffset);
      }
      const segTl = this.buildStepWalkTimeline(a.x, a.y, b.x, b.y, plan, () => {});
      master.add(segTl, tOffset);
      tOffset += plan.totalDuration;
    });

    return master;
  }

  prepareWalkVisuals(targetX, targetY) {
    this.setFacingToward(targetX, targetY);
    this.lampik.y = 0;
    this.lampik.x = 0;
    this.lampik.rotation = 0;

    const env = window.GAME_ENV;
    if (env?.useWalkSpritesheet && this.ensureWalkAnimation()) {
      this.lampik.setTexture(WALK_SPRITE.key);
      this.lampik.setDisplaySize(this.bakedCharacter.displayWidth, this.bakedCharacter.displayHeight);
      this.lampik.anims.play(WALK_SPRITE.animKey);
    }
  }

  buildStepWalkTimeline(fromX, fromY, toX, toY, plan, onComplete) {
    const tl = gsap.timeline({
      onUpdate: () => {
        this.lampikBaseX = this.lampikRoot.x;
        this.lampikBaseY = this.lampikRoot.y;
      },
      onComplete,
    });

    const { stepCount, cycleDuration, legDuration, dx, dy } = plan;
    const sy = this.lampikBaseScaleY;
    const fwd = this.getForwardSign();
    const rad = (WALK_PROCEDURAL.leanDeg * Math.PI) / 180;
    const useSpriteWalk = Boolean(window.GAME_ENV?.useWalkSpritesheet && this.anims.exists(WALK_SPRITE.animKey));
    const liftPart = 0.42;

    for (let i = 0; i < stepCount; i += 1) {
      const phase = (i + 1) / stepCount;
      const landX = fromX + dx * phase;
      const landY = fromY + dy * phase;
      const t0 = i * cycleDuration;

      tl.to(
        this.lampikRoot,
        {
          x: landX,
          y: landY,
          duration: cycleDuration,
          ease: 'sine.inOut',
        },
        t0
      );

      if (!useSpriteWalk) {
        tl.to(
          this.lampik,
          {
            y: -WALK_PROCEDURAL.bobY,
            scaleY: sy * WALK_PROCEDURAL.strideScaleY,
            rotation: fwd * rad,
            duration: cycleDuration * liftPart,
            ease: 'sine.out',
          },
          t0
        );
        tl.to(
          this.lampik,
          {
            y: 0,
            scaleY: sy * WALK_PROCEDURAL.squatScaleY,
            rotation: 0,
            duration: cycleDuration * (1 - liftPart),
            ease: 'sine.in',
          },
          t0 + cycleDuration * liftPart
        );
      }

    }

    return tl;
  }

  stopWalkVisuals() {
    if (!this.lampik) {
      return;
    }

    if (this.lampik.anims?.isPlaying) {
      this.lampik.anims.stop();
    }

    if (this.bakedCharacter?.key) {
      this.lampik.setTexture(this.bakedCharacter.key);
      this.lampik.setDisplaySize(this.bakedCharacter.displayWidth, this.bakedCharacter.displayHeight);
    }

    this.lampik.x = 0;
    this.lampik.y = 0;
    this.lampik.rotation = this.lampikBaseRotation;
    this.lampik.scaleY = this.lampikBaseScaleY;
  }

  onGameResize() {
    if (this.isMoving) {
      return;
    }
    this.buildWorld();
    this.refreshStopMarkersInteractivity();
  }

  startIdleAnimation() {
    if (this.idleTween) {
      this.idleTween.stop();
      this.idleTween = null;
    }

    if (!this.lampik || this.isMoving) {
      return;
    }

    this.lampik.y = 0;

    const layout = this.mapLayout;
    const bobDesign = window.GAME_ENV?.idleBobPx ?? 6;
    const motion = layout ? mapMotionUiScale(layout, this.scale.width) : 1;
    const bobPx = Math.max(2, Math.round(bobDesign * motion));

    this.idleTween = this.tweens.add({
      targets: this.lampik,
      y: -bobPx,
      duration: 1200,
      ease: 'Sine.easeInOut',
      yoyo: true,
      repeat: -1,
    });
  }

  pauseIdleAnimation() {
    if (this.idleTween) {
      this.idleTween.pause();
    }
  }

  /** Сбрасываем покой, иначе GSAP прыжок наслаивается на смещённый idle-y */
  clearIdleBeforeAction() {
    if (this.idleTween) {
      this.idleTween.stop();
      this.idleTween = null;
    }
    if (this.lampik) {
      this.lampik.y = 0;
    }
  }

  resumeIdleAnimation() {
    if (this.idleTween) {
      this.idleTween.resume();
      return;
    }
    this.startIdleAnimation();
  }

  playJumpAnimation() {
    if (!this.lampik || this.lampik.getData('jumping') || this.isMoving || this.isTaskModalOpen) {
      return;
    }

    this.lampik.setData('jumping', true);
    this.clearIdleBeforeAction();

    const j = jumpConfig(window.GAME_ENV);
    const motion = this.mapLayout ? mapMotionUiScale(this.mapLayout, this.scale.width) : 1;
    const jumpY = Math.max(8, Math.round(j.heightPx * motion));
    const sx = this.lampik.scaleX;
    const sy = this.lampikBaseScaleY;
    const fwd = this.getForwardSign();
    const lean = (j.leanDeg * Math.PI) / 180;
    const slideX = j.forwardPx > 0 ? fwd * Math.round(j.forwardPx * motion) : 0;
    const useBounces = j.reboundPx > 0 || j.rebound2Px > 0 || j.rebound3Px > 0;

    gsap.killTweensOf([this.lampikRoot, this.lampik]);

    const finishJump = () => {
      this.lampik.setData('jumping', false);
      this.lampik.setPosition(0, 0);
      this.lampik.rotation = 0;
      this.lampik.scaleX = sx;
      this.lampik.scaleY = sy;
      this.startIdleAnimation();
    };

    const tl = gsap.timeline({ onComplete: finishJump });

    tl.to(this.lampik, {
      scaleX: sx * 1.12,
      scaleY: sy * j.prepSquashY,
      y: 4,
      duration: j.prep,
      ease: 'sine.in',
    })
      .to(this.lampik, {
        y: -jumpY,
        x: slideX,
        rotation: slideX ? fwd * lean : 0,
        scaleX: sx * 0.94,
        scaleY: sy * j.stretchY,
        duration: j.launch,
        ease: 'sine.out',
      });

    if (j.hang > 0) {
      tl.to(this.lampik, {
        scaleY: sy * (j.stretchY * 0.98),
        duration: j.hang,
        ease: 'sine.inOut',
      });
    }

    tl.to(this.lampik, {
      y: 0,
      x: slideX ? slideX * 0.25 : 0,
      rotation: 0,
      scaleX: sx,
      scaleY: sy * j.landSquashY,
      duration: j.land,
      ease: 'sine.in',
      onStart: () => {
        if (j.camShakeMs > 0) {
          this.cameras.main.shake(j.camShakeMs, 0.0025);
        }
      },
    });

    if (useBounces) {
      appendSpringBounces(tl, this.lampik, j, sx, sy);
    } else {
      tl.to(this.lampik, {
        y: 0,
        x: 0,
        scaleX: sx,
        scaleY: sy,
        rotation: 0,
        duration: Math.max(0.12, j.settle),
        ease: 'sine.inOut',
      });
    }
  }
}

let game;

function initPhaserGame() {
  const config = {
    type: isFileProtocol() ? Phaser.CANVAS : Phaser.AUTO,
    parent: 'game-container',
    banner: false,
    width: window.innerWidth,
    height: window.innerHeight,
    resolution: getDevicePixelRatio(),
    backgroundColor: '#1a1a2e',
    render: {
      antialias: true,
      antialiasGL: true,
      pixelArt: false,
      roundPixels: true,
      powerPreference: 'high-performance',
    },
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    input: {
      activePointers: 2,
      touch: { capture: true },
    },
    scene: MainScene,
  };

  game = new Phaser.Game(config);
  bindGsapToPhaser(game);

  window.addEventListener('resize', () => {
    if (game?.scale) {
      game.scale.resize(window.innerWidth, window.innerHeight);
    }
  });
}

loadProgressFromStorage();
syncSparksHud();
bindTaskModalUi();
bindSparkExchangeUi();
bindVideoSplashUi();
bindGameAudioUnlock();
bindPortraitOrientationGate();

loadGameEnv()
  .then(async (env) => {
    window.GAME_ENV = env;
    syncSparksHud();
    const modalLampik = document.getElementById('task-modal-lampik');
    if (modalLampik && env.lampikImagePath) {
      modalLampik.src = encodeAssetPath(env.lampikImagePath);
    }
    syncTaskModalDismissUi();
    if (isFileProtocol()) {
      try {
        await preloadFileProtocolTextures(env);
      } catch (preloadError) {
        console.error(preloadError);
        document.body.insertAdjacentHTML(
          'beforeend',
          `<p style="color:#fff;text-align:center;padding:1rem;max-width:36rem;margin:0 auto;line-height:1.45">${
            preloadError?.message || preloadError
          }. Проверьте, что рядом с index.html есть папка assets/ (или соберите ./scripts/prepare-usb.sh).</p>`
        );
        return;
      }
    }
    showStartVideoSplash(() => {
      initPhaserGame();
    });
  })
  .catch((error) => {
    console.error(error);
    document.body.insertAdjacentHTML(
      'beforeend',
      `<p style="color:#fff;text-align:center;padding:1rem;max-width:36rem;margin:0 auto;line-height:1.45">${String(error?.message || error)}</p>`
    );
  });