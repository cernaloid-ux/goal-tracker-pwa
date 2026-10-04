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

## Часть A — Исправления (статусы)

| # | Описание | Статус |
|---|----------|--------|
| A1 | Auth: getSyncKey, getUid guard, x-nova-key header, api/sync.js 401 guard | ✅ Done (предыдущая сессия) |
| A2 | StateManager.set UI_ONLY, activeTaskId, sync-v2 migration, auto-refresh | ✅ Done |
| A3 | Priority sort `\|\|1` → `??1` (4 места) | ✅ Done |
| A4 | Timer: elapsed save (a), _armEndTimer background tab (b), resume after reload (c), pause prev on switch (d) | ✅ Done |
| A5 | Reminders: setTimeout overflow >24.8d, ghost occurrences missing | ✅ Done |
| A6 | Routines: days field ignored, one-time alarms, streak reset | ✅ Done |
| A7 | Task form: allDay flag, hidden time-from defaults, time-to wrapping | ❌ TODO |
| A8 | NLP dryRun on input keystroke | ✅ Done |
| A9 | Calendar: tap earlyCancel, addEventListener leak, overlap layout, now-line, month drag | ❌ TODO |
| A10 | Level from lifetime gems; stats exclude projects | ✅ Done |
| A11 | Uncomplete removes history entry, reverts exact gem amount | ✅ Done |
| A12 | Project gemsReward payment on leaf completion (settleProjectRewards) | ✅ Done |
| A13 | Misc: error handler extension filter, store label, creative→life filter, resetData clears cloud first, exportData strips tokens, Import button | ✅ Done |

---

## Часть B — Новые функции

| # | Описание | Статус |
|---|----------|--------|
| B1 | Smart Dictation 2.0 — api/parse-voice.js (Gemini), DictationController, voice modal redesign | ❌ TODO |
| B2 | Plan My Day — автопланировщик, findFreeSlots(), Accept/Shuffle UI | ❌ TODO |
| B3 | Insights & Weekly Review — SVG heatmap, donut chart, productivity bars | ❌ TODO |
| B4 | Boss of the Day + Achievements (~12) + Combo system | ❌ TODO |
| B5 | Appearance Studio — accent color, glass blur/opacity, density, font size | ❌ TODO |

---

## Часть C — Верификация

| # | Описание | Статус |
|---|----------|--------|
| C1 | `node --check app.js api/*.js` | ✅ Done (чисто) |
| C2 | `grep -r "^import\|^export" api/` | ✅ Done (только CommonJS) |
| C3 | Manual test checklist (8 пунктов) | ❌ TODO |

---

## A2 — Следующий приоритет (первый невыполненный)

**Что осталось из A2:**
- `setInterval(()=>SyncManager.loadFromCloud({silent:true}), 60000)` в DOMContentLoaded
- `document.addEventListener('visibilitychange', ()=>{ if(!document.hidden) SyncManager.loadFromCloud({silent:true}); })` в DOMContentLoaded

**Затем A4 (timer fixes).**

---

> Последнее обновление: 2026-10-03
