# Атлас истории, мифологии и традиций народов мира

Курсовой проект: веб-приложение — интерактивный историко-культурный атлас (карта + временная шкала + тематические карточки, заметки, мини-тесты).

## Стек

| Слой     | Технологии                                                          |
| -------- | ------------------------------------------------------------------- |
| Монорепо | pnpm workspaces                                                     |
| Backend  | Node.js 24 LTS, NestJS 12, Swagger, Prisma 7, JWT в httpOnly cookie |
| Frontend | React 19, TypeScript, Vite 8                                        |
| БД       | PostgreSQL 18 (Docker Compose)                                      |
| Тесты    | Jest (unit), Jest + Supertest (e2e API), Playwright (UI)            |
| Качество | ESLint (typescript-eslint, type-aware), Prettier, `strict: true`    |

## Структура

```
apps/
  backend/     NestJS API (префикс /api, Swagger на /api/docs)
  frontend/    React + Vite, Playwright-тесты в e2e/
packages/
  shared/      общие типы, константы и функции (formatYear и др.)
docker-compose.yml   postgres (5432) + postgres-test (5433)
```

## Требования

- Node.js **≥ 24.9** (Jest загружает ESM-пакеты NestJS 12 через `require(esm)`, это поддерживается начиная с Node 24.9)
- pnpm 12 (`npm i -g pnpm@12`)
- Docker Desktop (WSL2)

## Быстрый старт

```bash
pnpm install
cp .env.example .env            # Windows PowerShell: Copy-Item .env.example .env
pnpm db:up                      # поднять PostgreSQL (dev + test)
pnpm --filter @atlas/backend db:deploy   # применить миграции
pnpm db:seed                    # заполнить БД (Египет, Греция, admin + demo)
pnpm dev                        # backend :3000 + frontend :5173
```

- Приложение: http://localhost:5173
- API: http://localhost:3000/api/health
- Swagger: http://localhost:3000/api/docs

## Скрипты

| Команда           | Что делает                                              |
| ----------------- | ------------------------------------------------------- |
| `pnpm dev`        | backend и frontend параллельно (watch)                  |
| `pnpm build`      | сборка всех пакетов                                     |
| `pnpm db:up`      | `docker compose up -d`                                  |
| `pnpm db:down`    | остановить контейнеры БД                                |
| `pnpm db:migrate` | `prisma migrate dev` — создать/применить миграцию       |
| `pnpm db:seed`    | идемпотентный seed (повторный запуск не создаёт дублей) |
| `pnpm db:reset`   | **удаляет все данные dev-БД**, пересоздаёт схему и seed |
| `pnpm db:studio`  | Prisma Studio — просмотр данных                         |
| `pnpm lint`       | ESLint по всему репозиторию                             |
| `pnpm format`     | Prettier                                                |
| `pnpm typecheck`  | проверка типов во всех пакетах                          |
| `pnpm test`       | unit-тесты (Jest)                                       |
| `pnpm test:e2e`   | e2e-тесты API (Jest + Supertest)                        |
| `pnpm test:ui`    | UI-тесты Playwright (сами запускают backend и frontend) |

Перед первым запуском UI-тестов: `pnpm --filter @atlas/frontend test:ui:install` (скачивает Chromium).

e2e-тесты работают только с БД `atlas_test` (порт 5433): перед прогоном применяют миграции, перед каждым файлом очищают таблицы. Защита в `test/setup/env.ts` не даёт запустить их на базе, имя которой не оканчивается на `_test`.

Seed-данные лежат в `apps/backend/prisma/seed/` (JSON + GeoJSON). Перед записью они проверяются валидатором; после seed выводится список мест с пометкой `VERIFY` для ручной проверки фактов.

## Аутентификация

- Access-токен (15 мин) и refresh-токен (7 дней) лежат в httpOnly-cookie. Refresh-токен меняется при каждом обновлении; повторное предъявление старого токена завершает все сессии пользователя (BR-03).
- Все маршруты API закрыты по умолчанию; открытые помечены `@Public()`, админские — `@Roles(ADMIN)`.
- Вход, регистрация и refresh ограничены `THROTTLE_AUTH_LIMIT` запросами в минуту с одного IP (по умолчанию 10).
- Демо-учётки из seed: `demo@atlas.local` / `Demo12345`, `admin@atlas.local` / `Admin12345`.
- UI-тесты регистрируют в dev-БД пользователей вида `e2e-*@example.test`.

## Карта и временной срез

- Главная страница `/` — карта (Leaflet, подложка OpenStreetMap; другой тайл-сервер задаётся `VITE_MAP_TILE_URL`).
- Эпоха и год хранятся в URL: `/?era=antiquity&year=-450` (отрицательный год — до н. э., года 0 нет).
- API: `GET /api/eras`, `GET /api/map?year=-450&era=antiquity` (регионы с культурами, у которых есть опубликованные карточки, BR-04; год вне эпохи → 400, BR-05).
- UI-тесты не обращаются к серверу тайлов (запросы блокируются в `e2e/fixtures.ts`).

## Культуры и карточки

- Панель культуры открывается поверх карты: `/cultures/ancient-greece?era=antiquity&year=-450` (`&all=1` — все карточки, `&type=PERSON` — активная вкладка).
- Карточка: `/cards/parthenon` — текст (Markdown), период, источники, связанные карточки в обе стороны, «Показать на карте».
- API: `GET /api/cultures`, `GET /api/cultures/:slug?year=`, `GET /api/cards?cultureId&type&year&eraId&page&pageSize`, `GET /api/cards/:slug`. Пользователь видит только опубликованные карточки, admin — и черновики (BR-06).
- В панели культуры: галерея-карусель иллюстрированных карточек и граф связей (`&view=graph`, API `GET /api/cultures/:slug/graph?year=`).
- Иллюстрации — с Wikimedia Commons (свободные лицензии), подпись с автором, лицензией и ссылкой на страницу файла хранится в `imageCredit`. Все 30 изображений отмечены в seed как VERIFY.
- Регистрация требует согласия на обработку персональных данных (галочка; сервер принимает только `consent: true`), дата согласия хранится в `User.consentAt`.
- UI-компоненты: shadcn/ui (`apps/frontend/src/components/ui`, добавлять командой `pnpm dlx shadcn@latest add <component>` из `apps/frontend`).

## Заметки и экспорт

- API: `GET/POST /api/notes`, `PATCH/DELETE /api/notes/:id`, `GET /api/notes/export?format=md|pdf&lang=ru|en` (Swagger: `/api/docs`).
- Заметка привязана к карточке или культуре; у заметки к карточке сохраняется и культура карточки, поэтому она видна в панели культуры. Чужая заметка — 404 (BR-07).
- Где в интерфейсе: колонка справа на странице карточки, раздел внизу панели культуры, «Последние заметки» на главном экране, блокнот `/notes`, экспорт — в блокноте и профиле.
- PDF собирается на бэкенде библиотекой pdfkit со шрифтом DejaVu Sans (пакет `dejavu-fonts-ttf`) — стандартные PDF-шрифты не содержат кириллицы.

## Поиск

- Страница `/search`: поиск по карточкам, культурам и праздникам; фильтры — тип карточки, культура, регион, эпоха или свой период. Все условия хранятся в URL (`?q=&type=&culture=&region=&era=&from=&to=&page=`).
- API: `GET /api/search?q&type&cultureId&regionId&yearFrom&yearTo&page&pageSize`, `GET /api/regions`.
- Полнотекстовый поиск PostgreSQL: у карточек — хранимая колонка `search_vector` с GIN-индексом, у культур и праздников вектор строится на лету. Каждое слово ищется и как начало слова («парфен» → «Парфенон»), и по русской основе («пирамиды» → «пирамида»). Найденные слова подсвечиваются.
- Без слов поиск показывает каталог карточек по фильтрам (в хронологическом порядке); фильтр по типу ищет только карточки.

## Календарь и «Сегодня в истории»

- Страница `/calendar`: блок «Сегодня в истории» и праздники, сгруппированные по типу даты (точная, сезон, подвижная, приблизительная); у неточных дат показано объяснение. Фильтры — культура и месяц (`?culture=&month=`).
- На главном экране — компактный блок «Сегодня в истории» со ссылкой на календарь.
- API: `GET /api/calendar/today?month&day` (дата пользователя; без параметров — дата сервера), `GET /api/holidays?cultureId&month`.
- «Сегодня» берёт только праздники с точной датой и карточки с `month/day`; если на сегодня ничего нет — показывается ближайшая следующая дата. День событий до 1582 г. (до григорианского календаря) помечается как приблизительный.
- Фильтр по месяцу показывает праздники с точной датой в этом месяце и сезонные праздники этого времени года; подвижные и приблизительные к месяцу не привязаны.

## Замечания по окружению

- Переводы строк — LF (`.gitattributes`, `.editorconfig`), чтобы на Windows не возникало лишних диффов.
- pnpm 12 по умолчанию не запускает install-скрипты зависимостей и не ставит пакеты, опубликованные менее суток назад. Решения по скриптам зафиксированы в `pnpm-workspace.yaml` (`allowBuilds`).
- Один файл `.env` в корне читают и backend (`@nestjs/config`), и frontend (Vite, только переменные `VITE_*`).
