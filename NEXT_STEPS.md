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
11. **Tailwind CDN** — ⚠️ ПРОПУЩЕНО (потребует отдельной сборки tailwind CLI, заняло бы > 15 минут)

---

## Пакет F — Допроверки

| # | Описание | Статус |
|---|----------|--------|
| F1 | Viewport `width=device-width, initial-scale=1, viewport-fit=cover` & 16px font-size for mobile inputs | ✅ Done (коммит `df4c708`) |
| F2 | resetData cloud flush with empty state & preserve `nova-sync-key` | ✅ Verified (строки `3631-3648` app.js) |
| F3 | importData single input cleanup & listener verification | ✅ Done (коммит `fb167e8`) |
| F4 | renderCategoryFilters catKey normalization (`creative` → `life`) | ✅ Done (коммит `fea24ce`) |
| F5 | Modal accessibility: `.modal-card`, `role="dialog"`, `aria-label="Close"` | ✅ Done (коммит `d9e43ee`) |

---

## Часть A — Исправления (статусы)

| # | Описание | Статус |
|---|----------|--------|
| A1 | Auth & Sync Key: `NOVA_SYNC_KEY` in `api/sync.js`, `x-nova-key` header in doSync/loadFromCloud, guest uid isolation, token strip in exportData | ✅ Done (коммит `311b7b9`) |
| A2 | StateManager.set UI_ONLY, activeTaskId, sync-v2 migration, auto-refresh | ✅ Done |
| A3 | Priority sort `\|\|1` → `??1` (4 места) | ✅ Done |
| A4 | Timer: elapsed save (a), _armEndTimer background tab (b), resume after reload (c), pause prev on switch (d) | ✅ Done |
| A5 | Reminders: setTimeout overflow >24.8d, ghost occurrences missing | ✅ Done |
| A6 | Routines: days field ignored, one-time alarms, streak reset | ✅ Done |
| A7 | Task form: allDay flag, hidden time-from defaults, time-to wrapping | ✅ Done |
| A8 | NLP dryRun on input keystroke | ✅ Done |
| A9 | Calendar: tap earlyCancel, addEventListener leak, overlap layout, now-line, month drag | ✅ Done |
| A10 | Level from lifetime gems; stats exclude projects | ✅ Done |
| A11 | Uncomplete removes history entry, reverts exact gem amount | ✅ Done |
| A12 | Project gemsReward payment on leaf completion (settleProjectRewards) | ✅ Done |
| A13 | Misc: error handler extension filter, store label, creative→life filter, resetData clears cloud first, exportData strips tokens, Import button | ✅ Done |

---

## Часть B — Новые функции

| # | Описание | Статус |
|---|----------|--------|
| B1.1 | Serverless endpoint `api/parse-voice.js` (Gemini API, CommonJS, schema validation) | ✅ Done (коммит `b1e2047`) |
| B1.2 | UI redesign of `#modal-voice` (chips RU/RO/EN, big mic, calendar header mic button) | ✅ Done (коммит `e2cb812`) |
| B1.3 | DictationController client + `NLP.parseMulti` offline fallback (8s abort timeout) | ✅ Done (коммит `e8a7b13`) |
| B1.4 | Voice Draft Board with collision check (incl. ghost recurrences) & `TaskController.openModal` prefill | ✅ Done (коммит `6b177a5`) |
| B1.5 | Batch commit (`buildGoalFromDraft`, single undo snapshot, sync & reminders schedule, undoable toast) | ✅ Done (коммит `837f76b`) |
| B2 | Plan My Day — автопланировщик, findFreeSlots(), Accept/Shuffle UI | ❌ TODO (не тронуто) |
| B3 | Insights & Weekly Review — SVG heatmap, donut chart, productivity bars | ❌ TODO (не тронуто) |
| B4 | Boss of the Day + Achievements (~12) + Combo system | ❌ TODO (не тронуто) |
| B5 | Appearance Studio — accent color, glass blur/opacity, density, font size | ❌ TODO (не тронуто) |

---

## Часть C — Верификация

| # | Описание | Статус |
|---|----------|--------|
| C1 | `node --check app.js api/*.js` | ✅ Done (чисто) |
| C2 | `grep -r "^import\|^export" api/` | ✅ Done (только CommonJS) |
| C3 | Manual test checklist (8 пунктов) | ❌ TODO |

---

## DECISIONS

1. **A1: Sync Key & Guest Isolation (`api/sync.js`)**
   - *Выбор:* При запросе от `master_admin_id` строго проверяется `x-nova-key === process.env.NOVA_SYNC_KEY`. Для гостевых сессий (`guest_...`) данные изолируются в отдельный KV-ключ `цель:${clientUserId}` без краша интерфейса.
   - *Причина:* Защищает данные владельца от перезаписи неавторизованными пользователями, сохраняя при этом работоспособность локальных тестов и гостевых визитов.

2. **B1.1: CommonJS и Gemini API в Serverless (`api/parse-voice.js`)**
   - *Выбор:* Использована реализация `fetch` к Google Gemini Generative Language API без внешних SDK, с валидацией входных данных и строгим форматом ответа JSON schema.
   - *Причина:* Соответствует правилу CommonJS (`require`/`module.exports`) и предотвращает сбои рантайма Vercel Serverless Function.

3. **B1.3: Офлайн-парсер `NLP.parseMulti`**
   - *Выбор:* Многосоставной парсер разбивает речь по разделителям («и еще», «затем», «потом», «также», переносы строк, `;`), извлекает дни недели, относительные даты («сегодня», «завтра», «послезавтра»), форматы времени/длительности, приоритеты и категории, подставляя `defaultDate` календаря.
   - *Причина:* Обеспечивает полную автономность системы: при отсутствии сети или сбоях AI парсинг не падает, а выводит черновики с пометкой низкой уверенности для ручной корректировки.

4. **B1.4: Проверка коллизий с учётом Ghost-событий**
   - *Выбор:* Метод `_checkCollision` проверяет пересечения не только с обычными делами и событиями, но и с синтетическими повторениями через `getGhostOccurrences`.
   - *Причина:* Предотвращает назначение встреч на время, уже занятое регулярными рутинами или еженедельными митингами.

5. **B1.5: Атомарное пакетное сохранение с отменой**
   - *Выбор:* Делается один снапшот `StateManager.pushUndoSnapshot('Голосовой ввод')` перед добавлением всех выбранных дел в массив `goals`. После сохранения выводится тост с интерактивной кнопкой «Отменить».
   - *Причина:* Позволяет пользователю в один клик отменить добавление целой пачки распознанных дел, если результат не устроил.

---

> Последнее обновление: 2026-10-04
