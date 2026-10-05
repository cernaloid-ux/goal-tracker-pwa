# Nova OS — Audit & Feature Progress

## ✅ Mobile crash fix: done

**Правки вошедшие в коммит "fix: mobile crash (lite mode, single render, safe boot)":**

1. **CSS @media ≤767px** — backdrop-filter:none !important на .glass, .glass-soft, .modal-backdrop, #sidebar; непрозрачные фоны; body{background-attachment:scroll}; убраны transform на .glass-hover:hover и анимация .view/.subview
2. **HTML.lite** — глобальный класс на `<html>` отключает backdrop-filter + animation + transition для всего дерева
3. **app.js showToast()** — убран inline backdrop-filter, сплошной фон rgba(44,44,46,.96)
4. **app.js flushPopup()** — убран inline backdrop-filter
5. **app.js alarm card** (triggerAlarm) — убран inline backdrop-filter
6. **app.js week calendar header** — убран backdrop-filter из sticky header строки
7. **Safe boot guard** — nova-boot key: если есть = lite mode + skip loadFromCloud; иначе записать; удалять через 4 с после успешного init
8. **Single render** — _applyServerData: StateManager.patch() + deferred setTimeout(0){refreshEverything}; убран дублирующий refreshEverything
9. **loadFromCloud LWW skip** — если data.updatedAt ≤ localTs, не применяем серверные данные
10. **history ≤500** — slice(0,500) в save() и в doSync() payload
11. **Tailwind CDN** — ⚠️ ПРОПУЩЕНО (по требованию: Tailwind не трогать)

---

## Пакет H — Срочные UI-исправления на мобильных устройствах

| # | Описание | Статус |
|---|----------|--------|
| H1 | Safe-area top padding on mobile inside `@media (max-width: 767px)` for `main` (`calc(max(env(safe-area-inset-top, 0px), 16px) + 14px) !important`), `.modal` (`padding-top: calc(max(env(safe-area-inset-top, 0px), 16px) + 8px);`), `#toast-stack`, and `#alarm-stack` | ✅ Done (коммит `7aa4da0`) |
| H2 | Date/Time input overflow on mobile: appearance reset, `.modal-card * { min-width: 0 }`, `.field` box-sizing, `#event-time-fields` 2 equal columns, `overflow-x: hidden` on body and app-shell | ✅ Done (коммит `8b777b1`) |

---

## Пакет G — Исправление голосового ввода

| # | Описание | Статус |
|---|----------|--------|
| G1 | `buildGoalFromDraft`: если нет `it.time`, то `scheduledAt = 23:59` и `allDay = true` (`isEvent = false`). Если есть `it.time`, `isEvent = (it.kind === 'event')`. `allDay: (allDay && !isEvent)` | ✅ Done (коммит `2d4bd2b`) |

---

## Пакет B4 — Геймификация и Достижения

| # | Описание | Статус |
|---|----------|--------|
| B4.1 | Boss of the Day: ⭐ кнопка в карточке, закреплённая карточка вверху Tasks с мягкой подсветкой, кнопка "Pick suggested", +3 кристалла награды, canvas-конфетти без backdrop-filter (отключено в lite/reduced-motion), синхронизация через StateManager и `api/sync.js` | ✅ Done (коммит `9ffafca`) |
| B4.2 | Combo streak: 3-я задача за день даёт +1 кристалл, 5-я+ даёт +2 кристалла, сохранение в истории, всплывающий бейдж `Combo ×N`, корректный возврат при uncheck | ✅ Done (коммит `20d953c`) |
| B4.3 | Achievements System: 12 достижений с метаданными и иконками, хуки в `TaskController.complete`, `StoreController.checkout`, обновление стриков | ✅ Done (коммит `9d2c6bf`) |
| B4.4 | Trophy Case: сетка 3×4 в профиле (`#trophy-case-grid`), бейдж прогресса открытых наград, детальные подсказки по наведению/клику | ✅ Done (коммит `fda11a4`) |

---

## Пакет B3 — Статистика и Аналитика (Insights)

| # | Описание | Статус |
|---|----------|--------|
| B3.1 | Activity Heatmap: лёгкий инлайн SVG календарь активности за 26 недель (7 строк × 26 столбцов, 4 оттенка красного, подсказки по дням) | ✅ Done (коммит `9e3431c`) |
| B3.2 | Focus Time Donut: SVG круговая диаграмма распределения времени по категориям за 7d / 30d с переключателем и подсказкой запуска таймера | ✅ Done (коммит `e643f32`) |
| B3.3 | Hourly Productivity: 24 столбца гистограммы по часам выполнения задач + определение «Золотого часа» | ✅ Done (коммит `3a0e33f`) |
| B3.4 | Week-over-week Metrics: сравнение задач, часов фокуса и кристаллов с прошлой неделей с дельтами ▲ / ▼ | ✅ Done (коммит `76a63d8`) |
| B3.5 | Weekly Review Banner: эвристический баннер вверху списка задач в воскресенье после 18:00 или в понедельник утром с кнопкой скрытия | ✅ Done (коммит `38e75a6`) |

---

## Пакет B2 — Plan My Day (Автопланировщик)

| # | Описание | Статус |
|---|----------|--------|
| B2.1 | Scoring & Candidates: выбор задач на сегодня (без времени/allDay) + просроченных + из проектов с дедлайном ≤7 дней. Сортировка: high > mid > low + бонусы | ✅ Done (коммит `cb17c31`) |
| B2.2 | Day Window & Free Slots: расчёт окна дня от wake+30m до bedtime-60m из sleepSettings, учёт занятых интервалов событий и getGhostOccurrences, поиск свободных слотов findFreeSlots() | ✅ Done (коммит `7830462`) |
| B2.3 | First-fit Placement: разбиение задач >120m на части ("Part 1/2"), буфер gap=10m, правило 90/15 (пауза 15m после 90m работы), лимит 6 часов, отслеживание unplaced | ✅ Done (коммит `887d85c`) |
| B2.4 | UI Preview & Settings: кнопка "✨ Plan" в шапках Tasks и Calendar, превью пунктирными карточками в сетке дня с бейджем Proposed, модалка с расписанием и unplaced, кнопки Accept all, Accept single, Shuffle, Discard, настройки в `localStorage['nova-planner']` и Settings modal | ✅ Done (коммит `9ad15de`) |

---

## Пакет C — Верификация

| # | Описание | Статус |
|---|----------|--------|
| C1 | `node --check app.js api/*.js` | ✅ Clean (0 errors) |
| C2 | `grep -r "^import\|^export" api/` | ✅ Clean (strictly CommonJS require/module.exports) |
| C3 | Mobile Test Checklist & Safe execution verification | ✅ Clean |

---

## Пакет S1 — Модуль "Sprint" (SpaceX Time-Boxing: Каркас, UI и Хранилище состояния)

| # | Описание | Статус |
|---|----------|--------|
| S1.1 | Вкладка Sprint в `#focusTabs` и контейнер `#focus-sprint` в `#view-focus`, вызов `SprintUI.render()` в `switchSub` | ✅ Done (коммит `e30b923`) |
| S1.2 | Экран подготовки: длительность сессии, расчёт T-минус, кнопки Load tasks, Queue (N), Start sprint, схема JSON | ✅ Done (коммит `251feb0`) |
| S1.3 | Боевой оверлей `#sprint-overlay` (#05070b): телеметрия, статус GO/HOLD, таймер clamp MM:SS, SVG-кольцо r=150, текущая задача, кнопки DONE/BLOCKER/PAUSE/+5 MIN/Abort | ✅ Done (коммит `f16da2c`) |
| S1.4 | Модалка "Load tasks": textarea 16px, выбор JSON-файла, пример схемы, вызов `SprintQueue.load()` | ✅ Done (коммит `03cd9cd`) |
| S1.5 | Шторка очереди `.modal-card`: статусы (queued/active/done/frozen), кнопка Unfreeze, блок DANGER ZONE с двойным confirm Flush queue | ✅ Done (коммит `ad14500`) |
| S1.6 | Экраны OVERFLOW (очередь пуста, сессия активна) и FINISHED (сводка сделанного, замороженного, кристаллов, длительности, кнопка Close) | ✅ Done (коммит `bf0cda8`) |
| S1.7 | `SprintStore` по контракту (get/set/subscribe/reset, localStorage `nova-sprint`, try/catch, fallback), высокопроизводительный `tickDisplay(msLeft)` (чистый `textContent`, смена цвета белый/янтарный/красный без мигания) | ✅ Done (коммит `8728566`) |
| S1.8 | SpaceX-стиль: кнопки от 48px, поля 16px, акцент `#FF3B30` только на опасных действиях, 360px без скролла, переходы opacity 150ms с отключением в `html.lite` и `prefers-reduced-motion` | ✅ Done (коммит `0df77ef`) |

---

## DECISIONS

1. **H1: Safe-area top padding на мобильных экранах**
   - *Выбор:* Правила добавлены строго внутрь медиа-запроса `@media (max-width: 767px)` в `index.html`. Для `main` задан отступ `calc(max(env(safe-area-inset-top, 0px), 16px) + 14px) !important`, для `.modal` — `padding-top: calc(max(env(safe-area-inset-top, 0px), 16px) + 8px);`, для стеков уведомлений `#toast-stack` и `#alarm-stack` — `top: calc(max(env(safe-area-inset-top, 0px), 16px) + 10px) !important;`.
   - *Причина:* Предотвращает наползание заголовков и модальных окон на часы и динамический остров iPhone (Dynamic Island), сохраняя оригинальный отступ и пиксель-в-пиксель верстку на десктопе.

2. **H2: Защита модальных полей от горизонтального скролла на 360px**
   - *Выбор:* Сброшены специфичные для iOS ограничения инпутов Date/Time (`-webkit-appearance: none; appearance: none; width: 100%; min-width: 0; box-sizing: border-box;`). Для контейнера `#event-time-fields` на мобильных экранах задана 2-колоночная сетка `grid-template-columns: repeat(2, minmax(0, 1fr))` с `gap: 12px` и сбросом `min-width: 0` у дочерних элементов. В `html` и `body` задан `overflow-x: hidden`.
   - *Причина:* Позволяет всем полям форм (включая выбор даты и интервалов времени) комфортно помещаться в экраны шириной от 360px без появления нежелательного горизонтального скролла.

3. **G1: Обработка задач без времени в голосовом вводе**
   - *Выбор:* В функции `buildGoalFromDraft`: если у распознанной сущности нет поля `it.time`, то `scheduledAt` устанавливается на 23:59 текущего/выбранного дня, `allDay = true`, а `isEvent = false`. Если время указано, `isEvent = (it.kind === 'event')`. Итоговый флаг `allDay = (allDay && !isEvent)`.
   - *Причина:* Соответствует поведению ручного сохранения в `TaskController.save`, гарантируя корректное отображение в списках задач на день и исключая ложное добавление в почасовую сетку календаря.

4. **B4: Boss of the Day, Комбо-стрики и Достижения**
   - *Выбор:* Состояния `dailyBoss` и `achievements` интегрированы в `StateManager` (с ключами `nova-daily-boss` и `nova-achievements`), включены в тело `doSync` и белый список `api/sync.js`. Конфетти при победе над Боссом реализовано на легковесном canvas без блюра и автоматически отключается в `lite`-режиме и при `prefers-reduced-motion`.
   - *Причина:* Обеспечивает полную обратную совместимость старых данных, соблюдение мобильных ограничений по производительности и отсутствие лишних рендеров.

5. **B3: Аналитика и еженедельный обзор (Insights & Weekly Review)**
   - *Выбор:* Все графики (Heatmap 26 недель, Donut chart фокуса, Hourly productivity histogram) построены на легковесном инлайн SVG без сторонних библиотек. Вызов `InsightsRenderer.render()` привязан исключительно к открытию профиля и переключению табов статистики, что гарантирует нулевую нагрузку при обычных манипуляциях с задачами.
   - *Причина:* Предотвращает OOM и тормоза на мобильных устройствах, сохраняя информативность и эстетику UI.

6. **B2: Алгоритм DayPlanner (Plan My Day)**
   - *Выбор:* Реализован модуль `DayPlanner`:
     - Скоринг кандидатов учитывает приоритет, просроченность и близость дедлайна родительского проекта.
     - Окно дня строится по `sleepSettings` с защитой от прошедшего времени (округление до ближайших 10 минут).
     - Поиск свободных окон `findFreeSlots()` учитывает события и синтетические рутины `getGhostOccurrences()`.
     - Задачи >120 минут автоматически разбиваются на равные части («Part 1/2», «Part 2/2»).
     - Размещение first-fit с правилом 90/15 (вставка 15-минутной паузы при достижении 90 минут непрерывной работы) и буфером 10 минут между делами.
     - Режим Shuffle переключает приоритет между ранними (утро) и поздними (вечер) слотами без потери высокоприоритетных задач.
     - Принятие расписания выполняет единственный вызов `StateManager.pushUndoSnapshot('Plan my day')` и единый `refreshEverything()`, после чего выводится тост с возможностью отмены.
   - *Причина:* Обеспечивает эргономичное планирование дня в один клик без фризов, спама синхронизаций и дублирующих перерисовок.

7. **S1-1: Уровень z-index боевого оверлея (#sprint-overlay z-index: 9990)**
   - *Выбор:* Установлен `z-index: 9990`. Он перекрывает сайдбар и нижний бар мобильной навигации (z-index: 9000), исключая случайные нажатия во время спринта, но находится ниже всплывающих окон `.modal` (начинаются с 10001) и стека уведомлений `#toast-stack`/`#alarm-stack` (20000).
   - *Причина:* Соответствует контракту «z-index ниже toast/alarm», блокирует отвлечение на остальное приложение и обеспечивает корректное открытие модалки добавления задач и очереди поверх оверлея.

8. **S1-2: Разделение реактивности SprintUI.render() и SprintUI.tickDisplay(msLeft)**
   - *Выбор:* Метод `SprintUI.render()` вызывается исключительно при смене фазы (`phase`) или структурных модификациях (`queue`, `activeId`, `stats`). Секундный тик (`tickDisplay(msLeft)`) обновляет только свойства `textContent`, `setAttribute('stroke-dashoffset')` и цвет `style.color`/`setAttribute('stroke')` без какого-либо обращения к `innerHTML`.
   - *Причина:* Предотвращает деградацию производительности, потерю фокуса и возможные OOM-сбои в мобильном Safari при ежесекундном обновлении.

9. **S1-3: Статическая раскладка экранов внутри #sprint-overlay**
   - *Выбор:* В оверлее созданы три статичных контейнера `#sprint-overlay-combat`, `#sprint-overlay-overflow` и `#sprint-overlay-finished`, переключаемых классами `hidden`/`flex`.
   - *Причина:* Соответствует правилу Single Render приложения Nova OS — DOM-узлы и SVG-кольцо создаются однажды при загрузке, минимизируя нагрузку на сборщик мусора движка браузера.

10. **S1-4: Защита активного ввода в поле длительности сессии**
    - *Выбор:* В `SprintUI.render()` значение `input.value` поля `#sprint-session-min` обновляется только при условии `document.activeElement !== minInput`.
    - *Причина:* Пользователь может комфортно вводить число с экранной клавиатуры мобильного телефона без сброса курсора и сброса промежуточного ввода.

---

> Последнее обновление: 2026-10-05
