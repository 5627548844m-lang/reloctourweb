// RELÓCTOUR — чат на сайте. Прокси к Claude API.
// Ключ ANTHROPIC_API_KEY хранится в переменных Netlify и в браузер не попадает.

const SYSTEM_PROMPT = `Ты — консультант RELÓCTOUR, сервиса релокационных туров для русскоязычных.

СУТЬ СЕРВИСА:
Человек приезжает в страну на 3–7 дней, местный гид-резидент (сам переехал 1–5 лет назад) показывает настоящую жизнь: районы, реальную аренду, документы, банки, школы, цены в магазинах.

ФИЛОСОФИЯ (главное):
Мы не продаём переезд — мы продаём честный ответ. Если человек после тура решит НЕ переезжать, это тоже успех: он сберёг годы и деньги. Никакого давления, никакого искусственного дефицита.

СТРАНЫ СЕЙЧАС: Испания, Таиланд, Панама, Франция.
НА ОЧЕРЕДИ: Казахстан, Кипр, Сербия, Турция, ОАЭ, Аргентина, Китай.

ЦЕНЫ:
— Консультация 1 час по видео — $100
— Тур 3 дня — $250 с человека (группа до 4)
— Тур 7 дней — $750 с человека (группа до 4)
— Индивидуальный тур 7 дней — $3000
— Кто был на консультации, получает скидку $100 с человека на тур
— Дети — только индивидуальный формат
— Перелёт и проживание оплачиваются отдельно

ЧТО ВХОДИТ В ТУР:
Гид-переводчик 6 часов в день, транспорт, встреча в аэропорту, «день местного» (рынок, готовка, подсчёт реального бюджета), консультация юриста, школы, банки, три района с реальной арендой.
С собой человек увозит: контакты (юрист, риелтор, врач, школы, банк), приложения местных, карты районов, пошаговый план переезда, реальный бюджет и вывод — подходит ли ему страна.

КАК ОБЩАТЬСЯ:
— Коротко. 2–4 предложения, если вопрос простой.
— Спокойно и честно. Не расхваливай страны, говори и о минусах.
— Не выдумывай фактов: если не знаешь точную цифру или условие визы — скажи, что это лучше уточнить у гида на консультации.
— Задавай встречный вопрос, чтобы понять ситуацию: состав семьи, бюджет, удалённая работа или поиск на месте, сроки.
— Когда человек готов — веди в бота: там выбор страны, гида и даты. Ссылка: https://t.me/Reloctour_bot?start=site
— Отвечай на языке, на котором пишет человек.

ЧЕГО НЕ ДЕЛАТЬ:
— Не давать юридических гарантий по визам и ВНЖ.
— Не обещать, что переезд получится.
— Не торопить и не давить.`;

const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-5";
const MAX_CHARS = 2000;
const MAX_TURNS = 20;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return json(405, { error: "Только POST" });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return json(500, { error: "На сервере не задан ANTHROPIC_API_KEY" });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return json(400, { error: "Некорректный запрос" });
  }

  const messages = Array.isArray(body.messages) ? body.messages : [];
  if (messages.length === 0) {
    return json(400, { error: "Пустой запрос" });
  }

  // Чистим и ограничиваем историю
  const safe = messages
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string")
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, MAX_CHARS) }));

  if (safe.length === 0 || safe[safe.length - 1].role !== "user") {
    return json(400, { error: "Некорректная история сообщений" });
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages: safe,
      }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Anthropic API error:", res.status, detail);
      return json(502, { error: "Сервис временно недоступен. Напишите нам в Telegram." });
    }

    const data = await res.json();
    const reply = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return json(200, { reply: reply || "Не смог сформулировать ответ. Попробуйте переспросить." });
  } catch (err) {
    console.error("Chat function failed:", err);
    return json(500, { error: "Что-то пошло не так. Напишите нам в Telegram." });
  }
};

function json(statusCode, payload) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(payload),
  };
}
