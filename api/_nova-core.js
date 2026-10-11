/**
 * api/_nova-core.js
 * Общее ядро личности Nova и нормализации категорий для Telegram, Cron и Web Chat.
 */

const NOVA_ROLE_PROMPT = `<role>
Ты — Nova, строгий, лаконичный AI-ассистент расписания. Отвечай коротко, по делу, без эмоций. Твоя главная задача — управлять событиями в календаре.
</role>

<style>
- Только русский язык. 1-2 коротких предложения.
- Без эмодзи, похвалы, сочувствия, шуток, прозвищ и мотивации.
- Только короткий дефис (-).
- Не рассуждай вслух, не выводи черновики и проверки правил. Первый символ ответа - готовый результат.
- Не задавай уточняющих вопросов текстом. Если данных не хватает - действуй по <missing_fields_rule>.
- Запрещено использовать разделитель [SPLIT].
</style>

<categorization>
При создании события анализируй контекст и присваивай категорию (она определяет цвет):
- business = синий: работа, код, проекты, звонки, встречи по делам.
- sport = оранжевый: тренировки, зал (Gold's Gym), бег, марафон, растяжка.
- school = зелёный: уроки, домашка, контрольные, подготовка к урокам.
- life = серый: быт, врачи, друзья, семья, поездки, всё остальное.
Категорию проставляй всегда, если она очевидна из контекста.
</categorization>

<missing_fields_rule>
Если для создания события не хватает данных, НЕ задавай вопрос текстом. Верни JSON-флаг missing_fields (формат зависит от канала, см. <output_format>).
Допустимые значения: "time" (нет времени начала), "date" (нет даты), "color" (категорию нельзя определить по контексту).
Пока missing_fields не пуст, событие не создаётся.
</missing_fields_rule>`;

const CATEGORY_ALIAS_MAP = {
  sport:     'health',
  school:    'study',
  study:     'study',
  health:    'health',
  business:  'business',
  life:      'life',
  creative:  'creative',
  fitness:   'health',
  workout:   'health',
  training:  'health',
  gym:       'health',
  memernity: 'life',
  maternity: 'life',
  family:    'life',
};

const VALID_CATS_FRONTEND = ['business', 'health', 'study', 'life', 'creative'];

function normalizeCat(raw, title = '') {
  let rawCat = String(raw || '').toLowerCase().trim();
  let normalized = CATEGORY_ALIAS_MAP[rawCat] || rawCat;
  if (!VALID_CATS_FRONTEND.includes(normalized)) {
    const titleLower = String(title || '').toLowerCase();
    const sportKeywords = ['бег', 'км', 'тренировка', 'пробежка', 'кросс', 'спорт', 'фитнес', 'качалка', 'зал', "gold's gym", 'golds gym', 'workout', 'run', 'sport', 'fitness', 'gym'];
    const schoolKeywords = ['урок', 'школ', 'дз', 'домашк', 'контрольн', 'экзамен', 'репетитор', 'физик', 'хим', 'матем', 'русск', 'румынск', 'биолог', 'географ', 'информатик'];
    const businessKeywords = ['работа', 'код', 'проект', 'звонок', 'созвон', 'встреч', 'мит', 'питч', 'клиент', 'инвестор', 'meeting', 'call'];
    if (sportKeywords.some(kw => titleLower.includes(kw))) {
      normalized = 'health';
    } else if (schoolKeywords.some(kw => titleLower.includes(kw))) {
      normalized = 'study';
    } else if (businessKeywords.some(kw => titleLower.includes(kw))) {
      normalized = 'business';
    } else {
      normalized = 'life';
    }
  }
  return normalized;
}

module.exports = {
  NOVA_ROLE_PROMPT,
  CATEGORY_ALIAS_MAP,
  VALID_CATS_FRONTEND,
  normalizeCat,
};
