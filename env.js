/**
 * Минимальный парсер .env для статического фронта (без сборщика).
 */
function parseDotEnv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    env[key] = value;
  }
  return env;
}

function readStartFromRaw(raw) {
  let x = Number(raw.STOP_0_X);
  let y = Number(raw.STOP_0_Y);
  if (Number.isNaN(x) || Number.isNaN(y)) {
    x = Number(raw.START_X);
    y = Number(raw.START_Y);
  }
  if (Number.isNaN(x) || Number.isNaN(y)) {
    throw new Error('В .env нужны START_X/START_Y или STOP_0_X/STOP_0_Y (старт на карте)');
  }
  return { x, y };
}

/** @returns {Promise<object>} */
async function loadGameEnv(envUrl = '.env') {
  const response = await fetch(envUrl, { cache: 'no-cache' });
  if (!response.ok) {
    throw new Error(`Не удалось загрузить ${envUrl} (${response.status})`);
  }

  const raw = parseDotEnv(await response.text());

  const mapWidth = Number(raw.MAP_WIDTH);
  const mapHeight = Number(raw.MAP_HEIGHT);

  if ([mapWidth, mapHeight].some((n) => Number.isNaN(n))) {
    throw new Error('В .env должны быть числа: MAP_WIDTH, MAP_HEIGHT');
  }

  const start = readStartFromRaw(raw);

  const lampikDisplayHeight = Number(raw.LAMPIK_DISPLAY_HEIGHT);
  const resolvedHeight = Number.isNaN(lampikDisplayHeight) ? 110 : lampikDisplayHeight;

  const idleBobPx = Number(raw.IDLE_BOB_PX);
  const resolvedBob = Number.isNaN(idleBobPx) ? 6 : idleBobPx;

  const stopMarkerRadius = Number(raw.STOP_MARKER_RADIUS);
  const stopMarkerAlpha = Number(raw.STOP_MARKER_ALPHA);
  const stopMarkerNextAlpha = Number(raw.STOP_MARKER_NEXT_ALPHA);

  const mapImagePath = (raw.MAP_IMAGE_PATH || 'assets/map4.png').trim();

  return {
    startX: start.x,
    startY: start.y,
    start,
    mapWidth,
    mapHeight,
    mapImagePath,
    lampikImagePath: (
      raw.LAMPIK_IMAGE_PATH || 'assets/_lampik-remove-background.com (1).png'
    ).trim(),
    lampikTrimContent: raw.LAMPIK_TRIM_CONTENT !== 'false',
    lampikDisplayHeight: resolvedHeight,
    lampikBakeSuperSample: (() => {
      const v = Number(raw.LAMPIK_BAKE_SUPERSAMPLE);
      if (Number.isNaN(v)) {
        return 1;
      }
      return Math.max(0.25, Math.min(4, v));
    })(),
    idleBobPx: resolvedBob,
    stopMarkerRadius: Number.isNaN(stopMarkerRadius) ? 11 : stopMarkerRadius,
    stopMarkerAlpha: Number.isNaN(stopMarkerAlpha) ? 0.35 : stopMarkerAlpha,
    stopMarkerNextAlpha: Number.isNaN(stopMarkerNextAlpha) ? 0.55 : stopMarkerNextAlpha,
    useWalkSpritesheet: raw.USE_WALK_SPRITESHEET === 'true',
    walkSheetPath: (raw.WALK_SHEET_PATH || '').trim(),
    walkFrameWidth: Number(raw.WALK_FRAME_WIDTH) || 256,
    walkFrameHeight: Number(raw.WALK_FRAME_HEIGHT) || 256,
    walkFrameCount: Number(raw.WALK_FRAME_COUNT) || 8,
    walkFrameRate: Number(raw.WALK_FRAME_RATE) || 10,
    walkStepPx: Number(raw.WALK_STEP_PX) || 22,
    walkMaxSteps: Number(raw.WALK_MAX_STEPS) || 36,
    walkLegDuration: Number(raw.WALK_LEG_DURATION) || 0.22,
    lampikArtFacesLeft: raw.LAMPIK_ART_FACES_LEFT !== 'false',
    lampikDefaultFaceRight: raw.LAMPIK_DEFAULT_FACE_RIGHT !== 'false',
    jumpHeightPx: Number(raw.JUMP_HEIGHT_PX),
    jumpForwardPx: Number(raw.JUMP_FORWARD_PX),
    jumpLeanDeg: Number(raw.JUMP_LEAN_DEG),
    jumpPrepSquashY: Number(raw.JUMP_PREP_SQUASH_Y),
    jumpStretchY: Number(raw.JUMP_STRETCH_Y),
    jumpLandSquashY: Number(raw.JUMP_LAND_SQUASH_Y),
    jumpReboundPx: Number(raw.JUMP_REBOUND_PX),
    jumpRebound2Px: Number(raw.JUMP_REBOUND2_PX),
    jumpRebound3Px: Number(raw.JUMP_REBOUND3_PX),
    jumpElasticEase: (raw.JUMP_ELASTIC_EASE || '').trim() || undefined,
    jumpLaunchEase: (raw.JUMP_LAUNCH_EASE || '').trim() || undefined,
    jumpPrepDuration: Number(raw.JUMP_PREP_DURATION),
    jumpLaunchDuration: Number(raw.JUMP_LAUNCH_DURATION),
    jumpHangDuration: Number(raw.JUMP_HANG_DURATION),
    jumpLandDuration: Number(raw.JUMP_LAND_DURATION),
    jumpReboundDuration: Number(raw.JUMP_REBOUND_DURATION),
    jumpSettleDuration: Number(raw.JUMP_SETTLE_DURATION),
    jumpCamShakeMs: Number(raw.JUMP_CAM_SHAKE_MS),
  /** Пока нет мини-игр: сброс модалки без искры (× / Esc / фон). В проде — false */
    taskModalAllowDismiss: raw.TASK_MODAL_ALLOW_DISMISS !== 'false',
    /** true — сначала пробовать StartLampik.mp4 / FinishLampik.mp4 (нужны файлы в video/) */
    videoSplashUseMp4: raw.VIDEO_SPLASH_USE_MP4 === 'true',
  };
}

window.loadGameEnv = loadGameEnv;