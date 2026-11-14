# Деплой и git

## Что класть в git

| Путь | В git | Зачем |
|------|-------|--------|
| `index.html`, `main.js`, `style.css`, `env.js`, `manifest.webmanifest` | ✅ | Игра |
| `assets/`, `video/` | ✅ | Медиа |
| `.env` | ✅ | Настройки при `fetch` по HTTP |
| `scripts/` | ✅ | Сборка флешки / пакета для хостинга |
| `vendor/` | ❌ | Только офлайн; на сервере — CDN |
| `env.local.js` | ❌ | Копия `.env` для `file://`; на сервере не нужен |
| `dist-usb/`, `dist-remote/` | ❌ | Локальные сборки |

## Что **не** заливать на удалённый сервер

| Путь | Почему |
|------|--------|
| `vendor/` | В `index.html` есть запасная загрузка с jsDelivr |
| `env.local.js` | На HTTP достаточно `.env` |
| `scripts/` | Локальные утилиты |
| `dist-usb/`, `dist-remote/` | Артефакты сборки |
| `.git/`, `.gitignore`, `.deployignore`, `DEPLOY.md` | Служебное |
| `.DS_Store` | Мусор macOS |

## Что **нужно** на сервере (минимум)

```
index.html
main.js
style.css
env.js
manifest.webmanifest
.env
assets/
video/
```

## Команды

```bash
# Папка только под хостинг (без лишнего)
./scripts/pack-remote.sh
# → dist-remote/ — залей содержимое на хостинг

# Папка под флешку (офлайн)
./scripts/prepare-usb.sh
# → dist-usb/
```

После изменения `.env` на флешке: заново `./scripts/prepare-usb.sh`.  
Для сайта: обнови `.env` на сервере (или пересобери `dist-remote` и залей).

## Двойной клик по `index.html` (file://)

Phaser не грузит карту через свой Loader — в `main.js` PNG подгружаются через `Image()` до старта сцены. Нужны:

- **`env.local.js`** (в корне рядом с `index.html`), иначе настройки не прочитаются: `node scripts/generate-env-local.js`
- папки **`assets/`**, **`video/`**, **`vendor/`** (проще собрать `./scripts/prepare-usb.sh` → `dist-usb/`)
- открывать **корневой** `index.html` проекта, не копировать один файл