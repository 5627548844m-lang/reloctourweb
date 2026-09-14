/**
 * RELÓCTOUR — прокси между сайтом и ботом.
 *
 * Ключ доступа живёт здесь, на сервере. Напрямую сайт в бота не ходит:
 * иначе ключ окажется в браузере у любого посетителя.
 *
 * Наружу:
 *   GET  /.netlify/functions/slots?country=th
 *   POST /.netlify/functions/slots   { slot_id, name, contact, email }
 *
 * Переменные окружения Netlify:
 *   BOT_API_URL   адрес бота на Railway, без слэша в конце
 *   WEB_API_KEY   тот же секрет, что в Railway
 */

const BOT = (process.env.BOT_API_URL || "").replace(/\/+$/, "");
const KEY = process.env.WEB_API_KEY || "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

function reply(status, data) {
  return { statusCode: status, headers: CORS, body: JSON.stringify(data) };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: CORS, body: "" };
  }

  if (!BOT || !KEY) {
    // настройка не завершена — сайт покажет запасной путь в Telegram
    return reply(503, { error: "not_configured" });
  }

  const timeout = (ms) => new Promise((_, rej) =>
    setTimeout(() => rej(new Error("timeout")), ms));

  try {
    if (event.httpMethod === "GET") {
      const country = (event.queryStringParameters || {}).country || "";
      if (!country) return reply(400, { error: "country_required" });

      const res = await Promise.race([
        fetch(`${BOT}/api/slots?country=${encodeURIComponent(country)}`, {
          headers: { "X-Api-Key": KEY },
        }),
        timeout(8000),
      ]);
      const data = await res.json();
      return reply(res.status, data);
    }

    if (event.httpMethod === "POST") {
      let body;
      try {
        body = JSON.parse(event.body || "{}");
      } catch {
        return reply(400, { error: "bad_json" });
      }

      const res = await Promise.race([
        fetch(`${BOT}/api/hold`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Api-Key": KEY },
          body: JSON.stringify({
            slot_id: body.slot_id,
            name: body.name,
            contact: body.contact,
            email: body.email || "",
          }),
        }),
        timeout(10000),
      ]);
      const data = await res.json();
      return reply(res.status, data);
    }

    return reply(405, { error: "method_not_allowed" });
  } catch (e) {
    // бот спит, деплоится или недоступен — сайт предложит Telegram
    return reply(502, { error: "bot_unreachable" });
  }
};
