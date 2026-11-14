#!/usr/bin/env node
/**
 * Кладёт содержимое .env в env.local.js — нужно для открытия index.html с флешки (file://).
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const envPath = path.join(root, '.env');
const outPath = path.join(root, 'env.local.js');

if (!fs.existsSync(envPath)) {
  console.error('Нет файла .env в корне проекта.');
  process.exit(1);
}

const dotenv = fs.readFileSync(envPath, 'utf8');
const body = `/**
 * Сгенерировано scripts/generate-env-local.js — не редактируйте вручную.
 * Нужен для запуска без HTTP-сервера (двойной клик по index.html / флешка).
 */
window.LAMPIK_ENV_DOTENV = ${JSON.stringify(dotenv)};
`;

fs.writeFileSync(outPath, body, 'utf8');
console.log(`OK: ${path.relative(root, outPath)}`);